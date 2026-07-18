//! Vault komutları — sırlara değil, yalnız public veriye ve ID'lere erişim.

use tauri::State;

use crate::state::AppState;
use crate::types::*;

type R<T> = Result<T, String>;

#[tauri::command]
pub fn vault_get(state: State<AppState>) -> R<VaultData> {
    Ok(state.vault.lock().unwrap().get_public_data())
}

#[tauri::command]
pub fn vault_save_host(state: State<AppState>, host: Host) -> R<Host> {
    state.vault.lock().unwrap().save_host(host)
}

#[tauri::command]
pub fn vault_delete_host(state: State<AppState>, id: String) -> R<()> {
    state.vault.lock().unwrap().delete_host(&id)
}

#[tauri::command]
pub fn vault_save_identity(state: State<AppState>, req: IdentitySaveRequest) -> R<IdentityPublic> {
    state.vault.lock().unwrap().save_identity(req)
}

#[tauri::command]
pub fn vault_delete_identity(state: State<AppState>, id: String) -> R<()> {
    state.vault.lock().unwrap().delete_identity(&id)
}

#[tauri::command]
pub fn vault_save_group(state: State<AppState>, group: Group) -> R<Group> {
    state.vault.lock().unwrap().save_group(group)
}

#[tauri::command]
pub fn vault_delete_group(state: State<AppState>, id: String) -> R<()> {
    state.vault.lock().unwrap().delete_group(&id)
}

#[tauri::command]
pub fn vault_save_snippet(state: State<AppState>, snippet: Snippet) -> R<Snippet> {
    state.vault.lock().unwrap().save_snippet(snippet)
}

#[tauri::command]
pub fn vault_delete_snippet(state: State<AppState>, id: String) -> R<()> {
    state.vault.lock().unwrap().delete_snippet(&id)
}

#[tauri::command]
pub fn vault_save_tunnel(state: State<AppState>, tunnel: Tunnel) -> R<Tunnel> {
    state.vault.lock().unwrap().save_tunnel(tunnel)
}

#[tauri::command]
pub fn vault_delete_tunnel(state: State<AppState>, id: String) -> R<()> {
    // Not: tünel çalışıyorsa durdurma sonraki fazda tunnel manager ile bağlanacak.
    state.vault.lock().unwrap().delete_tunnel(&id)
}
