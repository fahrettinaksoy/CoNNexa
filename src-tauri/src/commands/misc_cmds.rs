//! Tünel, metrics, recording, harici RDP, import, plugins, alarm komutları.

use std::path::Path;

use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::commands::conn::resolve_host_auth;
use crate::state::AppState;
use crate::types::*;
use crate::{alarm, import, metrics, plugins, rdp_launcher};

// ---- Tünel ----

#[tauri::command]
pub fn tunnel_running(state: State<AppState>) -> Vec<String> {
    state.tunnels.running_ids()
}

#[tauri::command]
pub async fn tunnel_start(state: State<'_, AppState>, tunnel_id: String) -> Result<SimpleResult, String> {
    let (tunnel, host) = {
        let vault = state.vault.lock().unwrap();
        let tunnel = match vault.get_tunnel(&tunnel_id) {
            Some(t) => t,
            None => return Ok(SimpleResult::err("Tunnel not found")),
        };
        let host = match vault.get_host(&tunnel.host_id) {
            Some(h) => h,
            None => return Ok(SimpleResult::err("Tunnel host not found")),
        };
        (tunnel, host)
    };
    let (addr, port, auth) = match resolve_host_auth(&state, &host).await {
        Ok(v) => v,
        Err(e) => return Ok(SimpleResult::err(e)),
    };
    Ok(SimpleResult::from(state.tunnels.start(tunnel, addr, port, auth).await))
}

#[tauri::command]
pub fn tunnel_stop(state: State<AppState>, tunnel_id: String) {
    state.tunnels.stop(&tunnel_id);
}

// ---- Metrics ----

#[tauri::command]
pub async fn metrics_snapshot(state: State<'_, AppState>, session_id: String) -> Result<HostMetrics, String> {
    let handle = state.sessions.get_ssh(&session_id);
    Ok(match handle {
        Some(h) => metrics::snapshot(&h).await,
        None => HostMetrics { ok: false, error: Some("SSH oturumu bulunamadı".into()), ..Default::default() },
    })
}

// ---- Recording ----

#[tauri::command]
pub fn recording_start(
    state: State<AppState>,
    session_id: String,
    title: String,
    cols: u16,
    rows: u16,
) -> RecordingStartResult {
    let config_dir = state.vault.lock().unwrap().config_dir.clone();
    match state.sessions.start_recording(&session_id, &title, cols, rows, &config_dir) {
        Ok(path) => RecordingStartResult { ok: true, error: None, file_path: Some(path.display().to_string()) },
        Err(e) => RecordingStartResult { ok: false, error: Some(e), file_path: None },
    }
}

#[tauri::command]
pub fn recording_stop(state: State<AppState>, session_id: String) -> RecordingStopResult {
    match state.sessions.stop_recording(&session_id) {
        Some(path) => RecordingStopResult { ok: true, file_path: Some(path.display().to_string()) },
        None => RecordingStopResult { ok: false, file_path: None },
    }
}

#[tauri::command]
pub fn recording_active(state: State<AppState>) -> Vec<String> {
    state.sessions.active_recordings()
}

#[tauri::command]
pub fn recording_open_folder(state: State<AppState>) {
    let config_dir = state.vault.lock().unwrap().config_dir.clone();
    let dir = crate::recording::recordings_dir(&config_dir);
    let _ = std::fs::create_dir_all(&dir);
    open_path(&dir);
}

// ---- Harici RDP ----

#[tauri::command]
pub async fn rdp_launch_external(state: State<'_, AppState>, host_id: String) -> Result<SimpleResult, String> {
    let host = {
        let vault = state.vault.lock().unwrap();
        match vault.get_host(&host_id) {
            Some(h) => h,
            None => return Ok(SimpleResult::err("Host not found")),
        }
    };
    // Kimlik sırları (kullanıcı adı + parola)
    let (username, password) = {
        let vault = state.vault.lock().unwrap();
        match vault.resolve_identity_id(&host).and_then(|id| vault.resolve_secrets(&id).ok()) {
            Some(s) => (s.identity.username.clone(), s.password.unwrap_or_default()),
            None => (String::new(), String::new()),
        }
    };
    Ok(SimpleResult::from(rdp_launcher::launch(&host, &username, &password)))
}

// ---- Import ----

#[tauri::command]
pub fn import_ssh_config(state: State<AppState>) -> ImportSummary {
    let path = match import::default_ssh_config_path() {
        Some(p) => p,
        None => return ImportSummary::error("~/.ssh/config yolu çözülemedi"),
    };
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return ImportSummary::error("~/.ssh/config okunamadı"),
    };
    let parsed = import::parse_ssh_config(&content);
    state.vault.lock().unwrap().apply_import(parsed)
}

async fn pick_file_and_import(
    app: &AppHandle,
    state: &State<'_, AppState>,
    parse: fn(&str) -> import::ParsedImport,
) -> ImportSummary {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_file(move |p| {
        let _ = tx.send(p);
    });
    let picked = rx.await.ok().flatten();
    let Some(fp) = picked else { return ImportSummary::canceled() };
    let path = match fp.into_path() {
        Ok(p) => p,
        Err(e) => return ImportSummary::error(e.to_string()),
    };
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(e) => return ImportSummary::error(e.to_string()),
    };
    let parsed = parse(&content);
    state.vault.lock().unwrap().apply_import(parsed)
}

#[tauri::command]
pub async fn import_mremoteng(app: AppHandle, state: State<'_, AppState>) -> Result<ImportSummary, String> {
    Ok(pick_file_and_import(&app, &state, import::parse_mremoteng).await)
}

#[tauri::command]
pub async fn import_termius(app: AppHandle, state: State<'_, AppState>) -> Result<ImportSummary, String> {
    Ok(pick_file_and_import(&app, &state, import::parse_termius).await)
}

// ---- Plugins ----

#[tauri::command]
pub fn plugins_list(state: State<AppState>) -> PluginResult {
    let config_dir = state.vault.lock().unwrap().config_dir.clone();
    plugins::list(&config_dir)
}

#[tauri::command]
pub async fn plugins_install(app: AppHandle, state: State<'_, AppState>) -> Result<PluginResult, String> {
    let config_dir = state.vault.lock().unwrap().config_dir.clone();
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |p| {
        let _ = tx.send(p);
    });
    let picked = rx.await.ok().flatten();
    let Some(fp) = picked else {
        return Ok(PluginResult { ok: false, error: Some("iptal edildi".into()), plugins: vec![], snippets: vec![] });
    };
    let path = match fp.into_path() {
        Ok(p) => p,
        Err(e) => return Ok(PluginResult { ok: false, error: Some(e.to_string()), plugins: vec![], snippets: vec![] }),
    };
    Ok(plugins::install(&config_dir, &path))
}

#[tauri::command]
pub fn plugins_remove(state: State<AppState>, id: String) -> PluginResult {
    let config_dir = state.vault.lock().unwrap().config_dir.clone();
    plugins::remove(&config_dir, &id)
}

#[tauri::command]
pub fn plugins_open_folder(state: State<AppState>) {
    let config_dir = state.vault.lock().unwrap().config_dir.clone();
    let dir = plugins::plugins_dir(&config_dir);
    let _ = std::fs::create_dir_all(&dir);
    open_path(&dir);
}

// ---- Alarm ----

#[tauri::command]
pub fn alarm_get_config(state: State<AppState>) -> AlarmConfig {
    state.vault.lock().unwrap().get_alarm_config()
}

#[tauri::command]
pub fn alarm_save_config(state: State<AppState>, config: AlarmConfig) -> Result<(), String> {
    state.vault.lock().unwrap().save_alarm_config(config)
}

#[tauri::command]
pub async fn alarm_test(config: AlarmConfig) -> Result<SimpleResult, String> {
    Ok(SimpleResult::from(alarm::test(&config).await))
}

// ---- Yardımcı ----

fn open_path(path: &Path) {
    let p = path.to_string_lossy().to_string();
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(&p).spawn();
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("explorer").arg(&p).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let _ = std::process::Command::new("xdg-open").arg(&p).spawn();
}
