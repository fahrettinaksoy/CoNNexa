//! Eşik alarmları. 30 sn'de bir aktif SSH oturumlarını
//! izler; CPU/RAM/disk eşiği aşılınca (yalnız durum değişiminde) bildirir.

use std::collections::HashSet;
use std::time::Duration;

use tauri::{AppHandle, Manager};

use crate::http;
use crate::metrics;
use crate::state::AppState;
use crate::types::{AlarmConfig, AlarmNotifyType};

const POLL: Duration = Duration::from_secs(30);

pub async fn notify(
    config: &AlarmConfig,
    title: &str,
    message: &str,
    host: &str,
) -> Result<(), String> {
    match config.notify_type {
        AlarmNotifyType::Ntfy => {
            http::post_notify(
                &config.notify_target,
                message.to_string(),
                vec![
                    ("Title", title.to_string()),
                    ("Priority", "high".to_string()),
                    ("Tags", "warning".to_string()),
                ],
                false,
            )
            .await
        }
        AlarmNotifyType::Webhook => {
            let body = serde_json::json!({ "title": title, "message": message, "host": host });
            http::post_notify(&config.notify_target, body.to_string(), vec![], true).await
        }
    }
}

pub async fn test(config: &AlarmConfig) -> Result<(), String> {
    if config.notify_target.is_empty() {
        return Err("bildirim hedefi ayarlı değil".into());
    }
    notify(config, "Connexa Test", "Bu bir test bildirimidir.", "test").await
}

/// Arka plan izleme döngüsünü başlatır (setup'ta çağrılır).
pub fn spawn_loop(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut breached: HashSet<String> = HashSet::new();
        loop {
            tokio::time::sleep(POLL).await;
            evaluate(&app, &mut breached).await;
        }
    });
}

async fn evaluate(app: &AppHandle, breached: &mut HashSet<String>) {
    // Config + aktif ssh oturumlarını kilit altında al, sonra bırak.
    let (config, sessions): (AlarmConfig, Vec<(String, String)>) = {
        let state = app.state::<AppState>();
        let config = state.vault.lock().unwrap().get_alarm_config();
        let sessions = state.sessions.ssh_sessions();
        (config, sessions)
    };
    if !config.enabled || config.notify_target.is_empty() {
        return;
    }

    for (id, title) in sessions {
        let handle = {
            let state = app.state::<AppState>();
            state.sessions.get_ssh(&id)
        };
        let Some(handle) = handle else { continue };
        let m = metrics::snapshot(&handle).await;
        if !m.ok {
            continue;
        }
        let cpu = match (m.load_avg, m.cpu_count) {
            (Some(la), Some(n)) if n > 0 => la[0] / n as f64 * 100.0,
            _ => 0.0,
        };
        let ram = match (m.mem_used_bytes, m.mem_total_bytes) {
            (Some(u), Some(t)) if t > 0 => u as f64 / t as f64 * 100.0,
            _ => 0.0,
        };
        let disk = m
            .disks
            .as_ref()
            .map(|d| d.iter().map(|x| x.use_percent).fold(0.0, f64::max))
            .unwrap_or(0.0);

        let mut msgs = Vec::new();
        if cpu >= config.cpu_percent {
            msgs.push(format!("CPU %{cpu:.0}"));
        }
        if ram >= config.mem_percent {
            msgs.push(format!("RAM %{ram:.0}"));
        }
        if disk >= config.disk_percent {
            msgs.push(format!("Disk %{disk:.0}"));
        }

        if !msgs.is_empty() {
            if breached.insert(id.clone()) {
                let message = format!("{title}: {}", msgs.join(", "));
                let _ = notify(&config, "Connexa Alarm", &message, &title).await;
            }
        } else {
            breached.remove(&id);
        }
    }
}
