//! AI asistanı — Anthropic Messages API'ye SSE streaming.
//! `ai:delta`/`ai:done`/`ai:error` event'leri yayınlar; istek iptal edilebilir.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use futures_util::StreamExt;
use tauri::AppHandle;

use crate::events::{emit_ai_delta, emit_ai_done, emit_ai_error};

const SYSTEM_PROMPT: &str = "Sen bir kabuk (shell) komut asistanısın. Kullanıcının isteğine karşılık \
tek satırlık kısa bir açıklama ver, ardından çalıştırılacak komutu ```bash kod bloğu içinde ver. \
Tehlikeli komutlarda (silme, format, sistem değişikliği) açıkça uyar. Türkçe yanıtla.";

type CancelMap = Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>;

#[derive(Default, Clone)]
pub struct AiService {
    cancels: CancelMap,
}

impl AiService {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn cancel(&self, request_id: &str) {
        if let Some(flag) = self.cancels.lock().unwrap().get(request_id) {
            flag.store(true, Ordering::Relaxed);
        }
    }

    /// Streaming isteği başlatır (arka plan task). model/apiKey vault'tan çözülür.
    pub fn ask(
        &self,
        app: AppHandle,
        request_id: String,
        model: String,
        api_key: Option<String>,
        prompt: String,
        context: Option<String>,
    ) {
        let api_key = match api_key {
            Some(k) if !k.is_empty() => k,
            _ => {
                emit_ai_error(&app, &request_id, "API anahtarı ayarlı değil");
                return;
            }
        };
        let cancel = Arc::new(AtomicBool::new(false));
        self.cancels.lock().unwrap().insert(request_id.clone(), cancel.clone());

        let cancels = self.cancels.clone();
        tauri::async_runtime::spawn(async move {
            let user_content = match context {
                Some(ctx) if !ctx.is_empty() => {
                    let tail: String = ctx.chars().rev().take(2000).collect::<Vec<_>>().into_iter().rev().collect();
                    format!("Bağlam (terminal çıktısı):\n{tail}\n\nGörev: {prompt}")
                }
                _ => prompt,
            };
            let result = stream_messages(&app, &request_id, &model, &api_key, &user_content, &cancel).await;
            match result {
                Ok(()) => emit_ai_done(&app, &request_id),
                Err(e) => {
                    if cancel.load(Ordering::Relaxed) {
                        emit_ai_done(&app, &request_id);
                    } else {
                        emit_ai_error(&app, &request_id, &e);
                    }
                }
            }
            cancels.lock().unwrap().remove(&request_id);
        });
    }
}

async fn stream_messages(
    app: &AppHandle,
    request_id: &str,
    model: &str,
    api_key: &str,
    user_content: &str,
    cancel: &Arc<AtomicBool>,
) -> Result<(), String> {
    let body = serde_json::json!({
        "model": model,
        "max_tokens": 2048,
        "system": SYSTEM_PROMPT,
        "stream": true,
        "messages": [{ "role": "user", "content": user_content }],
    });

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Anthropic hatası {status}: {text}"));
    }

    let mut stream = resp.bytes_stream();
    let mut buf = String::new();
    while let Some(chunk) = stream.next().await {
        if cancel.load(Ordering::Relaxed) {
            return Err("iptal edildi".into());
        }
        let bytes = chunk.map_err(|e| e.to_string())?;
        buf.push_str(&String::from_utf8_lossy(&bytes));
        // SSE: satır satır işle; tamamlanmamış son satırı buf'ta bırak
        while let Some(pos) = buf.find('\n') {
            let line = buf[..pos].trim_end().to_string();
            buf.drain(..=pos);
            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" {
                    return Ok(());
                }
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
                    let t = v.get("type").and_then(|x| x.as_str()).unwrap_or("");
                    if t == "content_block_delta" {
                        if let Some(text) = v.get("delta").and_then(|d| d.get("text")).and_then(|x| x.as_str()) {
                            emit_ai_delta(app, request_id, text);
                        }
                    } else if t == "message_stop" {
                        return Ok(());
                    } else if t == "error" {
                        let msg = v.get("error").and_then(|e| e.get("message")).and_then(|x| x.as_str()).unwrap_or("bilinmeyen hata");
                        return Err(msg.to_string());
                    }
                }
            }
        }
    }
    Ok(())
}
