import { useMemo } from 'react';
import dagre from 'dagre';
import { Node, Edge, Position, MarkerType } from '@xyflow/react';
import { MindNode, MindEdge, Status } from '../types';
import { normalizeStatus, normalizePriority } from '../utils/statusUtils';

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 80;

/**
 * 递归计算子树的完成度统计及 P0 告警
 */
export function computeSubtreeStats(node: MindNode): {
  completed: number;
  total: number;
  percent: number;
  hasUnresolvedP0: boolean;
} {
  let completed = 0;
  let total = 0;
  let hasUnresolvedP0 = false;

  const traverse = (n: MindNode) => {
    total += 1;
    const status = normalizeStatus(n.status);
    const priority = normalizePriority(n.priority);
    if (status === 'completed') {
      completed += 1;
    } else if (priority === 'P0') {
      hasUnresolvedP0 = true;
    }
    if (n.children) {
      n.children.forEach(traverse);
    }
  };

  if (node.children) {
    node.children.forEach(traverse);
  }

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percent, hasUnresolvedP0 };
}

/**
 * 使用 Dagre 自动计算从左至右（LR）拓扑布局坐标
 */
export const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
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

export interface UseMindmapLayoutOptions {
  rootNode: MindNode;
  edgesData?: MindEdge[];
  selectedNodeId: string | null;
  onSelectNode: (node: MindNode) => void;
  onOpenDrawer: () => void;
  onRenameNode: (nodeId: string, newTitle: string) => void;
  onAddChildNode: (parentId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
}

/**
 * 封装脑图节点拓扑转换与 Dagre 排版计算的自定义 Hook
 */
export function useMindmapLayout({
  rootNode,
  edgesData = [],
  selectedNodeId,
  onSelectNode,
  onOpenDrawer,
  onRenameNode,
  onAddChildNode,
  onDeleteNode,
  onToggleCollapse,
  onDeleteEdge
}: UseMindmapLayoutOptions): { nodes: Node[]; edges: Edge[] } {
  return useMemo(() => {
    const nodesAcc: Node[] = [];
    const edgesAcc: Edge[] = [];
    const nodeStatusMap: Record<string, Status> = {};

    const traverse = (currentNode: MindNode, isRoot: boolean = false) => {
      nodeStatusMap[currentNode.id] = normalizeStatus(currentNode.status);
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
    return { nodes: layouted.nodes, edges: layouted.edges };
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
}
