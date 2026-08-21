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
    pub project_path: Arc<Mutex<String>>,
    pub port: Arc<Mutex<u16>>,
    pub is_running: Arc<Mutex<bool>>,
    pub cancel_tx: Arc<Mutex<Option<tokio::sync::oneshot::Sender<()>>>>,
    pub sse_tx: Arc<Mutex<Option<tokio::sync::mpsc::Sender<Result<axum::response::sse::Event, std::convert::Infallible>>>>>,
    pub logs: Arc<Mutex<Vec<MCPLogItem>>>,
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
async fn send_rpc_response(state: &AppState, res_val: Value) -> impl IntoResponse {
    use axum::response::sse::Event;

    if let Ok(guard) = state.sse_tx.lock() {
        if let Some(tx) = guard.as_ref() {
            let json_str = serde_json::to_string(&res_val).unwrap_or_default();
            let _ = tx.try_send(Ok(Event::default().event("message").data(json_str)));
        }
    }
    Json(res_val)
}

// 模拟扩展的标准 MCP Tools 处理器
pub async fn handle_mcp_rpc(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> impl IntoResponse {
    let method = payload.get("method").and_then(|v| v.as_str()).unwrap_or("");
    let id = payload.get("id").cloned().unwrap_or(json!(1));

    let p_path = state.project_path.lock().unwrap().clone();

    if method == "initialize" {
        return send_rpc_response(&state, json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "req-mindmark-mcp",
                    "version": "1.0.0"
                }
            }
        })).await;
    }

    if method == "notifications/initialized" || method == "ping" {
        return send_rpc_response(&state, json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {}
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
            if !p_path.is_empty() {
                let name = Path::new(&p_path).file_name().and_then(|s| s.to_str()).unwrap_or("active_project");
                info.push(json!({
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

                    let img_re = regex::Regex::new(r"!\[(.*?)\]\((.*?)\)").unwrap();
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
                            let _ = fs::write(&config_path, serde_json::to_string_pretty(&val).unwrap());
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

    let port = *state.port.lock().unwrap();
    let endpoint_url = format!("http://127.0.0.1:{}/messages", port);

    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Event, std::convert::Infallible>>(64);

    {
        let mut guard = state.sse_tx.lock().unwrap();
        *guard = Some(tx.clone());
    }

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
    });

    let stream = tokio_stream::wrappers::ReceiverStream::new(rx);
    axum::response::Sse::new(stream)
}

#[tauri::command]
pub fn start_mcp_server_rust(
    state: tauri::State<'_, AppState>,
    port: u16,
    project_path: String,
) -> Result<String, String> {
    // 1. 如果已在运行，先触发关闭上一次的服务器
    {
        let mut tx_opt = state.cancel_tx.lock().unwrap();
        if let Some(tx) = tx_opt.take() {
            let _ = tx.send(());
            // 等待 100ms 确保上一个监听 Socket 被操作系统完全释放
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    }

    {
        let mut p = state.project_path.lock().unwrap();
        *p = project_path.clone();
    }
    {
        let mut pt = state.port.lock().unwrap();
        *pt = port;
    }

    let (tx, rx) = tokio::sync::oneshot::channel::<()>();
    {
        let mut tx_opt = state.cancel_tx.lock().unwrap();
        *tx_opt = Some(tx);
    }
    {
        let mut running = state.is_running.lock().unwrap();
        *running = true;
    }

    let state_clone = state.inner().clone();
    let addr = format!("0.0.0.0:{}", port);

    tauri::async_runtime::spawn(async move {
        let app = Router::new()
            .route("/sse", get(sse_handler))
            .route("/messages", post(handle_mcp_rpc))
            .route("/rpc", post(handle_mcp_rpc))
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
        let mut tx_opt = state.cancel_tx.lock().unwrap();
        if let Some(tx) = tx_opt.take() {
            let _ = tx.send(());
        }
    }
    {
        let mut running = state.is_running.lock().unwrap();
        *running = false;
    }
    Ok(true)
}

#[tauri::command]
pub fn get_mcp_status_rust(state: tauri::State<'_, AppState>) -> Result<Value, String> {
    let p = state.project_path.lock().unwrap().clone();
    let pt = *state.port.lock().unwrap();
    let is_r = *state.is_running.lock().unwrap();
    let logs = state.logs.lock().unwrap().clone();

    Ok(json!({
        "isRunning": is_r,
        "port": pt,
        "projectPath": p,
        "sseUrl": format!("http://127.0.0.1:{}/sse", pt),
        "logs": logs
    }))
}
