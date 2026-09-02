import React, { useState, useMemo } from 'react';
import { MindNode, Status, Priority } from '../types';
import {
  Kanban,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Hash,
  Link2,
  ChevronRight,
  Filter,
  Plus
} from 'lucide-react';

interface KanbanViewProps {
  rootNode: MindNode | null;
  allNodes: MindNode[];
  docsMap: Record<string, string>;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onUpdateNodeMeta: (nodeId: string, updates: Partial<MindNode>) => void;
  onAddChildNode?: (parentId: string) => void;
}

type GroupByMode = 'status' | 'priority';

const STATUS_COLUMNS: Array<{ key: Status; label: string; color: string; icon: React.ReactNode }> = [
  { key: 'draft', label: '草稿', color: '#9ca3af', icon: <FileText size={15} /> },
  { key: 'todo', label: '待办', color: '#f59e0b', icon: <Clock size={15} /> },
  { key: 'in_progress', label: '进行中', color: '#3b82f6', icon: <AlertCircle size={15} /> },
  { key: 'completed', label: '已完成', color: '#10b981', icon: <CheckCircle2 size={15} /> },
  { key: 'deprecated', label: '废弃', color: '#ef4444', icon: <AlertCircle size={15} /> }
];

const PRIORITY_COLUMNS: Array<{ key: Priority; label: string; color: string }> = [
  { key: 'P0', label: 'P0 (紧急关键)', color: '#ef4444' },
  { key: 'P1', label: 'P1 (高优先级)', color: '#f97316' },
  { key: 'P2', label: 'P2 (中优先级)', color: '#3b82f6' },
  { key: 'P3', label: 'P3 (低优先级)', color: '#6b7280' }
];

// 计算节点面包屑链路
function buildBreadcrumbsMap(root: MindNode | null): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  if (!root) return map;

  const traverse = (node: MindNode, currentPath: string[]) => {
    map[node.id] = currentPath;
    if (node.children) {
      node.children.forEach((child) => {
        traverse(child, [...currentPath, node.title]);
      });
    }
  };

  traverse(root, []);
  return map;
}

// 计算节点及其子树的完成统计
function calculateNodeProgress(node: MindNode): { completed: number; total: number; percent: number } {
  if (!node.children || node.children.length === 0) {
    const isDone = node.status === 'completed';
    return { completed: isDone ? 1 : 0, total: 1, percent: isDone ? 100 : 0 };
  }

  let completed = 0;
  let total = 0;

  const countLeafs = (n: MindNode) => {
    if (!n.children || n.children.length === 0) {
      total += 1;
      if (n.status === 'completed') completed += 1;
    } else {
      n.children.forEach(countLeafs);
    }
  };

  countLeafs(node);
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percent };
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  rootNode,
  allNodes,
  docsMap,
  selectedNodeId,
  onSelectNode,
  onUpdateNodeMeta,
  onAddChildNode
}) => {
  const [groupBy, setGroupBy] = useState<GroupByMode>('status');
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const breadcrumbsMap = useMemo(() => buildBreadcrumbsMap(rootNode), [rootNode]);

  // 过滤后的节点列表（排除根节点）
  const displayNodes = useMemo(() => {
    return allNodes.filter((n) => {
      if (n.id === 'root-node' || n.id === rootNode?.id) return false;
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        (n.tags && n.tags.some((t) => t.toLowerCase().includes(q))) ||
        (docsMap[n.docPath] && docsMap[n.docPath].toLowerCase().includes(q))
      );
    });
  }, [allNodes, rootNode, searchFilter, docsMap]);

  // 拖拽处理
  const handleDragStart = (e: React.DragEvent, nodeId: string) => {
    e.dataTransfer.setData('text/plain', nodeId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedNodeId(nodeId);
  };

  const handleDragEnd = () => {
    setDraggedNodeId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== colKey) {
      setDragOverColumn(colKey);
    }
  };

  const handleDragLeave = (e: React.DragEvent, colKey: string) => {
    if (e.currentTarget.contains(e.relatedTarget as HTMLElement)) return;
    if (dragOverColumn === colKey) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetColumnKey: string) => {
    e.preventDefault();
    const nodeId = e.dataTransfer.getData('text/plain') || draggedNodeId;
    setDraggedNodeId(null);
    setDragOverColumn(null);

    if (!nodeId) return;

    if (groupBy === 'status') {
      onUpdateNodeMeta(nodeId, { status: targetColumnKey as Status });
    } else {
      onUpdateNodeMeta(nodeId, { priority: targetColumnKey as Priority });
    }
  };

  return (
    <div className="kanban-view-container">
      {/* 顶部控制栏 */}
      <div className="kanban-header-bar">
        <div className="kanban-header-left">
          <div className="kanban-title-tag">
            <Kanban size={16} />
            <span>任务泳道看板</span>
          </div>

          <div className="kanban-group-switch">
            <span className="switch-label">
              <Filter size={13} /> 分组方式:
            </span>
            <button
              className={`group-switch-btn ${groupBy === 'status' ? 'active' : ''}`}
              onClick={() => setGroupBy('status')}
            >
              按生命周期状态
            </button>
            <button
              className={`group-switch-btn ${groupBy === 'priority' ? 'active' : ''}`}
              onClick={() => setGroupBy('priority')}
            >
              按优先级矩阵
            </button>
          </div>
        </div>

        <div className="kanban-header-right">
          <input
            type="text"
            className="kanban-filter-input"
            placeholder="筛选看板卡片..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />

          {rootNode && onAddChildNode && (
            <button
              className="btn outline small"
              onClick={() => onAddChildNode(rootNode.id)}
              title="在根模块下快速添加任务"
            >
              <Plus size={13} /> 添加任务
            </button>
          )}
        </div>
      </div>

      {/* 看板列容器 */}
      <div className="kanban-board-columns">
        {groupBy === 'status'
          ? STATUS_COLUMNS.map((col) => {
              const colNodes = displayNodes.filter((n) => n.status === col.key);
              const isOver = dragOverColumn === col.key;

              return (
                <div
                  key={col.key}
                  className={`kanban-column ${isOver ? 'drag-over' : ''}`}
                  onDragOver={(e) => handleDragOver(e, col.key)}
                  onDragLeave={(e) => handleDragLeave(e, col.key)}
                  onDrop={(e) => handleDrop(e, col.key)}
                >
                  <div className="kanban-column-header" style={{ borderTopColor: col.color }}>
                    <div className="col-title-group">
                      <span className="col-icon" style={{ color: col.color }}>{col.icon}</span>
                      <span className="col-title">{col.label}</span>
                    </div>
                    <span className="col-count-badge">{colNodes.length}</span>
                  </div>

                  <div className="kanban-column-body">
                    {colNodes.length === 0 ? (
                      <div className="kanban-column-empty">暂无此状态任务</div>
                    ) : (
                      colNodes.map((node) => {
                        const isSelected = selectedNodeId === node.id;
                        const isDragging = draggedNodeId === node.id;
                        const breadcrumbs = breadcrumbsMap[node.id] || [];
                        const progress = calculateNodeProgress(node);
                        const hasChildren = node.children && node.children.length > 0;
                        const content = docsMap[node.docPath] || '';
                        const hasWikiLinks = content.includes('[[');

                        return (
                          <div
                            key={node.id}
                            className={`kanban-card ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, node.id)}
                            onDragEnd={handleDragEnd}
                            onClick={() => onSelectNode(node.id)}
                          >
                            {/* 面包屑链路 */}
                            {breadcrumbs.length > 0 && (
                              <div className="card-breadcrumbs">
                                {breadcrumbs.map((b, idx) => (
                                  <React.Fragment key={idx}>
                                    <span className="breadcrumb-item">{b}</span>
                                    {idx < breadcrumbs.length - 1 && (
                                      <ChevronRight size={10} className="breadcrumb-sep" />
                                    )}
                                  </React.Fragment>
                                ))}
                              </div>
                            )}

                            {/* 标题 */}
                            <div className="card-title-row">
                              <span className="card-title">{node.title}</span>
                            </div>

                            {/* 进度条 (如果有子任务) */}
                            {hasChildren && (
                              <div className="card-progress-section">
                                <div className="progress-info-row">
                                  <span>子任务进度</span>
                                  <span>{progress.completed}/{progress.total} ({progress.percent}%)</span>
                                </div>
                                <div className="card-progress-bar-bg">
                                  <div
                                    className="card-progress-bar-fill"
                                    style={{
                                      width: `${progress.percent}%`,
                                      backgroundColor: progress.percent === 100 ? '#10b981' : '#3b82f6'
                                    }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* 底部元数据 */}
                            <div className="card-footer-meta">
                              <div className="footer-left-pills">
                                <span className={`priority-badge ${node.priority.toLowerCase()}`}>
                                  {node.priority}
                                </span>
                                {hasWikiLinks && (
                                  <span className="card-wikilink-pill" title="包含双向链接引用">
                                    <Link2 size={11} /> 引用
                                  </span>
                                )}
                              </div>

                              {node.tags && node.tags.length > 0 && (
                                <div className="card-tags">
                                  <Hash size={10} />
                                  <span>{node.tags[0]}</span>
                                  {node.tags.length > 1 && <span>+{node.tags.length - 1}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })
          : PRIORITY_COLUMNS.map((col) => {
              const colNodes = displayNodes.filter((n) => n.priority === col.key);
              const isOver = dragOverColumn === col.key;

              return (
                <div
                  key={col.key}
                  className={`kanban-column ${isOver ? 'drag-over' : ''}`}
                  onDragOver={(e) => handleDragOver(e, col.key)}
                  onDragLeave={(e) => handleDragLeave(e, col.key)}
                  onDrop={(e) => handleDrop(e, col.key)}
                >
                  <div className="kanban-column-header" style={{ borderTopColor: col.color }}>
                    <div className="col-title-group">
                      <span className="col-title">{col.label}</span>
                    </div>
                    <span className="col-count-badge">{colNodes.length}</span>
                  </div>

                  <div className="kanban-column-body">
                    {colNodes.length === 0 ? (
                      <div className="kanban-column-empty">暂无此优先级任务</div>
                    ) : (
                      colNodes.map((node) => {
                        const isSelected = selectedNodeId === node.id;
                        const isDragging = draggedNodeId === node.id;
                        const breadcrumbs = breadcrumbsMap[node.id] || [];
                        const progress = calculateNodeProgress(node);
                        const hasChildren = node.children && node.children.length > 0;
                        const content = docsMap[node.docPath] || '';
                        const hasWikiLinks = content.includes('[[');

                        return (
                          <div
                            key={node.id}
                            className={`kanban-card ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, node.id)}
                            onDragEnd={handleDragEnd}
                            onClick={() => onSelectNode(node.id)}
                          >
                            {breadcrumbs.length > 0 && (
                              <div className="card-breadcrumbs">
                                {breadcrumbs.map((b, idx) => (
                                  <React.Fragment key={idx}>
                                    <span className="breadcrumb-item">{b}</span>
                                    {idx < breadcrumbs.length - 1 && (
                                      <ChevronRight size={10} className="breadcrumb-sep" />
                                    )}
                                  </React.Fragment>
                                ))}
                              </div>
                            )}

                            <div className="card-title-row">
                              <span className="card-title">{node.title}</span>
                            </div>

                            {hasChildren && (
                              <div className="card-progress-section">
                                <div className="progress-info-row">
                                  <span>子任务进度</span>
                                  <span>{progress.completed}/{progress.total} ({progress.percent}%)</span>
                                </div>
                                <div className="card-progress-bar-bg">
                                  <div
                                    className="card-progress-bar-fill"
                                    style={{
                                      width: `${progress.percent}%`,
                                      backgroundColor: progress.percent === 100 ? '#10b981' : '#3b82f6'
                                    }}
                                  />
                                </div>
                              </div>
                            )}

                            <div className="card-footer-meta">
                              <div className="footer-left-pills">
                                <span className={`priority-badge ${node.priority.toLowerCase()}`}>
                                  {node.priority}
                                </span>
                                {hasWikiLinks && (
                                  <span className="card-wikilink-pill" title="包含双向链接引用">
                                    <Link2 size={11} /> 引用
                                  </span>
                                )}
                              </div>

                              {node.tags && node.tags.length > 0 && (
                                <div className="card-tags">
                                  <Hash size={10} />
                                  <span>{node.tags[0]}</span>
                                  {node.tags.length > 1 && <span>+{node.tags.length - 1}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
};
