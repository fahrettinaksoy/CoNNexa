//! russh tabanlı SSH istemcisi: bağlanma + kimlik doğrulama + shell/exec kanalı.

use std::sync::Arc;
use std::time::Duration;

use russh::client::{self, AuthResult, Handle};
use russh::keys::agent::client::AgentClient;
use russh::keys::agent::AgentIdentity;
use russh::keys::{decode_secret_key, ssh_key, PrivateKeyWithHashAlg};
use russh::{ChannelMsg, Disconnect};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const KEEPALIVE: Duration = Duration::from_secs(30);

/// Minimal Handler — sunucu anahtarını kabul eder (host key doğrulaması yapılmaz).
pub struct Client;

impl client::Handler for Client {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &ssh_key::PublicKey,
    ) -> Result<bool, Self::Error> {
        // Host key doğrulaması yapılmaz (bilinçli).
        Ok(true)
    }
}

pub enum AuthMethod {
    Password(String),
    Key {
        pem: String,
        passphrase: Option<String>,
    },
    Agent,
}

pub struct SshAuth {
    pub username: String,
    pub method: AuthMethod,
}

pub type SshHandle = Arc<Handle<Client>>;

/// Bağlanır ve kimlik doğrular; paylaşılabilir bir Handle döndürür.
pub async fn connect(host: &str, port: u16, auth: SshAuth) -> Result<SshHandle, String> {
    let config = Arc::new(client::Config {
        keepalive_interval: Some(KEEPALIVE),
        ..Default::default()
    });

    let connect_fut = client::connect(config, (host, port), Client);
    let mut handle = tokio::time::timeout(CONNECT_TIMEOUT, connect_fut)
        .await
        .map_err(|_| "bağlantı zaman aşımı".to_string())?
        .map_err(|e| format!("bağlanılamadı: {e}"))?;

    let ok = match auth.method {
        AuthMethod::Password(pw) => {
            let res = handle
                .authenticate_password(auth.username, pw)
                .await
                .map_err(|e| format!("parola doğrulama hatası: {e}"))?;
            matches!(res, AuthResult::Success)
        }
        AuthMethod::Key { pem, passphrase } => {
            let key = decode_secret_key(&pem, passphrase.as_deref())
                .map_err(|e| format!("anahtar çözülemedi: {e}"))?;
            let res = handle
                .authenticate_publickey(
                    auth.username,
                    PrivateKeyWithHashAlg::new(Arc::new(key), None),
                )
                .await
                .map_err(|e| format!("anahtar doğrulama hatası: {e}"))?;
            matches!(res, AuthResult::Success)
        }
        AuthMethod::Agent => authenticate_agent(&mut handle, &auth.username).await?,
    };

    if !ok {
        return Err("kimlik doğrulama başarısız".to_string());
    }
    Ok(Arc::new(handle))
}

/// SSH agent (SSH_AUTH_SOCK) üzerindeki kimliklerle sırayla dener.
async fn authenticate_agent(handle: &mut Handle<Client>, username: &str) -> Result<bool, String> {
    let mut agent = AgentClient::connect_env()
        .await
        .map_err(|e| format!("SSH agent bağlanılamadı: {e}"))?;
    let identities = agent
        .request_identities()
        .await
        .map_err(|e| format!("agent kimlikleri alınamadı: {e}"))?;
    for id in identities {
        let AgentIdentity::PublicKey { key, .. } = id else {
            continue;
        };
        let res = handle
            .authenticate_publickey_with(username.to_string(), key, None, &mut agent)
            .await
            .map_err(|e| format!("agent doğrulama hatası: {e}"))?;
        if matches!(res, AuthResult::Success) {
            return Ok(true);
        }
    }
    Ok(false)
}

/// Interaktif shell kanalı açar (PTY istekli). startup komutu varsa yazılır.
pub async fn open_shell(
    handle: &SshHandle,
    cols: u16,
    rows: u16,
    startup_command: Option<&str>,
) -> Result<russh::Channel<client::Msg>, String> {
    let channel = handle
        .channel_open_session()
        .await
        .map_err(|e| format!("kanal açılamadı: {e}"))?;
    channel
        .request_pty(false, "xterm-256color", cols as u32, rows as u32, 0, 0, &[])
        .await
        .map_err(|e| format!("pty isteği hatası: {e}"))?;
    channel
        .request_shell(false)
        .await
        .map_err(|e| format!("shell isteği hatası: {e}"))?;
    if let Some(cmd) = startup_command {
        if !cmd.is_empty() {
            let line = format!("{cmd}\n");
            let _ = channel.data(line.as_bytes()).await;
        }
    }
    Ok(channel)
}

/// Ayrı bir exec kanalında komut çalıştırır (shell'i kirletmez).
pub async fn exec(
    handle: &SshHandle,
    command: &str,
) -> Result<(Option<i32>, String, String), String> {
    let mut channel = handle
        .channel_open_session()
        .await
        .map_err(|e| format!("exec kanalı açılamadı: {e}"))?;
    channel
        .exec(true, command)
        .await
        .map_err(|e| format!("exec hatası: {e}"))?;

    let mut stdout = Vec::new();
    let mut stderr = Vec::new();
    let mut code = None;
    while let Some(msg) = channel.wait().await {
        match msg {
            ChannelMsg::Data { data } => stdout.extend_from_slice(&data),
            ChannelMsg::ExtendedData { data, ext } => {
                if ext == 1 {
                    stderr.extend_from_slice(&data);
                } else {
                    stdout.extend_from_slice(&data);
                }
            }
            ChannelMsg::ExitStatus { exit_status } => code = Some(exit_status as i32),
            ChannelMsg::Eof | ChannelMsg::Close => break,
            _ => {}
        }
    }
    Ok((
        code,
        String::from_utf8_lossy(&stdout).to_string(),
        String::from_utf8_lossy(&stderr).to_string(),
    ))
}

/// Bağlantıyı kapatır.
pub async fn disconnect(handle: &SshHandle) {
    let _ = handle.disconnect(Disconnect::ByApplication, "", "en").await;
}
