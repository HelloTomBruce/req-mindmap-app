import React, { useEffect, useState } from 'react';
import {
  Layers,
  Plus,
  Folder,
  FileText,
  Trash2,
  ArrowRight,
  FileUp,
  RefreshCw,
  Zap,
  Plug,
  Download,
  PenLine,
  GitBranch,
  Sun,
  Moon
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { ProjectMeta } from '../types';
import { getGitStatus } from '../gitHelper';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTheme } from '../context/ThemeContext';
export type { ProjectMeta };

interface ProjectManagerProps {
  recentProjects: ProjectMeta[];
  mcpStatus: {
    isRunning: boolean;
    port: number;
    projectPath: string;
    sseUrl: string;
  };
  onOpenProject: (projectMeta: ProjectMeta) => void;
  onOpenFolder: () => void;
  onDeleteProjectMeta: (project: ProjectMeta) => void;
  onOpenCreateModal: () => void;
  onOpenImportModal: () => void;
  onOpenUpdateModal: () => void;
  onOpenMCPModal: () => void;
}

// 首页各项目的一次性探测快照：Git 未提交数 + 树完成度
interface ProjectSnapshot {
  dirty: number;
  total: number; // -1 表示读取失败，展示回退到索引中的 nodeCount
  completed: number;
}

async function probeCompletion(projectPath: string): Promise<{ total: number; completed: number }> {
  try {
    const json = await invoke<string>('read_text_file_custom', {
      path: `${projectPath}/.requirements.json`
    });
    const root = JSON.parse(json)?.root;
    if (!root) return { total: -1, completed: -1 };
    let total = 0;
    let completed = 0;
    const walk = (node: { status?: string; children?: unknown[] }) => {
      total += 1;
      if (node.status === 'completed') completed += 1;
      (node.children || []).forEach((c) => walk(c as never));
    };
    walk(root);
    return { total, completed };
  } catch {
    return { total: -1, completed: -1 };
  }
}

// lastOpened 历史上有两种格式：ISO 时间戳（新）与 toLocaleDateString 日期串（旧，可被 Date.parse 按当日零点解析）
function formatRelativeTime(raw: string): string {
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return raw;
  const diff = Date.now() - t;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return new Date(t).toLocaleDateString();
}

// 长路径中间省略：保留首段与末两级目录，title 中仍展示完整路径
function shortenPath(p: string, max = 46): string {
  if (p.length <= max) return p;
  const parts = p.split('/');
  if (parts.length < 3) return p;
  return `${parts[0]}/…/${parts.slice(-2).join('/')}`;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  recentProjects,
  mcpStatus,
  onOpenProject,
  onOpenFolder,
  onDeleteProjectMeta,
  onOpenCreateModal,
  onOpenImportModal,
  onOpenUpdateModal,
  onOpenMCPModal
}) => {

  // 全局亮暗主题切换
  const { resolvedTheme, toggleTheme } = useTheme();

  // 各最近项目的 Git 未提交数与完成度探测（目录已删除或非 Git 仓库时静默降级，不展示徽章）
  const [snapshots, setSnapshots] = useState<Record<string, ProjectSnapshot>>({});
  useEffect(() => {
    let cancelled = false;
    if (recentProjects.length === 0) {
      setSnapshots({});
      return;
    }
    (async () => {
      const entries = await Promise.all(
        recentProjects.map(async (p) => {
          const [statusItems, completion] = await Promise.all([
            getGitStatus(p.path),
            probeCompletion(p.path)
          ]);
          return [p.id, { dirty: statusItems.length, ...completion }] as const;
        })
      );
      if (!cancelled) setSnapshots(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [recentProjects]);


  const lastProject = recentProjects[0];

  return (
    <div className="project-manager-container">

      <div className="manager-shell">
        {/* 顶栏 */}
        <header className="manager-topbar">
          <div className="brand">
            <Layers size={26} className="brand-icon" />
            <div>
              <h1>DocMind 结构化文档工作台</h1>
              <p>以拓扑脑图把握宏观全局，以 Markdown 沉浸细节创作</p>
            </div>
          </div>

          <div className="topbar-actions">
            {/* 首页 MCP 状态快速入口组件 */}
            <button
              className={`mcp-status-pill ${mcpStatus.isRunning ? 'online' : 'offline'}`}
              onClick={onOpenMCPModal}
              title="点击配置或查看 MCP AI 接入状态"
            >
              <Zap size={14} />
              <span>
                MCP AI 接入: <strong>{mcpStatus.isRunning ? `🟢 端口 ${mcpStatus.port}` : '🔴 未启动'}</strong>
              </span>
            </button>

            <Button variant="outline" size="sm" onClick={onOpenUpdateModal}>
              <RefreshCw size={14} />
              检查更新
            </Button>

            <Button
              variant="outline"
              size="icon-sm"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={resolvedTheme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
            >
              {resolvedTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </Button>
          </div>
        </header>

        {/* 继续上次编辑直达卡：留存用户的高频路径 */}
        {lastProject && (
          <div
            className="resume-card"
            onClick={() => onOpenProject(lastProject)}
          >
            <div className="resume-main">
              <div className="resume-icon">
                <PenLine size={15} />
              </div>
              <div className="resume-info">
                <span className="resume-label">继续编辑</span>
                <span className="resume-name">{lastProject.name}</span>
                <span className="resume-time">· {formatRelativeTime(lastProject.lastOpened)}</span>
              </div>
            </div>
            <div className="resume-action">
              <span>打开项目</span>
              <ArrowRight size={14} />
            </div>
          </div>
        )}

        {/* 最近项目列表 */}
        <div className="recent-projects-section">
          <div className="recent-section-header">
            <div className="recent-title-group">
              <h2>最近打开的项目</h2>
              <span className="recent-count-pill">{recentProjects.length}</span>
            </div>
            <div className="recent-header-actions">
              <Button variant="outline" size="sm" onClick={onOpenFolder}>
                <Folder size={14} />
                打开本地
              </Button>
              <Button variant="outline" size="sm" onClick={onOpenImportModal}>
                <FileUp size={14} />
                从文档导入
              </Button>
              <Button variant="default" size="sm" onClick={onOpenCreateModal}>
                <Plus size={14} />
                新建项目
              </Button>
            </div>
          </div>

          {recentProjects.length === 0 ? (
            <div className="empty-projects">
              <div className="empty-icon-wrap">
                <Folder size={32} />
              </div>
              <h3>暂无最近打开的项目</h3>
              <p>您可以新建一个结构化需求树，或直接打开本地已有项目目录</p>
              <div className="empty-actions">
                <Button variant="default" size="sm" onClick={onOpenCreateModal}>
                  <Plus size={14} />
                  新建项目
                </Button>
                <Button variant="outline" size="sm" onClick={onOpenImportModal}>
                  <FileUp size={14} />
                  从文档导入
                </Button>
                <Button variant="outline" size="sm" onClick={onOpenFolder}>
                  <Folder size={14} />
                  打开本地项目
                </Button>
              </div>
            </div>
          ) : (
            <div className="projects-grid">
              {recentProjects.map((p) => {
                const snap = snapshots[p.id];
                const totalNodes = snap && snap.total >= 0 ? snap.total : p.nodeCount;
                return (
                  <Card
                    key={p.id}
                    stock="card"
                    tilt={false}
                    className="project-item-card"
                    onClick={() => onOpenProject(p)}
                  >
                    <div className="project-item-header">
                      <Folder className="folder-icon" size={20} />
                      <span className="project-item-name">{p.name}</span>
                      {snap && snap.dirty > 0 && (
                        <span
                          className="git-dirty-badge"
                          title={`${snap.dirty} 个文件存在未提交的变更（修改 / 新增 / 已暂存）`}
                        >
                          <GitBranch size={11} />
                          {snap.dirty}
                        </span>
                      )}
                      <button
                        className="icon-action-btn delete"
                        title="从最近列表中移除"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteProjectMeta(p);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="project-item-body">
                      <span className="project-item-path" title={p.path}>
                        {shortenPath(p.path)}
                      </span>
                      <div className="project-item-meta">
                        <span>
                          {totalNodes} 个节点
                          {snap && snap.total >= 0 ? ` · ${snap.completed} 已完成` : ''}
                        </span>
                        <span>{formatRelativeTime(p.lastOpened)}</span>
                      </div>
                    </div>
                    <div className="project-item-footer">
                      <span>打开工作台</span>
                      <ArrowRight size={14} />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部特性信息条：降级为紧凑低调的产品能力提示 */}
        <footer className="manager-info-strip">
          <button className="info-item" onClick={onOpenMCPModal}>
            <Plug size={14} />
            MCP AI 协同
          </button>
          <span className="info-item">
            <FileText size={14} />
            Markdown 本地双向同步
          </span>
          <span className="info-item">
            <Download size={14} />
            一键聚合导出
          </span>
        </footer>
      </div>
    </div>
  );
};
