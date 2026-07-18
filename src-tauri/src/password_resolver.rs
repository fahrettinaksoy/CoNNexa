//! Harici parola yöneticilerinden sır çözer (RustConn deseni). Bağlantı anında
//! çalışır; sır vault'ta saklanmaz. 15 sn timeout.

use crate::types::{SecretManager, SecretRef};
use std::time::Duration;
use tokio::process::Command;

const TIMEOUT: Duration = Duration::from_secs(15);

pub async fn resolve(reference: &SecretRef) -> Result<String, String> {
    let out = match reference.manager {
        SecretManager::Bitwarden => run("bw", &["get", "password", &reference.reference]).await?,
        SecretManager::Onepassword => run("op", &["read", &reference.reference]).await?,
        SecretManager::Command => run_shell(&reference.reference).await?,
    };
    match reference.manager {
        // command: yalnız son newline'ı kırp; diğerleri trim.
        SecretManager::Command => Ok(out.strip_suffix('\n').unwrap_or(&out).to_string()),
        _ => Ok(out.trim().to_string()),
    }
}

async fn run(program: &str, args: &[&str]) -> Result<String, String> {
    let fut = Command::new(program).args(args).output();
    let output = tokio::time::timeout(TIMEOUT, fut)
        .await
        .map_err(|_| format!("{program} zaman aşımı"))?
        .map_err(|e| format!("{program} çalıştırılamadı: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "{program} hata: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

async fn run_shell(command: &str) -> Result<String, String> {
    #[cfg(windows)]
    let (sh, flag) = ("cmd", "/C");
    #[cfg(not(windows))]
    let (sh, flag) = ("sh", "-c");
    run(sh, &[flag, command]).await
}
