//! SFTP komutları. İndirme/yükleme native dosya diyaloğu kullanır.

use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::sftp::posix_join;
use crate::state::AppState;
use crate::types::{SftpEntry, SftpResult};

async fn handle_for(
    state: &State<'_, AppState>,
    session_id: &str,
) -> Result<crate::ssh::SshHandle, String> {
    state
        .sessions
        .get_ssh(session_id)
        .ok_or_else(|| "SSH oturumu bulunamadı".to_string())
}

#[tauri::command]
pub async fn sftp_home(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<SftpResult<String>, String> {
    let handle = match handle_for(&state, &session_id).await {
        Ok(h) => h,
        Err(e) => return Ok(SftpResult::err(e)),
    };
    Ok(match state.sftp.home(&session_id, &handle).await {
        Ok(p) => SftpResult::ok(p),
        Err(e) => SftpResult::err(e),
    })
}

#[tauri::command]
pub async fn sftp_list(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<SftpResult<Vec<SftpEntry>>, String> {
    let handle = match handle_for(&state, &session_id).await {
        Ok(h) => h,
        Err(e) => return Ok(SftpResult::err(e)),
    };
    Ok(match state.sftp.list(&session_id, &handle, &path).await {
        Ok(v) => SftpResult::ok(v),
        Err(e) => SftpResult::err(e),
    })
}

#[tauri::command]
pub async fn sftp_mkdir(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<SftpResult<()>, String> {
    let handle = match handle_for(&state, &session_id).await {
        Ok(h) => h,
        Err(e) => return Ok(SftpResult::err(e)),
    };
    Ok(match state.sftp.mkdir(&session_id, &handle, &path).await {
        Ok(()) => SftpResult {
            ok: true,
            error: None,
            data: None,
        },
        Err(e) => SftpResult::err(e),
    })
}

#[tauri::command]
pub async fn sftp_rename(
    state: State<'_, AppState>,
    session_id: String,
    from: String,
    to: String,
) -> Result<SftpResult<()>, String> {
    let handle = match handle_for(&state, &session_id).await {
        Ok(h) => h,
        Err(e) => return Ok(SftpResult::err(e)),
    };
    Ok(
        match state.sftp.rename(&session_id, &handle, &from, &to).await {
            Ok(()) => SftpResult {
                ok: true,
                error: None,
                data: None,
            },
            Err(e) => SftpResult::err(e),
        },
    )
}

#[tauri::command]
pub async fn sftp_delete(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
    is_dir: bool,
) -> Result<SftpResult<()>, String> {
    let handle = match handle_for(&state, &session_id).await {
        Ok(h) => h,
        Err(e) => return Ok(SftpResult::err(e)),
    };
    Ok(
        match state.sftp.delete(&session_id, &handle, &path, is_dir).await {
            Ok(()) => SftpResult {
                ok: true,
                error: None,
                data: None,
            },
            Err(e) => SftpResult::err(e),
        },
    )
}

#[tauri::command]
pub async fn sftp_download(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    remote_path: String,
) -> Result<SftpResult<String>, String> {
    let handle = match handle_for(&state, &session_id).await {
        Ok(h) => h,
        Err(e) => return Ok(SftpResult::err(e)),
    };
    let data = match state
        .sftp
        .read_file(&session_id, &handle, &remote_path)
        .await
    {
        Ok(d) => d,
        Err(e) => return Ok(SftpResult::err(e)),
    };
    let basename = remote_path
        .rsplit('/')
        .next()
        .unwrap_or("indirilen")
        .to_string();

    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_file_name(&basename)
        .save_file(move |p| {
            let _ = tx.send(p);
        });
    let picked = rx.await.ok().flatten();
    let Some(fp) = picked else {
        return Ok(SftpResult::ok(String::new())); // iptal
    };
    let path = match fp.into_path() {
        Ok(p) => p,
        Err(e) => return Ok(SftpResult::err(e.to_string())),
    };
    if let Err(e) = std::fs::write(&path, &data) {
        return Ok(SftpResult::err(e.to_string()));
    }
    Ok(SftpResult::ok(path.display().to_string()))
}

#[tauri::command]
pub async fn sftp_upload(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    remote_dir: String,
) -> Result<SftpResult<Vec<String>>, String> {
    let handle = match handle_for(&state, &session_id).await {
        Ok(h) => h,
        Err(e) => return Ok(SftpResult::err(e)),
    };

    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_files(move |p| {
        let _ = tx.send(p);
    });
    let picked = rx.await.ok().flatten();
    let Some(files) = picked else {
        return Ok(SftpResult::ok(vec![])); // iptal
    };

    let mut uploaded = Vec::new();
    for fp in files {
        let path = match fp.into_path() {
            Ok(p) => p,
            Err(e) => return Ok(SftpResult::err(e.to_string())),
        };
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "dosya".to_string());
        let data = match std::fs::read(&path) {
            Ok(d) => d,
            Err(e) => return Ok(SftpResult::err(e.to_string())),
        };
        let remote = posix_join(&remote_dir, &name);
        if let Err(e) = state
            .sftp
            .write_file(&session_id, &handle, &remote, &data)
            .await
        {
            return Ok(SftpResult::err(e));
        }
        uploaded.push(name);
    }
    Ok(SftpResult::ok(uploaded))
}
