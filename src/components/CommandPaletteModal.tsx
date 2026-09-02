import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MindNode } from '../types';
import {
  Search,
  FileText,
  Sparkles,
  Hash,
  CornerDownLeft,
  X,
  Layers,
  Download,
  GitBranch,
  Server,
  Kanban,
  Network,
  Plus
} from 'lucide-react';

interface CommandPaletteModalProps {
  nodes: MindNode[];
  docsMap: Record<string, string>;
  isOpen: boolean;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
  onExecuteAction?: (action: string) => void;
}

interface NodeResultItem {
  type: 'node';
  node: MindNode;
  matchType: 'title' | 'tag' | 'content' | 'filter';
  snippet?: string;
}

interface ActionCommandItem {
  type: 'action';
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

type PaletteItem = NodeResultItem | ActionCommandItem;

const ACTION_COMMANDS: ActionCommandItem[] = [
  {
    type: 'action',
    id: 'kanban',
    title: '切换至任务看板视图',
    description: '以生命周期或优先级泳道查看所有模块进度',
    icon: <Kanban size={16} />
  },
  {
    type: 'action',
    id: 'mindmap',
    title: '切换至思维导图视图',
    description: '以拓扑脑图直观浏览系统层级树架构',
    icon: <Network size={16} />
  },
  {
    type: 'action',
    id: 'export',
    title: '导出聚合 Markdown 文档',
    description: '一键拼接全项目所有模块为带 TOC 目录的长篇大文档',
    icon: <Download size={16} />
  },
  {
    type: 'action',
    id: 'git',
    title: '打开 Git 变更历史与 Diff 审查',
    description: '查看本地修改、提交记录并进行版本回滚',
    icon: <GitBranch size={16} />
  },
  {
    type: 'action',
    id: 'mcp',
    title: '打开 MCP 服务管理中心',
    description: '查看 AI Agent 调用的实时工具流与日志',
    icon: <Server size={16} />
  },
  {
    type: 'action',
    id: 'new_child',
    title: '新建子任务节点',
    description: '在当前选中的模块下快速创建子需求',
    icon: <Plus size={16} />
  }
];

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  nodes,
  docsMap,
  isOpen,
  onClose,
  onSelectNode,
  onExecuteAction
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 展开并计算所有搜索结果（支持普通文字、#前缀过滤、/动作指令）
  const searchResults: PaletteItem[] = useMemo(() => {
    if (!isOpen) return [];
    const q = query.trim().toLowerCase();

    // 1. 指令模式 (以 / 开头)
    if (q.startsWith('/')) {
      const actQuery = q.slice(1).trim();
      if (!actQuery) return ACTION_COMMANDS;
      return ACTION_COMMANDS.filter(
        (a) =>
          a.id.toLowerCase().includes(actQuery) ||
          a.title.toLowerCase().includes(actQuery) ||
          a.description.toLowerCase().includes(actQuery)
      );
    }

    // 2. 标签 / 状态 / 优先级过滤模式 (以 # 开头)
    if (q.startsWith('#')) {
      const filterKey = q.slice(1).trim();
      if (!filterKey) {
        return nodes.map((node) => ({ type: 'node', node, matchType: 'filter' }));
      }

      return nodes
        .filter((node) => {
          // 优先级过滤，如 #p0, #p1
          if (node.priority.toLowerCase() === filterKey) return true;
          // 状态过滤，如 #todo, #in_progress, #completed, #draft
          if (node.status.toLowerCase().includes(filterKey)) return true;
          // 标签过滤
          if (node.tags && node.tags.some((t) => t.toLowerCase().includes(filterKey))) return true;
          return false;
        })
        .map((node) => ({ type: 'node', node, matchType: 'filter' }));
    }

    // 3. 默认空状态展示
    if (!q) {
      return nodes.map((node) => ({ type: 'node', node, matchType: 'title' }));
    }

    // 4. 普通综合搜索（标题 > 标签 > 正文内容）
    const titleMatches: NodeResultItem[] = [];
    const tagMatches: NodeResultItem[] = [];
    const contentMatches: NodeResultItem[] = [];

    nodes.forEach((node) => {
      // 标题匹配
      if (node.title.toLowerCase().includes(q)) {
        titleMatches.push({ type: 'node', node, matchType: 'title' });
        return;
      }

      // 标签匹配
      if (node.tags && node.tags.some((t) => t.toLowerCase().includes(q))) {
        tagMatches.push({ type: 'node', node, matchType: 'tag' });
        return;
      }

      // Markdown 正文全文内容匹配
      const content = docsMap[node.docPath] || '';
      const contentLower = content.toLowerCase();
      const matchPos = contentLower.indexOf(q);
      if (matchPos !== -1) {
        const start = Math.max(0, matchPos - 30);
        const end = Math.min(content.length, matchPos + q.length + 50);
        let snippet = content.slice(start, end).replace(/\n+/g, ' ');
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';

        contentMatches.push({ type: 'node', node, matchType: 'content', snippet });
      }
    });

    return [...titleMatches, ...tagMatches, ...contentMatches];
  }, [nodes, docsMap, query, isOpen]);

  // 打开时自动聚焦输入框并重置选中
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // 触发选中的项
  const handleTriggerItem = (item: PaletteItem) => {
    if (item.type === 'action') {
      if (onExecuteAction) onExecuteAction(item.id);
      onClose();
    } else {
      onSelectNode(item.node.id);
      onClose();
    }
  };

  // 键盘导航
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, searchResults.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + searchResults.length) % Math.max(1, searchResults.length));
      } else if (e.key === 'Enter') {
        if (searchResults.length > 0) {
          e.preventDefault();
          handleTriggerItem(searchResults[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, searchResults, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay command-palette-overlay" onClick={onClose}>
      <div className="modal-content command-palette-modal" onClick={(e) => e.stopPropagation()}>
        {/* 顶部极速搜索条 */}
        <div className="command-palette-input-wrap">
          <Search size={18} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="搜索节点、#状态/标签 (如 #p0, #todo)、或 / 快速指令..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="clear-query-btn" onClick={() => setQuery('')}>
              <X size={14} />
            </button>
          )}
          <kbd className="shortcut-badge">ESC</kbd>
        </div>

        {/* 快捷过滤提示条 */}
        <div className="command-palette-hint-chips">
          <span className="hint-label">快速前缀:</span>
          <button className="hint-chip" onClick={() => setQuery('#p0')}>#p0 (紧急)</button>
          <button className="hint-chip" onClick={() => setQuery('#todo')}>#todo (待办)</button>
          <button className="hint-chip" onClick={() => setQuery('#in_progress')}>#进行中</button>
          <button className="hint-chip" onClick={() => setQuery('/kanban')}>/kanban (看板)</button>
          <button className="hint-chip" onClick={() => setQuery('/export')}>/export (导出)</button>
        </div>

        {/* 搜索结果列表 */}
        <div className="command-palette-results">
          {searchResults.length === 0 ? (
            <div className="palette-empty-state">
              <Layers size={32} className="empty-icon" />
              <p>未找到匹配 “{query}” 的内容</p>
              <span>可尝试输入 # 过滤状态，或 / 执行全局快捷动作</span>
            </div>
          ) : (
            <div className="palette-results-list">
              {searchResults.map((item, idx) => {
                const isSelected = idx === selectedIndex;

                if (item.type === 'action') {
                  return (
                    <div
                      key={item.id}
                      className={`palette-result-item action-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleTriggerItem(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <div className="item-left-icon action-icon">
                        {item.icon}
                      </div>
                      <div className="item-info">
                        <div className="item-title-row">
                          <span className="item-title">{item.title}</span>
                          <span className="action-tag-pill">快捷指令</span>
                        </div>
                        <div className="item-snippet">{item.description}</div>
                      </div>
                      <div className="item-action-hint">
                        <CornerDownLeft size={13} />
                      </div>
                    </div>
                  );
                }

                const { node, matchType, snippet } = item;

                return (
                  <div
                    key={node.id}
                    className={`palette-result-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleTriggerItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="item-left-icon">
                      {node.id === 'root-node' ? (
                        <Sparkles size={16} color="#2c5e53" />
                      ) : (
                        <FileText size={16} />
                      )}
                    </div>

                    <div className="item-info">
                      <div className="item-title-row">
                        <span className="item-title">{node.title}</span>
                        <span className={`priority-badge ${node.priority.toLowerCase()}`}>
                          {node.priority}
                        </span>
                        <span className={`status-badge-pill ${node.status}`}>
                          {node.status}
                        </span>
                        {matchType === 'tag' && (
                          <span className="match-tag-pill">
                            <Hash size={10} /> 标签匹配
                          </span>
                        )}
                        {matchType === 'filter' && (
                          <span className="match-tag-pill">
                            <Hash size={10} /> 筛选结果
                          </span>
                        )}
                        {matchType === 'content' && (
                          <span className="match-content-pill">正文匹配</span>
                        )}
                      </div>

                      {snippet && (
                        <div className="item-snippet">
                          {snippet}
                        </div>
                      )}

                      <div className="item-meta-row">
                        <span className="doc-path-hint">{node.docPath}</span>
                        {node.tags && node.tags.length > 0 && (
                          <div className="tags-list">
                            {node.tags.map((t) => (
                              <span key={t} className="tag-item">#{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="item-action-hint">
                      <CornerDownLeft size={13} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部导航提示栏 */}
        <div className="command-palette-footer">
          <div className="footer-shortcut">
            <kbd>↑</kbd> <kbd>↓</kbd> <span>导航选择</span>
          </div>
          <div className="footer-shortcut">
            <kbd>Enter</kbd> <span>打开 / 执行</span>
          </div>
          <div className="footer-shortcut">
            <kbd>ESC</kbd> <span>关闭</span>
          </div>
          <div className="footer-count">
            共找到 <strong>{searchResults.length}</strong> 条结果
          </div>
        </div>
      </div>
    </div>
  );
};
