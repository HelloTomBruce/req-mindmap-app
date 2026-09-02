import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MindNode } from '../types';
import { Search, FileText, Sparkles, Hash, CornerDownLeft, X, Layers } from 'lucide-react';

interface CommandPaletteModalProps {
  nodes: MindNode[];
  docsMap: Record<string, string>;
  isOpen: boolean;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
}

interface SearchResultItem {
  node: MindNode;
  matchType: 'title' | 'tag' | 'content';
  snippet?: string;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  nodes,
  docsMap,
  isOpen,
  onClose,
  onSelectNode
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 展开并计算所有搜索结果
  const searchResults: SearchResultItem[] = useMemo(() => {
    if (!isOpen) return [];
    const q = query.trim().toLowerCase();
    if (!q) {
      // 默认按树顺序展示全部节点
      return nodes.map((node) => ({ node, matchType: 'title' }));
    }

    const titleMatches: SearchResultItem[] = [];
    const tagMatches: SearchResultItem[] = [];
    const contentMatches: SearchResultItem[] = [];

    nodes.forEach((node) => {
      // 1. 标题匹配 (最高优先级)
      if (node.title.toLowerCase().includes(q)) {
        titleMatches.push({ node, matchType: 'title' });
        return;
      }

      // 2. 标签匹配
      if (node.tags && node.tags.some((t) => t.toLowerCase().includes(q))) {
        tagMatches.push({ node, matchType: 'tag' });
        return;
      }

      // 3. Markdown 正文全文内容匹配
      const content = docsMap[node.docPath] || '';
      const contentLower = content.toLowerCase();
      const matchPos = contentLower.indexOf(q);
      if (matchPos !== -1) {
        const start = Math.max(0, matchPos - 30);
        const end = Math.min(content.length, matchPos + q.length + 50);
        let snippet = content.slice(start, end).replace(/\n+/g, ' ');
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';

        contentMatches.push({ node, matchType: 'content', snippet });
      }
    });

    return [...titleMatches, ...tagMatches, ...contentMatches];
  }, [nodes, docsMap, query, isOpen]);

  // 打开时自动聚焦输入框并重置选中
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // 键盘导航
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, searchResults.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + searchResults.length) % Math.max(1, searchResults.length));
      } else if (e.key === 'Enter') {
        if (searchResults.length > 0) {
          e.preventDefault();
          const target = searchResults[selectedIndex];
          onSelectNode(target.node.id);
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, searchResults, selectedIndex, onSelectNode, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay command-palette-overlay" onClick={onClose}>
      <div className="modal-content command-palette-modal" onClick={(e) => e.stopPropagation()}>
        {/* 顶部极速搜索条 */}
        <div className="command-palette-input-wrap">
          <Search size={18} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="搜索节点标题、标签或 Markdown 正文内容..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="clear-query-btn" onClick={() => setQuery('')}>
              <X size={14} />
            </button>
          )}
          <kbd className="shortcut-badge">ESC</kbd>
        </div>

        {/* 搜索结果列表 */}
        <div className="command-palette-results">
          {searchResults.length === 0 ? (
            <div className="palette-empty-state">
              <Layers size={32} className="empty-icon" />
              <p>未找到匹配 “{query}” 的文档节点</p>
              <span>可尝试搜索模块标题、关键词、#标签或正文代码段</span>
            </div>
          ) : (
            <div className="palette-results-list">
              {searchResults.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const { node, matchType, snippet } = item;

                return (
                  <div
                    key={node.id}
                    className={`palette-result-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onSelectNode(node.id);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="item-left-icon">
                      {node.id === 'root-node' ? (
                        <Sparkles size={16} color="#2c5e53" />
                      ) : (
                        <FileText size={16} />
                      )}
                    </div>

                    <div className="item-info">
                      <div className="item-title-row">
                        <span className="item-title">{node.title}</span>
                        <span className={`priority-badge ${node.priority.toLowerCase()}`}>
                          {node.priority}
                        </span>
                        {matchType === 'tag' && (
                          <span className="match-tag-pill">
                            <Hash size={10} /> 标签匹配
                          </span>
                        )}
                        {matchType === 'content' && (
                          <span className="match-content-pill">正文匹配</span>
                        )}
                      </div>

                      {snippet && (
                        <div className="item-snippet">
                          {snippet}
                        </div>
                      )}

                      <div className="item-meta-row">
                        <span className="doc-path-hint">{node.docPath}</span>
                        {node.tags && node.tags.length > 0 && (
                          <div className="tags-list">
                            {node.tags.map((t) => (
                              <span key={t} className="tag-item">#{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="item-action-hint">
                      <CornerDownLeft size={13} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部导航提示栏 */}
        <div className="command-palette-footer">
          <div className="footer-shortcut">
            <kbd>↑</kbd> <kbd>↓</kbd> <span>导航选择</span>
          </div>
          <div className="footer-shortcut">
            <kbd>Enter</kbd> <span>跳转并定位</span>
          </div>
          <div className="footer-shortcut">
            <kbd>ESC</kbd> <span>关闭</span>
          </div>
          <div className="footer-count">
            共找到 <strong>{searchResults.length}</strong> 个节点
          </div>
        </div>
      </div>
    </div>
  );
};
