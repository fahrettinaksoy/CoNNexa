//! Bildirimsel plugin yönetimi. Kod ÇALIŞTIRILMAZ;
//! yalnız snippet katkısı. Her plugin `plugins/<id>/plugin.json` manifesti.

use std::path::{Path, PathBuf};

use serde::Deserialize;

use crate::types::{PluginInfo, PluginResult, Snippet};

#[derive(Deserialize)]
struct ManifestSnippet {
    name: String,
    command: String,
    #[serde(default)]
    tags: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct Manifest {
    name: String,
    version: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    author: Option<String>,
    #[serde(default)]
    snippets: Option<Vec<ManifestSnippet>>,
}

pub fn plugins_dir(config_dir: &Path) -> PathBuf {
    config_dir.join("plugins")
}

pub fn list(config_dir: &Path) -> PluginResult {
    let dir = plugins_dir(config_dir);
    let mut plugins = Vec::new();
    let mut snippets = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let manifest_path = path.join("plugin.json");
            let Ok(text) = std::fs::read_to_string(&manifest_path) else { continue };
            let Ok(manifest) = serde_json::from_str::<Manifest>(&text) else { continue };
            let dir_name = entry.file_name().to_string_lossy().to_string();
            let snips = manifest.snippets.unwrap_or_default();
            for (i, s) in snips.iter().enumerate() {
                snippets.push(Snippet {
                    id: format!("plugin:{dir_name}:{i}"),
                    name: s.name.clone(),
                    command: s.command.clone(),
                    tags: s.tags.clone().unwrap_or_default(),
                    team_vault_id: None,
                });
            }
            plugins.push(PluginInfo {
                id: dir_name,
                name: manifest.name,
                version: manifest.version,
                description: manifest.description,
                author: manifest.author,
                snippet_count: snips.len() as u32,
            });
        }
    }

    PluginResult { ok: true, error: None, plugins, snippets }
}

pub fn install(config_dir: &Path, source: &Path) -> PluginResult {
    let manifest_path = source.join("plugin.json");
    let text = match std::fs::read_to_string(&manifest_path) {
        Ok(t) => t,
        Err(_) => return err("Geçerli bir plugin.json bulunamadı"),
    };
    if serde_json::from_str::<Manifest>(&text).is_err() {
        return err("plugin.json geçersiz (name/version zorunlu)");
    }
    let base = match source.file_name() {
        Some(n) => n.to_string_lossy().to_string(),
        None => return err("kaynak dizin adı çözülemedi"),
    };
    let target = plugins_dir(config_dir).join(&base);
    if let Err(e) = copy_dir_recursive(source, &target) {
        return err(e);
    }
    list(config_dir)
}

pub fn remove(config_dir: &Path, id: &str) -> PluginResult {
    // Yol kaçışı koruması
    if id.contains('/') || id.contains('\\') || id.contains("..") {
        return err("geçersiz plugin id");
    }
    let target = plugins_dir(config_dir).join(id);
    let _ = std::fs::remove_dir_all(&target);
    list(config_dir)
}

fn err(msg: impl Into<String>) -> PluginResult {
    PluginResult { ok: false, error: Some(msg.into()), plugins: vec![], snippets: vec![] }
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let dest = dst.join(entry.file_name());
        if path.is_dir() {
            copy_dir_recursive(&path, &dest)?;
        } else {
            std::fs::copy(&path, &dest).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
