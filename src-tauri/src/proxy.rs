//! VNC ve RDP için WebSocket↔TCP köprüleri.
//!
//! - **VNC**: noVNC istemcisi `ws://127.0.0.1:{port}/{token}`'a bağlanır; köprü
//!   ham TCP'yi (VNC sunucusu) çift yönlü aktarır (websockify eşdeğeri).
//! - **RDP**: ironrdp-wasm istemcisi RDCleanPath protokolüyle bağlanır. Bu
//!   protokolün (X.224 + TLS + ASN.1 DER sertifika zinciri) tam portu sürüyor;
//!   şimdilik açık ve dürüst bir hata döner (bkz. `create_bridge_session`).

use std::net::SocketAddr;

use futures_util::{SinkExt, StreamExt};
use tauri::State;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::tungstenite::handshake::server::{Request, Response};
use tokio_tungstenite::tungstenite::Message;

use crate::state::AppState;
use crate::types::{CreateSessionResult, Host, Protocol, SessionDescriptor, VncInfo};

fn rand_token() -> String {
    use rand::RngCore;
    let mut b = [0u8; 16];
    rand::rngs::OsRng.fill_bytes(&mut b);
    hex::encode(b)
}

/// VNC köprüsü başlatır; `(wsUrl, abort_handle)` döndürür.
async fn start_vnc_bridge(
    target_host: String,
    target_port: u16,
) -> Result<(String, tauri::async_runtime::JoinHandle<()>), String> {
    let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
        .await
        .map_err(|e| format!("köprü portu açılamadı: {e}"))?;
    let addr: SocketAddr = listener.local_addr().map_err(|e| e.to_string())?;
    let token = rand_token();
    let ws_url = format!("ws://127.0.0.1:{}/{}", addr.port(), token);

    let expected_path = format!("/{token}");
    let handle = tauri::async_runtime::spawn(async move {
        // Tek kullanımlık: ilk bağlantıyı kabul et.
        if let Ok((stream, _)) = listener.accept().await {
            let expected = expected_path.clone();
            let check = |req: &Request, resp: Response| {
                if req.uri().path() == expected {
                    Ok(resp)
                } else {
                    Err(Response::builder().status(404).body(None).unwrap())
                }
            };
            match tokio_tungstenite::accept_hdr_async(stream, check).await {
                Ok(ws) => {
                    if let Ok(tcp) = TcpStream::connect((target_host.as_str(), target_port)).await {
                        relay_ws_tcp(ws, tcp).await;
                    }
                }
                Err(e) => log::warn!("VNC ws handshake hatası: {e}"),
            }
        }
    });
    Ok((ws_url, handle))
}

/// WebSocket ↔ TCP çift yönlü aktarım.
async fn relay_ws_tcp(
    ws: tokio_tungstenite::WebSocketStream<TcpStream>,
    tcp: TcpStream,
) {
    let (mut ws_tx, mut ws_rx) = ws.split();
    let (mut tcp_rd, mut tcp_wr) = tcp.into_split();

    // TCP → WS
    let t1 = tauri::async_runtime::spawn(async move {
        let mut buf = [0u8; 16384];
        loop {
            match tcp_rd.read(&mut buf).await {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    if ws_tx.send(Message::Binary(buf[..n].to_vec())).await.is_err() {
                        break;
                    }
                }
            }
        }
        let _ = ws_tx.close().await;
    });

    // WS → TCP
    let t2 = tauri::async_runtime::spawn(async move {
        while let Some(msg) = ws_rx.next().await {
            match msg {
                Ok(Message::Binary(data)) => {
                    if tcp_wr.write_all(&data).await.is_err() {
                        break;
                    }
                }
                Ok(Message::Close(_)) | Err(_) => break,
                _ => {}
            }
        }
        let _ = tcp_wr.shutdown().await;
    });

    let _ = t1.await;
    t2.abort();
}

/// VNC/RDP oturumu oluşturur. VNC köprüyü başlatıp descriptor döndürür; RDP
/// için RDCleanPath portu tamamlanana kadar dürüst bir hata verir.
pub async fn create_bridge_session(
    state: State<'_, AppState>,
    host: Host,
    host_id: String,
) -> Result<CreateSessionResult, String> {
    match host.protocol {
        Protocol::Vnc => {
            let port = if host.port == 0 { 5900 } else { host.port };
            // VNC parolası (varsa) — kimlik sırlarından.
            let password = {
                let vault = state.vault.lock().unwrap();
                vault
                    .resolve_identity_id(&host)
                    .and_then(|id| vault.resolve_secrets(&id).ok())
                    .and_then(|s| s.password)
            };
            let (ws_url, handle) = start_vnc_bridge(host.hostname.clone(), port).await?;
            let descriptor = SessionDescriptor {
                id: uuid::Uuid::new_v4().to_string(),
                title: host.name.clone(),
                protocol: Protocol::Vnc,
                host_id: Some(host_id),
                vnc: Some(VncInfo { ws_url, password }),
                rdp: None,
            };
            state
                .sessions
                .insert_passive(descriptor.clone(), Some(Box::new(move || handle.abort())));
            Ok(CreateSessionResult { ok: true, session: Some(descriptor), error: None })
        }
        Protocol::Rdp => Ok(CreateSessionResult {
            ok: false,
            session: None,
            error: Some(
                "Uygulama içi RDP (RDCleanPath proxy) portu henüz tamamlanmadı; \
                 şimdilik Ayarlar'dan harici RDP istemcisini kullanın."
                    .to_string(),
            ),
        }),
        _ => Ok(CreateSessionResult { ok: false, session: None, error: Some("desteklenmeyen".into()) }),
    }
}
