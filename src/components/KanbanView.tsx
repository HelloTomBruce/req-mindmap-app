import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
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

interface DraggingCardState {
  nodeId: string;
  nodeTitle: string;
  sourceKey: string;
  currentX: number;
  currentY: number;
}

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
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [draggingState, setDraggingState] = useState<DraggingCardState | null>(null);
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

  // 指针驱动的拖拽引擎 (Pointer Event Based DnD - 彻底解决 WebKit / Tauri HTML5 drag 偶发不生效问题)
  const handleCardPointerDown = (e: React.PointerEvent, node: MindNode, sourceKey: string) => {
    // 若点击在下拉选择或按钮上则不触发拖拽
    if ((e.target as HTMLElement).closest('select') || (e.target as HTMLElement).closest('button')) {
      return;
    }

    if (e.button !== 0) return; // 仅左键拖拽

    const startX = e.clientX;
    const startY = e.clientY;
    let isDraggingActive = false;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (!isDraggingActive && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        isDraggingActive = true;
        document.body.classList.add('kanban-dragging-active');
        window.getSelection()?.removeAllRanges();
      }

      if (isDraggingActive) {
        moveEvent.preventDefault();
        window.getSelection()?.removeAllRanges();

        setDraggingState({
          nodeId: node.id,
          nodeTitle: node.title,
          sourceKey,
          currentX: moveEvent.clientX,
          currentY: moveEvent.clientY
        });

        const elements = document.elementsFromPoint(moveEvent.clientX, moveEvent.clientY);
        const colEl = elements.find((el) => el.getAttribute('data-col-key'));
        if (colEl) {
          const colKey = colEl.getAttribute('data-col-key');
          setDragOverColumn(colKey || null);
        } else {
          setDragOverColumn(null);
        }
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.classList.remove('kanban-dragging-active');
      window.getSelection()?.removeAllRanges();

      if (isDraggingActive) {
        const elements = document.elementsFromPoint(upEvent.clientX, upEvent.clientY);
        const colEl = elements.find((el) => el.getAttribute('data-col-key'));
        if (colEl) {
          const targetColKey = colEl.getAttribute('data-col-key');
          if (targetColKey) {
            if (groupBy === 'status') {
              onUpdateNodeMeta(node.id, { status: targetColKey as Status });
            } else {
              onUpdateNodeMeta(node.id, { priority: targetColKey as Priority });
            }
          }
        }
        setDraggingState(null);
        setDragOverColumn(null);
      } else {
        // 未移动判定为纯点击，打开对应节点抽屉
        onSelectNode(node.id);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div className="kanban-view-container">
      {/* 顶部控制栏 */}
      <div className="kanban-header-bar">
        <div className="kanban-header-left">
          <div className="kanban-title-tag">
            <Kanban size={15} />
            <span className="title-text">看板</span>
          </div>

          <div className="kanban-group-switch" title="切换看板分组维度">
            <Filter size={12} className="switch-icon" />
            <button
              className={`group-switch-btn ${groupBy === 'status' ? 'active' : ''}`}
              onClick={() => setGroupBy('status')}
            >
              按状态
            </button>
            <button
              className={`group-switch-btn ${groupBy === 'priority' ? 'active' : ''}`}
              onClick={() => setGroupBy('priority')}
            >
              按优先级
            </button>
          </div>
        </div>

        <div className="kanban-header-right">
          <input
            type="text"
            className="kanban-filter-input"
            placeholder="筛选卡片..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />

          {rootNode && onAddChildNode && (
            <button
              className="btn outline small kanban-add-btn"
              onClick={() => onAddChildNode(rootNode.id)}
              title="在根模块下快速添加任务"
            >
              <Plus size={13} />
              <span className="add-btn-text">添加任务</span>
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
                  data-col-key={col.key}
                  className={`kanban-column ${isOver ? 'drag-over' : ''}`}
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
                      <div className="kanban-column-empty">
                        <span>可拖拽任务卡片到此状态</span>
                      </div>
                    ) : (
                      colNodes.map((node) => {
                        const isSelected = selectedNodeId === node.id;
                        const isBeingDragged = draggingState?.nodeId === node.id;
                        const breadcrumbs = breadcrumbsMap[node.id] || [];
                        const progress = calculateNodeProgress(node);
                        const hasChildren = node.children && node.children.length > 0;
                        const content = docsMap[node.docPath] || '';
                        const hasWikiLinks = content.includes('[[');

                        return (
                          <div
                            key={node.id}
                            className={`kanban-card ${isSelected ? 'selected' : ''} ${isBeingDragged ? 'dragging' : ''}`}
                            onPointerDown={(e) => handleCardPointerDown(e, node, col.key)}
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

                            {/* 底部元数据与快捷流转 */}
                            <div className="card-footer-meta">
                              <div className="footer-left-pills">
                                <span className={`priority-badge ${node.priority.toLowerCase()}`}>
                                  {node.priority}
                                </span>

                                {/* 快捷状态切换下拉 */}
                                <select
                                  className="card-quick-move-select"
                                  value={node.status}
                                  onChange={(e) => {
                                    onUpdateNodeMeta(node.id, { status: e.target.value as Status });
                                  }}
                                  title="点击快捷流转状态"
                                >
                                  <option value="draft">草稿</option>
                                  <option value="todo">待办</option>
                                  <option value="in_progress">进行中</option>
                                  <option value="completed">已完成</option>
                                  <option value="deprecated">废弃</option>
                                </select>

                                {hasWikiLinks && (
                                  <span className="card-wikilink-pill" title="包含双向链接引用">
                                    <Link2 size={11} />
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
                  data-col-key={col.key}
                  className={`kanban-column ${isOver ? 'drag-over' : ''}`}
                >
                  <div className="kanban-column-header" style={{ borderTopColor: col.color }}>
                    <div className="col-title-group">
                      <span className="col-title">{col.label}</span>
                    </div>
                    <span className="col-count-badge">{colNodes.length}</span>
                  </div>

                  <div className="kanban-column-body">
                    {colNodes.length === 0 ? (
                      <div className="kanban-column-empty">
                        <span>可拖拽任务卡片到此优先级</span>
                      </div>
                    ) : (
                      colNodes.map((node) => {
                        const isSelected = selectedNodeId === node.id;
                        const isBeingDragged = draggingState?.nodeId === node.id;
                        const breadcrumbs = breadcrumbsMap[node.id] || [];
                        const progress = calculateNodeProgress(node);
                        const hasChildren = node.children && node.children.length > 0;
                        const content = docsMap[node.docPath] || '';
                        const hasWikiLinks = content.includes('[[');

                        return (
                          <div
                            key={node.id}
                            className={`kanban-card ${isSelected ? 'selected' : ''} ${isBeingDragged ? 'dragging' : ''}`}
                            onPointerDown={(e) => handleCardPointerDown(e, node, col.key)}
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
                                <span className={`status-badge-pill ${node.status}`}>
                                  {node.status}
                                </span>

                                {/* 快捷优先级切换下拉 */}
                                <select
                                  className="card-quick-move-select"
                                  value={node.priority}
                                  onChange={(e) => {
                                    onUpdateNodeMeta(node.id, { priority: e.target.value as Priority });
                                  }}
                                  title="点击快捷调整优先级"
                                >
                                  <option value="P0">P0 紧急</option>
                                  <option value="P1">P1 高</option>
                                  <option value="P2">P2 中</option>
                                  <option value="P3">P3 低</option>
                                </select>

                                {hasWikiLinks && (
                                  <span className="card-wikilink-pill" title="包含双向链接引用">
                                    <Link2 size={11} />
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

      {/* 拖拽浮层预览 (通过 Portal 挂载至 document.body，彻底避免被任意 overflow 或 contain 裁剪) */}
      {draggingState &&
        createPortal(
          <div
            className="kanban-drag-ghost"
            style={{
              left: `${draggingState.currentX + 12}px`,
              top: `${draggingState.currentY + 12}px`
            }}
          >
            <div className="ghost-title-row">
              <Kanban size={14} className="ghost-icon" />
              <span className="ghost-title">{draggingState.nodeTitle}</span>
            </div>
            <div className="ghost-target-hint">
              {dragOverColumn ? `✨ 释放流转至此列` : `👉 拖拽至目标泳道...`}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
