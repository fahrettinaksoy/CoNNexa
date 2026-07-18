//! Ağ yardımcıları (reqwest): GitHub Gist, WebDAV, genel JSON GET.

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("connexa")
        .build()
        .unwrap_or_default()
}

// ---- GitHub Gist ----

/// Gist oluşturur/günceller; kullanılan gist id'yi döndürür.
pub async fn gist_upsert(
    token: &str,
    gist_id: Option<&str>,
    filename: &str,
    content: &str,
    description: &str,
) -> Result<String, String> {
    let body = serde_json::json!({
        "description": description,
        "files": { filename: { "content": content } }
    });
    let c = client();
    let req = match gist_id {
        Some(id) => c.patch(format!("https://api.github.com/gists/{id}")),
        None => c.post("https://api.github.com/gists"),
    };
    let resp = req
        .header("Authorization", format!("Bearer {token}"))
        .header("Accept", "application/vnd.github+json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Gist hatası: {}", resp.status()));
    }
    let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    v.get("id")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Gist id alınamadı".to_string())
}

pub async fn gist_get(token: &str, gist_id: &str, filename: &str) -> Result<String, String> {
    let resp = client()
        .get(format!("https://api.github.com/gists/{gist_id}"))
        .header("Authorization", format!("Bearer {token}"))
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Gist okuma hatası: {}", resp.status()));
    }
    let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    v.get("files")
        .and_then(|f| f.get(filename))
        .and_then(|f| f.get("content"))
        .and_then(|c| c.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Gist dosyası bulunamadı".to_string())
}

// ---- WebDAV ----

fn webdav_url(base: &str, filename: &str) -> String {
    if base.ends_with('/') {
        format!("{base}{filename}")
    } else {
        base.to_string()
    }
}

pub async fn webdav_put(
    url: &str,
    user: &str,
    pass: &str,
    filename: &str,
    content: &str,
) -> Result<(), String> {
    let auth = B64.encode(format!("{user}:{pass}"));
    let resp = client()
        .put(webdav_url(url, filename))
        .header("Authorization", format!("Basic {auth}"))
        .header("Content-Type", "text/plain")
        .body(content.to_string())
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("WebDAV yazma hatası: {}", resp.status()));
    }
    Ok(())
}

pub async fn webdav_get(
    url: &str,
    user: &str,
    pass: &str,
    filename: &str,
) -> Result<String, String> {
    let auth = B64.encode(format!("{user}:{pass}"));
    let resp = client()
        .get(webdav_url(url, filename))
        .header("Authorization", format!("Basic {auth}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("WebDAV okuma hatası: {}", resp.status()));
    }
    resp.text().await.map_err(|e| e.to_string())
}

// ---- Genel JSON GET (cloud envanteri) ----

pub async fn get_json_bearer(url: &str, token: &str) -> Result<serde_json::Value, String> {
    let resp = client()
        .get(url)
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("API hatası: {}", resp.status()));
    }
    resp.json().await.map_err(|e| e.to_string())
}

/// ntfy/webhook bildirimi (POST).
pub async fn post_notify(
    url: &str,
    body: String,
    headers: Vec<(&str, String)>,
    json: bool,
) -> Result<(), String> {
    let mut req = client().post(url);
    for (k, v) in headers {
        req = req.header(k, v);
    }
    if json {
        req = req.header("Content-Type", "application/json");
    }
    let resp = req.body(body).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("bildirim hatası: {}", resp.status()));
    }
    Ok(())
}
