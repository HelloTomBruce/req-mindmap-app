import React from 'react';
import { Layout, Home, Search, Download, Kanban, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';

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
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          title="返回项目管理首页"
          onClick={onReturnToManager}
        >
          <Home size={16} />
        </Button>
        <Layout className="app-logo" size={20} />
        <span className="app-name">{projectName}</span>
      </div>

      <div className="header-actions">
        <div className="view-mode-toggle-group">
          <Button
            variant={canvasViewMode === 'mindmap' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onSetCanvasViewMode('mindmap')}
            title="切换至思维导图视图"
          >
            <Network size={14} />
            <span>脑图</span>
          </Button>
          <Button
            variant={canvasViewMode === 'kanban' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onSetCanvasViewMode('kanban')}
            title="切换至任务看板视图"
          >
            <Kanban size={14} />
            <span>看板</span>
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="header-search-btn"
          title="全局搜索节点与正文 (Cmd + K)"
          onClick={onOpenCommandPalette}
        >
          <Search size={14} />
          <span>搜索...</span>
          <Kbd className="ml-1 text-[11px]">⌘K</Kbd>
        </Button>

        <Button variant="default" size="sm" onClick={onOpenExportModal}>
          <Download size={14} /> 聚合导出文档
        </Button>
      </div>
    </header>
  );
};
