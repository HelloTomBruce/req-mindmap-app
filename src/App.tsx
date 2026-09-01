import React, { useState, useEffect, useRef } from 'react';
import { ProjectData, MindNode } from './types';
import { INITIAL_PROJECT_DATA, INITIAL_DOC_CONTENTS } from './mockData';
import { MindmapCanvas } from './components/MindmapCanvas';
import { MarkdownDrawer } from './components/MarkdownDrawer';
import { Sidebar } from './components/Sidebar';
import { GitSidebar } from './components/GitSidebar';
import { TemplateSidebar } from './components/TemplateSidebar';
import { TemplateMarkdownDrawer } from './components/TemplateMarkdownDrawer';
import { upsertCustomTemplate } from './templateStore';
import { ProjectManager, ProjectMeta } from './components/ProjectManager';
import { ExportDocModal } from './components/ExportDocModal';
import { CreateProjectModal } from './components/CreateProjectModal';
import { ImportMdModal } from './components/ImportMdModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { MCPManagerModal } from './components/MCPManagerModal';
import { UpdateModal } from './components/UpdateModal';
import { TemplatePickerModal } from './components/TemplatePickerModal';
import { NodeTemplate, renderTemplateMarkdown } from './templates';
import { PROJECT_PRESETS } from './projectPresets';
import { clearImageCache } from './components/MarkdownDrawer';
import { mcpServerManager } from './mcpServerManager';
import { useMcpPolling, loadDocsForTree } from './hooks/useMcpPolling';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Download, Layout, Plus, CheckCircle2, Home, Folder, GitBranch, Bookmark } from 'lucide-react';
import './App.css';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<'manager' | 'editor'>('manager');
  const [recentProjects, setRecentProjects] = useState<ProjectMeta[]>([]);
  
  const [currentProjectPath, setCurrentProjectPath] = useState<string>('');
  const [projectData, setProjectData] = useState<ProjectData>(INITIAL_PROJECT_DATA);
  const [docsMap, setDocsMap] = useState<Record<string, string>>(INITIAL_DOC_CONTENTS);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('root-node');
  
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isMCPModalOpen, setIsMCPModalOpen] = useState<boolean>(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
  const [targetDeleteProject, setTargetDeleteProject] = useState<ProjectMeta | null>(null);
  const [templateParentNode, setTemplateParentNode] = useState<{ id: string; title: string } | null>(null);
  const [selectedEditingTemplate, setSelectedEditingTemplate] = useState<{
    template: NodeTemplate;
    content: string;
    isCustom: boolean;
  } | null>(null);

  const { mcpStatus, mcpLogs } = useMcpPolling({
    currentProjectPath,
    onMcpWriteReload: (loadedProjectData, loadedDocsMap) => {
      setProjectData(loadedProjectData);
      setDocsMap(loadedDocsMap);
    }
  });

  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 组件卸载时清理防抖定时器
  useEffect(() => {
    return () => {
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
    };
  }, []);

  // 选择 md 文件
  const handleSelectMdFile = async (): Promise<string | null> => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Markdown File', extensions: ['md', 'markdown'] }]
      });
      if (selected && typeof selected === 'string') {
        return selected;
      }
    } catch (e) {
      console.warn('Select md file error:', e);
    }
    return null;
  };

  // 解析源 Markdown 文件，按 #, ##, ### 标题精准拆分为模块结构树
  const handleImportMd = async (mdPath: string, targetPath: string, name: string) => {
    try {
      const fullMarkdown = await invoke<string>('read_text_file_custom', { path: mdPath });
      const lines = fullMarkdown.split('\n');

      const rootNode: MindNode = {
        id: 'root-node',
        title: name,
        docPath: 'index.md',
        status: 'in_progress',
        priority: 'P0',
        tags: ['MD导入'],
        children: []
      };

      const docsMapResult: Record<string, string> = {
        'index.md': `# ${name}\n\n从 Markdown 文件 ${mdPath.split('/').pop()} 拆分导入。\n\n`
      };

      // 栈结构维护树多维深度 [node, level]
      const stack: { node: MindNode; level: number }[] = [{ node: rootNode, level: 0 }];
      let nodeIdx = 1;
      let activeContentKey = 'index.md';

      // 提取 Markdown 源文件所在目录
      const sourceDir = mdPath.substring(0, mdPath.lastIndexOf('/'));
      let imgIdx = 1;

      // 正则匹配 Markdown 图片语法: ![alt](url)
      const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

      // 异步辅助函数：处理并替换一行中的图片引用
      const processLineImages = async (textLine: string): Promise<string> => {
        let newLine = textLine;
        const matches = Array.from(textLine.matchAll(imgRegex));

        for (const match of matches) {
          const fullMatch = match[0];
          const altText = match[1];
          const originalSrc = match[2].trim();

          // 如果是网络图片（http/https）或 data: 格式，保持原样
          if (/^(https?:\/\/|data:)/i.test(originalSrc)) {
            continue;
          }

          // 计算本地图片的绝对路径
          const absoluteSrcPath = originalSrc.startsWith('/')
            ? originalSrc
            : `${sourceDir}/${originalSrc.replace(/^\.\//, '')}`;

          const fileExt = originalSrc.split('.').pop()?.split('?')[0] || 'png';
          const newFileName = `md_img_${Date.now()}_${imgIdx++}.${fileExt}`;
          const destPath = `${targetPath}/assets/${newFileName}`;
          const newRelativeSrc = `assets/${newFileName}`;

          try {
            // 调用 Rust 命令将原本地图片深拷贝到新项目的 assets/ 目录中
            await invoke('copy_local_file_custom', {
              srcPath: absoluteSrcPath,
              destPath
            });
            // 替换 Markdown 中的链接路径为新项目的 assets/xxx
            newLine = newLine.replace(fullMatch, `![${altText}](${newRelativeSrc})`);
          } catch (err) {
            console.warn(`Failed to copy image ${absoluteSrcPath}:`, err);
          }
        }
        return newLine;
      };

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (line.includes('![')) {
          line = await processLineImages(line);
        }

        const match = line.match(/^(\#{1,6})\s+(.+)$/);

        if (match) {
          const level = match[1].length;
          const rawTitleText = match[2].trim();
          const docRelPath = `modules/sec_${nodeIdx++}.md`;

          const newNode: MindNode = {
            id: `md-node-${nodeIdx}`,
            title: rawTitleText || `章节 ${nodeIdx}`,
            docPath: docRelPath,
            status: 'todo',
            priority: 'P1',
            tags: ['模块']
          };

          docsMapResult[docRelPath] = `${match[1]} ${rawTitleText}\n\n`;

          // 寻找合适的父级出栈
          while (stack.length > 1 && stack[stack.length - 1].level >= level) {
            stack.pop();
          }

          const parentNode = stack[stack.length - 1].node;
          if (!parentNode.children) {
            parentNode.children = [];
          }
          parentNode.children.push(newNode);

          stack.push({ node: newNode, level });
          activeContentKey = docRelPath;
        } else {
          // 普通段落追加到当前活跃节点的 md 中
          docsMapResult[activeContentKey] += `${line}\n`;
        }
      }

      // 保底处理：如果 Markdown 中无任何 # 标题，按空行切分节点
      if (!rootNode.children || rootNode.children.length === 0) {
        const rawBlocks = fullMarkdown.split(/\n\s*\n/);
        let fallbackIdx = 1;
        for (const block of rawBlocks) {
          const trimmed = block.trim();
          if (!trimmed) continue;
          const firstLine = trimmed.split('\n')[0].substring(0, 30);
          const docRelPath = `modules/sec_${fallbackIdx}.md`;
          
          const child: MindNode = {
            id: `fallback-node-${fallbackIdx}`,
            title: firstLine || `段落 ${fallbackIdx}`,
            docPath: docRelPath,
            status: 'todo',
            priority: 'P2',
            tags: ['段落']
          };
          rootNode.children = rootNode.children || [];
          rootNode.children.push(child);
          docsMapResult[docRelPath] = `# ${firstLine}\n\n${trimmed}\n`;
          fallbackIdx++;
        }
      }

      const importedProject: ProjectData = {
        version: '1.0.0',
        projectName: name,
        root: rootNode
      };

      setCurrentProjectPath(targetPath);
      setProjectData(importedProject);
      setDocsMap(docsMapResult);
      setSelectedNodeId('root-node');

      await syncToDisk(targetPath, importedProject, docsMapResult);

      const meta: ProjectMeta = {
        id: `proj-${Date.now()}`,
        name,
        path: targetPath,
        lastOpened: new Date().toLocaleDateString(),
        nodeCount: countNodes(rootNode)
      };

      const updated = [meta, ...recentProjects.filter((p) => p.path !== targetPath)];
      await saveRecentProjects(updated);

      setIsImportModalOpen(false);
      setViewMode('editor');
      setIsDrawerOpen(true);
    } catch (err) {
      console.error('Failed to parse md file:', err);
      const { message } = await import('@tauri-apps/plugin-dialog');
      await message('解析 Markdown 文件失败', { title: '错误', kind: 'error' });
    }
  };

  useEffect(() => {
    const initProjects = async () => {
      try {
        const saved = await invoke<string>('load_recent_projects_custom');
        if (saved) {
          const list: ProjectMeta[] = JSON.parse(saved);
          setRecentProjects(list);
          if (list.length > 0) {
            invoke('start_mcp_server_rust', { port: 6001, projectPath: list[0].path }).catch(console.error);
          }
        }
      } catch (e) {
        console.error('Failed to parse recent projects', e);
      }
    };
    initProjects();
  }, []);

  const saveRecentProjects = async (list: ProjectMeta[]) => {
    setRecentProjects(list);
    try {
      await invoke('save_recent_projects_custom', { content: JSON.stringify(list, null, 2) });
    } catch (e) {
      console.error('Failed to save recent projects to AppData:', e);
    }
  };

  const countNodes = (node: MindNode): number => {
    let count = 1;
    if (node.children) {
      for (const child of node.children) {
        count += countNodes(child);
      }
    }
    return count;
  };

  // 防抖同步：用于高频编辑场景，避免每次按键都触发全量磁盘写入
  const debouncedSyncToDisk = (pPath: string, pData: ProjectData, dMap: Record<string, string>, delay = 800) => {
    if (!pPath) return;
    if (syncDebounceRef.current) {
      clearTimeout(syncDebounceRef.current);
    }
    syncDebounceRef.current = setTimeout(() => {
      syncToDisk(pPath, pData, dMap);
      syncDebounceRef.current = null;
    }, delay);
  };

  // 通过自定义 Rust 原生命令写文件，彻底告别权限 scope 限制
  const syncToDisk = async (pPath: string, pData: ProjectData, dMap: Record<string, string>) => {
    if (!pPath) return;
    // 即时写入前取消任何待执行的防抖同步，避免延迟写入覆盖本次即时写入
    if (syncDebounceRef.current) {
      clearTimeout(syncDebounceRef.current);
      syncDebounceRef.current = null;
    }
    try {
      // 1. 写入 .requirements.json
      const configPath = `${pPath}/.requirements.json`;
      await invoke('write_text_file_custom', {
        path: configPath,
        content: JSON.stringify(pData, null, 2)
      });

      // 2. 写入关联的各 Markdown 文件
      for (const [relPath, content] of Object.entries(dMap)) {
        const fullFilePath = `${pPath}/${relPath}`;
        await invoke('write_text_file_custom', {
          path: fullFilePath,
          content
        });
      }
    } catch (err) {
      console.warn('Physical disk sync error:', err);
    }
  };

  // 选择文件夹用于新建项目
  const handleSelectFolderForCreate = async (): Promise<string | null> => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择新需求项目存放文件夹'
      });
      if (selected && typeof selected === 'string') {
        return selected;
      }
    } catch (e) {
      console.warn('Native dialog error:', e);
    }
    return null;
  };

  // 执行创建新项目
  const handleCreateProject = async (name: string, targetPath: string, presetId: string = 'prd') => {
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

    // 磁盘持久化
    await syncToDisk(targetPath, newProject, newDocsMap);

    // Git 初始化与首次提交
    try {
      await invoke('run_git_command', { cwd: targetPath, args: ['init'] });
      await invoke('run_git_command', { cwd: targetPath, args: ['add', '.'] });
      await invoke('run_git_command', { cwd: targetPath, args: ['commit', '-m', 'Initial commit'] });
    } catch (e) {
      console.warn('Git init failed:', e);
    }

    const meta: ProjectMeta = {
      id: `proj-${Date.now()}`,
      name,
      path: targetPath,
      lastOpened: new Date().toLocaleDateString(),
      nodeCount: countNodes(newRoot)
    };

    const updated = [meta, ...recentProjects.filter((p) => p.path !== targetPath)];
    await saveRecentProjects(updated);

    setIsCreateModalOpen(false);
    setViewMode('editor');
    setIsDrawerOpen(true);
  };

  // 切换/更新 MCP SSE 服务端口
  const handleToggleMCPServer = async (enable: boolean, customPort?: number) => {
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
  };

  // 从真实磁盘加载项目
  const loadFromDisk = async (meta: ProjectMeta) => {
    try {
      const configPath = `${meta.path}/.requirements.json`;
      const jsonStr = await invoke<string>('read_text_file_custom', { path: configPath });
      const loadedProjectData: ProjectData = JSON.parse(jsonStr);

      const loadedDocsMap: Record<string, string> = {};
      await loadDocsForTree(meta.path, loadedProjectData.root, loadedDocsMap);

      setProjectData(loadedProjectData);
      setDocsMap(loadedDocsMap);
      setSelectedNodeId(loadedProjectData.root.id);

      // 更新 MCP 当前关联项目并同步到 Rust 后端
      mcpServerManager.setProjectPath(meta.path);
      await mcpServerManager.startServer(6001, meta.path);
    } catch (err) {
      console.warn('Failed to load project from disk, using fallback/current data:', err);
    }
  };

  // 打开某个项目
  const handleOpenProject = async (meta: ProjectMeta) => {
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
    setViewMode('editor');
  };

  // 按钮触发打开磁盘文件夹
  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择需求项目文件夹'
      });
      if (selected && typeof selected === 'string') {
        const folderName = selected.split('/').pop() || '本地需求项目';
        const meta: ProjectMeta = {
          id: `proj-${Date.now()}`,
          name: folderName,
          path: selected,
          lastOpened: new Date().toLocaleDateString(),
          nodeCount: 1
        };
        await handleOpenProject(meta);
      }
    } catch (e) {
      console.warn('Native dialog error:', e);
    }
  };

  // 触发删除确认弹窗
  const handleDeleteProjectMeta = (project: ProjectMeta) => {
    setTargetDeleteProject(project);
  };

  // 确认删除（根据选项选择是否同步彻底删除磁盘文件）
  const handleDeleteProjectConfirm = async (deletePhysicalFiles: boolean) => {
    if (!targetDeleteProject) return;

    if (deletePhysicalFiles && targetDeleteProject.path) {
      try {
        await invoke('delete_dir_all_custom', { path: targetDeleteProject.path });
      } catch (err) {
        console.error('Failed to wipe physical project directory:', err);
        const { message } = await import('@tauri-apps/plugin-dialog');
        await message(`删除磁盘目录失败: ${err}`, { title: '错误', kind: 'error' });
      }
    }

    const updated = recentProjects.filter((p) => p.id !== targetDeleteProject.id);
    await saveRecentProjects(updated);
    setTargetDeleteProject(null);
  };

  const findNodeById = (node: MindNode, id: string): MindNode | null => {
    if (node.id === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNodeById(child, id);
        if (found) return found;
      }
    }
    return null;
  };

  const currentNode = selectedNodeId ? findNodeById(projectData.root, selectedNodeId) : null;

  const handleSelectNode = (node: MindNode) => {
    setSelectedNodeId(node.id);
  };

  const handleOpenNodeDrawer = (node: MindNode) => {
    setSelectedNodeId(node.id);
    setIsDrawerOpen(true);
  };

  // 触发打开模板选择弹窗
  const handleAddChildNode = (parentId: string) => {
    let parentTitle = '当前节点';
    const findTitle = (node: MindNode) => {
      if (node.id === parentId) parentTitle = node.title;
      if (node.children) node.children.forEach(findTitle);
    };
    findTitle(projectData.root);
    setTemplateParentNode({ id: parentId, title: parentTitle });
  };

  // 根据选中的模板实际创建节点并触发落盘
  const handleConfirmCreateWithTemplate = async (template: NodeTemplate) => {
    if (!templateParentNode) return;
    const parentId = templateParentNode.id;
    setTemplateParentNode(null);

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

    const updateTree = (node: MindNode): MindNode => {
      if (node.id === parentId) {
        return {
          ...node,
          children: [...(node.children || []), newNode]
        };
      }
      if (node.children) {
        return {
          ...node,
          children: node.children.map(updateTree)
        };
      }
      return node;
    };

    const updatedRoot = updateTree(projectData.root);
    const updatedProject = { ...projectData, root: updatedRoot };
    const updatedDocsMap = {
      ...docsMap,
      [newDocPath]: renderTemplateMarkdown(template, template.defaultTitle)
    };

    setProjectData(updatedProject);
    setDocsMap(updatedDocsMap);
    setSelectedNodeId(newNodeId);
    setIsDrawerOpen(true);

    await syncToDisk(currentProjectPath, updatedProject, updatedDocsMap);
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (nodeId === projectData.root.id) {
      const { message } = await import('@tauri-apps/plugin-dialog');
      await message('根节点无法删除', { title: '提示', kind: 'warning' });
      return;
    }

    let targetTitle = '该节点';
    const findTitle = (node: MindNode) => {
      if (node.id === nodeId) targetTitle = node.title;
      if (node.children) node.children.forEach(findTitle);
    };
    findTitle(projectData.root);

    const { ask } = await import('@tauri-apps/plugin-dialog');
    const confirmed = await ask(`确定要删除 "${targetTitle}" 及其所有子节点吗？\n删除后将无法恢复，对应的 markdown 内容也会被移除。`, {
      title: '二次确认',
      kind: 'warning'
    });

    if (!confirmed) {
      return;
    }

    // 收集要删除的文档路径，并清理 docsMap
    const deletedDocPaths: string[] = [];
    const collectDeletedDocs = (node: MindNode) => {
      deletedDocPaths.push(node.docPath);
      if (node.children) node.children.forEach(collectDeletedDocs);
    };
    
    const nodeToDelete = findNodeById(projectData.root, nodeId);
    if (nodeToDelete) {
      collectDeletedDocs(nodeToDelete);
    }

    const deleteFromTree = (node: MindNode): MindNode => {
      if (node.children) {
        return {
          ...node,
          children: node.children.filter((child) => child.id !== nodeId).map(deleteFromTree)
        };
      }
      return node;
    };

    const updatedProject = { ...projectData, root: deleteFromTree(projectData.root) };
    
    // 从内存中移除这些文档内容
    const updatedDocsMap = { ...docsMap };
    for (const p of deletedDocPaths) {
      delete updatedDocsMap[p];
    }
    
    setProjectData(updatedProject);
    setDocsMap(updatedDocsMap);

    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
      setIsDrawerOpen(false);
    }

    // 更新到磁盘
    await syncToDisk(currentProjectPath, updatedProject, updatedDocsMap);
    
    // 在物理磁盘上删除对应的 Markdown 文件
    for (const relPath of deletedDocPaths) {
      try {
        await invoke('remove_file_custom', { path: `${currentProjectPath}/${relPath}` });
      } catch (err) {
        console.warn('Failed to delete file on disk:', relPath, err);
      }
    }
  };

  const handleToggleCollapse = (nodeId: string) => {
    const toggleInTree = (node: MindNode): MindNode => {
      if (node.id === nodeId) {
        return { ...node, collapsed: !node.collapsed };
      }
      if (node.children) {
        return { ...node, children: node.children.map(toggleInTree) };
      }
      return node;
    };

    setProjectData({
      ...projectData,
      root: toggleInTree(projectData.root)
    });
  };

  const handleUpdateMeta = (nodeId: string, updates: Partial<MindNode>) => {
    const updateInTree = (node: MindNode): MindNode => {
      if (node.id === nodeId) {
        return { ...node, ...updates };
      }
      if (node.children) {
        return { ...node, children: node.children.map(updateInTree) };
      }
      return node;
    };

    const updatedProject = { ...projectData, root: updateInTree(projectData.root) };
    setProjectData(updatedProject);

    debouncedSyncToDisk(currentProjectPath, updatedProject, docsMap);
  };

  const handleContentChange = (newContent: string) => {
    if (!currentNode) return;
    const updatedDocsMap = {
      ...docsMap,
      [currentNode.docPath]: newContent
    };
    setDocsMap(updatedDocsMap);

    debouncedSyncToDisk(currentProjectPath, projectData, updatedDocsMap);
  };

  // 选择模板进行文档骨架查看或编辑
  const handleSelectTemplateForEdit = (tmpl: NodeTemplate, isCustom: boolean) => {
    const rawContent = tmpl.markdownSkeleton || renderTemplateMarkdown(tmpl, tmpl.defaultTitle);
    setSelectedEditingTemplate({
      template: tmpl,
      content: rawContent,
      isCustom
    });
    setIsDrawerOpen(true);
  };

  // 模板文档骨架修改
  const handleTemplateContentChange = (newContent: string) => {
    if (!selectedEditingTemplate || !selectedEditingTemplate.isCustom) return;

    const updatedTemplate: NodeTemplate = {
      ...selectedEditingTemplate.template,
      markdownSkeleton: newContent
    };

    upsertCustomTemplate(updatedTemplate);
    setSelectedEditingTemplate({
      template: updatedTemplate,
      content: newContent,
      isCustom: true
    });
  };

  // 模板元信息修改
  const handleTemplateMetaChange = (_templateId: string, updates: Partial<NodeTemplate>) => {
    if (!selectedEditingTemplate || !selectedEditingTemplate.isCustom) return;
    const updatedTemplate: NodeTemplate = {
      ...selectedEditingTemplate.template,
      ...updates
    };

    upsertCustomTemplate(updatedTemplate);
    setSelectedEditingTemplate({
      ...selectedEditingTemplate,
      template: updatedTemplate
    });
  };

  const [activeSidebarView, setActiveSidebarView] = useState<'explorer' | 'git' | 'templates'>('explorer');

  if (viewMode === 'manager') {
    return (
      <>
        <ProjectManager
          recentProjects={recentProjects}
          mcpStatus={mcpStatus}
          onOpenProject={handleOpenProject}
          onOpenFolder={handleSelectFolder}
          onDeleteProjectMeta={handleDeleteProjectMeta}
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
          onOpenImportModal={() => setIsImportModalOpen(true)}
          onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
          onOpenMCPModal={() => setIsMCPModalOpen(true)}
        />

        {isCreateModalOpen && (
          <CreateProjectModal
            onClose={() => setIsCreateModalOpen(false)}
            onSelectFolder={handleSelectFolderForCreate}
            onCreate={handleCreateProject}
          />
        )}

        {isImportModalOpen && (
          <ImportMdModal
            onClose={() => setIsImportModalOpen(false)}
            onSelectMd={handleSelectMdFile}
            onSelectFolder={handleSelectFolderForCreate}
            onImport={handleImportMd}
          />
        )}

        {targetDeleteProject && (
          <DeleteConfirmModal
            project={targetDeleteProject}
            onClose={() => setTargetDeleteProject(null)}
            onConfirm={handleDeleteProjectConfirm}
          />
        )}
        {/* 远程版本自动检查更新弹窗 */}
        <UpdateModal
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
        />

        {/* MCP AI 服务管理弹窗 (首页侧) */}
        {isMCPModalOpen && (
          <MCPManagerModal
            status={mcpStatus}
            logs={mcpLogs}
            onClose={() => setIsMCPModalOpen(false)}
            onToggleServer={handleToggleMCPServer}
          />
        )}
      </>
    );
  }

  return (
    <div className="app-container">
      {/* 顶栏 */}
      <header className="app-header">
        <div className="header-left">
          <button className="btn outline icon-only" title="返回项目管理首页" onClick={() => setViewMode('manager')}>
            <Home size={16} />
          </button>
          <Layout className="app-logo" size={20} />
          <span className="app-name">{projectData.projectName}</span>
        </div>

        <div className="header-actions">
          <button className="btn primary" onClick={() => setIsExportModalOpen(true)}>
            <Download size={14} /> 聚合导出文档
          </button>
        </div>
      </header>

      {/* 主体布局 */}
      <div className="app-body">
        {/* Activity Bar (最左侧活动栏) */}
        <div className="activity-bar">
          <button 
            className={`activity-icon ${activeSidebarView === 'explorer' ? 'active' : ''}`}
            onClick={() => setActiveSidebarView('explorer')}
            title="需求结构树 (Explorer)"
          >
            <Folder size={20} />
          </button>
          <button 
            className={`activity-icon ${activeSidebarView === 'git' ? 'active' : ''}`}
            onClick={() => setActiveSidebarView('git')}
            title="源代码管理 (Git)"
          >
            <GitBranch size={20} />
          </button>
          <button 
            className={`activity-icon ${activeSidebarView === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveSidebarView('templates')}
            title="需求模板库 (Templates)"
          >
            <Bookmark size={20} />
          </button>
        </div>

        {activeSidebarView === 'explorer' && (
          <Sidebar
            rootNode={projectData.root}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleOpenNodeDrawer}
            projectName={projectData.projectName}
          />
        )}

        {activeSidebarView === 'git' && (
          <GitSidebar projectPath={currentProjectPath} />
        )}

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

        <main className="app-main-canvas">
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
            selectedNodeId={selectedNodeId}
            onSelectNode={handleSelectNode}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onRenameNode={(nodeId, newTitle) => handleUpdateMeta(nodeId, { title: newTitle })}
            onAddChildNode={handleAddChildNode}
            onDeleteNode={handleDeleteNode}
            onToggleCollapse={handleToggleCollapse}
          />
        </main>

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

        {isDrawerOpen && activeSidebarView !== 'templates' && currentNode && (
          <MarkdownDrawer
            node={currentNode}
            content={docsMap[currentNode.docPath] || ''}
            projectPath={currentProjectPath}
            onClose={() => setIsDrawerOpen(false)}
            onContentChange={handleContentChange}
            onUpdateMeta={handleUpdateMeta}
          />
        )}
      </div>

      {/* 聚合导出完整文档弹窗 */}
      {isExportModalOpen && (
        <ExportDocModal
          rootNode={projectData.root}
          docsMap={docsMap}
          projectName={projectData.projectName}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}

      {/* MCP AI 服务管理弹窗 */}
      {isMCPModalOpen && (
        <MCPManagerModal
          status={mcpStatus}
          logs={mcpLogs}
          onClose={() => setIsMCPModalOpen(false)}
          onToggleServer={handleToggleMCPServer}
        />
      )}

      {/* 远程版本自动检查更新弹窗 */}
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
      />

      {/* 节点模板选择弹窗 */}
      {templateParentNode && (
        <TemplatePickerModal
          parentNodeTitle={templateParentNode.title}
          onClose={() => setTemplateParentNode(null)}
          onSelectTemplate={handleConfirmCreateWithTemplate}
        />
      )}

      {/* 底部状态栏 */}
      <footer className="app-statusbar">
        <div className="status-item">
          <CheckCircle2 size={12} color="#10b981" /> 磁盘自动同步已就绪
        </div>
        <div className="status-item">
          当前节点数: <strong>{countNodes(projectData.root)}</strong>
        </div>
        <div className="status-item">
          当前选中: <strong>{currentNode ? currentNode.title : '未选择'}</strong>
        </div>
      </footer>
    </div>
  );
};

export default App;
