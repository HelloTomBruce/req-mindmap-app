import React from 'react';
import { useProjectContext } from '../../context/ProjectContext';
import { ExportDocModal } from '../ExportDocModal';
import { CreateProjectModal } from '../CreateProjectModal';
import { ImportMdModal } from '../ImportMdModal';
import { DeleteConfirmModal } from '../DeleteConfirmModal';
import { MCPManagerModal } from '../MCPManagerModal';
import { UpdateModal } from '../UpdateModal';
import { CommandPaletteModal } from '../CommandPaletteModal';
import { TemplatePickerModal } from '../TemplatePickerModal';

export interface AppModalsProps {
  onExecutePaletteAction?: (actionId: string) => void;
}

/**
 * 全局统一模态框容器组件
 * 直接消费 ProjectContext，消除顶层页面 20+ 个状态字段的 Prop Drilling
 */
export const AppModals: React.FC<AppModalsProps> = ({ onExecutePaletteAction }) => {
  const {
    projectData,
    docsMap,
    allProjectNodes,
    setSelectedNodeId,
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
    setTargetDeleteProject,
    templateParentNode,
    setTemplateParentNode,
    selectFolderForCreate,
    selectMdFileForImport,
    handleCreateProject,
    handleImportDocument,
    handleDeleteProjectConfirm,
    handleToggleMCPServer,
    handleConfirmCreateWithTemplate,
    mcpStatus,
    mcpLogs
  } = useProjectContext();

  return (
    <>
      {/* 聚合导出完整文档弹窗 */}
      {isExportModalOpen && (
        <ExportDocModal
          rootNode={projectData.root}
          edgesData={projectData.edges}
          docsMap={docsMap}
          projectName={projectData.projectName}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}

      {/* 创建新需求项目弹窗 */}
      {isCreateModalOpen && (
        <CreateProjectModal
          onClose={() => setIsCreateModalOpen(false)}
          onSelectFolder={selectFolderForCreate}
          onCreate={handleCreateProject}
        />
      )}

      {/* 导入 Markdown / Word 弹窗 */}
      {isImportModalOpen && (
        <ImportMdModal
          onClose={() => setIsImportModalOpen(false)}
          onSelectMd={selectMdFileForImport}
          onSelectFolder={selectFolderForCreate}
          onImport={handleImportDocument}
        />
      )}

      {/* 删除项目二次确认弹窗 */}
      {targetDeleteProject && (
        <DeleteConfirmModal
          project={targetDeleteProject}
          onClose={() => setTargetDeleteProject(null)}
          onConfirm={async (deleteFiles) => {
            if (targetDeleteProject) {
              await handleDeleteProjectConfirm(targetDeleteProject, deleteFiles);
              setTargetDeleteProject(null);
            }
          }}
        />
      )}

      {/* 远程版本自动检查更新弹窗 */}
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
      />

      {/* MCP AI 服务管理弹窗 */}
      {isMCPModalOpen && (
        <MCPManagerModal
          status={mcpStatus}
          logs={mcpLogs}
          onClose={() => setIsMCPModalOpen(false)}
          onToggleServer={handleToggleMCPServer}
        />
      )}

      {/* 全局快捷搜索面板 (Cmd/Ctrl + K) */}
      <CommandPaletteModal
        nodes={allProjectNodes}
        docsMap={docsMap}
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectNode={(nodeId) => {
          setSelectedNodeId(nodeId);
          setIsDrawerOpen(true);
        }}
        onExecuteAction={onExecutePaletteAction}
      />

      {/* 节点模板选择弹窗 */}
      {templateParentNode && (
        <TemplatePickerModal
          parentNodeTitle={templateParentNode.title}
          onClose={() => setTemplateParentNode(null)}
          onSelectTemplate={handleConfirmCreateWithTemplate}
        />
      )}
    </>
  );
};
