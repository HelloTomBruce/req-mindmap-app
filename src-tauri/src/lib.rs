use std::fs;
use std::path::Path;

#[tauri::command]
fn write_text_file_custom(path: String, content: String) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    fs::write(p, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_dir_all_custom(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.exists() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn copy_local_file_custom(src_path: String, dest_path: String) -> Result<(), String> {
    let dest = Path::new(&dest_path);
    if let Some(parent) = dest.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    fs::copy(&src_path, dest).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_text_file_custom(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_image_data_url(project_path: String, relative_path: String) -> Result<String, String> {
    use base64::Engine;
    let full_path = Path::new(&project_path).join(&relative_path);
    let bytes = fs::read(&full_path).map_err(|e| e.to_string())?;
    let ext = full_path.extension().and_then(|s| s.to_str()).unwrap_or("png");
    let mime = match ext {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        _ => "image/png"
    };
    let base64_str = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!("data:{};base64,{}", mime, base64_str))
}

#[tauri::command]
fn save_image_binary(project_path: String, file_name: String, base64_data: String) -> Result<String, String> {
    use base64::Engine;

    let assets_dir = Path::new(&project_path).join("assets");
    if !assets_dir.exists() {
        fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    }

    let clean_base64 = if let Some(pos) = base64_data.find(",") {
        &base64_data[pos + 1..]
    } else {
        &base64_data
    };

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(clean_base64)
        .map_err(|e| e.to_string())?;

    let file_path = assets_dir.join(&file_name);
    fs::write(&file_path, bytes).map_err(|e| e.to_string())?;

    Ok(format!("assets/{}", file_name))
}

mod mcp_server;
use mcp_server::{get_mcp_status_rust, start_mcp_server_rust, stop_mcp_server_rust, AppState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState {
        project_path: std::sync::Arc::new(std::sync::Mutex::new(String::new())),
        port: std::sync::Arc::new(std::sync::Mutex::new(6001)),
        is_running: std::sync::Arc::new(std::sync::Mutex::new(false)),
        cancel_tx: std::sync::Arc::new(std::sync::Mutex::new(None)),
        sse_tx: std::sync::Arc::new(std::sync::Mutex::new(None)),
        logs: std::sync::Arc::new(std::sync::Mutex::new(Vec::new())),
    };

    let state_to_start = app_state.clone();
    let (tx, rx) = tokio::sync::oneshot::channel::<()>();
    {
        let mut tx_opt = app_state.cancel_tx.lock().unwrap();
        *tx_opt = Some(tx);
        let mut running = app_state.is_running.lock().unwrap();
        *running = true;
    }
    tauri::async_runtime::spawn(async move {
        let addr = "0.0.0.0:6001";
        let app = axum::Router::new()
            .route("/sse", axum::routing::get(mcp_server::sse_handler))
            .route("/messages", axum::routing::post(mcp_server::handle_mcp_rpc))
            .route("/rpc", axum::routing::post(mcp_server::handle_mcp_rpc))
            .layer(tower_http::cors::CorsLayer::permissive())
            .with_state(state_to_start.clone());

        if let Ok(listener) = tokio::net::TcpListener::bind(&addr).await {
            let _ = axum::serve(listener, app)
                .with_graceful_shutdown(async move {
                    let _ = rx.await;
                })
                .await;
        }

        if let Ok(mut running) = state_to_start.is_running.lock() {
            *running = false;
        }
    });

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            write_text_file_custom,
            read_text_file_custom,
            delete_dir_all_custom,
            copy_local_file_custom,
            read_binary_file,
            read_image_data_url,
            save_image_binary,
            start_mcp_server_rust,
            stop_mcp_server_rust,
            get_mcp_status_rust
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
