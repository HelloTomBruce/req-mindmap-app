import React, { useEffect, useState, useRef } from 'react';
import { MindNode } from '../types';
import { Link2, Sparkles, FileText } from 'lucide-react';

interface WikiLinkAutocompleteProps {
  nodes: MindNode[];
  searchQuery: string;
  position: { top: number; left: number };
  onSelect: (nodeTitle: string) => void;
  onClose: () => void;
}

export const WikiLinkAutocomplete: React.FC<WikiLinkAutocompleteProps> = ({
  nodes,
  searchQuery,
  position,
  onSelect,
  onClose
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 模糊匹配节点列表
  const filteredNodes = nodes.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      (n.tags && n.tags.some((t) => t.toLowerCase().includes(q)))
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredNodes.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredNodes.length) % Math.max(1, filteredNodes.length));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filteredNodes.length > 0) {
          e.preventDefault();
          onSelect(filteredNodes[selectedIndex].title);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [filteredNodes, selectedIndex, onSelect, onClose]);

  if (filteredNodes.length === 0) {
    return (
      <div
        ref={containerRef}
        className="wikilink-autocomplete-popup empty"
        style={{ top: position.top, left: position.left }}
      >
        <div className="autocomplete-empty-tip">未找到匹配的节点</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="wikilink-autocomplete-popup"
      style={{ top: position.top, left: position.left }}
    >
      <div className="autocomplete-header">
        <Link2 size={12} className="autocomplete-header-icon" />
        <span>选择要双向引用的节点 (Enter 插入)</span>
      </div>
      <div className="autocomplete-list">
        {filteredNodes.map((n, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={n.id}
              className={`autocomplete-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(n.title)}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <div className="item-icon">
                {n.id === 'root-node' ? <Sparkles size={13} color="#2c5e53" /> : <FileText size={13} />}
              </div>
              <div className="item-content">
                <span className="item-title">{n.title}</span>
                {n.tags && n.tags.length > 0 && (
                  <span className="item-tag">#{n.tags[0]}</span>
                )}
              </div>
              <span className="item-priority-pill">{n.priority}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
