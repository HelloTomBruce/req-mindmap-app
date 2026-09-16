import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { ProjectProvider } from '../context/ProjectContext';
import { ProjectManagerPage } from '../pages/ProjectManagerPage';
import { EditorPage } from '../pages/EditorPage';

export const AppRoutes: React.FC = () => {
  const navigate = useNavigate();

  return (
    <ProjectProvider onNavigateToEditor={() => navigate('/editor')}>
      <Routes>
        <Route path="/" element={<ProjectManagerPage />} />
        <Route path="/editor" element={<EditorPage />} />
      </Routes>
    </ProjectProvider>
  );
};
