import React from 'react';
import { MindNode } from '../types';
import { Folder, FolderOpen, FileText } from 'lucide-react';

interface SidebarProps {
  rootNode: MindNode;
  selectedNodeId: string | null;
  onSelectNode: (node: MindNode) => void;
  projectName: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  rootNode,
  selectedNodeId,
  onSelectNode,
  projectName
}) => {
  const renderTreeItem = (node: MindNode) => {
    const isSelected = selectedNodeId === node.id;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="sidebar-tree-node">
        <div
          className={`sidebar-item ${isSelected ? 'active' : ''}`}
          onClick={() => onSelectNode(node)}
        >
          {hasChildren ? (
            <FolderOpen size={14} className="sidebar-icon folder" />
          ) : (
            <FileText size={14} className="sidebar-icon file" />
          )}
          <span className="sidebar-item-title">{node.title}</span>
        </div>

        {hasChildren && (
          <div className="sidebar-sub-tree">
            {node.children!.map((child) => renderTreeItem(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <Folder size={16} />
        <span className="project-title">{projectName}</span>
      </div>

      <div className="sidebar-content">
        {renderTreeItem(rootNode)}
      </div>
    </aside>
  );
};
