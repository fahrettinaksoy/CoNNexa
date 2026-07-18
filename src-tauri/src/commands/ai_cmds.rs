//! AI asistanı komutları.

use tauri::{AppHandle, State};

use crate::state::AppState;
use crate::types::{AiConfigInput, AiConfigPublic};

#[tauri::command]
pub fn ai_get_config(state: State<AppState>) -> AiConfigPublic {
    state.vault.lock().unwrap().get_ai_public()
}

#[tauri::command]
pub fn ai_save_config(state: State<AppState>, input: AiConfigInput) -> Result<(), String> {
    state.vault.lock().unwrap().save_ai_config(input)
}

#[tauri::command]
pub fn ai_ask(
    app: AppHandle,
    state: State<AppState>,
    request_id: String,
    prompt: String,
    context: Option<String>,
) {
    let (model, api_key) = match state.vault.lock().unwrap().resolve_ai() {
        Ok(v) => v,
        Err(e) => {
            crate::events::emit_ai_error(&app, &request_id, &e);
            return;
        }
    };
    state
        .ai
        .ask(app, request_id, model, api_key, prompt, context);
}

#[tauri::command]
pub fn ai_cancel(state: State<AppState>, request_id: String) {
    state.ai.cancel(&request_id);
}
