import React from 'react';
import { HashRouter } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes';
import './App.css';

const App: React.FC = () => {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
};

export default App;
