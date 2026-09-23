import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ProjectData, MindNode } from '../types';
import { ProjectMeta } from '../components/ProjectManager';
import { INITIAL_PROJECT_DATA, INITIAL_DOC_CONTENTS } from '../mockData';
import { PROJECT_PRESETS } from '../projectPresets';
import { NodeTemplate, renderTemplateMarkdown } from '../templates';
import { clearImageCache } from '../components/MarkdownDrawer';
import { mcpServerManager } from '../mcpServerManager';
import { invoke } from '@tauri-apps/api/core';
import {
  countNodes,
  findNodeById,
  flattenTreeNodes,
  addChildNodeToTree,
  updateNodeInTree,
  deleteNodeFromTree,
  toggleNodeCollapseInTree
} from '../services/treeOperations';
import {
  loadRecentProjects,
  saveRecentProjects as persistRecentProjects,
  syncToDisk,
  loadProjectFromDisk,
  deleteProjectPhysicalDirectory,
  deleteDocumentFiles,
  selectFolder,
  initGitRepo
} from '../services/projectIO';

interface UseProjectOptions {
  onOpenDrawer?: () => void;
  onCloseDrawer?: () => void;
  onNavigateToEditor?: () => void;
}

export const useProject = ({
  onOpenDrawer,
  onCloseDrawer,
  onNavigateToEditor
}: UseProjectOptions = {}) => {
  const [recentProjects, setRecentProjects] = useState<ProjectMeta[]>([]);
  const [currentProjectPath, setCurrentProjectPath] = useState<string>('');
  const [projectData, setProjectData] = useState<ProjectData>(INITIAL_PROJECT_DATA);
  const [docsMap, setDocsMap] = useState<Record<string, string>>(INITIAL_DOC_CONTENTS);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('root-node');

  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
    };
  }, []);

  // 初始化加载最近项目
  useEffect(() => {
    const initProjects = async () => {
      const list = await loadRecentProjects();
      setRecentProjects(list);
      if (list.length > 0) {
        invoke('start_mcp_server_rust', { port: 6001, projectPath: list[0].path }).catch(
          console.error
        );
      }
    };
    initProjects();
  }, []);

  const saveRecentProjects = useCallback(async (list: ProjectMeta[]) => {
    setRecentProjects(list);
    await persistRecentProjects(list);
  }, []);

  // 防抖同步
  const debouncedSyncToDisk = useCallback(
    (pPath: string, pData: ProjectData, dMap: Record<string, string>, delay = 800) => {
      if (!pPath) return;
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
      syncDebounceRef.current = setTimeout(() => {
        syncToDisk(pPath, pData, dMap);
        syncDebounceRef.current = null;
      }, delay);
    },
    []
  );

  // 加载项目
  const loadFromDisk = useCallback(
    async (meta: ProjectMeta) => {
      try {
        const { projectData: loadedProjectData, docsMap: loadedDocsMap } =
          await loadProjectFromDisk(meta.path);

        setProjectData(loadedProjectData);
        setDocsMap(loadedDocsMap);
        setSelectedNodeId(loadedProjectData.root.id);

        mcpServerManager.setProjectPath(meta.path);
        await mcpServerManager.startServer(6001, meta.path);
      } catch (err) {
        console.warn('Failed to load project from disk, using fallback/current data:', err);
      }
    },
    []
  );

  // 打开项目
  const handleOpenProject = useCallback(
    async (meta: ProjectMeta) => {
      clearImageCache();
      setCurrentProjectPath(meta.path);
      await loadFromDisk(meta);

      const exists = recentProjects.some((p) => p.path === meta.path || p.id === meta.id);
      let updated: ProjectMeta[];
      if (exists) {
        updated = [
          { ...meta, lastOpened: new Date().toLocaleDateString() },
          ...recentProjects.filter((p) => p.path !== meta.path && p.id !== meta.id)
        ];
      } else {
        updated = [meta, ...recentProjects];
      }

      await saveRecentProjects(updated);
      onNavigateToEditor?.();
    },
    [recentProjects, loadFromDisk, saveRecentProjects, onNavigateToEditor]
  );

  // 通过选择文件夹打开项目
  const handleSelectFolder = useCallback(async (): Promise<boolean> => {
    const selected = await selectFolder('选择需求项目文件夹');
    if (selected) {
      const folderName = selected.split('/').pop() || '本地需求项目';
      const meta: ProjectMeta = {
        id: `proj-${Date.now()}`,
        name: folderName,
        path: selected,
        lastOpened: new Date().toLocaleDateString(),
        nodeCount: 1
      };
      await handleOpenProject(meta);
      return true;
    }
    return false;
  }, [handleOpenProject]);

  // 新建项目
  const handleCreateProject = useCallback(
    async (name: string, targetPath: string, presetId: string = 'prd') => {
      const preset = PROJECT_PRESETS.find((p) => p.id === presetId) || PROJECT_PRESETS[0];
      const { root: newRoot, docsMap: newDocsMap } = preset.generateInitialData(name);

      const newProject: ProjectData = {
        version: '1.0.0',
        projectName: name,
        root: newRoot
      };

      setCurrentProjectPath(targetPath);
      setProjectData(newProject);
      setDocsMap(newDocsMap);
      setSelectedNodeId('root-node');

      await syncToDisk(targetPath, newProject, newDocsMap);
      await initGitRepo(targetPath);

      const meta: ProjectMeta = {
        id: `proj-${Date.now()}`,
        name,
        path: targetPath,
        lastOpened: new Date().toLocaleDateString(),
        nodeCount: countNodes(newRoot)
      };

      const updated = [meta, ...recentProjects.filter((p) => p.path !== targetPath)];
      await saveRecentProjects(updated);

      onNavigateToEditor?.();
      onOpenDrawer?.();
    },
    [recentProjects, saveRecentProjects, onNavigateToEditor, onOpenDrawer]
  );

  // 确认删除项目
  const handleDeleteProjectConfirm = useCallback(
    async (targetProject: ProjectMeta, deletePhysicalFiles: boolean) => {
      if (deletePhysicalFiles && targetProject.path) {
        try {
          await deleteProjectPhysicalDirectory(targetProject.path);
        } catch (err) {
          console.error('Failed to wipe physical project directory:', err);
          const { message } = await import('@tauri-apps/plugin-dialog');
          await message(`删除磁盘目录失败: ${err}`, { title: '错误', kind: 'error' });
        }
      }

      const updated = recentProjects.filter((p) => p.id !== targetProject.id);
      await saveRecentProjects(updated);
    },
    [recentProjects, saveRecentProjects]
  );

  // 节点选择
  const handleSelectNode = useCallback((node: MindNode) => {
    setSelectedNodeId(node.id);
  }, []);

  const handleOpenNodeDrawer = useCallback(
    (node: MindNode) => {
      setSelectedNodeId(node.id);
      onOpenDrawer?.();
    },
    [onOpenDrawer]
  );

  // 添加子节点 (使用模板)
  const handleAddChildWithTemplate = useCallback(
    async (parentId: string, template: NodeTemplate) => {
      const nodeIdSuffix = Math.random().toString(36).slice(2, 8);
      const newNodeId = `node-${Date.now()}-${nodeIdSuffix}`;
      const newDocPath = `modules/node-${Date.now()}-${nodeIdSuffix}.md`;
      const newNode: MindNode = {
        id: newNodeId,
        title: template.defaultTitle,
        docPath: newDocPath,
        status: template.defaultStatus,
        priority: template.defaultPriority,
        tags: [...template.defaultTags]
      };

      const updatedRoot = addChildNodeToTree(projectData.root, parentId, newNode);
      const updatedProject = { ...projectData, root: updatedRoot };
      const updatedDocsMap = {
        ...docsMap,
        [newDocPath]: renderTemplateMarkdown(template, template.defaultTitle)
      };

      setProjectData(updatedProject);
      setDocsMap(updatedDocsMap);
      setSelectedNodeId(newNodeId);
      onOpenDrawer?.();

      await syncToDisk(currentProjectPath, updatedProject, updatedDocsMap);
    },
    [projectData, docsMap, currentProjectPath, onOpenDrawer]
  );

  // 删除节点
  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      if (nodeId === projectData.root.id) {
        const { message } = await import('@tauri-apps/plugin-dialog');
        await message('根节点无法删除', { title: '提示', kind: 'warning' });
        return;
      }

      const targetNode = findNodeById(projectData.root, nodeId);
      const targetTitle = targetNode ? targetNode.title : '该节点';

      const { ask } = await import('@tauri-apps/plugin-dialog');
      const confirmed = await ask(
        `确定要删除 "${targetTitle}" 及其所有子节点吗？\n删除后将无法恢复，对应的 markdown 内容也会被移除。`,
        {
          title: '二次确认',
          kind: 'warning'
        }
      );

      if (!confirmed) {
        return;
      }

      const { updatedRoot, deletedDocPaths } = deleteNodeFromTree(projectData.root, nodeId);
      const updatedProject = { ...projectData, root: updatedRoot };

      const updatedDocsMap = { ...docsMap };
      for (const p of deletedDocPaths) {
        delete updatedDocsMap[p];
      }

      setProjectData(updatedProject);
      setDocsMap(updatedDocsMap);

      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
        onCloseDrawer?.();
      }

      await syncToDisk(currentProjectPath, updatedProject, updatedDocsMap);
      await deleteDocumentFiles(currentProjectPath, deletedDocPaths);
    },
    [projectData, docsMap, selectedNodeId, currentProjectPath, onCloseDrawer]
  );

  // 展开/收起节点
  const handleToggleCollapse = useCallback(
    (nodeId: string) => {
      setProjectData({
        ...projectData,
        root: toggleNodeCollapseInTree(projectData.root, nodeId)
      });
    },
    [projectData]
  );

  // 更新节点属性元信息（支持 Obsidian 风格的 WikiLink 级联重构修复）
  const handleUpdateMeta = useCallback(
    (nodeId: string, updates: Partial<MindNode>) => {
      const oldNode = findNodeById(projectData.root, nodeId);
      const oldTitle = oldNode?.title;
      const isTitleChanged = updates.title && oldTitle && updates.title !== oldTitle;

      let nextDocsMap = docsMap;

      // 如果修改了节点标题，级联扫描所有文档中的 [[oldTitle]] 替换为 [[newTitle]]
      if (isTitleChanged && oldTitle) {
        const newTitle = updates.title!;
        const updatedDocs: Record<string, string> = {};
        const oldTagRegex = new RegExp(`\\[\\[${oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\]\\]|#[^\\]]+\\]\\])`, 'g');

        let replacedCount = 0;
        for (const [path, content] of Object.entries(docsMap)) {
          if (oldTagRegex.test(content)) {
            const newContent = content.replace(oldTagRegex, (_match, suffix) => {
              replacedCount++;
              return `[[${newTitle}${suffix}`;
            });
            updatedDocs[path] = newContent;
          } else {
            updatedDocs[path] = content;
          }
        }

        if (replacedCount > 0) {
          nextDocsMap = updatedDocs;
          setDocsMap(updatedDocs);
        }
      }

      const updatedRoot = updateNodeInTree(projectData.root, nodeId, updates);
      const updatedProject = { ...projectData, root: updatedRoot };
      setProjectData(updatedProject);
      debouncedSyncToDisk(currentProjectPath, updatedProject, nextDocsMap);
    },
    [projectData, currentProjectPath, docsMap, debouncedSyncToDisk]
  );

  // 添加跨分支依赖边
  const handleAddEdge = useCallback(
    (sourceId: string, targetId: string, type: 'depends_on' | 'blocks' | 'relates_to' = 'depends_on') => {
      if (sourceId === targetId) return;
      const existingEdges = projectData.edges || [];
      const isDuplicate = existingEdges.some(
        (e) => (e.source === sourceId && e.target === targetId) || (e.source === targetId && e.target === sourceId)
      );
      if (isDuplicate) return;

      const newEdge = {
        id: `dep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        source: sourceId,
        target: targetId,
        type
      };

      const updatedProject = {
        ...projectData,
        edges: [...existingEdges, newEdge]
      };
      setProjectData(updatedProject);
      debouncedSyncToDisk(currentProjectPath, updatedProject, docsMap);
    },
    [projectData, currentProjectPath, docsMap, debouncedSyncToDisk]
  );

  // 删除跨分支依赖边
  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      const existingEdges = projectData.edges || [];
      const updatedEdges = existingEdges.filter((e) => e.id !== edgeId);
      const updatedProject = {
        ...projectData,
        edges: updatedEdges
      };
      setProjectData(updatedProject);
      debouncedSyncToDisk(currentProjectPath, updatedProject, docsMap);
    },
    [projectData, currentProjectPath, docsMap, debouncedSyncToDisk]
  );

  // 更新当前节点 Markdown 正文
  const handleContentChange = useCallback(
    (newContent: string) => {
      const currentNode = selectedNodeId ? findNodeById(projectData.root, selectedNodeId) : null;
      if (!currentNode) return;
      const updatedDocsMap = {
        ...docsMap,
        [currentNode.docPath]: newContent
      };
      setDocsMap(updatedDocsMap);
      debouncedSyncToDisk(currentProjectPath, projectData, updatedDocsMap);
    },
    [selectedNodeId, projectData, docsMap, currentProjectPath, debouncedSyncToDisk]
  );

  // 获取当前选中节点
  const currentNode = useMemo(() => {
    return selectedNodeId ? findNodeById(projectData.root, selectedNodeId) : null;
  }, [projectData.root, selectedNodeId]);

  // 扁平化所有节点
  const allProjectNodes = useMemo(() => {
    return flattenTreeNodes(projectData?.root);
  }, [projectData?.root]);

  // 双向链接跳转
  const handleNavigateToNodeByTitle = useCallback(
    (title: string) => {
      const target = allProjectNodes.find(
        (n: MindNode) =>
          n.title.trim() === title.trim() || n.title.toLowerCase().includes(title.toLowerCase())
      );
      if (target) {
        setSelectedNodeId(target.id);
        onOpenDrawer?.();
      }
    },
    [allProjectNodes, onOpenDrawer]
  );

  return {
    recentProjects,
    setRecentProjects,
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
    debouncedSyncToDisk,
    handleOpenProject,
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
  };
};

