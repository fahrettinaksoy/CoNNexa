//! Oturum yaşam döngüsü yöneticisi.
//!
//! Protokoller: local (portable-pty), ssh (russh shell), telnet (ham TCP),
//! serial (serialport). VNC/RDP oturumları proxy modülünce eklenir (Passive).
//! Çıktı hem Tauri event'lerine yayınlanır hem (kayıt aktifse) asciicast'e yazılır.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex as StdMutex};

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use tauri::AppHandle;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::mpsc;

use crate::events::{emit_exit, emit_output};
use crate::recording::{make_filename, recordings_dir, RecordingWriter};
use crate::ssh::{self, SshAuth, SshHandle};
use crate::types::{Protocol, SessionDescriptor};

type Recorders = Arc<StdMutex<HashMap<String, RecordingWriter>>>;

/// Çıktıyı event'e yayınlar ve (kayıt aktifse) asciicast'e yazar.
#[derive(Clone)]
struct OutputSink {
    app: AppHandle,
    recorders: Recorders,
    id: String,
}

impl OutputSink {
    fn out(&self, data: &str) {
        emit_output(&self.app, &self.id, data);
        if let Ok(mut map) = self.recorders.lock() {
            if let Some(rec) = map.get_mut(&self.id) {
                rec.write_chunk(data);
            }
        }
    }
    fn exit(&self, message: Option<&str>) {
        emit_exit(&self.app, &self.id, message);
        if let Ok(mut map) = self.recorders.lock() {
            map.remove(&self.id);
        }
    }
}

enum Control {
    Write(Vec<u8>),
    Resize(u16, u16),
    Close,
}

struct PtyIo {
    writer: StdMutex<Box<dyn Write + Send>>,
    master: StdMutex<Box<dyn MasterPty + Send>>,
    child: StdMutex<Box<dyn Child + Send + Sync>>,
}

enum SessionIo {
    Channel(mpsc::UnboundedSender<Control>),
    Pty(Arc<PtyIo>),
    Serial {
        writer: StdMutex<Box<dyn serialport::SerialPort>>,
        running: Arc<AtomicBool>,
    },
    Passive(Option<Box<dyn FnOnce() + Send>>),
}

struct LiveSession {
    #[allow(dead_code)]
    descriptor: SessionDescriptor,
    io: SessionIo,
    ssh: Option<SshHandle>,
}

#[derive(Clone)]
pub struct SessionManager {
    app: AppHandle,
    sessions: Arc<StdMutex<HashMap<String, LiveSession>>>,
    recorders: Recorders,
}

impl SessionManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            sessions: Arc::new(StdMutex::new(HashMap::new())),
            recorders: Arc::new(StdMutex::new(HashMap::new())),
        }
    }

    fn sink(&self, id: &str) -> OutputSink {
        OutputSink {
            app: self.app.clone(),
            recorders: self.recorders.clone(),
            id: id.to_string(),
        }
    }

    fn insert(&self, id: String, session: LiveSession) {
        self.sessions.lock().unwrap().insert(id, session);
    }

    // ---- Yerel PTY ----

    pub fn create_local(&self, cols: u16, rows: u16) -> Result<SessionDescriptor, String> {
        let id = new_id();
        let pty = native_pty_system();
        let pair = pty
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("pty açılamadı: {e}"))?;

        let shell = default_shell();
        let mut cmd = CommandBuilder::new(&shell);
        if let Some(home) = home_dir() {
            cmd.cwd(home);
        }
        for (k, v) in std::env::vars() {
            cmd.env(k, v);
        }
        cmd.env("TERM", "xterm-256color");

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("kabuk başlatılamadı: {e}"))?;
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("pty reader hatası: {e}"))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("pty writer hatası: {e}"))?;

        let io = Arc::new(PtyIo {
            writer: StdMutex::new(writer),
            master: StdMutex::new(pair.master),
            child: StdMutex::new(child),
        });

        let sink = self.sink(&id);
        std::thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => {
                        sink.exit(None);
                        break;
                    }
                    Ok(n) => sink.out(&String::from_utf8_lossy(&buf[..n])),
                }
            }
        });

        let descriptor = descriptor(&id, "Yerel", Protocol::Local, None);
        self.insert(
            id,
            LiveSession {
                descriptor: descriptor.clone(),
                io: SessionIo::Pty(io),
                ssh: None,
            },
        );
        Ok(descriptor)
    }

    // ---- SSH ----

    #[allow(clippy::too_many_arguments)]
    pub async fn create_ssh(
        &self,
        host_id: String,
        title: String,
        addr: String,
        port: u16,
        auth: SshAuth,
        startup: Option<String>,
        cols: u16,
        rows: u16,
    ) -> Result<SessionDescriptor, String> {
        let handle = ssh::connect(&addr, port, auth).await?;
        let channel = ssh::open_shell(&handle, cols, rows, startup.as_deref()).await?;
        let id = new_id();
        let (tx, mut rx) = mpsc::unbounded_channel::<Control>();
        let sink = self.sink(&id);

        tauri::async_runtime::spawn(async move {
            let mut channel = channel;
            loop {
                tokio::select! {
                    msg = channel.wait() => match msg {
                        Some(russh::ChannelMsg::Data { data }) => {
                            sink.out(&String::from_utf8_lossy(&data));
                        }
                        Some(russh::ChannelMsg::ExtendedData { data, .. }) => {
                            sink.out(&String::from_utf8_lossy(&data));
                        }
                        Some(russh::ChannelMsg::ExitStatus { exit_status }) => {
                            sink.exit(Some(&format!("exit {exit_status}")));
                            break;
                        }
                        Some(russh::ChannelMsg::Eof) | Some(russh::ChannelMsg::Close) | None => {
                            sink.exit(None);
                            break;
                        }
                        _ => {}
                    },
                    ctrl = rx.recv() => match ctrl {
                        Some(Control::Write(b)) => { let _ = channel.data(&b[..]).await; }
                        Some(Control::Resize(c, r)) => {
                            let _ = channel.window_change(c as u32, r as u32, 0, 0).await;
                        }
                        Some(Control::Close) | None => {
                            let _ = channel.eof().await;
                            sink.exit(None);
                            break;
                        }
                    }
                }
            }
        });

        let descriptor = descriptor(&id, &title, Protocol::Ssh, Some(host_id));
        self.insert(
            id,
            LiveSession {
                descriptor: descriptor.clone(),
                io: SessionIo::Channel(tx),
                ssh: Some(handle),
            },
        );
        Ok(descriptor)
    }

    // ---- Telnet ----

    pub async fn create_telnet(
        &self,
        host_id: String,
        title: String,
        addr: String,
        port: u16,
    ) -> Result<SessionDescriptor, String> {
        let stream = tokio::net::TcpStream::connect((addr.as_str(), port))
            .await
            .map_err(|e| format!("telnet bağlanamadı: {e}"))?;
        let id = new_id();
        let (tx, mut rx) = mpsc::unbounded_channel::<Control>();
        let sink = self.sink(&id);

        tauri::async_runtime::spawn(async move {
            let (mut rd, mut wr) = stream.into_split();
            let mut buf = [0u8; 8192];
            loop {
                tokio::select! {
                    r = rd.read(&mut buf) => match r {
                        Ok(0) | Err(_) => { sink.exit(None); break; }
                        Ok(n) => {
                            // latin1: her byte doğrudan U+00XX
                            let s: String = buf[..n].iter().map(|&b| b as char).collect();
                            sink.out(&s);
                        }
                    },
                    ctrl = rx.recv() => match ctrl {
                        Some(Control::Write(b)) => { let _ = wr.write_all(&b).await; }
                        Some(Control::Resize(_, _)) => {}
                        Some(Control::Close) | None => { sink.exit(None); break; }
                    }
                }
            }
        });

        let descriptor = descriptor(&id, &title, Protocol::Telnet, Some(host_id));
        self.insert(
            id,
            LiveSession {
                descriptor: descriptor.clone(),
                io: SessionIo::Channel(tx),
                ssh: None,
            },
        );
        Ok(descriptor)
    }

    // ---- Serial ----

    pub fn create_serial(
        &self,
        host_id: String,
        title: String,
        device: String,
        baud: u32,
    ) -> Result<SessionDescriptor, String> {
        let port = serialport::new(&device, baud)
            .timeout(std::time::Duration::from_millis(200))
            .open()
            .map_err(|e| format!("serial açılamadı: {e}"))?;
        let mut reader = port
            .try_clone()
            .map_err(|e| format!("serial klonlanamadı: {e}"))?;
        let running = Arc::new(AtomicBool::new(true));
        let id = new_id();

        let sink = self.sink(&id);
        let run2 = running.clone();
        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            while run2.load(Ordering::Relaxed) {
                match reader.read(&mut buf) {
                    Ok(0) => continue,
                    Ok(n) => sink.out(&String::from_utf8_lossy(&buf[..n])),
                    Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => continue,
                    Err(_) => {
                        sink.exit(None);
                        break;
                    }
                }
            }
        });

        let descriptor = descriptor(&id, &title, Protocol::Serial, Some(host_id));
        self.insert(
            id,
            LiveSession {
                descriptor: descriptor.clone(),
                io: SessionIo::Serial {
                    writer: StdMutex::new(port),
                    running,
                },
                ssh: None,
            },
        );
        Ok(descriptor)
    }

    // ---- VNC/RDP (Passive) ----

    pub fn insert_passive(
        &self,
        descriptor: SessionDescriptor,
        on_close: Option<Box<dyn FnOnce() + Send>>,
    ) {
        let id = descriptor.id.clone();
        self.insert(
            id,
            LiveSession {
                descriptor,
                io: SessionIo::Passive(on_close),
                ssh: None,
            },
        );
    }

    // ---- I/O ----

    pub fn write(&self, id: &str, data: &str) {
        let map = self.sessions.lock().unwrap();
        if let Some(s) = map.get(id) {
            match &s.io {
                SessionIo::Channel(tx) => {
                    let _ = tx.send(Control::Write(data.as_bytes().to_vec()));
                }
                SessionIo::Pty(io) => {
                    if let Ok(mut w) = io.writer.lock() {
                        let _ = w.write_all(data.as_bytes());
                        let _ = w.flush();
                    }
                }
                SessionIo::Serial { writer, .. } => {
                    if let Ok(mut w) = writer.lock() {
                        let _ = w.write_all(data.as_bytes());
                    }
                }
                SessionIo::Passive(_) => {}
            }
        }
    }

    pub fn resize(&self, id: &str, cols: u16, rows: u16) {
        let map = self.sessions.lock().unwrap();
        if let Some(s) = map.get(id) {
            match &s.io {
                SessionIo::Channel(tx) => {
                    let _ = tx.send(Control::Resize(cols, rows));
                }
                SessionIo::Pty(io) => {
                    if let Ok(m) = io.master.lock() {
                        let _ = m.resize(PtySize {
                            rows,
                            cols,
                            pixel_width: 0,
                            pixel_height: 0,
                        });
                    }
                }
                _ => {}
            }
        }
    }

    pub fn close(&self, id: &str) {
        let session = self.sessions.lock().unwrap().remove(id);
        if let Some(s) = session {
            match s.io {
                SessionIo::Channel(tx) => {
                    let _ = tx.send(Control::Close);
                }
                SessionIo::Pty(io) => {
                    if let Ok(mut c) = io.child.lock() {
                        let _ = c.kill();
                    }
                }
                SessionIo::Serial { running, .. } => {
                    running.store(false, Ordering::Relaxed);
                }
                SessionIo::Passive(on_close) => {
                    if let Some(f) = on_close {
                        f();
                    }
                }
            }
            self.recorders.lock().unwrap().remove(id);
            if let Some(handle) = s.ssh {
                tauri::async_runtime::spawn(async move { ssh::disconnect(&handle).await });
            }
        }
    }

    pub fn get_ssh(&self, id: &str) -> Option<SshHandle> {
        self.sessions
            .lock()
            .unwrap()
            .get(id)
            .and_then(|s| s.ssh.clone())
    }

    /// Aktif SSH oturumları: (session_id, başlık).
    pub fn ssh_sessions(&self) -> Vec<(String, String)> {
        self.sessions
            .lock()
            .unwrap()
            .iter()
            .filter(|(_, s)| s.ssh.is_some())
            .map(|(id, s)| (id.clone(), s.descriptor.title.clone()))
            .collect()
    }

    pub fn dispose_all(&self) {
        let ids: Vec<String> = self.sessions.lock().unwrap().keys().cloned().collect();
        for id in ids {
            self.close(&id);
        }
    }

    // ---- Kayıt ----

    pub fn start_recording(
        &self,
        id: &str,
        title: &str,
        cols: u16,
        rows: u16,
        config_dir: &std::path::Path,
    ) -> Result<PathBuf, String> {
        if !self.sessions.lock().unwrap().contains_key(id) {
            return Err("Oturum bulunamadı".into());
        }
        let dir = recordings_dir(config_dir);
        let path = dir.join(make_filename(title));
        let writer = RecordingWriter::new(path.clone(), title, cols, rows)?;
        self.recorders
            .lock()
            .unwrap()
            .insert(id.to_string(), writer);
        Ok(path)
    }

    pub fn stop_recording(&self, id: &str) -> Option<PathBuf> {
        self.recorders.lock().unwrap().remove(id).map(|w| w.path)
    }

    pub fn active_recordings(&self) -> Vec<String> {
        self.recorders.lock().unwrap().keys().cloned().collect()
    }
}

fn descriptor(
    id: &str,
    title: &str,
    protocol: Protocol,
    host_id: Option<String>,
) -> SessionDescriptor {
    SessionDescriptor {
        id: id.to_string(),
        title: title.to_string(),
        protocol,
        host_id,
        vnc: None,
        rdp: None,
    }
}

fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn default_shell() -> String {
    if cfg!(windows) {
        std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
    }
}

fn home_dir() -> Option<String> {
    std::env::var("HOME")
        .ok()
        .or_else(|| std::env::var("USERPROFILE").ok())
}
