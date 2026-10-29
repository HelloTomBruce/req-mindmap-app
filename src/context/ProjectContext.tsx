import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { ProjectData, MindNode, ProjectMeta } from '../types';
import { NodeTemplate } from '../templates';
import { useProject } from '../hooks/useProject';
import { useTemplateEditor, EditingTemplateState } from '../hooks/useTemplateEditor';
import { useMcpPolling } from '../hooks/useMcpPolling';
import { mcpServerManager } from '../mcpServerManager';
import { importDocumentToProject } from '../services/documentImporter';
import { selectDocumentFile, selectFolder } from '../services/projectIO';
import { findNodeTitleById } from '../services/treeOperations';

// 1. 项目核心数据与操作
export interface ProjectDataContextType {
  recentProjects: ProjectMeta[];
  currentProjectPath: string;
  projectData: ProjectData;
  docsMap: Record<string, string>;
  selectedNodeId: string | null;
  currentNode: MindNode | null;
  allProjectNodes: MindNode[];
  setSelectedNodeId: (id: string | null) => void;
  handleSelectNode: (node: MindNode) => void;
  handleOpenNodeDrawer: (node: MindNode) => void;
  handleUpdateMeta: (nodeId: string, updates: Partial<MindNode>) => void;
  handleContentChange: (newContent: string) => void;
  handleDeleteNode: (nodeId: string) => Promise<void>;
  handleToggleCollapse: (nodeId: string) => void;
  handleNavigateToNodeByTitle: (title: string) => void;
  handleAddEdge: (sourceId: string, targetId: string, type?: 'depends_on' | 'blocks' | 'relates_to') => void;
  handleDeleteEdge: (edgeId: string) => void;
  handleOpenProject: (meta: ProjectMeta) => Promise<void>;
  handleSelectFolder: () => Promise<boolean>;
  handleCreateProject: (name: string, targetPath: string, presetId?: string) => Promise<void>;
  handleDeleteProjectConfirm: (targetProject: ProjectMeta, deletePhysicalFiles: boolean) => Promise<void>;
  handleImportDocument: (mdPath: string, targetPath: string, name: string) => Promise<void>;
  selectFolderForCreate: () => Promise<string | null>;
  selectMdFileForImport: () => Promise<string | null>;
}

// 2. 界面与弹窗状态
export interface UIStateContextType {
  canvasViewMode: 'mindmap' | 'kanban';
  setCanvasViewMode: (mode: 'mindmap' | 'kanban') => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  isExportModalOpen: boolean;
  setIsExportModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isImportModalOpen: boolean;
  setIsImportModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMCPModalOpen: boolean;
  setIsMCPModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isUpdateModalOpen: boolean;
  setIsUpdateModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  targetDeleteProject: ProjectMeta | null;
  setTargetDeleteProject: (proj: ProjectMeta | null) => void;
}

// 3. MCP AI 服务状态
export interface MCPContextType {
  mcpStatus: { isRunning: boolean; port: number; projectPath: string; sseUrl: string };
  mcpLogs: any[];
  handleToggleMCPServer: (enable: boolean, customPort?: number) => Promise<void>;
}

// 4. 需求模板状态
export interface TemplateContextType {
  selectedEditingTemplate: EditingTemplateState | null;
  setSelectedEditingTemplate: (state: EditingTemplateState | null) => void;
  handleSelectTemplateForEdit: (tmpl: NodeTemplate, isCustom: boolean) => void;
  handleTemplateContentChange: (newContent: string) => void;
  handleTemplateMetaChange: (templateId: string, updates: Partial<NodeTemplate>) => void;
  templateParentNode: { id: string; title: string } | null;
  setTemplateParentNode: (node: { id: string; title: string } | null) => void;
  handleAddChildNode: (parentId: string) => void;
  handleConfirmCreateWithTemplate: (template: NodeTemplate) => Promise<void>;
}

// 聚合类型（完全向下兼容现有 useProjectContext）
export type ProjectContextType = ProjectDataContextType & UIStateContextType & MCPContextType & TemplateContextType;

export const ProjectDataContext = createContext<ProjectDataContextType | null>(null);
export const UIStateContext = createContext<UIStateContextType | null>(null);
export const MCPContext = createContext<MCPContextType | null>(null);
export const TemplateContext = createContext<TemplateContextType | null>(null);
export const ProjectContext = createContext<ProjectContextType | null>(null);

interface ProjectProviderProps {
  children: ReactNode;
  onNavigateToEditor?: () => void;
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({
  children,
  onNavigateToEditor
}) => {
  const [canvasViewMode, setCanvasViewMode] = useState<'mindmap' | 'kanban'>('mindmap');
  // 默认收起：进入项目时先以纯导图概览，由用户主动打开节点文档抽屉
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // 弹窗状态
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isMCPModalOpen, setIsMCPModalOpen] = useState<boolean>(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [targetDeleteProject, setTargetDeleteProject] = useState<ProjectMeta | null>(null);
  const [templateParentNode, setTemplateParentNode] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const {
    recentProjects,
    currentProjectPath,
    setCurrentProjectPath,
    projectData,
    setProjectData,
    docsMap,
    setDocsMap,
    selectedNodeId,
    setSelectedNodeId,
    currentNode,
    allProjectNodes,
    saveRecentProjects,
    handleOpenProject,
    handleOpenProjectByPath,
    handleSelectFolder,
    handleCreateProject,
    handleDeleteProjectConfirm,
    handleSelectNode,
    handleOpenNodeDrawer,
    handleAddChildWithTemplate,
    handleDeleteNode,
    handleToggleCollapse,
    handleUpdateMeta,
    handleAddEdge,
    handleDeleteEdge,
    handleContentChange,
    handleNavigateToNodeByTitle
  } = useProject({
    onOpenDrawer: () => setIsDrawerOpen(true),
    onCloseDrawer: () => setIsDrawerOpen(false),
    onNavigateToEditor: () => {
      setIsCreateModalOpen(false);
      onNavigateToEditor?.();
    }
  });

  const {
    selectedEditingTemplate,
    setSelectedEditingTemplate,
    handleSelectTemplateForEdit,
    handleTemplateContentChange,
    handleTemplateMetaChange
  } = useTemplateEditor(() => setIsDrawerOpen(true));

  const { mcpStatus, mcpLogs } = useMcpPolling({
    currentProjectPath,
    onMcpWriteReload: (loadedProjectData, loadedDocsMap) => {
      setProjectData(loadedProjectData);
      setDocsMap(loadedDocsMap);
    },
    onProjectSwitch: handleOpenProjectByPath
  });

  const handleToggleMCPServer = useCallback(
    async (enable: boolean, customPort?: number) => {
      const targetPort = customPort || mcpStatus.port || 6001;
      if (enable) {
        if (!currentProjectPath) {
          const { message } = await import('@tauri-apps/plugin-dialog');
          await message('请先打开或创建一个需求项目', { title: '提示', kind: 'warning' });
          return;
        }
        await mcpServerManager.startServer(targetPort, currentProjectPath);
      } else {
        await mcpServerManager.stopServer();
      }
    },
    [currentProjectPath, mcpStatus.port]
  );

  const handleImportDocument = useCallback(
    async (mdPath: string, targetPath: string, name: string) => {
      try {
        const { importedProject, docsMapResult, meta } = await importDocumentToProject(
          mdPath,
          targetPath,
          name
        );

        setCurrentProjectPath(targetPath);
        setProjectData(importedProject);
        setDocsMap(docsMapResult);
        setSelectedNodeId('root-node');

        // 与 handleCreateProject 同理：同步切换 Rust MCP 项目路径，
        // 避免轮询误判项目切换而把界面弹回旧项目
        mcpServerManager.setProjectPath(targetPath);
        await mcpServerManager.startServer(6001, targetPath);

        const updated = [meta, ...recentProjects.filter((p) => p.path !== targetPath)];
        await saveRecentProjects(updated);

        setIsImportModalOpen(false);
        setIsDrawerOpen(true);
        onNavigateToEditor?.();
      } catch (err) {
        console.error('Failed to parse file:', err);
        const { message } = await import('@tauri-apps/plugin-dialog');
        await message('文档解析转换失败', { title: '错误', kind: 'error' });
      }
    },
    [recentProjects, saveRecentProjects, setCurrentProjectPath, setProjectData, setDocsMap, setSelectedNodeId, onNavigateToEditor]
  );

  const handleAddChildNode = useCallback(
    (parentId: string) => {
      const parentTitle = findNodeTitleById(projectData.root, parentId, '当前节点');
      setTemplateParentNode({ id: parentId, title: parentTitle });
    },
    [projectData.root]
  );

  const handleConfirmCreateWithTemplate = useCallback(
    async (template: NodeTemplate) => {
      if (!templateParentNode) return;
      const parentId = templateParentNode.id;
      setTemplateParentNode(null);
      await handleAddChildWithTemplate(parentId, template);
    },
    [templateParentNode, handleAddChildWithTemplate]
  );

  const selectFolderForCreate = useCallback(() => {
    return selectFolder('选择新需求项目存放文件夹');
  }, []);

  const selectMdFileForImport = useCallback(() => {
    return selectDocumentFile();
  }, []);

  const projectDataValue = useMemo<ProjectDataContextType>(() => ({
    recentProjects,
    currentProjectPath,
    projectData,
    docsMap,
    selectedNodeId,
    currentNode,
    allProjectNodes,
    setSelectedNodeId,
    handleSelectNode,
    handleOpenNodeDrawer,
    handleUpdateMeta,
    handleContentChange,
    handleDeleteNode,
    handleToggleCollapse,
    handleNavigateToNodeByTitle,
    handleAddEdge,
    handleDeleteEdge,
    handleOpenProject,
    handleSelectFolder,
    handleCreateProject,
    handleDeleteProjectConfirm,
    handleImportDocument,
    selectFolderForCreate,
    selectMdFileForImport
  }), [
    recentProjects,
    currentProjectPath,
    projectData,
    docsMap,
    selectedNodeId,
    currentNode,
    allProjectNodes,
    setSelectedNodeId,
    handleSelectNode,
    handleOpenNodeDrawer,
    handleUpdateMeta,
    handleContentChange,
    handleDeleteNode,
    handleToggleCollapse,
    handleNavigateToNodeByTitle,
    handleAddEdge,
    handleDeleteEdge,
    handleOpenProject,
    handleSelectFolder,
    handleCreateProject,
    handleDeleteProjectConfirm,
    handleImportDocument,
    selectFolderForCreate,
    selectMdFileForImport
  ]);

  const uiStateValue = useMemo<UIStateContextType>(() => ({
    canvasViewMode,
    setCanvasViewMode,
    isDrawerOpen,
    setIsDrawerOpen,
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
    setTargetDeleteProject
  }), [
    canvasViewMode,
    setCanvasViewMode,
    isDrawerOpen,
    setIsDrawerOpen,
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
    setTargetDeleteProject
  ]);

  const mcpValue = useMemo<MCPContextType>(() => ({
    mcpStatus,
    mcpLogs,
    handleToggleMCPServer
  }), [mcpStatus, mcpLogs, handleToggleMCPServer]);

  const templateValue = useMemo<TemplateContextType>(() => ({
    selectedEditingTemplate,
    setSelectedEditingTemplate,
    handleSelectTemplateForEdit,
    handleTemplateContentChange,
    handleTemplateMetaChange,
    templateParentNode,
    setTemplateParentNode,
    handleAddChildNode,
    handleConfirmCreateWithTemplate
  }), [
    selectedEditingTemplate,
    setSelectedEditingTemplate,
    handleSelectTemplateForEdit,
    handleTemplateContentChange,
    handleTemplateMetaChange,
    templateParentNode,
    setTemplateParentNode,
    handleAddChildNode,
    handleConfirmCreateWithTemplate
  ]);

  const combinedProjectContextValue = useMemo<ProjectContextType>(() => ({
    ...projectDataValue,
    ...uiStateValue,
    ...mcpValue,
    ...templateValue
  }), [projectDataValue, uiStateValue, mcpValue, templateValue]);

  return (
    <ProjectDataContext.Provider value={projectDataValue}>
      <UIStateContext.Provider value={uiStateValue}>
        <MCPContext.Provider value={mcpValue}>
          <TemplateContext.Provider value={templateValue}>
            <ProjectContext.Provider value={combinedProjectContextValue}>
              {children}
            </ProjectContext.Provider>
          </TemplateContext.Provider>
        </MCPContext.Provider>
      </UIStateContext.Provider>
    </ProjectDataContext.Provider>
  );
};

export const useProjectData = (): ProjectDataContextType => {
  const context = useContext(ProjectDataContext);
  if (!context) {
    throw new Error('useProjectData must be used within a ProjectProvider');
  }
  return context;
};

export const useUIState = (): UIStateContextType => {
  const context = useContext(UIStateContext);
  if (!context) {
    throw new Error('useUIState must be used within a ProjectProvider');
  }
  return context;
};

export const useMCPContext = (): MCPContextType => {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error('useMCPContext must be used within a ProjectProvider');
  }
  return context;
};

export const useTemplateContext = (): TemplateContextType => {
  const context = useContext(TemplateContext);
  if (!context) {
    throw new Error('useTemplateContext must be used within a ProjectProvider');
  }
  return context;
};

export const useProjectContext = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
};
