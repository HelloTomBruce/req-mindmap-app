import React from 'react';
import { HashRouter } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes';
// 样式按模块拆分于 src/styles/，引入顺序与原 App.css 行序一致（保持级联）
import './styles/tokens.css';
import './styles/base.css';
import './styles/manager.css';
import './styles/workspace.css';
import './styles/command-palette.css';
import './styles/mindmap.css';
import './styles/markdown-drawer.css';
import './styles/modal.css';
import './styles/mcp-manager.css';
import './styles/sidebar.css';
import './styles/diff-modal.css';
import './styles/template.css';
import './styles/kanban.css';
import './styles/misc.css';

const App: React.FC = () => {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
};

export default App;
