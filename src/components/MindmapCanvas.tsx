import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  Node,
  NodeProps,
  EdgeProps,
  ReactFlowProvider,
  useReactFlow,
  getBezierPath,
  EdgeLabelRenderer,
  Connection
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { MindNode, MindEdge, DependencyEdgeType } from '../types';
import { useMindmapLayout, computeSubtreeStats, NODE_WIDTH, NODE_HEIGHT } from '../hooks/useMindmapLayout';
import { getStatusLabel, normalizePriority } from '../utils/statusUtils';
import { ChevronRight, ChevronDown, Plus, Trash2, FileText, Edit2, Link2, AlertTriangle, X } from 'lucide-react';

interface MindmapCanvasProps {
  rootNode: MindNode;
  edgesData?: MindEdge[];
  selectedNodeId: string | null;
  onSelectNode: (node: MindNode) => void;
  onOpenDrawer: () => void;
  onRenameNode: (nodeId: string, newTitle: string) => void;
  onAddChildNode: (parentId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onAddEdge?: (sourceId: string, targetId: string, type?: DependencyEdgeType) => void;
  onDeleteEdge?: (edgeId: string) => void;
}


// 自定义依赖边组件（带动画流动与阻塞警示）
const CustomDependencyEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });

  const edgeData = data as unknown as {
    edgeId: string;
    type: DependencyEdgeType;
    isBlocked: boolean;
    onDelete?: (id: string) => void;
  };

  const isBlocked = edgeData?.isBlocked;

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path dependency-edge-path"
        d={edgePath}
        style={{
          ...style,
          stroke: isBlocked ? '#ef4444' : '#f59e0b',
          strokeWidth: isBlocked ? 2.5 : 2
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all'
          }}
          className={`dep-edge-pill ${isBlocked ? 'blocked' : ''}`}
          title={isBlocked ? '⚠️ 依赖未完成：前置任务尚未完成！' : '前置依赖关系'}
        >
          {isBlocked ? <AlertTriangle size={12} /> : <Link2 size={12} />}
          <span>{isBlocked ? '阻塞中' : '依赖'}</span>
          {edgeData?.onDelete && (
            <button
              className="dep-edge-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                edgeData.onDelete?.(edgeData.edgeId);
              }}
              title="删除此依赖关联"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

// 自定义思维导图节点组件 Custom MindNode Component for React Flow
const CustomMindNodeComponent: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as unknown as {
    node: MindNode;
    isRoot: boolean;
    onSelectNode: (node: MindNode) => void;
    onOpenDrawer: () => void;
    onRenameNode: (nodeId: string, newTitle: string) => void;
    onAddChildNode: (parentId: string) => void;
    onDeleteNode: (nodeId: string) => void;
    onToggleCollapse: (nodeId: string) => void;
  };

  const { node, isRoot, onRenameNode, onAddChildNode, onDeleteNode, onToggleCollapse } = nodeData;
  const hasChildren = node.children && node.children.length > 0;
  const isCollapsed = !!node.collapsed;
  const stats = useMemo(() => computeSubtreeStats(node), [node]);

  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(node.title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setEditingTitle(node.title);
  }, [node.title]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSaveTitle = () => {
    const trimmed = editingTitle.trim();
    if (trimmed && trimmed !== node.title) {
      onRenameNode(node.id, trimmed);
    } else {
      setEditingTitle(node.title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setEditingTitle(node.title);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`mindmap-node-card ${isRoot ? 'root-node' : ''} ${selected ? 'selected' : ''} ${hasChildren && stats.hasUnresolvedP0 ? 'has-p0-alert' : ''}`}
      style={{ margin: 0, width: `${NODE_WIDTH}px` }}
    >
      {/* 顶部/左侧 Handle 供连接 */}
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        style={{ width: 8, height: 8, background: '#64748b', opacity: 0.6 }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        style={{ width: 8, height: 8, background: '#64748b', opacity: 0.6 }}
      />

      <div className="node-main-row">
        <FileText size={16} className="node-type-icon" />

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="node-title-input"
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="node-title-text"
            title={`${node.title} (双击重命名)`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            {node.title}
          </span>
        )}

        {hasChildren && (
          <button
            className="node-collapse-toggle"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(node.id);
            }}
            title={isCollapsed ? '展开子节点' : '折叠子节点'}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      <div className="node-footer-meta">
        <div className="node-meta-left">
          {(() => {
            const priority = normalizePriority(node.priority);
            const statusInfo = getStatusLabel(node.status);
            return (
              <>
                <span className={`priority-badge ${priority.toLowerCase()}`}>
                  {priority}
                </span>

                <span className="status-badge" style={{ color: statusInfo.color }}>
                  ● {statusInfo.label}
                </span>
              </>
            );
          })()}
        </div>

        {hasChildren && (
          <div className="node-meta-right">
            <span
              className={`node-progress-pill ${stats.percent === 100 ? 'done' : ''}`}
              title={`子任务完成度: ${stats.completed}/${stats.total} (${stats.percent}%)`}
            >
              {stats.completed}/{stats.total}
            </span>
            {stats.hasUnresolvedP0 && (
              <span className="node-p0-alert-badge" title="分支下存在未完成的 P0 紧急需求">
                P0!
              </span>
            )}
          </div>
        )}
      </div>

      {/* 悬浮操作栏 */}
      <div className="node-hover-actions" onClick={(e) => e.stopPropagation()}>
        <button
          title="重命名节点"
          className="action-btn edit"
          onClick={() => setIsEditing(true)}
        >
          <Edit2 size={13} />
        </button>

        <button
          title="添加子节点"
          className="action-btn add"
          onClick={() => onAddChildNode(node.id)}
        >
          <Plus size={13} />
        </button>

        {!isRoot && (
          <button
            title="删除节点"
            className="action-btn delete"
            onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* 底部/右侧 Handle 供连线 */}
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        style={{ width: 8, height: 8, background: '#3b82f6', opacity: 0.6 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        style={{ width: 8, height: 8, background: '#3b82f6', opacity: 0.6 }}
      />
    </div>
  );
};

const MindmapFlowInner: React.FC<MindmapCanvasProps> = ({
  rootNode,
  edgesData = [],
  selectedNodeId,
  onSelectNode,
  onOpenDrawer,
  onRenameNode,
  onAddChildNode,
  onDeleteNode,
  onToggleCollapse,
  onAddEdge,
  onDeleteEdge
}) => {
  const nodeTypes = useMemo(() => ({ mindNode: CustomMindNodeComponent }), []);
  const edgeTypes = useMemo(() => ({ dependencyEdge: CustomDependencyEdge }), []);
  const reactFlowInstance = useReactFlow();

  // 通过自定义 Hook 纯粹解耦拓扑算法与排版
  const { nodes: initialNodes, edges: initialEdges } = useMindmapLayout({
    rootNode,
    edgesData,
    selectedNodeId,
    onSelectNode,
    onOpenDrawer,
    onRenameNode,
    onAddChildNode,
    onDeleteNode,
    onToggleCollapse,
    onDeleteEdge
  });

  // 当外部选中的节点改变时，平滑聚焦居中至该节点
  const prevSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedNodeId) {
      prevSelectedIdRef.current = null;
      return;
    }
    if (prevSelectedIdRef.current === selectedNodeId) {
      return;
    }
    prevSelectedIdRef.current = selectedNodeId;

    const target = initialNodes.find((n) => n.id === selectedNodeId);
    if (target && target.position) {
      reactFlowInstance.setCenter(
        target.position.x + NODE_WIDTH / 2,
        target.position.y + NODE_HEIGHT / 2,
        { duration: 400, zoom: Math.max(reactFlowInstance.getZoom(), 0.9) }
      );
    }
  }, [selectedNodeId, initialNodes, reactFlowInstance]);

  // 处理拖拽连线创建依赖
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target && connection.source !== connection.target) {
        onAddEdge?.(connection.source, connection.target, 'depends_on');
      }
    },
    [onAddEdge]
  );

  // 单击：仅选中节点
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const targetMindNode = (node.data as any).node as MindNode;
      if (targetMindNode) {
        onSelectNode(targetMindNode);
      }
    },
    [onSelectNode]
  );

  // 双击：打开右侧 Markdown 需求编辑抽屉
  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const targetMindNode = (node.data as any).node as MindNode;
      if (targetMindNode) {
        onSelectNode(targetMindNode);
        onOpenDrawer();
      }
    },
    [onSelectNode, onOpenDrawer]
  );

  // 监听全局删除快捷键
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 避免在输入框里按退格键时误删节点
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedNodeId) {
        onDeleteNode(selectedNodeId);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedNodeId, onDeleteNode]);

  return (
    <div className="react-flow-mindmap-container">
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        deleteKeyCode={null} // 禁用自带的删除，改用自定义拦截以支持二次确认
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background gap={20} size={1} className="react-flow-background" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
};

export const MindmapCanvas: React.FC<MindmapCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <MindmapFlowInner {...props} />
    </ReactFlowProvider>
  );
};

