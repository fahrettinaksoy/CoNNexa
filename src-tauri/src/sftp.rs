//! SFTP alt sistemi (russh-sftp). Aynı SSH bağlantısını yeniden kullanır;
//! session id başına bir `SftpSession` önbelleğe alınır.

use std::collections::HashMap;
use std::sync::Arc;

use russh_sftp::client::SftpSession;
use tokio::sync::Mutex;

use crate::ssh::SshHandle;
use crate::types::{SftpEntry, SftpEntryType};

#[derive(Default)]
pub struct SftpService {
    cache: Mutex<HashMap<String, Arc<SftpSession>>>,
}

impl SftpService {
    pub fn new() -> Self {
        Self::default()
    }

    async fn session(&self, id: &str, handle: &SshHandle) -> Result<Arc<SftpSession>, String> {
        if let Some(s) = self.cache.lock().await.get(id) {
            return Ok(s.clone());
        }
        let channel = handle
            .channel_open_session()
            .await
            .map_err(|e| format!("sftp kanalı açılamadı: {e}"))?;
        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| format!("sftp alt sistemi hatası: {e}"))?;
        let sftp = SftpSession::new(channel.into_stream())
            .await
            .map_err(|e| format!("sftp oturumu kurulamadı: {e}"))?;
        let arc = Arc::new(sftp);
        self.cache.lock().await.insert(id.to_string(), arc.clone());
        Ok(arc)
    }

    pub async fn forget(&self, id: &str) {
        self.cache.lock().await.remove(id);
    }

    pub async fn home(&self, id: &str, handle: &SshHandle) -> Result<String, String> {
        let s = self.session(id, handle).await?;
        s.canonicalize(".").await.map_err(|e| e.to_string())
    }

    pub async fn list(
        &self,
        id: &str,
        handle: &SshHandle,
        path: &str,
    ) -> Result<Vec<SftpEntry>, String> {
        let s = self.session(id, handle).await?;
        let dir = s.read_dir(path).await.map_err(|e| e.to_string())?;
        let mut entries: Vec<SftpEntry> = Vec::new();
        for entry in dir {
            let ft = entry.file_type();
            let entry_type = if ft.is_dir() {
                SftpEntryType::Dir
            } else if ft.is_symlink() {
                SftpEntryType::Link
            } else {
                SftpEntryType::File
            };
            let meta = entry.metadata();
            entries.push(SftpEntry {
                name: entry.file_name(),
                path: entry.path(),
                entry_type,
                size: meta.size.unwrap_or(0),
                mtime: meta.mtime.unwrap_or(0) as i64 * 1000,
            });
        }
        // Dizinler önce, sonra ada göre.
        entries.sort_by(|a, b| {
            let ad = matches!(a.entry_type, SftpEntryType::Dir);
            let bd = matches!(b.entry_type, SftpEntryType::Dir);
            bd.cmp(&ad).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });
        Ok(entries)
    }

    pub async fn mkdir(&self, id: &str, handle: &SshHandle, path: &str) -> Result<(), String> {
        let s = self.session(id, handle).await?;
        s.create_dir(path).await.map_err(|e| e.to_string())
    }

    pub async fn rename(
        &self,
        id: &str,
        handle: &SshHandle,
        from: &str,
        to: &str,
    ) -> Result<(), String> {
        let s = self.session(id, handle).await?;
        s.rename(from, to).await.map_err(|e| e.to_string())
    }

    pub async fn delete(
        &self,
        id: &str,
        handle: &SshHandle,
        path: &str,
        is_dir: bool,
    ) -> Result<(), String> {
        let s = self.session(id, handle).await?;
        if is_dir {
            s.remove_dir(path).await.map_err(|e| e.to_string())
        } else {
            s.remove_file(path).await.map_err(|e| e.to_string())
        }
    }

    /// Uzak dosyayı okur (indirme için).
    pub async fn read_file(
        &self,
        id: &str,
        handle: &SshHandle,
        path: &str,
    ) -> Result<Vec<u8>, String> {
        let s = self.session(id, handle).await?;
        s.read(path).await.map_err(|e| e.to_string())
    }

    /// Uzak dosyaya yazar (yükleme için).
    pub async fn write_file(
        &self,
        id: &str,
        handle: &SshHandle,
        path: &str,
        data: &[u8],
    ) -> Result<(), String> {
        let s = self.session(id, handle).await?;
        s.write(path, data).await.map_err(|e| e.to_string())
    }
}

/// POSIX yol birleştirme (uzak yollar daima POSIX).
pub fn posix_join(dir: &str, name: &str) -> String {
    if dir.ends_with('/') {
        format!("{dir}{name}")
    } else {
        format!("{dir}/{name}")
    }
}
