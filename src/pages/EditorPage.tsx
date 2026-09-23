import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { countNodes } from '../services/treeOperations';
import { useProjectContext } from '../context/ProjectContext';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';
import { AppHeader } from '../components/layout/AppHeader';
import { AppActivityBar, SidebarViewType } from '../components/layout/AppActivityBar';
import { AppStatusBar } from '../components/layout/AppStatusBar';
import { AppModals } from '../components/layout/AppModals';
import { MindmapCanvas } from '../components/MindmapCanvas';
import { KanbanView } from '../components/KanbanView';
import { MarkdownDrawer } from '../components/MarkdownDrawer';
import { Sidebar } from '../components/Sidebar';
import { GitSidebar } from '../components/GitSidebar';
import { TemplateSidebar } from '../components/TemplateSidebar';
import { TemplateMarkdownDrawer } from '../components/TemplateMarkdownDrawer';

export const EditorPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeSidebarView, setActiveSidebarView] = useState<SidebarViewType>('explorer');

  const {
    currentProjectPath,
    projectData,
    docsMap,
    selectedNodeId,
    setSelectedNodeId,
    currentNode,
    allProjectNodes,
    canvasViewMode,
    setCanvasViewMode,
    isDrawerOpen,
    setIsDrawerOpen,
    handleSelectNode,
    handleOpenNodeDrawer,
    handleUpdateMeta,
    handleContentChange,
    handleDeleteNode,
    handleToggleCollapse,
    handleNavigateToNodeByTitle,
    handleAddEdge,
    handleDeleteEdge,
    handleCreateProject,
    handleDeleteProjectConfirm,
    handleImportDocument,
    selectFolderForCreate,
    selectMdFileForImport,
    selectedEditingTemplate,
    setSelectedEditingTemplate,
    handleSelectTemplateForEdit,
    handleTemplateContentChange,
    handleTemplateMetaChange,
    templateParentNode,
    setTemplateParentNode,
    handleAddChildNode,
    handleConfirmCreateWithTemplate,
    mcpStatus,
    mcpLogs,
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
    setTargetDeleteProject
  } = useProjectContext();

  // 状态循环顺序定义
  const STATUS_CYCLE_ORDER: Array<'draft' | 'todo' | 'in_progress' | 'completed'> = [
    'draft',
    'todo',
    'in_progress',
    'completed'
  ];

  // 快速轮转当前选中节点的状态
  const handleCycleCurrentNodeStatus = useCallback(() => {
    if (!currentNode || !selectedNodeId) return;
    const currentIndex = STATUS_CYCLE_ORDER.indexOf(currentNode.status as any);
    const nextStatus =
      currentIndex === -1
        ? 'todo'
        : STATUS_CYCLE_ORDER[(currentIndex + 1) % STATUS_CYCLE_ORDER.length];
    handleUpdateMeta(selectedNodeId, { status: nextStatus });
  }, [currentNode, selectedNodeId, handleUpdateMeta]);

  // 全局快捷键监听 (Cmd/Ctrl + K/O, Space 轮转状态, Alt+D 开关抽屉, Tab 加子节点)
  useGlobalShortcuts({
    onToggleCommandPalette: useCallback(() => {
      setIsCommandPaletteOpen((prev) => !prev);
    }, [setIsCommandPaletteOpen]),
    onToggleDrawer: useCallback(() => {
      setIsDrawerOpen(!isDrawerOpen);
    }, [isDrawerOpen, setIsDrawerOpen]),
    onCycleStatus: handleCycleCurrentNodeStatus,
    onAddChild: useCallback(() => {
      if (projectData?.root) {
        handleAddChildNode(selectedNodeId || projectData.root.id);
      }
    }, [projectData, selectedNodeId, handleAddChildNode])
  });

  // 全局命令面板动作路由
  const handleExecutePaletteAction = (actionId: string) => {
    if (actionId === 'kanban') setCanvasViewMode('kanban');
    else if (actionId === 'mindmap') setCanvasViewMode('mindmap');
    else if (actionId === 'export') setIsExportModalOpen(true);
    else if (actionId === 'git') setActiveSidebarView('git');
    else if (actionId === 'mcp') setIsMCPModalOpen(true);
    else if (actionId === 'new_child' && projectData?.root) {
      handleAddChildNode(selectedNodeId || projectData.root.id);
    }
  };

  return (
    <div className="app-container">
      {/* 顶部导航栏 */}
      <AppHeader
        projectName={projectData.projectName}
        canvasViewMode={canvasViewMode}
        onSetCanvasViewMode={setCanvasViewMode}
        onReturnToManager={() => navigate('/')}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
      />

      {/* 主体工作区布局 */}
      <div className="app-body">
        {/* 左侧活动栏 */}
        <AppActivityBar
          activeSidebarView={activeSidebarView}
          onChangeSidebarView={setActiveSidebarView}
        />

        {/* 侧边栏内容区 */}
        {activeSidebarView === 'explorer' && (
          <Sidebar
            rootNode={projectData.root}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleOpenNodeDrawer}
            projectName={projectData.projectName}
          />
        )}

        {activeSidebarView === 'git' && <GitSidebar projectPath={currentProjectPath} />}

        {activeSidebarView === 'templates' && (
          <TemplateSidebar
            selectedTemplateId={selectedEditingTemplate?.template.id}
            onSelectTemplate={handleSelectTemplateForEdit}
            onDeleteTemplate={(deletedId) => {
              if (selectedEditingTemplate?.template.id === deletedId) {
                setSelectedEditingTemplate(null);
                setIsDrawerOpen(false);
              }
            }}
          />
        )}

        {/* 画布主内容区 */}
        <main className="app-main-canvas">
          {canvasViewMode === 'mindmap' ? (
            <>
              <div className="canvas-header-bar">
                <span className="canvas-title">🧠 模块拓扑关系视图</span>
                <button
                  className="btn small"
                  onClick={() => handleAddChildNode(selectedNodeId || projectData.root.id)}
                >
                  <Plus size={14} /> 添加子需求节点
                </button>
              </div>

              <MindmapCanvas
                rootNode={projectData.root}
                edgesData={projectData.edges}
                selectedNodeId={selectedNodeId}
                onSelectNode={handleSelectNode}
                onOpenDrawer={() => setIsDrawerOpen(true)}
                onRenameNode={(nodeId, newTitle) => handleUpdateMeta(nodeId, { title: newTitle })}
                onAddChildNode={handleAddChildNode}
                onDeleteNode={handleDeleteNode}
                onToggleCollapse={handleToggleCollapse}
                onAddEdge={handleAddEdge}
                onDeleteEdge={handleDeleteEdge}
              />
            </>
          ) : (
            <KanbanView
              rootNode={projectData.root}
              allNodes={allProjectNodes}
              docsMap={docsMap}
              selectedNodeId={selectedNodeId}
              onSelectNode={(nodeId) => {
                setSelectedNodeId(nodeId);
                setIsDrawerOpen(true);
              }}
              onUpdateNodeMeta={handleUpdateMeta}
              onAddChildNode={handleAddChildNode}
            />
          )}
        </main>

        {/* 模板 Markdown 编辑抽屉 */}
        {isDrawerOpen && activeSidebarView === 'templates' && selectedEditingTemplate && (
          <TemplateMarkdownDrawer
            template={selectedEditingTemplate.template}
            content={selectedEditingTemplate.content}
            isCustom={selectedEditingTemplate.isCustom}
            onClose={() => setIsDrawerOpen(false)}
            onContentChange={handleTemplateContentChange}
            onUpdateMeta={handleTemplateMetaChange}
          />
        )}

        {/* 需求节点 Markdown 编辑抽屉 */}
        {isDrawerOpen && activeSidebarView !== 'templates' && currentNode && (
          <MarkdownDrawer
            node={currentNode}
            content={docsMap[currentNode.docPath] || ''}
            projectPath={currentProjectPath}
            allNodes={allProjectNodes}
            docsMap={docsMap}
            onClose={() => setIsDrawerOpen(false)}
            onContentChange={handleContentChange}
            onUpdateMeta={handleUpdateMeta}
            onNavigateToNode={handleNavigateToNodeByTitle}
          />
        )}
      </div>

      {/* 弹窗集合 */}
      <AppModals
        isExportModalOpen={isExportModalOpen}
        onCloseExportModal={() => setIsExportModalOpen(false)}
        rootNode={projectData.root}
        edgesData={projectData.edges}
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
        onExecutePaletteAction={handleExecutePaletteAction}
        templateParentNode={templateParentNode}
        onCloseTemplatePicker={() => setTemplateParentNode(null)}
        onSelectNodeTemplate={handleConfirmCreateWithTemplate}
      />

      {/* 底部状态栏 */}
      <AppStatusBar
        nodeCount={countNodes(projectData.root)}
        currentNodeTitle={currentNode?.title}
      />
    </div>
  );
};
