import React from 'react';
import { MindNode, Priority, Status } from '../types';
import { ChevronRight, ChevronDown, Plus, Trash2, FileText } from 'lucide-react';

interface MindmapCanvasProps {
  rootNode: MindNode;
  selectedNodeId: string | null;
  onSelectNode: (node: MindNode) => void;
  onAddChildNode: (parentId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
}

const PRIORITY_COLORS: Record<Priority, { bg: string; text: string }> = {
  P0: { bg: '#fee2e2', text: '#991b1b' },
  P1: { bg: '#fef3c7', text: '#92400e' },
  P2: { bg: '#e0e7ff', text: '#3730a3' },
  P3: { bg: '#f3f4f6', text: '#374151' }
};

const STATUS_LABELS: Record<Status, { label: string; color: string }> = {
  draft: { label: '草稿', color: '#9ca3af' },
  todo: { label: '待办', color: '#f59e0b' },
  in_progress: { label: '进行中', color: '#3b82f6' },
  completed: { label: '已完成', color: '#10b981' },
  deprecated: { label: '废弃', color: '#ef4444' }
};

export const MindmapCanvas: React.FC<MindmapCanvasProps> = ({
  rootNode,
  selectedNodeId,
  onSelectNode,
  onAddChildNode,
  onDeleteNode,
  onToggleCollapse
}) => {
  const renderTree = (node: MindNode, depth: number = 0) => {
    const isSelected = selectedNodeId === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = !!node.collapsed;

    return (
      <div key={node.id} className="mindmap-tree-item" style={{ marginLeft: depth > 0 ? 28 : 0 }}>
        <div className="tree-node-row">
          <div className="node-branch-line" />
          
          <div
            className={`node-card ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelectNode(node)}
          >
            {hasChildren && (
              <button
                className="collapse-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse(node.id);
                }}
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
            )}

            <div className="node-content">
              <span className="node-title">
                <FileText size={14} className="node-icon" />
                {node.title}
              </span>

              <div className="node-badges">
                <span
                  className="priority-badge"
                  style={{
                    backgroundColor: PRIORITY_COLORS[node.priority].bg,
                    color: PRIORITY_COLORS[node.priority].text
                  }}
                >
                  {node.priority}
                </span>

                <span
                  className="status-badge"
                  style={{ color: STATUS_LABELS[node.status].color }}
                >
                  ● {STATUS_LABELS[node.status].label}
                </span>
              </div>
            </div>

            <div className="node-actions" onClick={(e) => e.stopPropagation()}>
              <button
                title="添加子节点"
                className="icon-action-btn"
                onClick={() => onAddChildNode(node.id)}
              >
                <Plus size={14} />
              </button>
              {depth > 0 && (
                <button
                  title="删除节点"
                  className="icon-action-btn delete"
                  onClick={() => onDeleteNode(node.id)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {hasChildren && !isCollapsed && (
          <div className="node-children-container">
            {node.children!.map((child) => renderTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mindmap-canvas-container">
      <div className="mindmap-viewport">
        {renderTree(rootNode)}
      </div>
    </div>
  );
};
