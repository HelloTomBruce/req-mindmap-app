import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  Node,
  Edge,
  NodeProps,
  EdgeProps,
  ReactFlowProvider,
  useReactFlow,
  getBezierPath,
  EdgeLabelRenderer,
  Connection,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { MindNode, MindEdge, Status, DependencyEdgeType } from '../types';
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

const STATUS_LABELS: Record<Status, { label: string; color: string }> = {
  draft: { label: '草稿', color: '#9ca3af' },
  todo: { label: '待办', color: '#f59e0b' },
  in_progress: { label: '进行中', color: '#3b82f6' },
  completed: { label: '已完成', color: '#10b981' },
  deprecated: { label: '废弃', color: '#ef4444' }
};

const NODE_WIDTH = 240;
const NODE_HEIGHT = 76;

interface SubtreeStats {
  completed: number;
  total: number;
  percent: number;
  hasUnresolvedP0: boolean;
}

function computeSubtreeStats(node: MindNode): SubtreeStats {
  if (!node.children || node.children.length === 0) {
    const isDone = node.status === 'completed';
    const isUnresolvedP0 = node.priority === 'P0' && !isDone;
    return {
      completed: isDone ? 1 : 0,
      total: 1,
      percent: isDone ? 100 : 0,
      hasUnresolvedP0: isUnresolvedP0
    };
  }

  let completed = 0;
  let total = 0;
  let hasUnresolvedP0 = false;

  const traverse = (n: MindNode) => {
    if (!n.children || n.children.length === 0) {
      total += 1;
      if (n.status === 'completed') {
        completed += 1;
      } else if (n.priority === 'P0') {
        hasUnresolvedP0 = true;
      }
    } else {
      n.children.forEach(traverse);
    }
  };

  traverse(node);
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percent, hasUnresolvedP0 };
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
          <span className={`priority-badge ${node.priority.toLowerCase()}`}>
            {node.priority}
          </span>

          <span className="status-badge" style={{ color: STATUS_LABELS[node.status].color }}>
            ● {STATUS_LABELS[node.status].label}
          </span>
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

// 使用 Dagre 自动计算水平从左至右布局（Rankdir: LR）
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: 'LR',
    nodesep: 28,
    ranksep: 70
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    // 仅基于层级树进行 Dagre 排版
    if (edge.type === 'default' || !edge.type) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2
      }
    };
  });

  return { nodes: layoutedNodes, edges };
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

  // 转换为 React Flow Nodes & Edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodesAcc: Node[] = [];
    const edgesAcc: Edge[] = [];
    const nodeStatusMap: Record<string, Status> = {};

    const traverse = (currentNode: MindNode, isRoot: boolean = false) => {
      nodeStatusMap[currentNode.id] = currentNode.status;
      nodesAcc.push({
        id: currentNode.id,
        type: 'mindNode',
        data: {
          node: currentNode,
          isRoot,
          onSelectNode,
          onOpenDrawer,
          onRenameNode,
          onAddChildNode,
          onDeleteNode,
          onToggleCollapse
        },
        selected: selectedNodeId === currentNode.id,
        position: { x: 0, y: 0 }
      });

      if (currentNode.children && currentNode.children.length > 0 && !currentNode.collapsed) {
        currentNode.children.forEach((child) => {
          edgesAcc.push({
            id: `edge-${currentNode.id}-${child.id}`,
            source: currentNode.id,
            target: child.id,
            sourceHandle: 'source-right',
            targetHandle: 'target-left',
            type: 'default',
            style: { stroke: '#94a3b8', strokeWidth: 2 }
          });
          traverse(child, false);
        });
      }
    };

    traverse(rootNode, true);

    // 追加跨分支依赖边
    edgesData.forEach((depEdge) => {
      const sourceStatus = nodeStatusMap[depEdge.source];
      const targetStatus = nodeStatusMap[depEdge.target];
      // 如果目标节点已经进入开发或已完成，而前置源节点未完成，则标记为阻塞 (Blocked)
      const isBlocked =
        sourceStatus !== 'completed' &&
        (targetStatus === 'in_progress' || targetStatus === 'completed');

      edgesAcc.push({
        id: depEdge.id,
        source: depEdge.source,
        target: depEdge.target,
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
        type: 'dependencyEdge',
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isBlocked ? '#ef4444' : '#f59e0b',
          width: 14,
          height: 14
        },
        data: {
          edgeId: depEdge.id,
          type: depEdge.type,
          isBlocked,
          onDelete: onDeleteEdge
        }
      });
    });

    const layouted = getLayoutedElements(nodesAcc, edgesAcc);
    return { initialNodes: layouted.nodes, initialEdges: layouted.edges };
  }, [
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
  ]);

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

