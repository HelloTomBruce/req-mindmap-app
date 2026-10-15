import { Status, Priority } from '../types';

/**
 * 规范化需求节点状态，兼容常见别名 (如 'done' -> 'completed', 'in-progress' -> 'in_progress')
 */
export function normalizeStatus(rawStatus?: string | null): Status {
  if (!rawStatus) return 'draft';
  const s = rawStatus.toLowerCase().trim();
  if (s === 'completed' || s === 'done' || s === 'finish' || s === 'finished') {
    return 'completed';
  }
  if (s === 'in_progress' || s === 'in-progress' || s === 'doing') {
    return 'in_progress';
  }
  if (s === 'todo' || s === 'pending' || s === 'open') {
    return 'todo';
  }
  if (s === 'deprecated' || s === 'abandoned' || s === 'closed') {
    return 'deprecated';
  }
  return 'draft';
}

/**
 * 规范化需求优先级，兜底为 P1
 */
export function normalizePriority(rawPriority?: string | null): Priority {
  if (!rawPriority) return 'P1';
  const p = rawPriority.toUpperCase().trim();
  if (p === 'P0' || p === 'P1' || p === 'P2' || p === 'P3') {
    return p as Priority;
  }
  return 'P1';
}

export const STATUS_LABELS: Record<Status, { label: string; color: string }> = {
  draft: { label: '草稿', color: '#9ca3af' },
  todo: { label: '待办', color: '#f59e0b' },
  in_progress: { label: '进行中', color: '#3b82f6' },
  completed: { label: '已完成', color: '#10b981' },
  deprecated: { label: '废弃', color: '#ef4444' }
};

/**
 * 安全获取节点状态对应的标签与色彩，防崩溃兜底
 */
export function getStatusLabel(rawStatus?: string | null): { label: string; color: string } {
  const norm = normalizeStatus(rawStatus);
  return STATUS_LABELS[norm] || { label: rawStatus || '草稿', color: '#9ca3af' };
}
