import React from 'react';
import { Layout, Home, Search, Download, Kanban, Network } from 'lucide-react';

interface AppHeaderProps {
  projectName: string;
  canvasViewMode: 'mindmap' | 'kanban';
  onSetCanvasViewMode: (mode: 'mindmap' | 'kanban') => void;
  onReturnToManager: () => void;
  onOpenCommandPalette: () => void;
  onOpenExportModal: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  projectName,
  canvasViewMode,
  onSetCanvasViewMode,
  onReturnToManager,
  onOpenCommandPalette,
  onOpenExportModal
}) => {
  return (
    <header className="app-header">
      <div className="header-left">
        <button
          className="btn outline icon-only"
          title="返回项目管理首页"
          onClick={onReturnToManager}
        >
          <Home size={16} />
        </button>
        <Layout className="app-logo" size={20} />
        <span className="app-name">{projectName}</span>
      </div>

      <div className="header-actions">
        <div className="view-mode-toggle-group">
          <button
            className={`toggle-btn ${canvasViewMode === 'mindmap' ? 'active' : ''}`}
            onClick={() => onSetCanvasViewMode('mindmap')}
            title="切换至思维导图视图"
          >
            <Network size={14} />
            <span>脑图</span>
          </button>
          <button
            className={`toggle-btn ${canvasViewMode === 'kanban' ? 'active' : ''}`}
            onClick={() => onSetCanvasViewMode('kanban')}
            title="切换至任务看板视图"
          >
            <Kanban size={14} />
            <span>看板</span>
          </button>
        </div>

        <button
          className="btn outline header-search-btn"
          title="全局搜索节点与正文 (Cmd + K)"
          onClick={onOpenCommandPalette}
        >
          <Search size={14} />
          <span>搜索...</span>
          <kbd className="header-kbd">⌘K</kbd>
        </button>

        <button className="btn primary" onClick={onOpenExportModal}>
          <Download size={14} /> 聚合导出文档
        </button>
      </div>
    </header>
  );
};
