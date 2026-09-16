import React from 'react';
import { MindNode } from '../../types';
import { ProjectMeta } from '../ProjectManager';
import { NodeTemplate } from '../../templates';
import { MCPLogItem } from '../../mcpServerManager';
import { ExportDocModal } from '../ExportDocModal';
import { CreateProjectModal } from '../CreateProjectModal';
import { ImportMdModal } from '../ImportMdModal';
import { DeleteConfirmModal } from '../DeleteConfirmModal';
import { MCPManagerModal } from '../MCPManagerModal';
import { UpdateModal } from '../UpdateModal';
import { CommandPaletteModal } from '../CommandPaletteModal';
import { TemplatePickerModal } from '../TemplatePickerModal';

interface AppModalsProps {
  // 导出文档
  isExportModalOpen: boolean;
  onCloseExportModal: () => void;
  rootNode: MindNode;
  docsMap: Record<string, string>;
  projectName: string;

  // 创建项目
  isCreateModalOpen: boolean;
  onCloseCreateModal: () => void;
  onSelectFolderForCreate: () => Promise<string | null>;
  onCreateProject: (name: string, targetPath: string, presetId?: string) => Promise<void>;

  // 导入文档
  isImportModalOpen: boolean;
  onCloseImportModal: () => void;
  onSelectMdFile: () => Promise<string | null>;
  onImportDocument: (mdPath: string, targetPath: string, name: string) => Promise<void>;

  // 删除项目确认
  targetDeleteProject: ProjectMeta | null;
  onCloseDeleteModal: () => void;
  onConfirmDeleteProject: (deletePhysicalFiles: boolean) => Promise<void>;

  // MCP AI 管理
  isMCPModalOpen: boolean;
  onCloseMCPModal: () => void;
  mcpStatus: { isRunning: boolean; port: number; projectPath: string; sseUrl: string };
  mcpLogs: MCPLogItem[];
  onToggleMCPServer: (enable: boolean, customPort?: number) => Promise<void>;

  // 检查更新
  isUpdateModalOpen: boolean;
  onCloseUpdateModal: () => void;

  // 全局命令面板
  isCommandPaletteOpen: boolean;
  onCloseCommandPalette: () => void;
  allProjectNodes: MindNode[];
  onSelectPaletteNode: (nodeId: string) => void;
  onExecutePaletteAction: (actionId: string) => void;

  // 节点模板选择
  templateParentNode: { id: string; title: string } | null;
  onCloseTemplatePicker: () => void;
  onSelectNodeTemplate: (template: NodeTemplate) => Promise<void>;
}

export const AppModals: React.FC<AppModalsProps> = ({
  isExportModalOpen,
  onCloseExportModal,
  rootNode,
  docsMap,
  projectName,
  isCreateModalOpen,
  onCloseCreateModal,
  onSelectFolderForCreate,
  onCreateProject,
  isImportModalOpen,
  onCloseImportModal,
  onSelectMdFile,
  onImportDocument,
  targetDeleteProject,
  onCloseDeleteModal,
  onConfirmDeleteProject,
  isMCPModalOpen,
  onCloseMCPModal,
  mcpStatus,
  mcpLogs,
  onToggleMCPServer,
  isUpdateModalOpen,
  onCloseUpdateModal,
  isCommandPaletteOpen,
  onCloseCommandPalette,
  allProjectNodes,
  onSelectPaletteNode,
  onExecutePaletteAction,
  templateParentNode,
  onCloseTemplatePicker,
  onSelectNodeTemplate
}) => {
  return (
    <>
      {/* 聚合导出完整文档弹窗 */}
      {isExportModalOpen && (
        <ExportDocModal
          rootNode={rootNode}
          docsMap={docsMap}
          projectName={projectName}
          onClose={onCloseExportModal}
        />
      )}

      {/* 创建新需求项目弹窗 */}
      {isCreateModalOpen && (
        <CreateProjectModal
          onClose={onCloseCreateModal}
          onSelectFolder={onSelectFolderForCreate}
          onCreate={onCreateProject}
        />
      )}

      {/* 导入 Markdown / Word 弹窗 */}
      {isImportModalOpen && (
        <ImportMdModal
          onClose={onCloseImportModal}
          onSelectMd={onSelectMdFile}
          onSelectFolder={onSelectFolderForCreate}
          onImport={onImportDocument}
        />
      )}

      {/* 删除项目二次确认弹窗 */}
      {targetDeleteProject && (
        <DeleteConfirmModal
          project={targetDeleteProject}
          onClose={onCloseDeleteModal}
          onConfirm={onConfirmDeleteProject}
        />
      )}

      {/* 远程版本自动检查更新弹窗 */}
      <UpdateModal isOpen={isUpdateModalOpen} onClose={onCloseUpdateModal} />

      {/* MCP AI 服务管理弹窗 */}
      {isMCPModalOpen && (
        <MCPManagerModal
          status={mcpStatus}
          logs={mcpLogs}
          onClose={onCloseMCPModal}
          onToggleServer={onToggleMCPServer}
        />
      )}

      {/* 全局快捷搜索面板 (Cmd/Ctrl + K) */}
      <CommandPaletteModal
        nodes={allProjectNodes}
        docsMap={docsMap}
        isOpen={isCommandPaletteOpen}
        onClose={onCloseCommandPalette}
        onSelectNode={onSelectPaletteNode}
        onExecuteAction={onExecutePaletteAction}
      />

      {/* 节点模板选择弹窗 */}
      {templateParentNode && (
        <TemplatePickerModal
          parentNodeTitle={templateParentNode.title}
          onClose={onCloseTemplatePicker}
          onSelectTemplate={onSelectNodeTemplate}
        />
      )}
    </>
  );
};
