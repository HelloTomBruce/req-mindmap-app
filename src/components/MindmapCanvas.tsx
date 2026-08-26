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
  useNodesState,
  useEdgesState
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { MindNode, Priority, Status } from '../types';
import { ChevronRight, ChevronDown, Plus, Trash2, FileText, Edit2 } from 'lucide-react';

interface MindmapCanvasProps {
  rootNode: MindNode;
  selectedNodeId: string | null;
  onSelectNode: (node: MindNode) => void;
  onOpenDrawer: () => void;
  onRenameNode: (nodeId: string, newTitle: string) => void;
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

const NODE_WIDTH = 220;
const NODE_HEIGHT = 70;

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
      className={`mindmap-node-card ${isRoot ? 'root-node' : ''} ${selected ? 'selected' : ''}`}
      style={{ margin: 0, width: `${NODE_WIDTH}px` }}
    >
      {/* 输入 Connect Handle (左侧) */}
      {!isRoot && <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />}

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
        <span
          className="priority-badge"
          style={{
            backgroundColor: PRIORITY_COLORS[node.priority].bg,
            color: PRIORITY_COLORS[node.priority].text
          }}
        >
          {node.priority}
        </span>

        <span className="status-badge" style={{ color: STATUS_LABELS[node.status].color }}>
          ● {STATUS_LABELS[node.status].label}
        </span>
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
            onClick={() => onDeleteNode(node.id)}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* 输出 Connect Handle (右侧) */}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
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
    dagreGraph.setEdge(edge.source, edge.target);
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

export const MindmapCanvas: React.FC<MindmapCanvasProps> = ({
  rootNode,
  selectedNodeId,
  onSelectNode,
  onOpenDrawer,
  onRenameNode,
  onAddChildNode,
  onDeleteNode,
  onToggleCollapse
}) => {
  const nodeTypes = useMemo(() => ({ mindNode: CustomMindNodeComponent }), []);

  // 转换为 React Flow Nodes & Edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodesAcc: Node[] = [];
    const edgesAcc: Edge[] = [];

    const traverse = (currentNode: MindNode, isRoot: boolean = false) => {
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
            type: 'bezier',
            style: { stroke: '#94a3b8', strokeWidth: 2 }
          });
          traverse(child, false);
        });
      }
    };

    traverse(rootNode, true);

    const layouted = getLayoutedElements(nodesAcc, edgesAcc);
    return { initialNodes: layouted.nodes, initialEdges: layouted.edges };
  }, [rootNode, selectedNodeId, onSelectNode, onOpenDrawer, onRenameNode, onAddChildNode, onDeleteNode, onToggleCollapse]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

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

  return (
    <div className="react-flow-mindmap-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background gap={20} size={1} color="#cbd5e1" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
};
