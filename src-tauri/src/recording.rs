//! Oturum kaydı (asciicast v2). Yalnız çıktı kaydedilir (girdi/sır değil).

use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

pub struct RecordingWriter {
    file: std::fs::File,
    start: Instant,
    pub path: PathBuf,
}

impl RecordingWriter {
    pub fn new(path: PathBuf, title: &str, cols: u16, rows: u16) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
        let ts = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
        let header = serde_json::json!({
            "version": 2,
            "width": cols,
            "height": rows,
            "timestamp": ts,
            "title": title,
        });
        writeln!(file, "{header}").map_err(|e| e.to_string())?;
        Ok(Self { file, start: Instant::now(), path })
    }

    pub fn write_chunk(&mut self, data: &str) {
        let elapsed = self.start.elapsed().as_secs_f64();
        let line = serde_json::json!([elapsed, "o", data]);
        let _ = writeln!(self.file, "{line}");
    }
}

/// `{ISO-ilk19}-{sanitize(title)}.cast` — güvenli dosya adı.
pub fn make_filename(title: &str) -> String {
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let safe: String = title
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .take(40)
        .collect();
    format!("{ts}-{safe}.cast")
}

pub fn recordings_dir(config_dir: &Path) -> PathBuf {
    config_dir.join("recordings")
}
