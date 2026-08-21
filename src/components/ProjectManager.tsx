import React from 'react';
import { HardDrive, Plus, Folder, FileText, Trash2, ArrowRight, FileUp } from 'lucide-react';

export interface ProjectMeta {
  id: string;
  name: string;
  path: string;
  lastOpened: string;
  nodeCount: number;
}

interface ProjectManagerProps {
  recentProjects: ProjectMeta[];
  onOpenProject: (projectMeta: ProjectMeta) => void;
  onOpenFolder: () => void;
  onDeleteProjectMeta: (project: ProjectMeta) => void;
  onOpenCreateModal: () => void;
  onOpenImportModal: () => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  recentProjects,
  onOpenProject,
  onOpenFolder,
  onDeleteProjectMeta,
  onOpenCreateModal,
  onOpenImportModal
}) => {
  return (
    <div className="project-manager-container">
      <div className="project-manager-card">
        <header className="manager-header">
          <div className="brand">
            <HardDrive size={28} className="brand-icon" />
            <div>
              <h1>ReqMindmark 需求架构师</h1>
              <p>以思维导图形式维护模块关系与 Markdown 需求文档</p>
            </div>
          </div>
        </header>

        <div className="manager-actions-bar">
          <button className="btn primary large" onClick={onOpenCreateModal}>
            <Plus size={16} /> 新建需求项目
          </button>

          <button className="btn outline large" onClick={onOpenImportModal}>
            <FileUp size={16} /> 从 Markdown (.md) 转换
          </button>

          <button className="btn outline large" onClick={onOpenFolder}>
            <Folder size={16} /> 打开已有项目文件夹
          </button>
        </div>

        <div className="recent-projects-section">
          <h2>最近打开的项目</h2>
          {recentProjects.length === 0 ? (
            <div className="empty-projects">
              <FileText size={32} color="#cbd5e1" />
              <p>暂无最近项目，点击上方按钮新建或打开项目</p>
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
                      title="删除项目"
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
                      <span>节点数量: {p.nodeCount}</span>
                      <span>{p.lastOpened}</span>
                    </div>
                  </div>
                  <div className="project-item-footer">
                    <span>进入编辑</span>
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
