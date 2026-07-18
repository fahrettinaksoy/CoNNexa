//! Oturum komutları — create (protokole göre dağıtım) + write/resize/close.

use tauri::State;

use crate::commands::conn::resolve_host_auth;
use crate::state::AppState;
use crate::types::*;

#[tauri::command]
pub async fn session_create(
    state: State<'_, AppState>,
    req: CreateSessionRequest,
) -> Result<CreateSessionResult, String> {
    if req.local.unwrap_or(false) {
        return Ok(match state.sessions.create_local(req.cols, req.rows) {
            Ok(session) => ok(session),
            Err(e) => err(e),
        });
    }

    let host_id = match &req.host_id {
        Some(id) => id.clone(),
        None => return Ok(err("Host not found")),
    };
    let host = {
        let vault = state.vault.lock().unwrap();
        match vault.get_host(&host_id) {
            Some(h) => h,
            None => return Ok(err("Host not found")),
        }
    };

    match host.protocol {
        Protocol::Ssh => {
            let (addr, port, auth) = match resolve_host_auth(&state, &host).await {
                Ok(v) => v,
                Err(e) => return Ok(err(e)),
            };
            match state
                .sessions
                .create_ssh(
                    host_id,
                    host.name.clone(),
                    addr,
                    port,
                    auth,
                    host.startup_command.clone(),
                    req.cols,
                    req.rows,
                )
                .await
            {
                Ok(s) => Ok(ok(s)),
                Err(e) => Ok(err(e)),
            }
        }
        Protocol::Telnet => {
            let port = if host.port == 0 { 23 } else { host.port };
            match state
                .sessions
                .create_telnet(host_id, host.name.clone(), host.hostname.clone(), port)
                .await
            {
                Ok(s) => Ok(ok(s)),
                Err(e) => Ok(err(e)),
            }
        }
        Protocol::Serial => {
            let baud = if host.port == 0 { 9600 } else { host.port } as u32;
            match state.sessions.create_serial(
                host_id,
                host.name.clone(),
                host.hostname.clone(),
                baud,
            ) {
                Ok(s) => Ok(ok(s)),
                Err(e) => Ok(err(e)),
            }
        }
        Protocol::Local => Ok(match state.sessions.create_local(req.cols, req.rows) {
            Ok(s) => ok(s),
            Err(e) => err(e),
        }),
        Protocol::Vnc | Protocol::Rdp => {
            crate::proxy::create_bridge_session(state, host, host_id).await
        }
    }
}

#[tauri::command]
pub fn session_write(state: State<AppState>, id: String, data: String) {
    state.sessions.write(&id, &data);
}

#[tauri::command]
pub fn session_resize(state: State<AppState>, id: String, cols: u16, rows: u16) {
    state.sessions.resize(&id, cols, rows);
}

#[tauri::command]
pub fn session_close(state: State<AppState>, id: String) {
    state.sessions.close(&id);
}

fn ok(session: SessionDescriptor) -> CreateSessionResult {
    CreateSessionResult {
        ok: true,
        session: Some(session),
        error: None,
    }
}
fn err(msg: impl Into<String>) -> CreateSessionResult {
    CreateSessionResult {
        ok: false,
        session: None,
        error: Some(msg.into()),
    }
}
