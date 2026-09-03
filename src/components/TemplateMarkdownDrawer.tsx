import React, { useState, useEffect, useRef, useMemo } from 'react';
import MDEditor, { commands, ICommand } from '@uiw/react-md-editor';
import { NodeTemplate } from '../templates';
import { Priority, Status } from '../types';
import { X, Save, Sparkles, Code2, Database, Layout, Wrench, FileText } from 'lucide-react';
import { processCustomMarkdownSyntax, parseColorQuery, createColorCommands } from '../utils/markdownColor';

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
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const isCurrentlyFs = !!document.fullscreenElement || isFullscreen;
    const editorEl = editorContainerRef.current?.querySelector('.w-md-editor') as HTMLElement | null;
    const targetEl = editorEl || editorContainerRef.current;

    if (!isCurrentlyFs) {
      setIsFullscreen(true);
      if (targetEl && targetEl.requestFullscreen) {
        targetEl.requestFullscreen().catch(() => {});
      }
    } else {
      setIsFullscreen(false);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const customFullscreenCommand: ICommand = useMemo(() => ({
    name: 'fullscreen',
    keyCommand: 'fullscreen',
    shortcuts: 'ctrlcmd+0',
    value: 'fullscreen',
    buttonProps: { 'aria-label': '切换全屏模式 (Ctrl/Cmd + 0)', title: '切换全屏模式 (Ctrl/Cmd + 0)' },
    icon: (
      <svg width="12" height="12" viewBox="0 0 520 520">
        <path
          fill="currentColor"
          d="M118 171.133334L118 342.200271C118 353.766938 126.675 365.333605 141.133333 365.333605L382.634614 365.333605C394.201281 365.333605 405.767948 356.658605 405.767948 342.200271L405.767948 171.133334C405.767948 159.566667 397.092948 148 382.634614 148L141.133333 148C126.674999 148 117.999999 156.675 118 171.133334zM465.353591 413.444444L370 413.444444 370 471.222222 474.0221 471.222222C500.027624 471.222222 520.254143 451 520.254143 425L520.254143 321 462.464089 321 462.464089 413.444444 465.353591 413.444444zM471.0221 43L367 43 367 100.777778 462.353591 100.777778 462.353591 196.111111 520.143647 196.111111 520.143647 89.2222219C517.254144 63.2222219 497.027624 43 471.0221 43zM57.7900547 100.777778L153.143646 100.777778 153.143646 43 46.2320439 43C20.2265191 43 0 63.2222219 0 89.2222219L0 193.222222 57.7900547 193.222222 57.7900547 100.777778zM57.7900547 321L0 321 0 425C0 451 20.2265191 471.222222 46.2320439 471.222223L150.254143 471.222223 150.254143 413.444445 57.7900547 413.444445 57.7900547 321z"
        />
      </svg>
    ),
    execute: () => {
      toggleFullscreen();
    }
  }), [isFullscreen]);

  const extraCommands: ICommand[] = useMemo(() => [
    createColorCommands(),
    commands.divider,
    commands.codeEdit,
    commands.codeLive,
    commands.codePreview,
    commands.divider,
    customFullscreenCommand
  ], [customFullscreenCommand]);

  const processedContent = useMemo(() => {
    return processCustomMarkdownSyntax(content);
  }, [content]);

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
    <div className={`markdown-drawer-panel ${isFullscreen ? 'fullscreen-active' : ''}`}>
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

      <div className="drawer-editor-container" ref={editorContainerRef}>
        <MDEditor
          value={isCustom ? content : processedContent}
          onChange={(val) => {
            if (isCustom) {
              onContentChange(val || '');
            }
          }}
          extraCommands={extraCommands}
          fullscreen={isFullscreen}
          height="100%"
          preview={isCustom ? 'live' : 'preview'}
          previewOptions={{
            components: {
              a: ({ href, children, ...props }: any) => {
                if (href && href.startsWith('#color:')) {
                  const { textColor, bgColor, isHighlight } = parseColorQuery(href);
                  if (isHighlight) {
                    return <mark className="md-highlight-text">{children}</mark>;
                  }
                  return (
                    <span
                      className="md-custom-color-text"
                      style={{
                        color: textColor || 'inherit',
                        backgroundColor: bgColor || 'transparent',
                        fontWeight: textColor ? 600 : undefined,
                        borderRadius: bgColor ? '3px' : undefined,
                        padding: bgColor ? '1px 4px' : undefined
                      }}
                    >
                      {children}
                    </span>
                  );
                }
                return <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>;
              }
            }
          }}
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
