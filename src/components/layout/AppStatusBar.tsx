import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface AppStatusBarProps {
  nodeCount: number;
  currentNodeTitle?: string;
}

export const AppStatusBar: React.FC<AppStatusBarProps> = ({
  nodeCount,
  currentNodeTitle
}) => {
  return (
    <footer className="app-statusbar">
      <div className="status-item">
        <CheckCircle2 size={12} color="#10b981" /> 磁盘自动同步已就绪
      </div>
      <div className="status-item">
        当前节点数: <strong>{nodeCount}</strong>
      </div>
      <div className="status-item">
        当前选中: <strong>{currentNodeTitle || '未选择'}</strong>
      </div>
    </footer>
  );
};
