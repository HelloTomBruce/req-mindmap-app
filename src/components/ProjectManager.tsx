import React, { useEffect, useRef } from 'react';
import { HardDrive, Plus, Folder, FileText, Trash2, ArrowRight, FileUp, RefreshCw, Server, Cpu, BookOpen, ShieldCheck } from 'lucide-react';

export interface ProjectMeta {
  id: string;
  name: string;
  path: string;
  lastOpened: string;
  nodeCount: number;
}

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 背景 Canvas 粒子 + 动态拓扑连线动画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // 粒子节点数据模型
    const PARTICLE_COUNT = 45;
    const particles = Array.from({ length: PARTICLE_COUNT }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      radius: Math.random() * 2 + 1.5,
      alpha: Math.random() * 0.5 + 0.3
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. 渐变背景光晕
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        100,
        width / 2,
        height / 2,
        Math.max(width, height)
      );
      gradient.addColorStop(0, '#f8fafc');
      gradient.addColorStop(0.6, '#e2e8f0');
      gradient.addColorStop(1, '#cbd5e1');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // 2. 更新与绘制粒子节点
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        // 碰撞反弹
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // 绘制点
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(37, 99, 235, ${p.alpha * 0.6})`;
        ctx.fill();

        // 3. 粒子之间连线 (思维导图网格连线效果)
        for (let j = i + 1; j < PARTICLE_COUNT; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 140) {
            const lineAlpha = (1 - dist / 140) * 0.25;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(37, 99, 235, ${lineAlpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="project-manager-container">
      {/* 动态 Canvas 背景 */}
      <canvas ref={canvasRef} className="bg-canvas-animation" />

      <div className="project-manager-card">
        {/* 顶栏 Header */}
        <header className="manager-header">
          <div className="brand">
            <HardDrive size={32} className="brand-icon" />
            <div>
              <h1>ReqMindmark 需求架构师</h1>
              <p>可视化模块拓扑思维导图 & Markdown 级规格说明书工具集</p>
            </div>
          </div>

          <div className="header-actions-right">
            {/* 首页 MCP 状态快速入口组件 */}
            <button
              className={`mcp-status-pill ${mcpStatus.isRunning ? 'online' : 'offline'}`}
              onClick={onOpenMCPModal}
              title="点击配置或查看 MCP AI 接入状态"
            >
              <Server size={14} />
              <span>
                MCP AI 接入: <strong>{mcpStatus.isRunning ? `🟢 端口 ${mcpStatus.port}` : '🔴 未启动'}</strong>
              </span>
            </button>

            <button className="btn outline" onClick={onOpenUpdateModal}>
              <RefreshCw size={14} />
              检查更新
            </button>
          </div>
        </header>

        {/* 快速功能入口 */}
        <div className="manager-actions-bar">
          <button className="btn primary large" onClick={onOpenCreateModal}>
            <Plus size={16} /> 新建
          </button>

          <button className="btn outline large" onClick={onOpenImportModal}>
            <FileUp size={16} /> 从 Markdown (.md) 转换
          </button>

          <button className="btn outline large" onClick={onOpenFolder}>
            <Folder size={16} /> 打开已有项目文件夹
          </button>
        </div>

        {/* 首页核心优势与 AI 特质扩展面板 */}
        <div className="manager-features-grid">
          <div className="feature-card" onClick={onOpenMCPModal}>
            <div className="feature-icon-wrapper ai">
              <Cpu size={20} />
            </div>
            <div className="feature-info">
              <h3>MCP (Model Context Protocol) 协同</h3>
              <p>提供 8 个原生 SSE Tools，支持 Antigravity / Cursor 等 AI 助手直接读取与更新需求拓扑树。</p>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper md">
              <BookOpen size={20} />
            </div>
            <div className="feature-info">
              <h3>Markdown 文件夹双向同步</h3>
              <p>需求思维导图与磁盘 `.md` 规范说明书 1:1 实时双向映射，无需担心脱离本地磁盘格式。</p>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper security">
              <ShieldCheck size={20} />
            </div>
            <div className="feature-info">
              <h3>全量 PRD 一键导出</h3>
              <p>智能聚合导出完整规范 PRD 产品需求说明书，自动拆分图片与模块引用资源。</p>
            </div>
          </div>
        </div>

        {/* 最近项目列表 */}
        <div className="recent-projects-section">
          <div className="recent-section-header">
            <h2>最近打开的需求项目 ({recentProjects.length})</h2>
          </div>

          {recentProjects.length === 0 ? (
            <div className="empty-projects">
              <FileText size={36} color="#cbd5e1" />
              <p>暂无最近打开的项目记录，点击上方按钮新建或打开本地目录</p>
            </div>
          ) : (
            <div className="projects-grid">
              {recentProjects.map((p) => (
                <div key={p.id} className="project-item-card" onClick={() => onOpenProject(p)}>
                  <div className="project-item-header">
                    <Folder className="folder-icon" size={20} />
                    <span className="project-item-name">{p.name}</span>
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
                    <span className="project-item-path" title={p.path}>{p.path}</span>
                    <div className="project-item-meta">
                      <span>包含节点: {p.nodeCount} 个</span>
                      <span>{p.lastOpened}</span>
                    </div>
                  </div>
                  <div className="project-item-footer">
                    <span>打开工作台</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
