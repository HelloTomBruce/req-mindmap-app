import { invoke } from '@tauri-apps/api/core';

export interface MCPLogItem {
  id: string;
  time: string;
  tool: string;
  params: any;
  status: 'success' | 'error';
}

export class MCPServerManager {
  private port: number = 6001;
  private isRunning: boolean = false;
  private projectPath: string = '';
  private logs: MCPLogItem[] = [];

  constructor() {}

  public setProjectPath(pPath: string) {
    this.projectPath = pPath;
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      projectPath: this.projectPath,
      sseUrl: `http://127.0.0.1:${this.port}/sse`
    };
  }

  public getLogs() {
    return this.logs;
  }

  public async fetchStatusFromRust() {
    try {
      const res: any = await invoke('get_mcp_status_rust');
      this.isRunning = res.isRunning;
      if (res.port) this.port = res.port;
      this.projectPath = res.projectPath || this.projectPath;
      this.logs = res.logs || [];
      return this.getStatus();
    } catch (e) {
      console.warn('Fetch MCP status error:', e);
      return this.getStatus();
    }
  }

  public async startServer(port: number = 6001, projectPath: string): Promise<boolean> {
    this.port = port;
    this.projectPath = projectPath;
    try {
      await invoke('start_mcp_server_rust', {
        port: this.port,
        projectPath: this.projectPath
      });
      this.isRunning = true;
      await this.fetchStatusFromRust();
      return true;
    } catch (err) {
      console.error('Failed to start Rust MCP Server:', err);
      this.isRunning = false;
      return false;
    }
  }
  public async stopServer(): Promise<boolean> {
    try {
      await invoke('stop_mcp_server_rust');
      this.isRunning = false;
      await this.fetchStatusFromRust();
      return true;
    } catch (err) {
      console.error('Failed to stop Rust MCP Server:', err);
      return false;
    }
  }
}

export const mcpServerManager = new MCPServerManager();
