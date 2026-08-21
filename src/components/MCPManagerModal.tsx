import React, { useState } from 'react';
import { X, Server, Check, Copy, Activity, Terminal, Wrench } from 'lucide-react';
import { MCPLogItem } from '../mcpServerManager';

interface MCPManagerModalProps {
  status: {
    isRunning: boolean;
    port: number;
    projectPath: string;
    sseUrl: string;
  };
  logs: MCPLogItem[];
  onClose: () => void;
  onToggleServer: (enable: boolean, customPort?: number) => void;
}

export const MCPManagerModal: React.FC<MCPManagerModalProps> = ({
  status,
  logs,
  onClose,
  onToggleServer
}) => {
  const [copiedSSE, setCopiedSSE] = useState(false);
  const [copiedJSON, setCopiedJSON] = useState(false);
  const [inputPort, setInputPort] = useState<number>(status.port || 6001);

  const antigravityJsonConfig = JSON.stringify(
    {
      mcpServers: {
        'req-mindmark': {
          url: status.sseUrl
        }
      }
    },
    null,
    2
  );

  const handleCopySSE = () => {
    navigator.clipboard.writeText(status.sseUrl);
    setCopiedSSE(true);
    setTimeout(() => setCopiedSSE(false), 2000);
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(antigravityJsonConfig);
    setCopiedJSON(true);
    setTimeout(() => setCopiedJSON(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content mcp-manager-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Server size={18} color="#2563eb" /> AI 接入服务管理 (MCP Server over SSE)
          </div>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {/* 状态 Bar & 端口配置 */}
          <div className="mcp-status-banner">
            <div className="status-indicator">
              <span className={`status-dot ${status.isRunning ? 'online' : 'offline'}`} />
              <span className="status-text">
                服务状态: <strong>{status.isRunning ? `🟢 已启动 (端口: ${status.port})` : '🔴 已停止'}</strong>
              </span>
            </div>

            <div className="status-actions">
              <div className="port-input-group">
                <label>端口号:</label>
                <input
                  type="number"
                  className="port-input"
                  value={inputPort}
                  onChange={(e) => setInputPort(parseInt(e.target.value) || 6001)}
                />
              </div>

              {status.isRunning ? (
                <>
                  <button
                    className="btn outline small"
                    onClick={() => onToggleServer(true, inputPort)}
                  >
                    重启/应用端口
                  </button>
                  <button className="btn outline small" onClick={() => onToggleServer(false)}>
                    停止服务
                  </button>
                </>
              ) : (
                <button className="btn primary small" onClick={() => onToggleServer(true, inputPort)}>
                  启动 SSE 服务
                </button>
              )}
            </div>
          </div>

          {/* SSE 接入说明卡片 */}
          <div className="mcp-config-card">
            <div className="card-header">
              <div className="card-title">
                <Terminal size={16} /> SSE 接入配置 (Antigravity CLI / Cursor / Claude Desktop)
              </div>
              <button className="btn outline small" onClick={handleCopyJSON}>
                {copiedJSON ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                {copiedJSON ? '已复制 JSON 配置' : '复制 mcpServers JSON'}
              </button>
            </div>

            <div className="card-body">
              <div className="sse-url-row">
                <label>SSE Server URL:</label>
                <code className="url-code">{status.sseUrl}</code>
                <button className="btn outline small" onClick={handleCopySSE}>
                  {copiedSSE ? '已复制' : '复制 URL'}
                </button>
              </div>

              <textarea
                className="json-config-preview"
                readOnly
                value={antigravityJsonConfig}
              />
            </div>
          </div>

          {/* 暴露的 MCP Tools 列表 */}
          <div className="mcp-tools-card">
            <div className="card-title">
              <Wrench size={16} /> 已暴露给 AI 助手的 4 个 MCP Tools
            </div>
            <div className="tools-grid">
              <div className="tool-tag-item">
                <code>get_requirements_tree</code>
                <span>获取需求模块拓扑与完成状态</span>
              </div>
              <div className="tool-tag-item">
                <code>get_requirement_detail</code>
                <span>获取指定节点的 Markdown 详情</span>
              </div>
              <div className="tool-tag-item">
                <code>search_requirements</code>
                <span>全局全文检索需求文档关键词</span>
              </div>
              <div className="tool-tag-item">
                <code>update_requirement_status</code>
                <span>允许 AI 完成代码后自动更新节点状态</span>
              </div>
            </div>
          </div>

          {/* AI 实时调用日志 */}
          <div className="mcp-logs-card">
            <div className="card-title">
              <Activity size={16} /> AI 助手实时调用日志 (SSE Live Activity)
            </div>
            <div className="logs-scroll-box">
              {logs.length === 0 ? (
                <div className="empty-logs">暂无 AI 调用记录，在 AI 工具中调用工具时此处将实时刷新...</div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className={`log-item ${log.status}`}>
                    <span className="log-time">{log.time}</span>
                    <code className="log-tool">{log.tool}</code>
                    <span className="log-params">{JSON.stringify(log.params)}</span>
                    <span className="log-status-badge">{log.status.toUpperCase()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn primary" onClick={onClose}>
            关闭面板
          </button>
        </div>
      </div>
    </div>
  );
};
