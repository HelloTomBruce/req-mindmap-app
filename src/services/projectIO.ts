import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { ProjectData } from '../types';
import { ProjectMeta } from '../components/ProjectManager';
import { loadDocsForTree } from '../hooks/useMcpPolling';

/**
 * 加载最近项目列表
 */
export const loadRecentProjects = async (): Promise<ProjectMeta[]> => {
  try {
    const saved = await invoke<string>('load_recent_projects_custom');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load recent projects from AppData:', e);
  }
  return [];
};

/**
 * 保存最近项目列表
 */
export const saveRecentProjects = async (list: ProjectMeta[]): Promise<void> => {
  try {
    await invoke('save_recent_projects_custom', { content: JSON.stringify(list, null, 2) });
  } catch (e) {
    console.error('Failed to save recent projects to AppData:', e);
  }
};

/**
 * 完整同步项目配置与关联文档至磁盘
 */
export const syncToDisk = async (
  projectPath: string,
  projectData: ProjectData,
  docsMap: Record<string, string>
): Promise<void> => {
  if (!projectPath) return;
  try {
    // 1. 写入 .requirements.json
    const configPath = `${projectPath}/.requirements.json`;
    await invoke('write_text_file_custom', {
      path: configPath,
      content: JSON.stringify(projectData, null, 2)
    });

    // 2. 写入关联的各 Markdown 文件
    for (const [relPath, content] of Object.entries(docsMap)) {
      const fullFilePath = `${projectPath}/${relPath}`;
      await invoke('write_text_file_custom', {
        path: fullFilePath,
        content
      });
    }
  } catch (err) {
    console.warn('Physical disk sync error:', err);
  }
};

/**
 * 从真实磁盘加载需求项目及所有分节文档
 */
export const loadProjectFromDisk = async (
  projectPath: string
): Promise<{ projectData: ProjectData; docsMap: Record<string, string> }> => {
  const configPath = `${projectPath}/.requirements.json`;
  const jsonStr = await invoke<string>('read_text_file_custom', { path: configPath });
  const loadedProjectData: ProjectData = JSON.parse(jsonStr);

  const loadedDocsMap: Record<string, string> = {};
  await loadDocsForTree(projectPath, loadedProjectData.root, loadedDocsMap);

  return {
    projectData: loadedProjectData,
    docsMap: loadedDocsMap
  };
};

/**
 * 彻底删除磁盘上的项目目录
 */
export const deleteProjectPhysicalDirectory = async (projectPath: string): Promise<void> => {
  if (!projectPath) return;
  await invoke('delete_dir_all_custom', { path: projectPath });
};

/**
 * 删除磁盘上的 Markdown 节点文件
 */
export const deleteDocumentFiles = async (
  projectPath: string,
  relDocPaths: string[]
): Promise<void> => {
  for (const relPath of relDocPaths) {
    try {
      await invoke('remove_file_custom', { path: `${projectPath}/${relPath}` });
    } catch (err) {
      console.warn('Failed to delete file on disk:', relPath, err);
    }
  }
};

/**
 * 弹出系统文件选择框选择文档 (Markdown / Word)
 */
export const selectDocumentFile = async (): Promise<string | null> => {
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Document Files', extensions: ['md', 'markdown', 'docx', 'doc'] }]
    });
    if (selected && typeof selected === 'string') {
      return selected;
    }
  } catch (e) {
    console.warn('Select file error:', e);
  }
  return null;
};

/**
 * 弹出系统选择框选择文件夹
 */
export const selectFolder = async (title: string = '选择文件夹'): Promise<string | null> => {
  try {
    const selected = await open({
      directory: true,
      multiple: false,
      title
    });
    if (selected && typeof selected === 'string') {
      return selected;
    }
  } catch (e) {
    console.warn('Native dialog error:', e);
  }
  return null;
};

/**
 * 初始化 Git 仓库并执行首次提交
 */
export const initGitRepo = async (projectPath: string): Promise<void> => {
  try {
    await invoke('run_git_command', { cwd: projectPath, args: ['init'] });
    await invoke('run_git_command', { cwd: projectPath, args: ['add', '.'] });
    await invoke('run_git_command', {
      cwd: projectPath,
      args: ['commit', '-m', 'Initial commit']
    });
  } catch (e) {
    console.warn('Git init failed:', e);
  }
};
