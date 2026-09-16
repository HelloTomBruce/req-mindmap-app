import React from 'react';
import { Folder, GitBranch, Bookmark } from 'lucide-react';

export type SidebarViewType = 'explorer' | 'git' | 'templates';

interface AppActivityBarProps {
  activeSidebarView: SidebarViewType;
  onChangeSidebarView: (view: SidebarViewType) => void;
}

export const AppActivityBar: React.FC<AppActivityBarProps> = ({
  activeSidebarView,
  onChangeSidebarView
}) => {
  return (
    <div className="activity-bar">
      <button
        className={`activity-icon ${activeSidebarView === 'explorer' ? 'active' : ''}`}
        onClick={() => onChangeSidebarView('explorer')}
        title="需求结构树 (Explorer)"
      >
        <Folder size={20} />
      </button>
      <button
        className={`activity-icon ${activeSidebarView === 'git' ? 'active' : ''}`}
        onClick={() => onChangeSidebarView('git')}
        title="源代码管理 (Git)"
      >
        <GitBranch size={20} />
      </button>
      <button
        className={`activity-icon ${activeSidebarView === 'templates' ? 'active' : ''}`}
        onClick={() => onChangeSidebarView('templates')}
        title="模板库 (Templates)"
      >
        <Bookmark size={20} />
      </button>
    </div>
  );
};
