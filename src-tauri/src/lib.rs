// Connexa — Tauri v2 arka uç girişi.
// Native uzak erişim katmanı: SSH/PTY/SFTP/tünel/serial/proxy — hepsi Rust.

mod ai;
mod alarm;
mod commands;
mod crypto;
mod events;
mod http;
mod import;
mod metrics;
mod password_resolver;
mod plugins;
mod proxy;
mod rdp_launcher;
mod recording;
mod session;
mod sftp;
mod ssh;
mod state;
mod tunnel;
mod types;
mod vault;

use tauri::Manager;

use crate::session::SessionManager;
use crate::state::AppState;
use crate::tunnel::TunnelManager;
use crate::vault::VaultStore;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: None,
                    }),
                ])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("app_data_dir çözülemedi: {e}"))?;
            let vault = VaultStore::new(dir).map_err(|e| e.to_string())?;
            let handle = app.handle().clone();
            let sessions = SessionManager::new(handle.clone());
            let tunnels = TunnelManager::new(handle.clone());
            app.manage(AppState::new(vault, sessions, tunnels));
            // Arka plan alarm izleme döngüsü
            crate::alarm::spawn_loop(handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Vault
            commands::vault_get,
            commands::vault_save_host,
            commands::vault_delete_host,
            commands::vault_save_identity,
            commands::vault_delete_identity,
            commands::vault_save_group,
            commands::vault_delete_group,
            commands::vault_save_snippet,
            commands::vault_delete_snippet,
            commands::vault_save_tunnel,
            commands::vault_delete_tunnel,
            // Sessions
            commands::session_create,
            commands::session_write,
            commands::session_resize,
            commands::session_close,
            // SFTP
            commands::sftp_home,
            commands::sftp_list,
            commands::sftp_mkdir,
            commands::sftp_rename,
            commands::sftp_delete,
            commands::sftp_download,
            commands::sftp_upload,
            // Tünel
            commands::tunnel_running,
            commands::tunnel_start,
            commands::tunnel_stop,
            // Metrics
            commands::metrics_snapshot,
            // Recording
            commands::recording_start,
            commands::recording_stop,
            commands::recording_active,
            commands::recording_open_folder,
            // Harici RDP
            commands::rdp_launch_external,
            // Import
            commands::import_ssh_config,
            commands::import_mremoteng,
            commands::import_termius,
            // Plugins
            commands::plugins_list,
            commands::plugins_install,
            commands::plugins_remove,
            commands::plugins_open_folder,
            // Alarm
            commands::alarm_get_config,
            commands::alarm_save_config,
            commands::alarm_test,
            // Sync / Cloud / Team
            commands::sync_get_config,
            commands::sync_save_config,
            commands::sync_push,
            commands::sync_pull,
            commands::cloud_import,
            commands::team_list,
            commands::team_save,
            commands::team_delete,
            commands::team_assign,
            commands::team_push,
            commands::team_pull,
            // AI
            commands::ai_get_config,
            commands::ai_save_config,
            commands::ai_ask,
            commands::ai_cancel,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Çıkışta tüm oturum/tünel kaynaklarını serbest bırak (before-quit).
            if let tauri::RunEvent::ExitRequested { .. } = event {
                if let Some(state) = app.try_state::<AppState>() {
                    state.sessions.dispose_all();
                    state.tunnels.dispose_all();
                }
            }
        });
}
