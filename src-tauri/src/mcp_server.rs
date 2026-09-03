use axum::{
    extract::State,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tower_http::cors::CorsLayer;

// 从 poisoned Mutex 中恢复，避免一次 panic 导致整个 MCP 服务链路永久瘫痪
macro_rules! safe_lock {
    ($mutex:expr) => {
        $mutex.lock().unwrap_or_else(|e| e.into_inner())
    };
}

static IMG_RE: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();

fn mark_mcp_write(state: &AppState) {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    *safe_lock!(state.last_mcp_write) = ts;
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct MCPLogItem {
    pub id: String,
    pub time: String,
    pub tool: String,
    pub params: Value,
    pub status: String,
}

#[derive(Clone)]
pub struct AppState {
    pub app_handle: Arc<Mutex<Option<tauri::AppHandle>>>,
    pub project_path: Arc<Mutex<String>>,
    pub port: Arc<Mutex<u16>>,
    pub is_running: Arc<Mutex<bool>>,
    pub cancel_tx: Arc<Mutex<Option<tokio::sync::oneshot::Sender<()>>>>,
    pub sse_clients: Arc<Mutex<Vec<tokio::sync::mpsc::Sender<Result<axum::response::sse::Event, std::convert::Infallible>>>>>,
    pub logs: Arc<Mutex<Vec<MCPLogItem>>>,
    pub last_mcp_write: Arc<Mutex<u64>>,
}

fn add_log(state: &AppState, tool: String, params: Value, status: String) {
    let now = chrono::Local::now().format("%H:%M:%S").to_string();
    let id = format!("log-{}", now);
    let item = MCPLogItem {
        id,
        time: now,
        tool,
        params,
        status,
    };
    if let Ok(mut logs) = state.logs.lock() {
        logs.insert(0, item);
        if logs.len() > 50 {
            logs.pop();
        }
    }
}

// 辅助函数：根据双重 MCP 客户端标准，同时支持在 HTTP 200 响应体中直接返回 JSON-RPC 以及经由 SSE 广播回执
async fn send_rpc_response(state: &AppState, res_val: Value) -> axum::response::Response {
    use axum::response::sse::Event;

    if let Ok(guard) = state.sse_clients.lock() {
        for tx in guard.iter() {
            let json_str = serde_json::to_string(&res_val).unwrap_or_default();
            let _ = tx.try_send(Ok(Event::default().event("message").data(json_str)));
        }
    }

    axum::response::Response::builder()
        .status(axum::http::StatusCode::OK)
        .header("Content-Type", "application/json")
        .body(axum::body::Body::from(serde_json::to_string(&res_val).unwrap_or_default()))
        .unwrap()
}

// 标准 MCP JSON-RPC 处理器
pub async fn handle_mcp_rpc(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> axum::response::Response {
    let method = payload.get("method").and_then(|v| v.as_str()).unwrap_or("");
    let is_notification = payload.get("id").is_none() || method.starts_with("notifications/");
    let id = payload.get("id").cloned().unwrap_or(Value::Null);

    // 1. JSON-RPC Notification (如 notifications/initialized)：规范严格要求不可向客户端回复任何 JSON-RPC 消息
    if is_notification {
        return axum::response::Response::builder()
            .status(axum::http::StatusCode::ACCEPTED)
            .header("Content-Type", "text/plain")
            .body(axum::body::Body::from("Accepted"))
            .unwrap();
    }

    let p_path = safe_lock!(state.project_path).clone();

    if method == "initialize" {
        return send_rpc_response(&state, json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {
                        "listChanged": true
                    },
                    "resources": {
                        "listChanged": true
                    },
                    "prompts": {
                        "listChanged": true
                    }
                },
                "serverInfo": {
                    "name": "req-mindmark-mcp",
                    "version": "1.4.0"
                }
            }
        })).await;
    }

    if method == "ping" {
        return send_rpc_response(&state, json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {}
        })).await;
    }

    if method == "resources/list" {
        return send_rpc_response(&state, json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "resources": []
            }
        })).await;
    }

    if method == "resources/templates/list" {
        return send_rpc_response(&state, json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "resourceTemplates": []
            }
        })).await;
    }

    if method == "prompts/list" {
        return send_rpc_response(&state, json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "prompts": []
            }
        })).await;
    }

    if method == "tools/list" {
        return send_rpc_response(&state, json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "tools": [
                    {
                        "name": "list_projects",
                        "description": "获取当前所有的需求项目列表（包含项目名称、本地目录路径及当前激活状态）",
                        "inputSchema": { "type": "object", "properties": {} }
                    },
                    {
                        "name": "get_requirements_tree",
                        "description": "获取当前需求项目的完整模块树架构、节点ID、文档路径及完成状态",
                        "inputSchema": { "type": "object", "properties": {} }
                    },
                    {
                        "name": "get_requirement_detail",
                        "description": "读取并返回某个特定需求节点的详细 Markdown 描述内容",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "doc_path": { "type": "string" },
                                "node_id": { "type": "string" }
                            }
                        }
                    },
                    {
                        "name": "search_requirements",
                        "description": "在需求文档库中全局搜索指定关键词（如接口定义、功能点、业务规则）",
                        "inputSchema": {
                            "type": "object",
                            "properties": { "query": { "type": "string" } },
                            "required": ["query"]
                        }
                    },
                    {
                        "name": "update_requirement_status",
                        "description": "当 AI 完成编码或重构后，自动更新需求节点的状态(draft, todo, in_progress, completed)",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "node_id": { "type": "string" },
                                "status": { "type": "string" }
                            },
                            "required": ["node_id", "status"]
                        }
                    },
                    {
                        "name": "add_node",
                        "description": "向需求思维导图中添加一个新的子节点，并自动创建关联的 Markdown 需求文档",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "parent_id": { "type": "string", "description": "父节点的 ID" },
                                "title": { "type": "string", "description": "节点标题" },
                                "priority": { "type": "string", "description": "优先级 (P0, P1, P2, P3)", "enum": ["P0", "P1", "P2", "P3"] },
                                "status": { "type": "string", "description": "初始状态 (draft, todo, in_progress, completed)", "enum": ["draft", "todo", "in_progress", "completed"] },
                                "tags": { "type": "array", "items": { "type": "string" }, "description": "节点标签列表" },
                                "content": { "type": "string", "description": "节点对应的初始 Markdown 文档内容" }
                            },
                            "required": ["parent_id", "title"]
                        }
                    },
                    {
                        "name": "update_node",
                        "description": "更新需求思维导图中指定节点的元数据信息（标题、优先级、状态、标签、Markdown 详细文档）",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "node_id": { "type": "string", "description": "需要修改的节点 ID" },
                                "title": { "type": "string", "description": "新的节点标题" },
                                "priority": { "type": "string", "description": "新的优先级 (P0, P1, P2, P3)" },
                                "status": { "type": "string", "description": "新的状态 (draft, todo, in_progress, completed)" },
                                "tags": { "type": "array", "items": { "type": "string" }, "description": "新的标签列表" },
                                "content": { "type": "string", "description": "新的 Markdown 文档完整内容" }
                            },
                            "required": ["node_id"]
                        }
                    },
                    {
                        "name": "delete_node",
                        "description": "从思维导图中删除指定的节点及其所有子节点，同时清理关联的 Markdown 文件",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "node_id": { "type": "string", "description": "要删除的节点 ID" }
                            },
                            "required": ["node_id"]
                        }
                    },
                    {
                        "name": "expand_node_outline",
                        "description": "【高阶AI工具】批量向指定父节点下拆解、拓展生成多个子模块节点及关联的初始 Markdown 文档骨架",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "parent_id": { "type": "string", "description": "父节点的 ID" },
                                "children": {
                                    "type": "array",
                                    "description": "需要批量创建的子节点列表",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "title": { "type": "string", "description": "子节点标题" },
                                            "priority": { "type": "string", "description": "优先级 (P0, P1, P2, P3)" },
                                            "status": { "type": "string", "description": "状态 (draft, todo, in_progress, completed)" },
                                            "tags": { "type": "array", "items": { "type": "string" }, "description": "标签" },
                                            "content": { "type": "string", "description": "详细 Markdown 文档内容" }
                                        },
                                        "required": ["title"]
                                    }
                                }
                            },
                            "required": ["parent_id", "children"]
                        }
                    },
                    {
                        "name": "link_nodes",
                        "description": "【双向链接工具】在源节点的 Markdown 文档中智能插入对目标节点的 [[WikiLink]] 双向引用链接",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "source_node_id": { "type": "string", "description": "发起引用的源节点 ID" },
                                "target_node_title": { "type": "string", "description": "被引用的目标节点标题" },
                                "context_note": { "type": "string", "description": "引用的关联背景说明 (可选)" }
                            },
                            "required": ["source_node_id", "target_node_title"]
                        }
                    },
                    {
                        "name": "get_document_outline",
                        "description": "【全局速览】极速获取当前项目的完整拓扑脉络与所有节点的摘要快照 (极省 Token)",
                        "inputSchema": { "type": "object", "properties": {} }
                    },
                    {
                        "name": "export_aggregate_document",
                        "description": "【长文聚合】一键将全项目所有文档按思维导图层级自动拼接为带 TOC 目录的长篇 Markdown 大文档",
                        "inputSchema": { "type": "object", "properties": {} }
                    }
                ]
            }
        })).await;
    }

    if method == "tools/call" {
        let params = payload.get("params").cloned().unwrap_or(json!({}));
        let tool_name = params.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let args = params.get("arguments").cloned().unwrap_or(json!({}));

        if tool_name == "list_projects" {
            let mut info = Vec::new();
            let mut seen_paths = std::collections::HashSet::new();

            // 1. 尝试从 AppData 读取所有历史/近期项目列表 (projects_index.json)
            let app_handle_opt = safe_lock!(state.app_handle).clone();
            if let Some(app) = app_handle_opt {
                use tauri::Manager;
                if let Ok(app_dir) = app.path().app_data_dir() {
                    let index_path = app_dir.join("projects_index.json");
                    if index_path.exists() {
                        if let Ok(content) = fs::read_to_string(&index_path) {
                            if let Ok(list) = serde_json::from_str::<Vec<Value>>(&content) {
                                for item in list {
                                    if let Some(path_str) = item.get("path").and_then(|v| v.as_str()) {
                                        let is_active = !p_path.is_empty() && path_str == p_path;
                                        let name = item.get("name").and_then(|v| v.as_str())
                                            .or_else(|| Path::new(path_str).file_name().and_then(|s| s.to_str()))
                                            .unwrap_or("project");
                                        let node_count = item.get("nodeCount").and_then(|v| v.as_u64()).unwrap_or(0);
                                        let last_opened = item.get("lastOpened").and_then(|v| v.as_str()).unwrap_or("");

                                        seen_paths.insert(path_str.to_string());
                                        info.push(json!({
                                            "name": name,
                                            "path": path_str,
                                            "active": is_active,
                                            "nodeCount": node_count,
                                            "lastOpened": last_opened
                                        }));
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 2. 如果当前激活的项目不在历史列表中，将其补充进来
            if !p_path.is_empty() && !seen_paths.contains(&p_path) {
                let name = Path::new(&p_path).file_name().and_then(|s| s.to_str()).unwrap_or("active_project");
                info.insert(0, json!({
                    "name": name,
                    "path": p_path,
                    "active": true
                }));
            }

            add_log(&state, tool_name.to_string(), args, "success".to_string());
            return send_rpc_response(&state, json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": { "content": [{ "type": "text", "text": serde_json::to_string_pretty(&info).unwrap_or_default() }] }
            })).await;
        }

        if p_path.is_empty() {
            add_log(&state, tool_name.to_string(), args, "error".to_string());
            return send_rpc_response(&state, json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "isError": true,
                    "content": [{ "type": "text", "text": "未关联任何需求项目，请在需求应用中先打开或创建一个项目。" }]
                }
            })).await;
        }

        if tool_name == "get_requirements_tree" {
            let config_path = Path::new(&p_path).join(".requirements.json");
            match fs::read_to_string(&config_path) {
                Ok(content) => {
                    add_log(&state, tool_name.to_string(), args, "success".to_string());
                    return send_rpc_response(&state, json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "result": { "content": [{ "type": "text", "text": content }] }
                    })).await;
                }
                Err(e) => {
                    add_log(&state, tool_name.to_string(), args, "error".to_string());
                    return send_rpc_response(&state, json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "error": { "code": -32603, "message": e.to_string() }
                    })).await;
                }
            }
        }

        if tool_name == "get_requirement_detail" {
            let rel_doc_path = args.get("doc_path").and_then(|v| v.as_str()).unwrap_or("index.md");
            let full_path = Path::new(&p_path).join(rel_doc_path);
            match fs::read_to_string(&full_path) {
                Ok(md) => {
                    // 解析 Markdown 中关联的图片，并将相对路径如 assets/xxx.png 替换为物理绝对路径 URL
                    let mut content_list = Vec::new();
                    let proj_path_buf = Path::new(&p_path);

                    let img_re = IMG_RE.get_or_init(|| regex::Regex::new(r"!\[(.*?)\]\((.*?)\)").expect("static regex"));
                    let processed_md = img_re.replace_all(&md, |caps: &regex::Captures| {
                        let alt = &caps[1];
                        let src = &caps[2];
                        if !src.starts_with("http://") && !src.starts_with("https://") && !src.starts_with("file://") && !src.starts_with("data:") {
                            let abs_img_path = proj_path_buf.join(src).to_string_lossy().to_string();
                            format!("![{}]({})", alt, format!("file://{}", abs_img_path))
                        } else {
                            caps[0].to_string()
                        }
                    }).to_string();

                    content_list.push(json!({
                        "type": "text",
                        "text": processed_md
                    }));

                    add_log(&state, tool_name.to_string(), args, "success".to_string());
                    return send_rpc_response(&state, json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "result": { "content": content_list }
                    })).await;
                }
                Err(e) => {
                    add_log(&state, tool_name.to_string(), args, "error".to_string());
                    return send_rpc_response(&state, json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "result": {
                            "isError": true,
                            "content": [{ "type": "text", "text": format!("读取文档失败: {}", e) }]
                        }
                    })).await;
                }
            }
        }

        if tool_name == "search_requirements" {
            let query = args.get("query").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
            let mut matches = Vec::new();

            fn search_dir(p: &Path, q: &str, matches: &mut Vec<Value>) {
                if let Ok(entries) = fs::read_dir(p) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_dir() {
                            search_dir(&path, q, matches);
                        } else if path.extension().and_then(|s| s.to_str()) == Some("md") {
                            if let Ok(text) = fs::read_to_string(&path) {
                                if text.to_lowercase().contains(q) {
                                    matches.push(json!({
                                        "file": path.to_string_lossy(),
                                        "snippet": text.chars().take(200).collect::<String>()
                                    }));
                                }
                            }
                        }
                    }
                }
            }

            search_dir(Path::new(&p_path), &query, &mut matches);
            add_log(&state, tool_name.to_string(), args, "success".to_string());
            return send_rpc_response(&state, json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": { "content": [{ "type": "text", "text": serde_json::to_string(&matches).unwrap_or_default() }] }
            })).await;
        }

        if tool_name == "update_requirement_status" {
            let node_id = args.get("node_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let status = args.get("status").and_then(|v| v.as_str()).unwrap_or("").to_string();

            let config_path = Path::new(&p_path).join(".requirements.json");
            if let Ok(json_str) = fs::read_to_string(&config_path) {
                if let Ok(mut val) = serde_json::from_str::<Value>(&json_str) {
                    fn update_node(n: &mut Value, target_id: &str, new_st: &str) -> bool {
                        if n.get("id").and_then(|v| v.as_str()) == Some(target_id) {
                            n["status"] = json!(new_st);
                            return true;
                        }
                        if let Some(children) = n.get_mut("children").and_then(|v| v.as_array_mut()) {
                            for child in children {
                                if update_node(child, target_id, new_st) {
                                    return true;
                                }
                            }
                        }
                        false
                    }

                    if let Some(root) = val.get_mut("root") {
                        if update_node(root, &node_id, &status) {
                            let _ = fs::write(&config_path, serde_json::to_string_pretty(&val).unwrap_or_default());
                            mark_mcp_write(&state);
                            let nid = node_id.clone();
                            let st = status.clone();
                            add_log(&state, tool_name.to_string(), args, "success".to_string());
                            return send_rpc_response(&state, json!({
                                "jsonrpc": "2.0",
                                "id": id,
                                "result": { "content": [{ "type": "text", "text": format!("节点 {} 状态更新为 {}", nid, st) }] }
                            })).await;
                        }
                    }
                }
            }
            add_log(&state, tool_name.to_string(), args, "error".to_string());
            return send_rpc_response(&state, json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32603, "message": "无法找到指定节点并更新状态" }
            })).await;
        }

        if tool_name == "add_node" {
            let parent_id = args.get("parent_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let title = args.get("title").and_then(|v| v.as_str()).unwrap_or("新节点").to_string();
            let priority = args.get("priority").and_then(|v| v.as_str()).unwrap_or("P1").to_string();
            let status = args.get("status").and_then(|v| v.as_str()).unwrap_or("todo").to_string();
            let tags = args.get("tags").cloned().unwrap_or(json!([]));
            let content = args.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string();

            let config_path = Path::new(&p_path).join(".requirements.json");
            if let Ok(json_str) = fs::read_to_string(&config_path) {
                if let Ok(mut val) = serde_json::from_str::<Value>(&json_str) {
                    let nanos = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.subsec_nanos())
                        .unwrap_or(0);
                    let new_node_id = format!("node-{}-{}", chrono::Local::now().timestamp_millis(), nanos);
                    let doc_rel_path = format!("modules/{}.md", new_node_id);
                    let doc_full_path = Path::new(&p_path).join(&doc_rel_path);

                    if let Some(parent) = doc_full_path.parent() {
                        let _ = fs::create_dir_all(parent);
                    }
                    let doc_content = if content.is_empty() {
                        format!("# {}\n\n暂无详细内容。", title)
                    } else {
                        content
                    };
                    let _ = fs::write(&doc_full_path, doc_content);

                    let new_node = json!({
                        "id": new_node_id,
                        "title": title,
                        "docPath": doc_rel_path,
                        "status": status,
                        "priority": priority,
                        "tags": tags,
                        "children": []
                    });

                    fn insert_child(n: &mut Value, target_id: &str, child: Value) -> bool {
                        if n.get("id").and_then(|v| v.as_str()) == Some(target_id) {
                            if n.get("children").is_none() {
                                n["children"] = json!([]);
                            }
                            if let Some(children) = n.get_mut("children").and_then(|v| v.as_array_mut()) {
                                children.push(child);
                                return true;
                            }
                        }
                        if let Some(children) = n.get_mut("children").and_then(|v| v.as_array_mut()) {
                            for c in children {
                                if insert_child(c, target_id, child.clone()) {
                                    return true;
                                }
                            }
                        }
                        false
                    }

                    if let Some(root) = val.get_mut("root") {
                        if insert_child(root, &parent_id, new_node.clone()) {
                            let _ = fs::write(&config_path, serde_json::to_string_pretty(&val).unwrap_or_default());
                            mark_mcp_write(&state);
                            add_log(&state, tool_name.to_string(), args, "success".to_string());
                            return send_rpc_response(&state, json!({
                                "jsonrpc": "2.0",
                                "id": id,
                                "result": { "content": [{ "type": "text", "text": format!("成功添加子节点 '{}' (ID: {})", title, new_node_id) }] }
                            })).await;
                        }
                    }
                }
            }
            add_log(&state, tool_name.to_string(), args, "error".to_string());
            return send_rpc_response(&state, json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32603, "message": "无法找到指定的父节点 parent_id" }
            })).await;
        }

        if tool_name == "update_node" {
            let node_id = args.get("node_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let config_path = Path::new(&p_path).join(".requirements.json");

            if let Ok(json_str) = fs::read_to_string(&config_path) {
                if let Ok(mut val) = serde_json::from_str::<Value>(&json_str) {
                    let mut doc_path_to_update = None;

                    fn update_node_data(n: &mut Value, target_id: &str, args: &Value, doc_path_out: &mut Option<String>) -> bool {
                        if n.get("id").and_then(|v| v.as_str()) == Some(target_id) {
                            if let Some(t) = args.get("title").and_then(|v| v.as_str()) {
                                n["title"] = json!(t);
                            }
                            if let Some(p) = args.get("priority").and_then(|v| v.as_str()) {
                                n["priority"] = json!(p);
                            }
                            if let Some(s) = args.get("status").and_then(|v| v.as_str()) {
                                n["status"] = json!(s);
                            }
                            if let Some(tg) = args.get("tags") {
                                n["tags"] = tg.clone();
                            }
                            if let Some(dp) = n.get("docPath").and_then(|v| v.as_str()) {
                                *doc_path_out = Some(dp.to_string());
                            }
                            return true;
                        }
                        if let Some(children) = n.get_mut("children").and_then(|v| v.as_array_mut()) {
                            for c in children {
                                if update_node_data(c, target_id, args, doc_path_out) {
                                    return true;
                                }
                            }
                        }
                        false
                    }

                    if let Some(root) = val.get_mut("root") {
                        if update_node_data(root, &node_id, &args, &mut doc_path_to_update) {
                            let _ = fs::write(&config_path, serde_json::to_string_pretty(&val).unwrap_or_default());
                            mark_mcp_write(&state);

                            if let Some(c) = args.get("content").and_then(|v| v.as_str()) {
                                if let Some(dp) = doc_path_to_update {
                                    let doc_full_path = Path::new(&p_path).join(dp);
                                    let _ = fs::write(doc_full_path, c);
                                }
                            }

                            add_log(&state, tool_name.to_string(), args, "success".to_string());
                            return send_rpc_response(&state, json!({
                                "jsonrpc": "2.0",
                                "id": id,
                                "result": { "content": [{ "type": "text", "text": format!("节点 {} 信息已更新", node_id) }] }
                            })).await;
                        }
                    }
                }
            }
            add_log(&state, tool_name.to_string(), args, "error".to_string());
            return send_rpc_response(&state, json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32603, "message": "未找到指定的节点 node_id" }
            })).await;
        }

        if tool_name == "delete_node" {
            let node_id = args.get("node_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let config_path = Path::new(&p_path).join(".requirements.json");

            if let Ok(json_str) = fs::read_to_string(&config_path) {
                if let Ok(mut val) = serde_json::from_str::<Value>(&json_str) {
                    fn collect_doc_paths(n: &Value, docs: &mut Vec<String>) {
                        if let Some(dp) = n.get("docPath").and_then(|v| v.as_str()) {
                            if dp != "index.md" {
                                docs.push(dp.to_string());
                            }
                        }
                        if let Some(children) = n.get("children").and_then(|v| v.as_array()) {
                            for c in children {
                                collect_doc_paths(c, docs);
                            }
                        }
                    }

                    fn remove_node(n: &mut Value, target_id: &str, deleted_docs: &mut Vec<String>) -> bool {
                        if let Some(children) = n.get_mut("children").and_then(|v| v.as_array_mut()) {
                            let mut found_idx = None;
                            for (idx, c) in children.iter().enumerate() {
                                if c.get("id").and_then(|v| v.as_str()) == Some(target_id) {
                                    found_idx = Some(idx);
                                    collect_doc_paths(c, deleted_docs);
                                    break;
                                }
                            }
                            if let Some(idx) = found_idx {
                                children.remove(idx);
                                return true;
                            }
                            for c in children.iter_mut() {
                                if remove_node(c, target_id, deleted_docs) {
                                    return true;
                                }
                            }
                        }
                        false
                    }

                    let mut deleted_docs = Vec::new();
                    if let Some(root) = val.get_mut("root") {
                        if remove_node(root, &node_id, &mut deleted_docs) {
                            let _ = fs::write(&config_path, serde_json::to_string_pretty(&val).unwrap_or_default());
                            mark_mcp_write(&state);

                            for rel_doc in deleted_docs {
                                let doc_full = Path::new(&p_path).join(rel_doc);
                                if doc_full.exists() {
                                    let _ = fs::remove_file(doc_full);
                                }
                            }

                            add_log(&state, tool_name.to_string(), args, "success".to_string());
                            return send_rpc_response(&state, json!({
                                "jsonrpc": "2.0",
                                "id": id,
                                "result": { "content": [{ "type": "text", "text": format!("节点 {} 及其关联子文档已彻底删除", node_id) }] }
                            })).await;
                        }
                    }
                }
            }
            add_log(&state, tool_name.to_string(), args, "error".to_string());
            return send_rpc_response(&state, json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32603, "message": "无法找到指定的节点或无法删除根节点" }
            })).await;
        }

        // ==================== 批量拆解大纲与子模块 expand_node_outline ====================
        if tool_name == "expand_node_outline" {
            let parent_id = args.get("parent_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let children = args.get("children").and_then(|v| v.as_array()).cloned().unwrap_or_default();
            let config_path = Path::new(&p_path).join(".requirements.json");

            if let Ok(json_str) = fs::read_to_string(&config_path) {
                if let Ok(mut val) = serde_json::from_str::<Value>(&json_str) {
                    let mut created_nodes = Vec::new();
                    let mut created_docs = Vec::new();

                    for (idx, child_item) in children.iter().enumerate() {
                        let title = child_item.get("title").and_then(|v| v.as_str()).unwrap_or("新建子节点").to_string();
                        let priority = child_item.get("priority").and_then(|v| v.as_str()).unwrap_or("P1").to_string();
                        let status = child_item.get("status").and_then(|v| v.as_str()).unwrap_or("todo").to_string();
                        let tags = child_item.get("tags").cloned().unwrap_or(json!([]));
                        let content = child_item.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string();

                        let nanos = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.subsec_nanos())
                            .unwrap_or(0);
                        let new_node_id = format!("node-{}-{}-{}", chrono::Local::now().timestamp_millis(), idx, nanos);
                        let new_doc_path = format!("modules/{}.md", new_node_id);

                        let new_child_val = json!({
                            "id": new_node_id,
                            "title": title,
                            "docPath": new_doc_path,
                            "priority": priority,
                            "status": status,
                            "tags": tags,
                            "children": []
                        });

                        created_nodes.push(new_child_val.clone());
                        let final_content = if content.is_empty() {
                            format!("# {}\n\n由 AI 自动生成骨架，请在此补充详细业务与技术设计说明...", title)
                        } else {
                            content
                        };
                        created_docs.push((new_doc_path, final_content));
                    }

                    fn add_multiple_children(n: &mut Value, target_id: &str, new_children: &[Value]) -> bool {
                        if n.get("id").and_then(|v| v.as_str()) == Some(target_id) {
                            if let Some(arr) = n.get_mut("children").and_then(|v| v.as_array_mut()) {
                                for c in new_children {
                                    arr.push(c.clone());
                                }
                            } else {
                                n["children"] = json!(new_children);
                            }
                            return true;
                        }
                        if let Some(children) = n.get_mut("children").and_then(|v| v.as_array_mut()) {
                            for c in children {
                                if add_multiple_children(c, target_id, new_children) {
                                    return true;
                                }
                            }
                        }
                        false
                    }

                    if let Some(root) = val.get_mut("root") {
                        if add_multiple_children(root, &parent_id, &created_nodes) {
                            let _ = fs::write(&config_path, serde_json::to_string_pretty(&val).unwrap_or_default());
                            mark_mcp_write(&state);

                            for (doc_rel, doc_body) in created_docs {
                                let doc_full = Path::new(&p_path).join(doc_rel);
                                if let Some(parent) = doc_full.parent() {
                                    let _ = fs::create_dir_all(parent);
                                }
                                let _ = fs::write(doc_full, doc_body);
                            }

                            add_log(&state, tool_name.to_string(), args, "success".to_string());
                            return send_rpc_response(&state, json!({
                                "jsonrpc": "2.0",
                                "id": id,
                                "result": { "content": [{ "type": "text", "text": format!("已成功向节点 {} 下批量拓展生成 {} 个子模块及关联 Markdown 文件", parent_id, created_nodes.len()) }] }
                            })).await;
                        }
                    }
                }
            }

            add_log(&state, tool_name.to_string(), args, "error".to_string());
            return send_rpc_response(&state, json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32603, "message": "无法找到指定的父节点 parent_id" }
            })).await;
        }

        // ==================== 双向链接与引用 link_nodes ====================
        if tool_name == "link_nodes" {
            let source_node_id = args.get("source_node_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let target_node_title = args.get("target_node_title").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let context_note = args.get("context_note").and_then(|v| v.as_str()).unwrap_or("");
            let config_path = Path::new(&p_path).join(".requirements.json");

            if let Ok(json_str) = fs::read_to_string(&config_path) {
                if let Ok(val) = serde_json::from_str::<Value>(&json_str) {
                    fn find_doc_path(n: &Value, target_id: &str) -> Option<String> {
                        if n.get("id").and_then(|v| v.as_str()) == Some(target_id) {
                            return n.get("docPath").and_then(|v| v.as_str()).map(|s| s.to_string());
                        }
                        if let Some(children) = n.get("children").and_then(|v| v.as_array()) {
                            for c in children {
                                if let Some(p) = find_doc_path(c, target_id) {
                                    return Some(p);
                                }
                            }
                        }
                        None
                    }

                    if let Some(root) = val.get("root") {
                        if let Some(doc_rel) = find_doc_path(root, &source_node_id) {
                            let doc_full = Path::new(&p_path).join(&doc_rel);
                            let current_content = fs::read_to_string(&doc_full).unwrap_or_default();

                            let link_str = format!("[[{}]]", target_node_title);
                            let append_content = if !context_note.is_empty() {
                                format!("\n\n> 🔗 **关联模块引用**: {} - {}\n", link_str, context_note)
                            } else {
                                format!("\n\n> 🔗 **关联模块引用**: {}\n", link_str)
                            };

                            let updated_content = format!("{}{}", current_content.trim_end(), append_content);
                            let _ = fs::write(&doc_full, updated_content);
                            mark_mcp_write(&state);

                            add_log(&state, tool_name.to_string(), args, "success".to_string());
                            return send_rpc_response(&state, json!({
                                "jsonrpc": "2.0",
                                "id": id,
                                "result": { "content": [{ "type": "text", "text": format!("已成功在节点 {} ({}) 中嵌入双向引用 [[{}]]", source_node_id, doc_rel, target_node_title) }] }
                            })).await;
                        }
                    }
                }
            }

            add_log(&state, tool_name.to_string(), args, "error".to_string());
            return send_rpc_response(&state, json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32603, "message": "未找到源节点 source_node_id" }
            })).await;
        }

        // ==================== 全局大纲与摘要速览 get_document_outline ====================
        if tool_name == "get_document_outline" {
            let config_path = Path::new(&p_path).join(".requirements.json");
            if let Ok(json_str) = fs::read_to_string(&config_path) {
                if let Ok(val) = serde_json::from_str::<Value>(&json_str) {
                    fn build_outline(n: &Value, p_dir: &str, depth: usize) -> Value {
                        let title = n.get("title").and_then(|v| v.as_str()).unwrap_or("");
                        let id = n.get("id").and_then(|v| v.as_str()).unwrap_or("");
                        let priority = n.get("priority").and_then(|v| v.as_str()).unwrap_or("");
                        let status = n.get("status").and_then(|v| v.as_str()).unwrap_or("");
                        let doc_path = n.get("docPath").and_then(|v| v.as_str()).unwrap_or("");

                        let summary = if !doc_path.is_empty() {
                            let doc_full = Path::new(p_dir).join(doc_path);
                            if let Ok(content) = fs::read_to_string(doc_full) {
                                let clean = content.lines().filter(|l| !l.starts_with('#')).collect::<Vec<&str>>().join(" ");
                                let chars: Vec<char> = clean.chars().collect();
                                if chars.len() > 160 {
                                    format!("{}...", chars[..160].iter().collect::<String>())
                                } else {
                                    clean
                                }
                            } else {
                                String::new()
                            }
                        } else {
                            String::new()
                        };

                        let mut children_outline = Vec::new();
                        if let Some(children) = n.get("children").and_then(|v| v.as_array()) {
                            for c in children {
                                children_outline.push(build_outline(c, p_dir, depth + 1));
                            }
                        }

                        json!({
                            "id": id,
                            "depth": depth,
                            "title": title,
                            "priority": priority,
                            "status": status,
                            "doc_path": doc_path,
                            "summary": summary,
                            "children": children_outline
                        })
                    }

                    let outline_res = if let Some(root) = val.get("root") {
                        build_outline(root, &p_path, 1)
                    } else {
                        json!({})
                    };

                    add_log(&state, tool_name.to_string(), args, "success".to_string());
                    return send_rpc_response(&state, json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "result": { "content": [{ "type": "text", "text": serde_json::to_string_pretty(&outline_res).unwrap_or_default() }] }
                    })).await;
                }
            }

            add_log(&state, tool_name.to_string(), args, "error".to_string());
            return send_rpc_response(&state, json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32603, "message": "无法读取项目拓扑文件" }
            })).await;
        }

        // ==================== 长篇长文聚合 export_aggregate_document ====================
        if tool_name == "export_aggregate_document" {
            let config_path = Path::new(&p_path).join(".requirements.json");
            if let Ok(json_str) = fs::read_to_string(&config_path) {
                if let Ok(val) = serde_json::from_str::<Value>(&json_str) {
                    let project_name = val.get("projectName").and_then(|v| v.as_str()).unwrap_or("DocMind 文档");

                    fn aggregate_tree(n: &Value, p_dir: &str, depth: usize) -> String {
                        let hashes = "#".repeat(depth.min(6));
                        let title = n.get("title").and_then(|v| v.as_str()).unwrap_or("");
                        let doc_path = n.get("docPath").and_then(|v| v.as_str()).unwrap_or("");
                        let priority = n.get("priority").and_then(|v| v.as_str()).unwrap_or("");
                        let status = n.get("status").and_then(|v| v.as_str()).unwrap_or("");

                        let mut body = String::new();
                        if !doc_path.is_empty() {
                            let doc_full = Path::new(p_dir).join(doc_path);
                            if let Ok(c) = fs::read_to_string(doc_full) {
                                body = c;
                            }
                        }

                        let mut result = format!("{} {}\n\n> **状态**: `{}` | **优先级**: `{}`\n\n", hashes, title, status, priority);
                        if !body.trim().is_empty() {
                            result.push_str(body.trim());
                            result.push_str("\n\n");
                        }

                        if let Some(children) = n.get("children").and_then(|v| v.as_array()) {
                            for c in children {
                                result.push_str(&aggregate_tree(c, p_dir, depth + 1));
                            }
                        }
                        result
                    }

                    let full_doc = if let Some(root) = val.get("root") {
                        format!("# {}\n\n> 聚合生成时间: {}\n\n---\n\n{}", project_name, chrono::Local::now().format("%Y-%m-%d %H:%M:%S"), aggregate_tree(root, &p_path, 1))
                    } else {
                        String::new()
                    };

                    add_log(&state, tool_name.to_string(), args, "success".to_string());
                    return send_rpc_response(&state, json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "result": { "content": [{ "type": "text", "text": full_doc }] }
                    })).await;
                }
            }

            add_log(&state, tool_name.to_string(), args, "error".to_string());
            return send_rpc_response(&state, json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32603, "message": "无法导出聚合文档" }
            })).await;
        }
    }

    send_rpc_response(&state, json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": { "code": -32601, "message": "Method not found" }
    })).await
}

// 维持符合 MCP 标准规范的无限长连接 SSE 通道 HTTP Handler
pub async fn sse_handler(State(state): State<AppState>) -> impl IntoResponse {
    use axum::response::sse::Event;

    let port = *safe_lock!(state.port);
    let endpoint_url = format!("http://127.0.0.1:{}/messages", port);

    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Event, std::convert::Infallible>>(64);

    {
        let mut guard = safe_lock!(state.sse_clients);
        guard.push(tx.clone());
    }

    // 克隆 state 以在 keepalive 任务中清理断开连接的客户端
    let state_for_cleanup = state.clone();

    tauri::async_runtime::spawn(async move {
        // 1. 立即推送 endpoint 事件
        let _ = tx.send(Ok(Event::default().event("endpoint").data(endpoint_url))).await;

        // 2. 定期每 2 秒发送 SSE 保活心跳帧，保证网络 Client 不会判定为 hung 悬挂超时
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(2));
        loop {
            interval.tick().await;
            if tx.send(Ok(Event::default().comment("keepalive"))).await.is_err() {
                break;
            }
        }

        // 3. 客户端断开后从列表中移除
        if let Ok(mut guard) = state_for_cleanup.sse_clients.lock() {
            guard.retain(|c| !c.is_closed());
        }
    });

    let stream = tokio_stream::wrappers::ReceiverStream::new(rx);
    axum::response::Sse::new(stream)
}

#[tauri::command]
pub fn start_mcp_server_rust(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    port: u16,
    project_path: String,
) -> Result<String, String> {
    // 1. 如果已在运行，先触发关闭上一次的服务器
    {
        let mut tx_opt = safe_lock!(state.cancel_tx);
        if let Some(tx) = tx_opt.take() {
            let _ = tx.send(());
            // 等待 100ms 确保上一个监听 Socket 被操作系统完全释放
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    }

    {
        let mut h = safe_lock!(state.app_handle);
        *h = Some(app);
    }
    {
        let mut p = safe_lock!(state.project_path);
        *p = project_path.clone();
    }
    {
        let mut pt = safe_lock!(state.port);
        *pt = port;
    }

    let (tx, rx) = tokio::sync::oneshot::channel::<()>();
    {
        let mut tx_opt = safe_lock!(state.cancel_tx);
        *tx_opt = Some(tx);
    }
    {
        let mut running = safe_lock!(state.is_running);
        *running = true;
    }

    let state_clone = state.inner().clone();
    let addr = format!("0.0.0.0:{}", port);

    tauri::async_runtime::spawn(async move {
        let app = Router::new()
            .route("/sse", get(sse_handler))
            .route("/messages", post(handle_mcp_rpc))
            .route("/rpc", post(handle_mcp_rpc))
            .route("/", post(handle_mcp_rpc))
            .layer(CorsLayer::permissive())
            .with_state(state_clone.clone());

        if let Ok(listener) = tokio::net::TcpListener::bind(&addr).await {
            let _ = axum::serve(listener, app)
                .with_graceful_shutdown(async move {
                    let _ = rx.await;
                })
                .await;
        }

        if let Ok(mut running) = state_clone.is_running.lock() {
            *running = false;
        }
    });

    Ok(format!("http://127.0.0.1:{}/sse", port))
}

#[tauri::command]
pub fn stop_mcp_server_rust(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    {
        let mut tx_opt = safe_lock!(state.cancel_tx);
        if let Some(tx) = tx_opt.take() {
            let _ = tx.send(());
        }
    }
    {
        let mut running = safe_lock!(state.is_running);
        *running = false;
    }
    Ok(true)
}

#[tauri::command]
pub fn get_mcp_status_rust(state: tauri::State<'_, AppState>) -> Result<Value, String> {
    let p = safe_lock!(state.project_path).clone();
    let pt = *safe_lock!(state.port);
    let is_r = *safe_lock!(state.is_running);
    let logs = safe_lock!(state.logs).clone();
    let last_write = *safe_lock!(state.last_mcp_write);

    Ok(json!({
        "isRunning": is_r,
        "port": pt,
        "projectPath": p,
        "sseUrl": format!("http://127.0.0.1:{}/sse", pt),
        "logs": logs,
        "lastMcpWrite": last_write
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_state() -> AppState {
        AppState {
            project_path: Arc::new(Mutex::new(String::new())),
            port: Arc::new(Mutex::new(6001)),
            is_running: Arc::new(Mutex::new(false)),
            cancel_tx: Arc::new(Mutex::new(None)),
            sse_clients: Arc::new(Mutex::new(Vec::new())),
            logs: Arc::new(Mutex::new(Vec::new())),
            last_mcp_write: Arc::new(Mutex::new(0)),
        }
    }

    #[test]
    fn test_add_log_inserts_at_front() {
        let state = make_state();
        add_log(&state, "test_tool".into(), json!({"key": "val"}), "success".into());
        add_log(&state, "other_tool".into(), json!({}), "error".into());

        let logs = safe_lock!(state.logs);
        assert_eq!(logs.len(), 2);
        assert_eq!(logs[0].tool, "other_tool");
        assert_eq!(logs[1].tool, "test_tool");
    }

    #[test]
    fn test_add_log_caps_at_50() {
        let state = make_state();
        for i in 0..60 {
            add_log(&state, format!("tool_{}", i), json!({}), "success".into());
        }
        let logs = safe_lock!(state.logs);
        assert_eq!(logs.len(), 50);
        // 最新的应该在前面
        assert_eq!(logs[0].tool, "tool_59");
    }

    #[test]
    fn test_mark_mcp_write_updates_timestamp() {
        let state = make_state();
        assert_eq!(*safe_lock!(state.last_mcp_write), 0);
        mark_mcp_write(&state);
        assert!(*safe_lock!(state.last_mcp_write) > 0);
    }

    #[test]
    fn test_update_node_status_recursive() {
        let mut tree = json!({
            "id": "root",
            "status": "todo",
            "children": [
                { "id": "child-1", "status": "todo", "children": [] },
                { "id": "child-2", "status": "completed", "children": [
                    { "id": "grandchild", "status": "draft", "children": [] }
                ]}
            ]
        });

        fn update_node(n: &mut Value, target_id: &str, new_st: &str) -> bool {
            if n.get("id").and_then(|v| v.as_str()) == Some(target_id) {
                n["status"] = json!(new_st);
                return true;
            }
            if let Some(children) = n.get_mut("children").and_then(|v| v.as_array_mut()) {
                for child in children {
                    if update_node(child, target_id, new_st) {
                        return true;
                    }
                }
            }
            false
        }

        assert!(update_node(&mut tree, "grandchild", "in_progress"));
        let grandchild = &tree["children"][1]["children"][0];
        assert_eq!(grandchild["status"], "in_progress");
    }

    #[test]
    fn test_insert_child_recursive() {
        let mut tree = json!({
            "id": "root",
            "children": [
                { "id": "child-1", "children": [] }
            ]
        });

        let new_node = json!({ "id": "new-node", "title": "Test", "children": [] });

        fn insert_child(n: &mut Value, target_id: &str, child: Value) -> bool {
            if n.get("id").and_then(|v| v.as_str()) == Some(target_id) {
                if n.get("children").is_none() {
                    n["children"] = json!([]);
                }
                if let Some(children) = n.get_mut("children").and_then(|v| v.as_array_mut()) {
                    children.push(child);
                    return true;
                }
            }
            if let Some(children) = n.get_mut("children").and_then(|v| v.as_array_mut()) {
                for c in children {
                    if insert_child(c, target_id, child.clone()) {
                        return true;
                    }
                }
            }
            false
        }

        assert!(insert_child(&mut tree, "child-1", new_node.clone()));
        let child1 = &tree["children"][0];
        assert_eq!(child1["children"].as_array().unwrap().len(), 1);
        assert_eq!(child1["children"][0]["id"], "new-node");
    }

    #[test]
    fn test_remove_node_recursive() {
        let mut tree = json!({
            "id": "root",
            "children": [
                { "id": "child-1", "docPath": "modules/child-1.md", "children": [] },
                { "id": "child-2", "docPath": "modules/child-2.md", "children": [
                    { "id": "grandchild", "docPath": "modules/grandchild.md", "children": [] }
                ]}
            ]
        });

        fn collect_doc_paths(n: &Value, docs: &mut Vec<String>) {
            if let Some(dp) = n.get("docPath").and_then(|v| v.as_str()) {
                if dp != "index.md" {
                    docs.push(dp.to_string());
                }
            }
            if let Some(children) = n.get("children").and_then(|v| v.as_array()) {
                for c in children {
                    collect_doc_paths(c, docs);
                }
            }
        }

        fn remove_node(n: &mut Value, target_id: &str, deleted_docs: &mut Vec<String>) -> bool {
            if let Some(children) = n.get_mut("children").and_then(|v| v.as_array_mut()) {
                let mut found_idx = None;
                for (idx, c) in children.iter().enumerate() {
                    if c.get("id").and_then(|v| v.as_str()) == Some(target_id) {
                        found_idx = Some(idx);
                        collect_doc_paths(c, deleted_docs);
                        break;
                    }
                }
                if let Some(idx) = found_idx {
                    children.remove(idx);
                    return true;
                }
                for c in children.iter_mut() {
                    if remove_node(c, target_id, deleted_docs) {
                        return true;
                    }
                }
            }
            false
        }

        let mut deleted_docs = Vec::new();
        assert!(remove_node(&mut tree, "child-2", &mut deleted_docs));
        assert_eq!(deleted_docs, vec!["modules/child-2.md", "modules/grandchild.md"]);
        assert_eq!(tree["children"].as_array().unwrap().len(), 1);
        assert_eq!(tree["children"][0]["id"], "child-1");
    }
}
