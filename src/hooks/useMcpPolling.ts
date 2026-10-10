import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ProjectData, MindNode } from '../types';
import { mcpServerManager, MCPLogItem } from '../mcpServerManager';

// 递归读取节点树下所有 Markdown 文件
export async function loadDocsForTree(
  pPath: string,
  node: MindNode,
  docsMapAcc: Record<string, string>
): Promise<void> {
  if (node.docPath) {
    try {
      const fullMdPath = `${pPath}/${node.docPath}`;
      const content = await invoke<string>('read_text_file_custom', { path: fullMdPath });
      docsMapAcc[node.docPath] = content;
    } catch (e) {
      console.warn(`Doc not found on disk: ${node.docPath}`, e);
    }
  }
  if (node.children) {
    for (const child of node.children) {
      await loadDocsForTree(pPath, child, docsMapAcc);
    }
  }
}

// 保持回调最新引用，避免 effect 频繁重建
function useCallbackRef<T extends (...args: any[]) => any>(callback?: T): { current?: T } {
  const ref = useRef(callback);
  ref.current = callback;
  return ref;
}

interface UseMcpPollingOptions {
  currentProjectPath: string;
  onMcpWriteReload: (projectData: ProjectData, docsMap: Record<string, string>) => void;
  onProjectSwitch?: (newProjectPath: string) => void;
}

// 轮询 Rust MCP 服务状态，检测 MCP 端写入并触发磁盘重载及项目切换
export function useMcpPolling({
  currentProjectPath,
  onMcpWriteReload,
  onProjectSwitch
}: UseMcpPollingOptions) {
  const [mcpStatus, setMcpStatus] = useState(mcpServerManager.getStatus());
  const [mcpLogs, setMcpLogs] = useState<MCPLogItem[]>([]);
  const lastMcpWriteRef = useRef<number>(0);
  const onMcpWriteReloadRef = useCallbackRef(onMcpWriteReload);
  const onProjectSwitchRef = useCallbackRef(onProjectSwitch);

  // 1. 监听 Rust 端广播的 mcp:project_switched 事件
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<{ path: string; name: string }>('mcp:project_switched', (event) => {
      const targetPath = event.payload?.path;
      if (targetPath && targetPath !== currentProjectPath) {
        onProjectSwitchRef.current?.(targetPath);
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((err) => {
        console.warn('Failed to listen to mcp:project_switched event:', err);
      });

    return () => {
      if (unlisten) unlisten();
    };
  }, [currentProjectPath, onProjectSwitchRef]);

  // 2. 轮询 Rust MCP 服务状态
  useEffect(() => {
    const interval = setInterval(async () => {
      const updated = await mcpServerManager.fetchStatusFromRust();
      setMcpStatus(updated);
      setMcpLogs([...mcpServerManager.getLogs()]);

      // 检测是否在 MCP 端切换了项目路径
      if (updated.projectPath && updated.projectPath !== currentProjectPath) {
        onProjectSwitchRef.current?.(updated.projectPath);
        return;
      }

      const latestWrite = updated.lastMcpWrite || 0;
      if (latestWrite > 0 && latestWrite !== lastMcpWriteRef.current) {
        lastMcpWriteRef.current = latestWrite;
        if (currentProjectPath) {
          try {
            const configPath = `${currentProjectPath}/.requirements.json`;
            const jsonStr = await invoke<string>('read_text_file_custom', { path: configPath });
            const loadedProjectData: ProjectData = JSON.parse(jsonStr);
            const loadedDocsMap: Record<string, string> = {};
            await loadDocsForTree(currentProjectPath, loadedProjectData.root, loadedDocsMap);
            onMcpWriteReloadRef.current?.(loadedProjectData, loadedDocsMap);
          } catch (e) {
            console.warn('MCP write reload failed:', e);
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentProjectPath, onMcpWriteReloadRef, onProjectSwitchRef]);

  return { mcpStatus, mcpLogs };
}

