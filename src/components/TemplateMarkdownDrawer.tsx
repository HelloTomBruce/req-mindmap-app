import React from 'react';
import MDEditor from '@uiw/react-md-editor';
import { NodeTemplate } from '../templates';
import { Priority, Status } from '../types';
import { X, Save, Sparkles, Code2, Database, Layout, Wrench, FileText } from 'lucide-react';

interface TemplateMarkdownDrawerProps {
  template: NodeTemplate | null;
  content: string;
  isCustom: boolean;
  onClose: () => void;
  onContentChange: (newContent: string) => void;
  onUpdateMeta: (templateId: string, updates: Partial<NodeTemplate>) => void;
}

export const TemplateMarkdownDrawer: React.FC<TemplateMarkdownDrawerProps> = ({
  template,
  content,
  isCustom,
  onClose,
  onContentChange,
  onUpdateMeta
}) => {
  if (!template) return null;

  const renderIcon = (iconName: NodeTemplate['iconName'], size = 18) => {
    switch (iconName) {
      case 'Sparkles':
        return <Sparkles size={size} color="#8b5cf6" />;
      case 'Code2':
        return <Code2 size={size} color="#3b82f6" />;
      case 'Database':
        return <Database size={size} color="#059669" />;
      case 'Layout':
        return <Layout size={size} color="#ea580c" />;
      case 'Wrench':
        return <Wrench size={size} color="#d97706" />;
      case 'FileText':
      default:
        return <FileText size={size} color="#64748b" />;
    }
  };

  return (
    <div className="markdown-drawer-panel">
      <div className="drawer-header">
        <div className="drawer-title-group">
          {renderIcon(template.iconName)}
          <div className="template-drawer-title-box">
            <span className="template-drawer-badge">{isCustom ? '自定义模板' : '内置模板'}</span>
            <span className="drawer-title-input" style={{ fontWeight: 600, border: 'none', background: 'transparent' }} title={template.name}>
              {template.name}
            </span>
          </div>
        </div>

        <div className="drawer-header-actions">
          <button className="close-btn" onClick={onClose} title="关闭抽屉">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="drawer-meta-bar">
        <div className="meta-item">
          <label>默认优先级:</label>
          {isCustom ? (
            <select
              value={template.defaultPriority}
              onChange={(e) => onUpdateMeta(template.id, { defaultPriority: e.target.value as Priority })}
            >
              <option value="P0">P0 (紧急关键)</option>
              <option value="P1">P1 (高优先级)</option>
              <option value="P2">P2 (中优先级)</option>
              <option value="P3">P3 (低优先级)</option>
            </select>
          ) : (
            <span className="meta-static-val">{template.defaultPriority}</span>
          )}
        </div>

        <div className="meta-item">
          <label>默认状态:</label>
          {isCustom ? (
            <select
              value={template.defaultStatus}
              onChange={(e) => onUpdateMeta(template.id, { defaultStatus: e.target.value as Status })}
            >
              <option value="draft">草稿</option>
              <option value="todo">待办</option>
              <option value="in_progress">进行中</option>
              <option value="completed">已完成</option>
            </select>
          ) : (
            <span className="meta-static-val">{template.defaultStatus}</span>
          )}
        </div>

        <div className="meta-item path-info">
          <label>预设标签:</label>
          <span title={template.defaultTags?.join(', ')}>
            {(template.defaultTags || []).map((t) => `#${t}`).join(' ')}
          </span>
        </div>
      </div>

      <div className="drawer-editor-container">
        <MDEditor
          value={content}
          onChange={(val) => {
            if (isCustom) {
              onContentChange(val || '');
            }
          }}
          height="100%"
          preview={isCustom ? 'live' : 'preview'}
        />
      </div>

      <div className="drawer-footer">
        <span className="auto-save-hint">
          {isCustom ? (
            <>
              <Save size={12} style={{ marginRight: 4 }} /> 修改 Markdown 内容骨架将实时自动保存到此模板
            </>
          ) : (
            '内置模板文档骨架仅供预览参考（只读）'
          )}
        </span>
      </div>
    </div>
  );
};
