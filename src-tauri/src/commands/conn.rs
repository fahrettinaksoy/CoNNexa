//! SSH bağlantısı için host → identity → sır çözümü (session ve tunnel ortak).

use tauri::State;

use crate::password_resolver;
use crate::ssh::{AuthMethod, SshAuth};
use crate::state::AppState;
use crate::types::{AuthType, Host};

/// Host için (adres, port, SshAuth) çözer. Vault kilidi await öncesi bırakılır.
pub async fn resolve_host_auth(
    state: &State<'_, AppState>,
    host: &Host,
) -> Result<(String, u16, SshAuth), String> {
    let (username, auth_type, password, passphrase, private_key_path, secret_ref) = {
        let vault = state.vault.lock().unwrap();
        let iid = vault
            .resolve_identity_id(host)
            .ok_or("Host has no identity assigned")?;
        let s = vault.resolve_secrets(&iid)?;
        (
            s.identity.username.clone(),
            s.identity.auth_type,
            s.password,
            s.passphrase,
            s.identity.private_key_path.clone(),
            s.identity.secret_ref.clone(),
        )
    };

    let method = match auth_type {
        AuthType::Password => {
            let pw = if let Some(sr) = &secret_ref {
                password_resolver::resolve(sr).await?
            } else {
                password.ok_or("Identity için parola yok")?
            };
            AuthMethod::Password(pw)
        }
        AuthType::Key => {
            let path = private_key_path.ok_or("Anahtar dosyası yolu yok")?;
            let pem = std::fs::read_to_string(&path)
                .map_err(|e| format!("anahtar dosyası okunamadı: {e}"))?;
            AuthMethod::Key { pem, passphrase }
        }
        AuthType::Agent => AuthMethod::Agent,
    };

    let port = if host.port == 0 { 22 } else { host.port };
    Ok((host.hostname.clone(), port, SshAuth { username, method }))
}
