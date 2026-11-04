import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectContext } from '../context/ProjectContext';
import { ProjectManager } from '../components/ProjectManager';
import { AppModals } from '../components/layout/AppModals';

export const ProjectManagerPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    recentProjects,
    mcpStatus,
    handleOpenProject,
    handleSelectFolder,
    setIsCreateModalOpen,
    setIsImportModalOpen,
    setIsUpdateModalOpen,
    setIsMCPModalOpen,
    setTargetDeleteProject
  } = useProjectContext();

  const onOpenProjectAndNavigate = async (meta: any) => {
    await handleOpenProject(meta);
    navigate('/editor');
  };

  const onOpenFolderAndNavigate = async () => {
    const opened = await handleSelectFolder();
    if (opened) {
      navigate('/editor');
    }
  };

  return (
    <>
      <ProjectManager
        recentProjects={recentProjects}
        mcpStatus={mcpStatus}
        onOpenProject={onOpenProjectAndNavigate}
        onOpenFolder={onOpenFolderAndNavigate}
        onDeleteProjectMeta={(proj) => setTargetDeleteProject(proj)}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
        onOpenMCPModal={() => setIsMCPModalOpen(true)}
      />

      <AppModals />
    </>
  );
};
