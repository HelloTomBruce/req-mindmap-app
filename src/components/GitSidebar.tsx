import React, { useState, useEffect, useCallback } from 'react';
import { getGitStatus, gitAdd, gitCommit, gitCheckout, gitUnstage, getGitHistory, GitStatusItem, GitCommitItem } from '../gitHelper';
import { RotateCcw, Plus, Minus, Check, RefreshCw, ChevronDown, ChevronRight, GitCommit } from 'lucide-react';
import { DiffModal } from './DiffModal';

interface GitSidebarProps {
  projectPath: string;
}

export const GitSidebar: React.FC<GitSidebarProps> = ({ projectPath }) => {
  const [statusList, setStatusList] = useState<GitStatusItem[]>([]);
  const [historyList, setHistoryList] = useState<GitCommitItem[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCommitsExpanded, setIsCommitsExpanded] = useState(false);
  
  const [expandedCommitHash, setExpandedCommitHash] = useState<string | null>(null);
  const [currentCommitFiles, setCurrentCommitFiles] = useState<GitStatusItem[]>([]);
  const [commitFilesLoading, setCommitFilesLoading] = useState(false);
  
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(null);
  const [selectedDiffCommit, setSelectedDiffCommit] = useState<string | undefined>(undefined);

  const handleToggleCommit = async (hash: string) => {
    if (expandedCommitHash === hash) {
      setExpandedCommitHash(null);
      return;
    }
    setExpandedCommitHash(hash);
    setCommitFilesLoading(true);
    try {
      const { getCommitFiles } = await import('../gitHelper');
      const files = await getCommitFiles(projectPath, hash);
      setCurrentCommitFiles(files);
    } catch (e) {
      console.error(e);
    } finally {
      setCommitFilesLoading(false);
    }
  };

  const fetchStatus = useCallback(async () => {
    if (!projectPath) return;
    setIsRefreshing(true);
    try {
      const items = await getGitStatus(projectPath);
      setStatusList(items);
      const history = await getGitHistory(projectPath);
      setHistoryList(history);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  }, [projectPath]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);


  const handleAdd = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await gitAdd(projectPath, path);
    await fetchStatus();
  };

  const handleUnstage = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await gitUnstage(projectPath, path);
    await fetchStatus();
  };

  const handleAddAll = async () => {
    await gitAdd(projectPath, '.');
    await fetchStatus();
  };

  const handleDiscard = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { ask } = await import('@tauri-apps/plugin-dialog');
    const confirmed = await ask(`确定要撤销对 ${path} 的所有修改吗？`, { title: '确认撤销', kind: 'warning' });
    if (confirmed) {
      await gitCheckout(projectPath, path);
      await fetchStatus();
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    try {
      await gitCommit(projectPath, commitMessage);
      setCommitMessage('');
      await fetchStatus();
    } catch (e) {
      const { message } = await import('@tauri-apps/plugin-dialog');
      await message('提交失败: ' + String(e), { title: '错误', kind: 'error' });
    }
  };

  // git status --porcelain 输出格式: XY path
  // X = 暂存区状态, Y = 工作区状态。' ' 表示无变更, '?' 表示未追踪。
  // 暂存区有变更的文件: X 不是空格且不是 '?' (未追踪文件不在暂存区)
  const stagedFiles = statusList.filter(item => item.status[0] !== ' ' && item.status[0] !== '?');
  // 工作区有变更的文件: Y 不是空格 (含 'M', 'D', '?' 等)
  const unstagedFiles = statusList.filter(item => item.status[1] !== ' ' && item.status[1] !== undefined);

  return (
    <>
      <aside className="app-sidebar git-sidebar">
        <div className="sidebar-header">
          <span className="project-title">源代码管理 (Git)</span>
          <button className="btn icon-only outline" onClick={fetchStatus} title="刷新状态">
            <RefreshCw size={14} className={isRefreshing ? 'spinning' : ''} />
          </button>
        </div>

        <div className="git-commit-box">
          <textarea
            placeholder="请输入提交信息 (Commit Message)"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            rows={3}
          />
          <div className="commit-actions">
            <button className="btn small primary" onClick={handleCommit} disabled={!commitMessage.trim() || stagedFiles.length === 0}>
              <Check size={14} /> 提交 (Commit)
            </button>
          </div>
        </div>

        <div className="sidebar-content">
          {/* 暂存的更改 */}
          {stagedFiles.length > 0 && (
            <div className="git-group">
              <div className="git-changes-header">
                <span>暂存的更改 ({stagedFiles.length})</span>
              </div>
              <div className="git-file-list">
                {stagedFiles.map((item, idx) => (
                  <div key={`staged-${idx}`} className="git-file-item" onClick={() => setSelectedDiffPath(item.path)} style={{ cursor: 'pointer' }}>
                    <span className={`git-badge ${item.status[0]}`}>
                      {item.status[0]}
                    </span>
                    <span className="git-file-path" title={item.path}>{item.path}</span>
                    <div className="git-file-actions">
                      <button className="icon-action" onClick={(e) => handleUnstage(item.path, e)} title="取消暂存">
                        <Minus size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 未暂存的更改 */}
          <div className="git-group" style={{ marginTop: stagedFiles.length > 0 ? '16px' : '0' }}>
            <div className="git-changes-header">
              <span>更改 ({unstagedFiles.length})</span>
              {unstagedFiles.length > 0 && (
                <button className="btn icon-only text-only" title="暂存所有更改" onClick={handleAddAll}>
                  <Plus size={14} />
                </button>
              )}
            </div>
            <div className="git-file-list">
              {unstagedFiles.length === 0 && stagedFiles.length === 0 ? (
                <div className="git-empty-state">没有检测到未提交的变更</div>
              ) : (
                unstagedFiles.map((item, idx) => (
                  <div key={`unstaged-${idx}`} className="git-file-item" onClick={() => setSelectedDiffPath(item.path)} style={{ cursor: 'pointer' }}>
                    <span className={`git-badge ${item.status[1] === '?' ? 'U' : item.status[1]}`}>
                      {item.status[1] === '?' ? 'U' : item.status[1]}
                    </span>
                    <span className="git-file-path" title={item.path}>{item.path}</span>
                    <div className="git-file-actions">
                      <button className="icon-action" onClick={(e) => handleDiscard(item.path, e)} title="撤销更改">
                        <RotateCcw size={12} />
                      </button>
                      <button className="icon-action" onClick={(e) => handleAdd(item.path, e)} title="暂存">
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 提交记录 (Commits) 吸底区域 */}
        <div className="git-commits-panel" style={{ borderTop: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', maxHeight: isCommitsExpanded ? '50%' : 'auto', flexShrink: 0 }}>
          <div 
            className="git-changes-header" 
            style={{ cursor: 'pointer', margin: 0, padding: '8px 12px' }}
            onClick={() => setIsCommitsExpanded(!isCommitsExpanded)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {isCommitsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>提交记录 ({historyList.length})</span>
            </div>
          </div>
          
          {isCommitsExpanded && (
            <div className="git-history-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px', overflowY: 'auto', flex: 1 }}>
              {historyList.length === 0 ? (
                <div className="git-empty-state">暂无提交记录</div>
              ) : (
                historyList.map((commit, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div 
                      className="git-commit-item" 
                      style={{ display: 'flex', gap: '8px', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', alignItems: 'center' }}
                      onClick={() => handleToggleCommit(commit.hash)}
                    >
                      <div style={{ color: 'var(--text-muted)' }}>
                        <GitCommit size={14} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', flex: 1 }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} title={commit.message}>
                          {commit.message}
                        </span>
                        <div style={{ display: 'flex', gap: '8px', color: 'var(--text-muted)', fontSize: '11px' }}>
                          <span style={{ fontFamily: 'monospace' }}>{commit.hash}</span>
                          <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{commit.author} • {commit.date}</span>
                        </div>
                      </div>
                      <div style={{ color: 'var(--text-muted)' }}>
                        {expandedCommitHash === commit.hash ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                    </div>
                    
                    {/* 展开展示的文件列表 */}
                    {expandedCommitHash === commit.hash && (
                      <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '24px', paddingRight: '8px', gap: '4px', marginTop: '4px', marginBottom: '8px' }}>
                        {commitFilesLoading ? (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>加载中...</div>
                        ) : currentCommitFiles.length === 0 ? (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>没有包含更改的文件</div>
                        ) : (
                          currentCommitFiles.map((file, fIdx) => (
                            <div 
                              key={fIdx} 
                              className="git-file-item" 
                              style={{ cursor: 'pointer', padding: '2px 4px', background: 'transparent' }}
                              onClick={() => {
                                setSelectedDiffPath(file.path);
                                setSelectedDiffCommit(commit.hash);
                              }}
                            >
                              <span className={`git-badge ${file.status.trim()}`}>
                                {file.status.trim()}
                              </span>
                              <span className="git-file-path" title={file.path}>{file.path}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </aside>

      {selectedDiffPath && (
        <DiffModal
          projectPath={projectPath}
          filePath={selectedDiffPath}
          commitHash={selectedDiffCommit}
          onClose={() => {
            setSelectedDiffPath(null);
            setSelectedDiffCommit(undefined);
          }}
        />
      )}
    </>
  );
};
