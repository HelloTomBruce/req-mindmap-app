export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type Status = 'draft' | 'todo' | 'in_progress' | 'completed' | 'deprecated';

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
}
