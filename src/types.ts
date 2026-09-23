export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type Status = 'draft' | 'todo' | 'in_progress' | 'completed' | 'deprecated';

export type DependencyEdgeType = 'depends_on' | 'blocks' | 'relates_to';

export interface MindEdge {
  id: string;
  source: string;       // 源节点 ID
  target: string;       // 目标节点 ID
  type: DependencyEdgeType; // 依赖类型
  label?: string;       // 依赖说明（如 "需要先完成接口定义"）
}

export interface MindNode {
  id: string;
  title: string;
  docPath: string; // 相对于项目根目录的 .md 路径
  status: Status;
  priority: Priority;
  tags?: string[];
  collapsed?: boolean;
  children?: MindNode[];
}

export interface ProjectData {
  version: string;
  projectName: string;
  root: MindNode;
  edges?: MindEdge[]; // 跨分支依赖关系
}

