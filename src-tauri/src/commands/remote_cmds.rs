//! Sync / cloud / team komutları (zero-knowledge senkron, bulut envanteri).

use tauri::State;

use crate::state::AppState;
use crate::types::*;
use crate::vault::PortableVault;
use crate::{crypto, http};

const SYNC_FILE: &str = "connexa-vault.enc";

fn team_file(id: &str) -> String {
    format!("connexa-team-{id}.enc")
}

// ---- Sync ----

#[tauri::command]
pub fn sync_get_config(state: State<AppState>) -> SyncConfigPublic {
    state.vault.lock().unwrap().get_sync_public()
}

#[tauri::command]
pub fn sync_save_config(state: State<AppState>, input: SyncConfigInput) -> Result<(), String> {
    state.vault.lock().unwrap().save_sync_config(input)
}

#[tauri::command]
pub async fn sync_push(
    state: State<'_, AppState>,
    passphrase: String,
) -> Result<SyncResult, String> {
    if passphrase.is_empty() {
        return Ok(SyncResult {
            ok: false,
            error: Some("parola gerekli".into()),
            gist_id: None,
            summary: None,
        });
    }
    let (backend, token, webdav_pw, gist_id, webdav_url, webdav_user, portable) = {
        let vault = state.vault.lock().unwrap();
        let (token, pw) = vault.resolve_sync_secrets()?;
        let (url, user) = vault.sync_webdav();
        let portable = vault.export_portable()?;
        (
            vault.sync_backend(),
            token,
            pw,
            vault.sync_gist_id(),
            url,
            user,
            portable,
        )
    };
    let blob = crypto::encrypt_payload(&portable, &passphrase)?;

    match backend {
        SyncBackend::Gist => {
            let token = token.ok_or("Gist token ayarlı değil")?;
            let new_id = http::gist_upsert(
                &token,
                gist_id.as_deref(),
                SYNC_FILE,
                &blob,
                "Connexa vault",
            )
            .await?;
            state.vault.lock().unwrap().set_gist_id(&new_id)?;
            Ok(SyncResult {
                ok: true,
                error: None,
                gist_id: Some(new_id),
                summary: None,
            })
        }
        SyncBackend::Webdav => {
            let url = webdav_url.ok_or("WebDAV URL yok")?;
            let user = webdav_user.unwrap_or_default();
            let pw = webdav_pw.ok_or("WebDAV parolası yok")?;
            http::webdav_put(&url, &user, &pw, SYNC_FILE, &blob).await?;
            Ok(SyncResult {
                ok: true,
                error: None,
                gist_id: None,
                summary: None,
            })
        }
        SyncBackend::None => Ok(SyncResult {
            ok: false,
            error: Some("senkron hedefi ayarlı değil".into()),
            gist_id: None,
            summary: None,
        }),
    }
}

#[tauri::command]
pub async fn sync_pull(
    state: State<'_, AppState>,
    passphrase: String,
) -> Result<SyncResult, String> {
    if passphrase.is_empty() {
        return Ok(SyncResult {
            ok: false,
            error: Some("parola gerekli".into()),
            gist_id: None,
            summary: None,
        });
    }
    let (backend, token, webdav_pw, gist_id, webdav_url, webdav_user) = {
        let vault = state.vault.lock().unwrap();
        let (token, pw) = vault.resolve_sync_secrets()?;
        let (url, user) = vault.sync_webdav();
        (
            vault.sync_backend(),
            token,
            pw,
            vault.sync_gist_id(),
            url,
            user,
        )
    };

    let blob = match backend {
        SyncBackend::Gist => {
            let token = token.ok_or("Gist token yok")?;
            let gid = gist_id.ok_or("Gist id yok")?;
            http::gist_get(&token, &gid, SYNC_FILE).await?
        }
        SyncBackend::Webdav => {
            let url = webdav_url.ok_or("WebDAV URL yok")?;
            let user = webdav_user.unwrap_or_default();
            let pw = webdav_pw.ok_or("WebDAV parolası yok")?;
            http::webdav_get(&url, &user, &pw, SYNC_FILE).await?
        }
        SyncBackend::None => {
            return Ok(SyncResult {
                ok: false,
                error: Some("senkron hedefi yok".into()),
                gist_id: None,
                summary: None,
            })
        }
    };

    let data: PortableVault = crypto::decrypt_payload(&blob, &passphrase)?;
    let summary = ImportSummary {
        ok: true,
        error: None,
        canceled: None,
        hosts: data.hosts.len() as u32,
        identities: data.identities.len() as u32,
        groups: data.groups.len() as u32,
        skipped: 0,
    };
    state.vault.lock().unwrap().replace_portable(data)?;
    Ok(SyncResult {
        ok: true,
        error: None,
        gist_id: None,
        summary: Some(summary),
    })
}

// ---- Cloud ----

#[tauri::command]
pub async fn cloud_import(
    state: State<'_, AppState>,
    provider: String,
    token: String,
    identity_id: Option<String>,
) -> Result<ImportSummary, String> {
    let servers: Vec<(String, String)> = match provider.as_str() {
        "digitalocean" => {
            let v = http::get_json_bearer(
                "https://api.digitalocean.com/v2/droplets?per_page=200",
                &token,
            )
            .await?;
            v.get("droplets")
                .and_then(|d| d.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|d| {
                            let name = d
                                .get("name")
                                .and_then(|x| x.as_str())
                                .unwrap_or("droplet")
                                .to_string();
                            let ip = d
                                .get("networks")
                                .and_then(|n| n.get("v4"))
                                .and_then(|v4| v4.as_array())
                                .and_then(|arr| {
                                    arr.iter()
                                        .find(|net| {
                                            net.get("type").and_then(|t| t.as_str())
                                                == Some("public")
                                        })
                                        .and_then(|net| net.get("ip_address"))
                                        .and_then(|x| x.as_str())
                                })?;
                            Some((name, ip.to_string()))
                        })
                        .collect()
                })
                .unwrap_or_default()
        }
        "hetzner" => {
            let v =
                http::get_json_bearer("https://api.hetzner.cloud/v1/servers?per_page=50", &token)
                    .await?;
            v.get("servers")
                .and_then(|s| s.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|s| {
                            let name = s
                                .get("name")
                                .and_then(|x| x.as_str())
                                .unwrap_or("server")
                                .to_string();
                            let ip = s
                                .get("public_net")
                                .and_then(|p| p.get("ipv4"))
                                .and_then(|v| v.get("ip"))
                                .and_then(|x| x.as_str())?;
                            Some((name, ip.to_string()))
                        })
                        .collect()
                })
                .unwrap_or_default()
        }
        _ => return Ok(ImportSummary::error("bilinmeyen sağlayıcı")),
    };
    Ok(state
        .vault
        .lock()
        .unwrap()
        .import_cloud_hosts(&provider, servers, identity_id))
}

// ---- Team ----

#[tauri::command]
pub fn team_list(state: State<AppState>) -> Vec<TeamVaultPublic> {
    state.vault.lock().unwrap().get_team_vaults_public()
}

#[tauri::command]
pub fn team_save(state: State<AppState>, input: TeamVaultInput) -> Result<TeamVaultPublic, String> {
    state.vault.lock().unwrap().save_team_vault(input)
}

#[tauri::command]
pub fn team_delete(state: State<AppState>, id: String) -> Result<(), String> {
    state.vault.lock().unwrap().delete_team_vault(&id)
}

#[tauri::command]
pub fn team_assign(
    state: State<AppState>,
    kind: String,
    item_id: String,
    team_id: Option<String>,
) -> Result<(), String> {
    state
        .vault
        .lock()
        .unwrap()
        .assign_to_team(&kind, &item_id, team_id)
}

#[tauri::command]
pub async fn team_push(
    state: State<'_, AppState>,
    team_id: String,
    passphrase: String,
) -> Result<TeamVaultResult, String> {
    if passphrase.is_empty() {
        return Ok(TeamVaultResult {
            ok: false,
            error: Some("parola gerekli".into()),
            gist_id: None,
            summary: None,
        });
    }
    let (backend, token, webdav_pw, gist_id, webdav_url, webdav_user, portable) = {
        let vault = state.vault.lock().unwrap();
        let backend = vault
            .get_team_backend(&team_id)
            .ok_or("Ekip vault'u bulunamadı")?;
        let (token, pw) = vault.resolve_team_secrets(&team_id)?;
        let (url, user) = vault.team_webdav(&team_id);
        (
            backend,
            token,
            pw,
            vault.team_gist_id(&team_id),
            url,
            user,
            vault.export_team(&team_id),
        )
    };
    let blob = crypto::encrypt_payload(&portable, &passphrase)?;
    let file = team_file(&team_id);

    match backend {
        TeamBackend::Gist => {
            let token = token.ok_or("Gist token yok")?;
            let new_id = http::gist_upsert(
                &token,
                gist_id.as_deref(),
                &file,
                &blob,
                "Connexa team vault",
            )
            .await?;
            state
                .vault
                .lock()
                .unwrap()
                .set_team_gist_id(&team_id, &new_id)?;
            Ok(TeamVaultResult {
                ok: true,
                error: None,
                gist_id: Some(new_id),
                summary: None,
            })
        }
        TeamBackend::Webdav => {
            let url = webdav_url.ok_or("WebDAV URL yok")?;
            let user = webdav_user.unwrap_or_default();
            let pw = webdav_pw.ok_or("WebDAV parolası yok")?;
            http::webdav_put(&url, &user, &pw, &file, &blob).await?;
            Ok(TeamVaultResult {
                ok: true,
                error: None,
                gist_id: None,
                summary: None,
            })
        }
    }
}

#[tauri::command]
pub async fn team_pull(
    state: State<'_, AppState>,
    team_id: String,
    passphrase: String,
) -> Result<TeamVaultResult, String> {
    if passphrase.is_empty() {
        return Ok(TeamVaultResult {
            ok: false,
            error: Some("parola gerekli".into()),
            gist_id: None,
            summary: None,
        });
    }
    let (backend, token, webdav_pw, gist_id, webdav_url, webdav_user) = {
        let vault = state.vault.lock().unwrap();
        let backend = vault
            .get_team_backend(&team_id)
            .ok_or("Ekip vault'u bulunamadı")?;
        let (token, pw) = vault.resolve_team_secrets(&team_id)?;
        let (url, user) = vault.team_webdav(&team_id);
        (backend, token, pw, vault.team_gist_id(&team_id), url, user)
    };
    let file = team_file(&team_id);

    let blob = match backend {
        TeamBackend::Gist => {
            let token = token.ok_or("Gist token yok")?;
            let gid = gist_id.ok_or("Gist id yok")?;
            http::gist_get(&token, &gid, &file).await?
        }
        TeamBackend::Webdav => {
            let url = webdav_url.ok_or("WebDAV URL yok")?;
            let user = webdav_user.unwrap_or_default();
            let pw = webdav_pw.ok_or("WebDAV parolası yok")?;
            http::webdav_get(&url, &user, &pw, &file).await?
        }
    };

    let data: PortableVault = crypto::decrypt_payload(&blob, &passphrase)?;
    let summary = ImportSummary {
        ok: true,
        error: None,
        canceled: None,
        hosts: data.hosts.len() as u32,
        identities: data.identities.len() as u32,
        groups: data.groups.len() as u32,
        skipped: 0,
    };
    state.vault.lock().unwrap().replace_team(&team_id, data)?;
    Ok(TeamVaultResult {
        ok: true,
        error: None,
        gist_id: None,
        summary: Some(summary),
    })
}
