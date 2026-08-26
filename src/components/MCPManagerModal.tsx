import React, { useState } from 'react';
import { X, Server, Check, Copy, Activity, Terminal, Wrench, Settings, Code2 } from 'lucide-react';
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

interface MCPToolDef {
  name: string;
  category: 'query' | 'mutation';
  description: string;
  parameters: string;
}

const MCP_TOOLS_CATALOG: MCPToolDef[] = [
  {
    name: 'list_projects',
    category: 'query',
    description: '获取当前所有的需求项目列表（包含项目名称、本地目录路径及当前激活状态）',
    parameters: '无参数'
  },
  {
    name: 'get_requirements_tree',
    category: 'query',
    description: '获取当前需求项目的完整模块树架构、节点ID、文档路径及完成状态',
    parameters: '无参数'
  },
  {
    name: 'get_requirement_detail',
    category: 'query',
    description: '读取并返回某个特定需求节点的详细 Markdown 描述内容',
    parameters: 'doc_path?: string, node_id?: string'
  },
  {
    name: 'search_requirements',
    category: 'query',
    description: '在需求文档库中全局搜索指定关键词（如接口定义、功能点、业务规则）',
    parameters: 'query: string'
  },
  {
    name: 'update_requirement_status',
    category: 'mutation',
    description: '当 AI 完成编码或重构后，自动更新需求节点的状态 (draft, todo, in_progress, completed)',
    parameters: 'node_id: string, status: string'
  },
  {
    name: 'add_node',
    category: 'mutation',
    description: '向需求思维导图中添加一个新的子节点，并自动创建关联的 Markdown 需求文档',
    parameters: 'parent_id: string, title: string, priority?: string, status?: string, tags?: string[], content?: string'
  },
  {
    name: 'update_node',
    category: 'mutation',
    description: '更新需求思维导图中指定节点的元数据信息（标题、优先级、状态、标签、Markdown 详细文档）',
    parameters: 'node_id: string, title?: string, priority?: string, status?: string, tags?: string[], content?: string'
  },
  {
    name: 'delete_node',
    category: 'mutation',
    description: '从需求思维导图中删除指定的节点及其所有子节点，同时清理关联的 Markdown 文件',
    parameters: 'node_id: string'
  }
];

export const MCPManagerModal: React.FC<MCPManagerModalProps> = ({
  status,
  logs,
  onClose,
  onToggleServer
}) => {
  const [activeTab, setActiveTab] = useState<'config' | 'tools' | 'logs'>('config');
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

        {/* Tab 导航头 */}
        <div className="mcp-modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            <Settings size={15} />
            服务状态与配置
          </button>
          <button
            className={`tab-btn ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => setActiveTab('tools')}
          >
            <Wrench size={15} />
            已暴露 Tools 目录 ({MCP_TOOLS_CATALOG.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <Activity size={15} />
            AI 实时调用日志
            {logs.length > 0 && <span className="tab-badge">{logs.length}</span>}
          </button>
        </div>

        <div className="modal-body">
          {/* Tab 1: 服务状态 & 配置文件 */}
          {activeTab === 'config' && (
            <div className="tab-pane">
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
            </div>
          )}

          {/* Tab 2: 已暴露的 8 个 MCP Tools 详细列表 */}
          {activeTab === 'tools' && (
            <div className="tab-pane">
              <div className="tools-pane-header">
                <p className="tools-pane-desc">
                  外部 AI 助手 (如 Antigravity / Cursor / Claude) 连接本程序的 MCP Server 后，可直接调用以下 <strong>{MCP_TOOLS_CATALOG.length} 个</strong> 原生 Tools 读写需求思维导图与 Markdown 描述：
                </p>
              </div>

              <div className="tools-list">
                {MCP_TOOLS_CATALOG.map((tool) => (
                  <div key={tool.name} className="tool-card">
                    <div className="tool-card-header">
                      <div className="tool-name-tag">
                        <Code2 size={14} className="tool-icon" />
                        <code>{tool.name}</code>
                      </div>
                      <span className={`tool-category-badge ${tool.category}`}>
                        {tool.category === 'query' ? '查询读接口' : '变更写接口'}
                      </span>
                    </div>

                    <p className="tool-description">{tool.description}</p>

                    <div className="tool-params-row">
                      <span className="params-label">参数列表:</span>
                      <code className="params-code">{tool.parameters}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: AI 实时调用日志 */}
          {activeTab === 'logs' && (
            <div className="tab-pane">
              <div className="mcp-logs-card full-height">
                <div className="card-title">
                  <Activity size={16} /> AI 助手实时调用日志 (SSE Live Activity)
                </div>
                <div className="logs-scroll-box expanded">
                  {logs.length === 0 ? (
                    <div className="empty-logs">暂无 AI 调用记录，在 AI 工具中调用工具时此处将实时刷新...</div>
                  ) : (
                    logs.map((log) => (
                      <div key={log.id} className={`log-item ${log.status}`}>
                        <span className="log-time">{log.time}</span>
                        <code className="log-tool">{log.tool}</code>
                        <span className="log-params">{JSON.stringify(log.params)}</span>
                        <span className={`log-status-badge ${log.status}`}>{log.status.toUpperCase()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
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
