//! Tauri event yayınları — eski EventEmitter kanallarının karşılığı.
//! Kanal adları arayüz köprüsüyle (bridge/connexa.ts) birebir eşleşir.

use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
struct SessionOutput<'a> {
    id: &'a str,
    data: &'a str,
}

#[derive(Clone, Serialize)]
struct SessionExit<'a> {
    id: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<&'a str>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TunnelState<'a> {
    tunnel_id: &'a str,
    running: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<&'a str>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AiDelta<'a> {
    request_id: &'a str,
    text: &'a str,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AiSimple<'a> {
    request_id: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<&'a str>,
}

pub fn emit_output(app: &AppHandle, id: &str, data: &str) {
    let _ = app.emit("session:output", SessionOutput { id, data });
}

pub fn emit_exit(app: &AppHandle, id: &str, message: Option<&str>) {
    let _ = app.emit("session:exit", SessionExit { id, message });
}

pub fn emit_tunnel_state(app: &AppHandle, tunnel_id: &str, running: bool, error: Option<&str>) {
    let _ = app.emit("tunnel:state", TunnelState { tunnel_id, running, error });
}

pub fn emit_ai_delta(app: &AppHandle, request_id: &str, text: &str) {
    let _ = app.emit("ai:delta", AiDelta { request_id, text });
}

pub fn emit_ai_done(app: &AppHandle, request_id: &str) {
    let _ = app.emit("ai:done", AiSimple { request_id, message: None });
}

pub fn emit_ai_error(app: &AppHandle, request_id: &str, message: &str) {
    let _ = app.emit("ai:error", AiSimple { request_id, message: Some(message) });
}
