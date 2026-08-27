import { invoke } from '@tauri-apps/api/core';

export interface GitStatusItem {
  status: string; // e.g. 'M ', '??', 'A '
  path: string;
}

// 通用执行 git 命令
export async function runGit(cwd: string, args: string[]): Promise<string> {
  return await invoke<string>('run_git_command', { cwd, args });
}

// 初始化仓库
export async function initGit(cwd: string): Promise<string> {
  return runGit(cwd, ['init']);
}

// 获取状态
export async function getGitStatus(cwd: string): Promise<GitStatusItem[]> {
  try {
    const out = await runGit(cwd, ['status', '--porcelain']);
    if (!out.trim()) return [];
    
    return out.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const status = line.substring(0, 2);
        const path = line.substring(3);
        return { status, path };
      });
  } catch (err) {
    console.warn('getGitStatus error:', err);
    return [];
  }
}

// 添加全部或特定文件到暂存区
export async function gitAdd(cwd: string, path: string = '.'): Promise<string> {
  return runGit(cwd, ['add', path]);
}

export interface GitCommitItem {
  hash: string;
  message: string;
  author: string;
  date: string;
}

// 取消暂存
export async function gitUnstage(cwd: string, path: string): Promise<string> {
  return runGit(cwd, ['reset', 'HEAD', '--', path]).catch(async () => {
    // 兼容没有 HEAD 的首次提交
    return runGit(cwd, ['rm', '--cached', path]);
  });
}

// 提交
export async function gitCommit(cwd: string, message: string): Promise<string> {
  return runGit(cwd, ['commit', '-m', message]);
}

// 获取提交历史
export async function getGitHistory(cwd: string): Promise<GitCommitItem[]> {
  try {
    // %h: hash, %s: subject, %an: author name, %cr: relative date
    const out = await runGit(cwd, ['log', '-n', '20', '--pretty=format:%h|%s|%an|%cr']);
    if (!out.trim()) return [];
    
    return out.split('\n').map(line => {
      const [hash, message, author, date] = line.split('|');
      return { hash, message, author, date };
    });
  } catch (err) {
    console.warn('getGitHistory error (maybe no commits yet):', err);
    return [];
  }
}

// 还原文件
export async function gitCheckout(cwd: string, path: string): Promise<string> {
  return runGit(cwd, ['checkout', '--', path]);
}

// 获取差异 (Diff)
export async function gitDiff(cwd: string, path: string, commitHash?: string): Promise<string> {
  let diff = '';
  try {
    if (commitHash) {
      // 比较特定提交。如果是首个提交（没有父节点），需要特殊处理（空树 Hash）
      const emptyTree = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
      diff = await runGit(cwd, ['diff', `${commitHash}^..${commitHash}`, '--', path]).catch(async () => {
        return await runGit(cwd, ['diff', `${emptyTree}..${commitHash}`, '--', path]);
      });
    } else {
      diff = await runGit(cwd, ['diff', 'HEAD', '--', path]);
    }
  } catch (err) {
    console.warn('git diff failed:', err);
    // 忽略报错，交给下方的新文件逻辑去兜底读取全量内容
  }

  if (!diff.trim() && !commitHash) {
    // 可能是未追踪的新文件，或者是没有 HEAD 的首次提交，直接使用底层读取
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const fullPath = `${cwd}/${path}`;
      const content = await invoke<string>('read_text_file_custom', { path: fullPath });
      // 模拟 git diff 输出格式
      return `--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${content.split('\n').length} @@\n` + 
             content.split('\n').map(line => `+${line}`).join('\n');
    } catch (e) {
      return '';
    }
  }
  return diff;
}

// 获取某个提交的更改文件列表
export async function getCommitFiles(cwd: string, hash: string): Promise<GitStatusItem[]> {
  try {
    const out = await runGit(cwd, ['diff-tree', '--no-commit-id', '--name-status', '-r', hash]);
    if (!out.trim()) return [];
    
    return out.split('\n')
      .filter(line => line.trim())
      .map(line => {
        // e.g. "M       src/App.tsx" or "A\tpath"
        const parts = line.split(/\s+/);
        const status = parts[0].padEnd(2, ' '); // 保持和 GitStatusItem 兼容的长度
        const path = parts.slice(1).join(' ');
        return { status, path };
      });
  } catch (err) {
    console.warn('getCommitFiles error:', err);
    return [];
  }
}
