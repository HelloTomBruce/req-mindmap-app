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
    mcpLogs,
    projectData,
    docsMap,
    allProjectNodes,
    handleOpenProject,
    handleSelectFolder,
    handleCreateProject,
    handleDeleteProjectConfirm,
    handleImportDocument,
    selectFolderForCreate,
    selectMdFileForImport,
    handleToggleMCPServer,
    isExportModalOpen,
    setIsExportModalOpen,
    isCreateModalOpen,
    setIsCreateModalOpen,
    isImportModalOpen,
    setIsImportModalOpen,
    isMCPModalOpen,
    setIsMCPModalOpen,
    isUpdateModalOpen,
    setIsUpdateModalOpen,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    targetDeleteProject,
    setTargetDeleteProject,
    templateParentNode,
    setTemplateParentNode,
    handleConfirmCreateWithTemplate,
    setSelectedNodeId,
    setIsDrawerOpen
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

      <AppModals
        isExportModalOpen={isExportModalOpen}
        onCloseExportModal={() => setIsExportModalOpen(false)}
        rootNode={projectData.root}
        docsMap={docsMap}
        projectName={projectData.projectName}
        isCreateModalOpen={isCreateModalOpen}
        onCloseCreateModal={() => setIsCreateModalOpen(false)}
        onSelectFolderForCreate={selectFolderForCreate}
        onCreateProject={handleCreateProject}
        isImportModalOpen={isImportModalOpen}
        onCloseImportModal={() => setIsImportModalOpen(false)}
        onSelectMdFile={selectMdFileForImport}
        onImportDocument={handleImportDocument}
        targetDeleteProject={targetDeleteProject}
        onCloseDeleteModal={() => setTargetDeleteProject(null)}
        onConfirmDeleteProject={async (deleteFiles) => {
          if (targetDeleteProject) {
            await handleDeleteProjectConfirm(targetDeleteProject, deleteFiles);
            setTargetDeleteProject(null);
          }
        }}
        isMCPModalOpen={isMCPModalOpen}
        onCloseMCPModal={() => setIsMCPModalOpen(false)}
        mcpStatus={mcpStatus}
        mcpLogs={mcpLogs}
        onToggleMCPServer={handleToggleMCPServer}
        isUpdateModalOpen={isUpdateModalOpen}
        onCloseUpdateModal={() => setIsUpdateModalOpen(false)}
        isCommandPaletteOpen={isCommandPaletteOpen}
        onCloseCommandPalette={() => setIsCommandPaletteOpen(false)}
        allProjectNodes={allProjectNodes}
        onSelectPaletteNode={(nodeId) => {
          setSelectedNodeId(nodeId);
          setIsDrawerOpen(true);
        }}
        onExecutePaletteAction={() => {}}
        templateParentNode={templateParentNode}
        onCloseTemplatePicker={() => setTemplateParentNode(null)}
        onSelectNodeTemplate={handleConfirmCreateWithTemplate}
      />
    </>
  );
};
