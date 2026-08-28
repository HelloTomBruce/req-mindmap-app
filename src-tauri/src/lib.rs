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
fn run_git_command(cwd: String, args: Vec<String>) -> Result<String, String> {
    // 子命令白名单，防止前端传入危险 git 操作 (如 push, config --global, rm 等)
    const ALLOWED_SUBCOMMANDS: &[&str] = &[
        "init", "add", "commit", "status", "log", "diff", "checkout",
        "reset", "rm", "diff-tree", "show", "stash", "branch", "merge",
    ];
    if let Some(first) = args.first() {
        if !ALLOWED_SUBCOMMANDS.contains(&first.as_str()) {
            return Err(format!("不允许的 git 子命令: {}", first));
        }
    } else {
        return Err("git 命令参数不能为空".to_string());
    }

    let output = std::process::Command::new("git")
        .current_dir(&cwd)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute git: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn read_text_file_custom(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_file_custom(path: String) -> Result<(), String> {
    if Path::new(&path).exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

fn get_app_index_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取 AppData 目录失败: {}", e))?;
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).map_err(|e| format!("创建 AppData 目录失败: {}", e))?;
    }
    Ok(app_dir.join("projects_index.json"))
}

#[tauri::command]
fn load_recent_projects_custom(app: tauri::AppHandle) -> Result<String, String> {
    let index_path = get_app_index_path(&app)?;
    if index_path.exists() {
        fs::read_to_string(&index_path).map_err(|e| e.to_string())
    } else {
        Ok("[]".to_string())
    }
}

#[tauri::command]
fn save_recent_projects_custom(app: tauri::AppHandle, content: String) -> Result<(), String> {
    let index_path = get_app_index_path(&app)?;
    fs::write(index_path, content).map_err(|e| e.to_string())
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
fn read_image_as_base64(path: String) -> Result<String, String> {
    use base64::Engine;
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let base64_str = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(base64_str)
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
        sse_clients: std::sync::Arc::new(std::sync::Mutex::new(Vec::new())),
        logs: std::sync::Arc::new(std::sync::Mutex::new(Vec::new())),
        last_mcp_write: std::sync::Arc::new(std::sync::Mutex::new(0)),
    };

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            write_text_file_custom,
            read_text_file_custom,
            remove_file_custom,
            delete_dir_all_custom,
            copy_local_file_custom,
            read_binary_file,
            read_image_data_url,
            read_image_as_base64,
            save_image_binary,
            load_recent_projects_custom,
            save_recent_projects_custom,
            start_mcp_server_rust,
            stop_mcp_server_rust,
            get_mcp_status_rust,
            run_git_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
