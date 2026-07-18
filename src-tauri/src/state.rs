//! Uygulama genel durumu (Tauri `manage`).

use std::sync::Mutex;

use crate::ai::AiService;
use crate::session::SessionManager;
use crate::sftp::SftpService;
use crate::tunnel::TunnelManager;
use crate::vault::VaultStore;

pub struct AppState {
    pub vault: Mutex<VaultStore>,
    pub sessions: SessionManager,
    pub sftp: SftpService,
    pub tunnels: TunnelManager,
    pub ai: AiService,
}

impl AppState {
    pub fn new(vault: VaultStore, sessions: SessionManager, tunnels: TunnelManager) -> Self {
        Self {
            vault: Mutex::new(vault),
            sessions,
            sftp: SftpService::new(),
            tunnels,
            ai: AiService::new(),
        }
    }
}
