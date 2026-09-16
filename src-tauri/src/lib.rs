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

#[derive(Debug, Clone)]
struct DocxHeadingInfo {
    text: String,
    level: usize,
}

fn extract_docx_headings(docx_path: &str) -> Result<Vec<DocxHeadingInfo>, String> {
    let file = std::fs::File::open(docx_path).map_err(|e| format!("打开 docx 文件失败: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("解析 docx zip 压缩包失败: {}", e))?;
    
    // 1. 解析 word/styles.xml，构建 styleId -> heading level (1..6) 映射
    let mut style_map: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    if let Ok(mut styles_file) = archive.by_name("word/styles.xml") {
        let mut styles_xml = String::new();
        if std::io::Read::read_to_string(&mut styles_file, &mut styles_xml).is_ok() {
            if let Ok(style_re) = regex::Regex::new(r#"(?s)<w:style[^>]*w:styleId="([^"]+)"[^>]*>.*?<w:name[^>]*w:val="([^"]+)""#) {
                for cap in style_re.captures_iter(&styles_xml) {
                    let style_id = cap[1].to_string();
                    let style_name = cap[2].to_lowercase();
                    
                    let level = if style_name.starts_with("heading ") || style_name.starts_with("标题 ") || style_name.starts_with("标题") {
                        let num_str: String = style_name.chars().filter(|c| c.is_digit(10)).collect();
                        num_str.parse::<usize>().unwrap_or(0)
                    } else {
                        0
                    };
                    
                    if level >= 1 && level <= 6 {
                        style_map.insert(style_id, level);
                    }
                }
            }
        }
    }
    
    // 2. 解析 word/document.xml 获取所有段落标题
    let mut doc_file = archive.by_name("word/document.xml").map_err(|e| format!("读取 word/document.xml 失败: {}", e))?;
    let mut doc_xml = String::new();
    std::io::Read::read_to_string(&mut doc_file, &mut doc_xml).map_err(|e| format!("读取 document.xml 内容失败: {}", e))?;
    
    let mut headings = Vec::new();
    let p_re = regex::Regex::new(r#"(?s)<w:p\b[^>]*>(.*?)</w:p>"#).map_err(|e| e.to_string())?;
    let p_style_re = regex::Regex::new(r#"<w:pStyle[^>]*w:val="([^"]+)""#).map_err(|e| e.to_string())?;
    let outline_lvl_re = regex::Regex::new(r#"<w:outlineLvl[^>]*w:val="(\d+)""#).map_err(|e| e.to_string())?;
    let t_re = regex::Regex::new(r#"<w:t\b[^>]*>(.*?)</w:t>"#).map_err(|e| e.to_string())?;

    for cap in p_re.captures_iter(&doc_xml) {
        let p_content = &cap[1];
        
        let style_id = p_style_re.captures(p_content).map(|c| c[1].to_string());
        let outline_lvl = outline_lvl_re.captures(p_content).and_then(|c| c[1].parse::<usize>().ok());
        
        // 提取段落所有文字
        let mut text = String::new();
        for t_cap in t_re.captures_iter(p_content) {
            text.push_str(&t_cap[1]);
        }
        let trimmed_text = text.trim();
        if trimmed_text.is_empty() {
            continue;
        }
        
        // 忽略目录样式
        if let Some(ref sid) = style_id {
            let lower_sid = sid.to_lowercase();
            if lower_sid.contains("toc") || lower_sid.contains("目录") {
                continue;
            }
        }
        
        let mut level = 0;
        if let Some(ref sid) = style_id {
            if let Some(&lvl) = style_map.get(sid) {
                level = lvl;
            }
        }
        
        if level == 0 {
            if let Some(lvl) = outline_lvl {
                level = lvl + 1; // outlineLvl 是 0 索引
            }
        }
        
        if level >= 1 && level <= 6 {
            if trimmed_text == "目录" || trimmed_text == "TABLE OF CONTENTS" {
                continue;
            }
            headings.push(DocxHeadingInfo {
                text: trimmed_text.to_string(),
                level,
            });
        }
    }
    
    Ok(headings)
}

fn enhance_markdown_with_headings(markdown: &str, headings: &[DocxHeadingInfo]) -> String {
    if headings.is_empty() {
        return markdown.to_string();
    }

    let mut lines: Vec<String> = markdown.lines().map(|s| s.to_string()).collect();
    let mut heading_ptr = 0;
    let clean_text_re = regex::Regex::new(r#"^(\d+(\.\d+)*\s*|[一二三四五六七八九十]+[、\.]\s*|\(\d+\)\s*)"#).unwrap();

    for line_idx in 0..lines.len() {
        if heading_ptr >= headings.len() {
            break;
        }
        
        let current_h = &headings[heading_ptr];
        let line_trimmed = lines[line_idx].trim();
        if line_trimmed.is_empty() {
            continue;
        }
        
        // 检查当前行是否与 Word 标题匹配
        let line_clean = line_trimmed.trim_start_matches('#').trim();
        let stripped_line = clean_text_re.replace(line_clean, "").trim().to_string();
        let target_stripped = clean_text_re.replace(&current_h.text, "").trim().to_string();
        
        let is_match = if !stripped_line.is_empty() && !target_stripped.is_empty() {
            stripped_line == target_stripped 
                || line_clean == current_h.text 
                || line_clean.ends_with(&current_h.text)
                || current_h.text.ends_with(line_clean)
        } else {
            line_clean == current_h.text
        };
        
        if is_match {
            let hashes = "#".repeat(current_h.level);
            let display_title = if !current_h.text.is_empty() {
                &current_h.text
            } else {
                &stripped_line
            };
            lines[line_idx] = format!("{} {}", hashes, display_title);
            heading_ptr += 1;
        }
    }
    
    lines.join("\n")
}

#[tauri::command]
fn convert_word_to_markdown(docx_path: String, assets_dir: String) -> Result<String, String> {
    use anytomd;

    // 创建 assets 目录（用于存放 Word 中提取的图片）
    fs::create_dir_all(&assets_dir).map_err(|e| format!("创建 assets 目录失败: {}", e))?;

    // 调用 anytomd 将 .docx 转换为 Markdown
    let options = anytomd::ConversionOptions {
        extract_images: true,
        ..Default::default()
    };
    
    let result = anytomd::convert_file(&docx_path, &options)
        .map_err(|e| format!("Word 文档转换失败: {}", e))?;

    // 提取 Word XML 中的原始标题层级，并对 markdown 标题进行精准校准与补全
    let headings = extract_docx_headings(&docx_path).unwrap_or_default();
    let mut markdown = enhance_markdown_with_headings(&result.markdown, &headings);

    // 第一步：保存所有图片到 assets 目录
    let mut image_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    
    for (idx, (filename, bytes)) in result.images.iter().enumerate() {
        let ext = if let Some(pos) = filename.rfind('.') {
            &filename[pos + 1..]
        } else {
            "png"
        };
        
        let save_filename = format!("image_{}.{}", idx, ext);
        let filepath = std::path::Path::new(&assets_dir).join(&save_filename);
        
        fs::write(&filepath, bytes)
            .map_err(|e| format!("保存图片失败: {}", e))?;
        
        // 记录原始文件名 -> 新文件名的映射
        image_map.insert(filename.clone(), save_filename);
    }
    
    // 第二步：替换 markdown 中的所有图片引用
    // 替换 base64 内嵌图片: ![](data:image/xxx;base64,...)
    let base64_pattern = regex::Regex::new(r"!\[[^\]]*\]\(data:image/[^;]+;base64,[^)]+\)").unwrap();
    let mut base64_idx = 0;
    markdown = base64_pattern.replace_all(&markdown, |_caps: &regex::Captures| {
        let save_filename = if base64_idx < result.images.len() {
            let ext = if let Some(pos) = result.images[base64_idx].0.rfind('.') {
                &result.images[base64_idx].0[pos + 1..]
            } else {
                "png"
            };
            let name = format!("image_{}.{}", base64_idx, ext);
            base64_idx += 1;
            name
        } else {
            format!("image_{}.png", base64_idx)
        };
        format!("![image](assets/{})", save_filename)
    }).to_string();
    
    // 替换原始文件名引用: ![](filename.png) 或 ![alt](filename.png)
    for (original_filename, save_filename) in &image_map {
        let escaped_name = regex::escape(original_filename);
        let pattern = format!(r"!\[[^\]]*\]\(([^/]*){}(?:\?[^\)]*)?\)", escaped_name);
        if let Ok(re) = regex::Regex::new(&pattern) {
            let new_ref = format!("![image](assets/{})", save_filename);
            markdown = re.replace_all(&markdown, new_ref.as_str()).to_string();
        }
    }

    Ok(markdown)
}

mod mcp_server;
use mcp_server::{get_mcp_status_rust, start_mcp_server_rust, stop_mcp_server_rust, AppState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState {
        app_handle: std::sync::Arc::new(std::sync::Mutex::new(None)),
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
            run_git_command,
            convert_word_to_markdown
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
