//! SSH port yönlendirme yöneticisi.
//! local (-L), remote (-R), dynamic (-D, elle SOCKS5). Her tünel kendi SSH
//! bağlantısını açar. Durum `tunnel:state` event'iyle bildirilir.

use std::collections::HashMap;
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;

use russh::client::{self, Handle};
use russh::keys::key;
use tauri::AppHandle;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;

use crate::events::emit_tunnel_state;
use crate::ssh::{AuthMethod, SshAuth};
use crate::types::{Tunnel, TunnelType};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);

/// Yönlendirilen kanalları (remote -R) yakalayan handler.
struct TunnelClient {
    forwarded: Option<mpsc::UnboundedSender<russh::Channel<client::Msg>>>,
}

#[async_trait::async_trait]
impl client::Handler for TunnelClient {
    type Error = russh::Error;

    async fn check_server_key(&mut self, _key: &key::PublicKey) -> Result<bool, Self::Error> {
        Ok(true)
    }

    async fn server_channel_open_forwarded_tcpip(
        &mut self,
        channel: russh::Channel<client::Msg>,
        _connected_address: &str,
        _connected_port: u32,
        _originator_address: &str,
        _originator_port: u32,
        _session: &mut client::Session,
    ) -> Result<(), Self::Error> {
        if let Some(tx) = &self.forwarded {
            let _ = tx.send(channel);
        }
        Ok(())
    }
}

type TunnelHandle = Arc<Handle<TunnelClient>>;

async fn connect(
    host: &str,
    port: u16,
    auth: SshAuth,
    forwarded: Option<mpsc::UnboundedSender<russh::Channel<client::Msg>>>,
) -> Result<Handle<TunnelClient>, String> {
    let config = Arc::new(client::Config {
        keepalive_interval: Some(Duration::from_secs(30)),
        ..Default::default()
    });
    let handler = TunnelClient { forwarded };
    let fut = client::connect(config, (host, port), handler);
    let mut handle = tokio::time::timeout(CONNECT_TIMEOUT, fut)
        .await
        .map_err(|_| "tünel bağlantı zaman aşımı".to_string())?
        .map_err(|e| format!("tünel bağlanamadı: {e}"))?;

    let ok = match auth.method {
        AuthMethod::Password(pw) => handle
            .authenticate_password(auth.username, pw)
            .await
            .map_err(|e| e.to_string())?,
        AuthMethod::Key { pem, passphrase } => {
            let keypair = russh::keys::decode_secret_key(&pem, passphrase.as_deref())
                .map_err(|e| format!("anahtar çözülemedi: {e}"))?;
            handle
                .authenticate_publickey(auth.username, Arc::new(keypair))
                .await
                .map_err(|e| e.to_string())?
        }
        AuthMethod::Agent => {
            let mut agent = russh::keys::agent::client::AgentClient::connect_env()
                .await
                .map_err(|e| format!("agent bağlanamadı: {e}"))?;
            let ids = agent
                .request_identities()
                .await
                .map_err(|e| e.to_string())?;
            let mut ok = false;
            for key in ids {
                let (back, res) = handle.authenticate_future(&auth.username, key, agent).await;
                agent = back;
                if let Ok(true) = res {
                    ok = true;
                    break;
                }
            }
            ok
        }
    };
    if !ok {
        return Err("tünel kimlik doğrulama başarısız".into());
    }
    Ok(handle)
}

pub struct TunnelManager {
    app: AppHandle,
    active: Arc<StdMutex<HashMap<String, tauri::async_runtime::JoinHandle<()>>>>,
}

impl TunnelManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            active: Arc::new(StdMutex::new(HashMap::new())),
        }
    }

    #[allow(dead_code)] // durum sorgusu için genel API
    pub fn is_running(&self, id: &str) -> bool {
        self.active.lock().unwrap().contains_key(id)
    }

    pub fn running_ids(&self) -> Vec<String> {
        self.active.lock().unwrap().keys().cloned().collect()
    }

    pub async fn start(
        &self,
        tunnel: Tunnel,
        addr: String,
        ssh_port: u16,
        auth: SshAuth,
    ) -> Result<(), String> {
        let listen_host = if tunnel.listen_host.is_empty() {
            "127.0.0.1".to_string()
        } else {
            tunnel.listen_host.clone()
        };
        let app = self.app.clone();
        let tid = tunnel.id.clone();

        let task = match tunnel.tunnel_type {
            TunnelType::Local => {
                let handle = Arc::new(connect(&addr, ssh_port, auth, None).await?);
                let listener = TcpListener::bind((listen_host.as_str(), tunnel.listen_port))
                    .await
                    .map_err(|e| format!("dinleme portu açılamadı: {e}"))?;
                let dest_host = tunnel
                    .dest_host
                    .clone()
                    .unwrap_or_else(|| "127.0.0.1".into());
                let dest_port = tunnel.dest_port.unwrap_or(0);
                tauri::async_runtime::spawn(async move {
                    while let Ok((sock, _)) = listener.accept().await {
                        let h = handle.clone();
                        let dh = dest_host.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Ok(ch) = h
                                .channel_open_direct_tcpip(dh, dest_port as u32, "127.0.0.1", 0)
                                .await
                            {
                                relay(ch.into_stream(), sock).await;
                            }
                        });
                    }
                })
            }
            TunnelType::Remote => {
                let (tx, mut rx) = mpsc::unbounded_channel();
                let mut handle = connect(&addr, ssh_port, auth, Some(tx)).await?;
                handle
                    .tcpip_forward(listen_host.clone(), tunnel.listen_port as u32)
                    .await
                    .map_err(|e| format!("uzak yönlendirme hatası: {e}"))?;
                let dest_host = tunnel
                    .dest_host
                    .clone()
                    .unwrap_or_else(|| "127.0.0.1".into());
                let dest_port = tunnel.dest_port.unwrap_or(0);
                tauri::async_runtime::spawn(async move {
                    // handle burada canlı tutulur; drop olursa SSH kapanır.
                    let _keepalive = handle;
                    while let Some(ch) = rx.recv().await {
                        let dh = dest_host.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Ok(tcp) = TcpStream::connect((dh.as_str(), dest_port)).await {
                                relay(ch.into_stream(), tcp).await;
                            }
                        });
                    }
                })
            }
            TunnelType::Dynamic => {
                let handle = Arc::new(connect(&addr, ssh_port, auth, None).await?);
                let listener = TcpListener::bind((listen_host.as_str(), tunnel.listen_port))
                    .await
                    .map_err(|e| format!("dinleme portu açılamadı: {e}"))?;
                tauri::async_runtime::spawn(async move {
                    while let Ok((sock, _)) = listener.accept().await {
                        let h = handle.clone();
                        tauri::async_runtime::spawn(async move {
                            let _ = handle_socks5(sock, h).await;
                        });
                    }
                })
            }
        };

        self.active.lock().unwrap().insert(tid.clone(), task);
        emit_tunnel_state(&app, &tid, true, None);
        Ok(())
    }

    pub fn stop(&self, id: &str) {
        if let Some(task) = self.active.lock().unwrap().remove(id) {
            task.abort();
            emit_tunnel_state(&self.app, id, false, None);
        }
    }

    pub fn dispose_all(&self) {
        let ids: Vec<String> = self.active.lock().unwrap().keys().cloned().collect();
        for id in ids {
            self.stop(&id);
        }
    }
}

/// Kanal ↔ TCP çift yönlü aktarım.
async fn relay<S>(mut channel: S, mut tcp: TcpStream)
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
{
    let _ = tokio::io::copy_bidirectional(&mut channel, &mut tcp).await;
}

/// Minimal SOCKS5: no-auth + CONNECT (IPv4/domain). IPv6 desteklenmez.
async fn handle_socks5(mut sock: TcpStream, handle: TunnelHandle) -> Result<(), String> {
    let mut head = [0u8; 2];
    sock.read_exact(&mut head)
        .await
        .map_err(|e| e.to_string())?;
    if head[0] != 0x05 {
        return Err("socks5 değil".into());
    }
    let nmethods = head[1] as usize;
    let mut methods = vec![0u8; nmethods];
    sock.read_exact(&mut methods)
        .await
        .map_err(|e| e.to_string())?;
    sock.write_all(&[0x05, 0x00])
        .await
        .map_err(|e| e.to_string())?; // no-auth

    let mut req = [0u8; 4];
    sock.read_exact(&mut req).await.map_err(|e| e.to_string())?;
    if req[1] != 0x01 {
        // yalnız CONNECT
        sock.write_all(&[0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
            .await
            .ok();
        return Err("yalnız CONNECT".into());
    }
    let host = match req[3] {
        0x01 => {
            let mut a = [0u8; 4];
            sock.read_exact(&mut a).await.map_err(|e| e.to_string())?;
            format!("{}.{}.{}.{}", a[0], a[1], a[2], a[3])
        }
        0x03 => {
            let mut l = [0u8; 1];
            sock.read_exact(&mut l).await.map_err(|e| e.to_string())?;
            let mut d = vec![0u8; l[0] as usize];
            sock.read_exact(&mut d).await.map_err(|e| e.to_string())?;
            String::from_utf8_lossy(&d).to_string()
        }
        _ => {
            // IPv6 (0x04) desteklenmez
            sock.write_all(&[0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
                .await
                .ok();
            return Err("adres türü desteklenmiyor".into());
        }
    };
    let mut p = [0u8; 2];
    sock.read_exact(&mut p).await.map_err(|e| e.to_string())?;
    let port = u16::from_be_bytes(p);

    match handle
        .channel_open_direct_tcpip(host, port as u32, "127.0.0.1", 0)
        .await
    {
        Ok(ch) => {
            sock.write_all(&[0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
                .await
                .ok();
            relay(ch.into_stream(), sock).await;
            Ok(())
        }
        Err(e) => {
            sock.write_all(&[0x05, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0])
                .await
                .ok();
            Err(e.to_string())
        }
    }
}
