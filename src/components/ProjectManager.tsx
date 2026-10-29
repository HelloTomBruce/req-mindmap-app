import React, { useEffect, useState } from 'react';
import {
  Layers,
  Plus,
  Folder,
  FileText,
  Trash2,
  ArrowRight,
  ArrowUpRight,
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

  // 窗口亮暗主题：切换走 Tauri setTheme（WebView 的 prefers-color-scheme 随之生效，全站 CSS/Canvas 自动跟随）
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('docmind-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* ignore */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    try {
      localStorage.setItem('docmind-theme', next);
    } catch { /* ignore */ }
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().setTheme(next);
    } catch {
      /* 浏览器 dev 环境无此能力，静默降级 */
    }
  };

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

            <button className="btn outline" onClick={onOpenUpdateModal}>
              <RefreshCw size={14} />
              检查更新
            </button>

            <button
              className="btn outline theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </header>

        {/* 继续上次编辑直达卡：留存用户的高频路径 */}
        {lastProject && (
          <div className="resume-card" onClick={() => onOpenProject(lastProject)}>
            <div className="resume-main">
              <div className="resume-icon">
                <PenLine size={16} />
              </div>
              <div className="resume-info">
                <span className="resume-label">继续上次编辑</span>
                <span className="resume-name">
                  {lastProject.name}
                  <span className="resume-time">· {formatRelativeTime(lastProject.lastOpened)}</span>
                </span>
              </div>
            </div>
            <ArrowRight size={16} className="resume-arrow" />
          </div>
        )}

        {/* 快速开始磁贴 */}
        <div className="manager-tiles">
          <button className="manager-tile primary" onClick={onOpenCreateModal}>
            <div className="tile-icon">
              <Plus size={20} />
            </div>
            <div className="tile-info">
              <h3>新建项目</h3>
              <p>从空白或预设模板开始一棵需求树</p>
            </div>
            <ArrowUpRight size={16} className="tile-arrow" />
          </button>

          <button className="manager-tile" onClick={onOpenImportModal}>
            <div className="tile-icon">
              <FileUp size={20} />
            </div>
            <div className="tile-info">
              <h3>从文档导入</h3>
              <p>长篇 Markdown / Word 逆向智能切分</p>
            </div>
            <ArrowUpRight size={16} className="tile-arrow" />
          </button>

          <button className="manager-tile" onClick={onOpenFolder}>
            <div className="tile-icon">
              <Folder size={20} />
            </div>
            <div className="tile-info">
              <h3>打开本地项目</h3>
              <p>选择已有的需求项目文件夹</p>
            </div>
            <ArrowUpRight size={16} className="tile-arrow" />
          </button>
        </div>

        {/* 最近项目列表 */}
        <div className="recent-projects-section">
          <div className="recent-section-header">
            <h2>最近打开的文档项目 ({recentProjects.length})</h2>
          </div>

          {recentProjects.length === 0 ? (
            <div className="empty-projects">
              <FileText size={36} color="#cbd5e1" />
              <p>暂无最近打开的项目记录，点击上方按钮新建或打开本地目录</p>
            </div>
          ) : (
            <div className="projects-grid">
              {recentProjects.map((p) => {
                const snap = snapshots[p.id];
                const totalNodes = snap && snap.total >= 0 ? snap.total : p.nodeCount;
                return (
                  <div key={p.id} className="project-item-card" onClick={() => onOpenProject(p)}>
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
                  </div>
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
