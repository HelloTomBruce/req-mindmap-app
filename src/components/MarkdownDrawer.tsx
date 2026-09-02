import React, { useState, useMemo, useRef } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { MindNode, Priority, Status } from '../types';
import { X, Save, FileCode, Image as ImageIcon, Link2, ArrowUpRight, Network } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { WikiLinkAutocomplete } from './WikiLinkAutocomplete';

interface MarkdownDrawerProps {
  node: MindNode | null;
  content: string;
  projectPath: string;
  allNodes?: MindNode[];
  docsMap?: Record<string, string>;
  onClose: () => void;
  onContentChange: (newContent: string) => void;
  onUpdateMeta: (nodeId: string, updates: Partial<MindNode>) => void;
  onNavigateToNode?: (nodeTitle: string) => void;
}

// 本地图片 DataURL 全局内存缓存，避免输入文本导致组件重新渲染时的频繁 IPC 重新读取与图片闪烁
const imageCache = new Map<string, string>();

// 切换项目时调用，清理上一个项目的图片缓存防止内存膨胀
export function clearImageCache() {
  imageCache.clear();
}

// 独立组件：从 assets/ 加载本地图片并缓存为 DataURL
const CachedImage: React.FC<{ src?: string; alt?: string; projectPath: string }> = ({ src, alt, projectPath }) => {
  const cacheKey = `${projectPath}:${src}`;
  const cachedSrc = imageCache.get(cacheKey);
  const [srcUrl, setSrcUrl] = React.useState<string>(cachedSrc || src || '');

  React.useEffect(() => {
    if (!src) return;

    if (imageCache.has(cacheKey)) {
      setSrcUrl(imageCache.get(cacheKey)!);
      return;
    }

    if (src.startsWith('assets/') && projectPath) {
      let isMounted = true;
      invoke<string>('read_image_data_url', { projectPath, relativePath: src })
        .then((dataUrl) => {
          imageCache.set(cacheKey, dataUrl);
          if (isMounted) setSrcUrl(dataUrl);
        })
        .catch((e) => {
          console.warn('Failed to load image preview:', src, e);
        });
      return () => { isMounted = false; };
    } else {
      setSrcUrl(src);
    }
  }, [src, projectPath, cacheKey]);

  return (
    <img
      src={srcUrl}
      style={{ maxWidth: '100%', borderRadius: 6, margin: '8px 0', display: 'block' }}
      alt={alt || '图片'}
    />
  );
};

export const MarkdownDrawer: React.FC<MarkdownDrawerProps> = ({
  node,
  content,
  projectPath,
  allNodes = [],
  docsMap = {},
  onClose,
  onContentChange,
  onUpdateMeta,
  onNavigateToNode
}) => {
  if (!node) return null;

  // 联想弹窗状态
  const [autocompleteState, setAutocompleteState] = useState<{
    isOpen: boolean;
    query: string;
    cursorPos: number;
    position: { top: number; left: number };
  }>({
    isOpen: false,
    query: '',
    cursorPos: 0,
    position: { top: 60, left: 20 }
  });

  const editorContainerRef = useRef<HTMLDivElement>(null);

  // 计算反向链接（Backlinks）：遍历所有其他节点的文档内容，找出引用了 [[当前节点标题]] 的节点列表
  const backlinks = useMemo(() => {
    if (!node.title || !docsMap) return [];
    const currentTitle = node.title;
    const targetTag = `[[${currentTitle}]]`;
    const referencingNodes: Array<{ id: string; title: string; docPath: string }> = [];

    allNodes.forEach((n) => {
      if (n.id === node.id) return;
      const text = docsMap[n.docPath] || '';
      if (text.includes(targetTag) || text.includes(`[[${currentTitle}`)) {
        referencingNodes.push({ id: n.id, title: n.title, docPath: n.docPath });
      }
    });

    return referencingNodes;
  }, [node.id, node.title, allNodes, docsMap]);

  // 处理文本改变，检测是否输入了 [[
  const handleEditorChange = (newVal: string | undefined) => {
    const text = newVal || '';
    onContentChange(text);

    // 获取当前活动输入框（MDEditor 的 textarea）
    const textarea = editorContainerRef.current?.querySelector('textarea');
    if (!textarea) return;

    const cursorPos = textarea.selectionStart || text.length;
    const textBeforeCursor = text.slice(0, cursorPos);
    const lastDoubleBracketIndex = textBeforeCursor.lastIndexOf('[[');

    if (lastDoubleBracketIndex !== -1) {
      const matchText = textBeforeCursor.slice(lastDoubleBracketIndex + 2);
      // 如果未闭合且中间没有换行符，则触发联想
      if (!matchText.includes(']]') && !matchText.includes('\n')) {
        // 计算弹窗大致相对位置
        const lines = textBeforeCursor.split('\n');
        const currentLineNum = lines.length;
        const top = Math.min(window.innerHeight - 260, Math.max(50, currentLineNum * 22 + 40));
        const left = 24;

        setAutocompleteState({
          isOpen: true,
          query: matchText,
          cursorPos,
          position: { top, left }
        });
        return;
      }
    }

    if (autocompleteState.isOpen) {
      setAutocompleteState((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // 选中节点插入 [[节点标题]]
  const handleSelectWikiNode = (targetTitle: string) => {
    const textarea = editorContainerRef.current?.querySelector('textarea');
    const text = content;
    const cursorPos = textarea?.selectionStart ?? autocompleteState.cursorPos;
    const textBeforeCursor = text.slice(0, cursorPos);
    const lastDoubleBracketIndex = textBeforeCursor.lastIndexOf('[[');

    if (lastDoubleBracketIndex !== -1) {
      const before = text.slice(0, lastDoubleBracketIndex);
      const after = text.slice(cursorPos);
      const newText = `${before}[[${targetTitle}]]${after}`;
      onContentChange(newText);
    }

    setAutocompleteState((prev) => ({ ...prev, isOpen: false }));
  };

  // 转换/渲染带 [[WikiLink]] 的 Markdown
  // 自定义链接拦截：如果链接格式为 #wikilink:标题，或者文本匹配 [[...]]
  const processedContent = useMemo(() => {
    // 将正文中的 [[节点名称]] 转为可点击的 Markdown 超链接 [🏷️ 节点名称](#wikilink:节点名称)
    return content.replace(/\[\[(.*?)\]\]/g, '[$1](#wikilink:$1)');
  }, [content]);

  // 上传/粘贴图片处理
  const handleImageSave = async (file: File) => {
    if (!projectPath) {
      const { message } = await import('@tauri-apps/plugin-dialog');
      await message('请先选择或创建项目保存目录后再上传图片', { title: '提示', kind: 'warning' });
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        if (!base64Data) return;

        const ext = file.name.split('.').pop() || 'png';
        const fileName = `img_${Date.now()}.${ext}`;

        const relativePath = await invoke<string>('save_image_binary', {
          projectPath,
          fileName,
          base64Data
        });

        const imageMarkdown = `\n![${file.name}](${relativePath})\n`;
        onContentChange(content + imageMarkdown);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Image upload failed:', err);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          handleImageSave(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  return (
    <div className="markdown-drawer-panel">
      <div className="drawer-header">
        <div className="drawer-title-group">
          <FileCode size={18} className="drawer-title-icon" />
          <input
            type="text"
            className="drawer-title-input"
            value={node.title}
            onChange={(e) => onUpdateMeta(node.id, { title: e.target.value })}
          />
        </div>

        <div className="drawer-header-actions">
          <button
            className="btn outline small"
            title="插入本地图片"
            onClick={async () => {
              try {
                const selected = await open({
                  multiple: false,
                  filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }]
                });
                if (selected && typeof selected === 'string') {
                  const fileName = selected.split('/').pop() || `img_${Date.now()}.png`;
                  const base64Data = await invoke<string>('read_image_as_base64', { path: selected });
                  const relativePath = await invoke<string>('save_image_binary', {
                    projectPath,
                    fileName,
                    base64Data
                  });
                  const imageMarkdown = `\n![${fileName}](${relativePath})\n`;
                  onContentChange(content + imageMarkdown);
                }
              } catch (err) {
                console.error('Pick image error:', err);
              }
            }}
          >
            <ImageIcon size={14} /> 插入图片
          </button>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="drawer-meta-bar">
        <div className="meta-item">
          <label>优先级:</label>
          <select
            value={node.priority}
            onChange={(e) => onUpdateMeta(node.id, { priority: e.target.value as Priority })}
          >
            <option value="P0">P0 (紧急关键)</option>
            <option value="P1">P1 (高)</option>
            <option value="P2">P2 (中)</option>
            <option value="P3">P3 (低)</option>
          </select>
        </div>

        <div className="meta-item">
          <label>状态:</label>
          <select
            value={node.status}
            onChange={(e) => onUpdateMeta(node.id, { status: e.target.value as Status })}
          >
            <option value="draft">草稿</option>
            <option value="todo">待办</option>
            <option value="in_progress">进行中</option>
            <option value="completed">已完成</option>
            <option value="deprecated">废弃</option>
          </select>
        </div>

        <div className="meta-item path-info">
          <label>路径:</label>
          <span title={node.docPath}>{node.docPath}</span>
        </div>
      </div>

      <div className="drawer-editor-container" ref={editorContainerRef} onPaste={handlePaste}>
        <MDEditor
          value={autocompleteState.isOpen ? content : processedContent}
          onChange={handleEditorChange}
          height="100%"
          preview="live"
          previewOptions={{
            components: {
              img: ({ src, alt }: any) => (
                <CachedImage src={src} alt={alt} projectPath={projectPath} />
              ),
              a: ({ href, children, ...props }: any) => {
                if (href && href.startsWith('#wikilink:')) {
                  const targetTitle = decodeURIComponent(href.replace('#wikilink:', ''));
                  return (
                    <span
                      className="wikilink-tag-badge"
                      title={`点击在脑图与右侧跳转至「${targetTitle}」`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onNavigateToNode) {
                          onNavigateToNode(targetTitle);
                        }
                      }}
                    >
                      <Link2 size={12} className="wikilink-icon" />
                      {children}
                      <ArrowUpRight size={11} className="wikilink-arrow" />
                    </span>
                  );
                }
                return <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>;
              }
            }
          }}
        />

        {/* 输入 [[ 联想浮窗 */}
        {autocompleteState.isOpen && (
          <WikiLinkAutocomplete
            nodes={allNodes.filter(n => n.id !== node.id)}
            searchQuery={autocompleteState.query}
            position={autocompleteState.position}
            onSelect={handleSelectWikiNode}
            onClose={() => setAutocompleteState((prev) => ({ ...prev, isOpen: false }))}
          />
        )}
      </div>

      {/* 反向引用面板 (Backlinks) */}
      {backlinks.length > 0 && (
        <div className="drawer-backlinks-panel">
          <div className="backlinks-header">
            <Network size={13} color="#2c5e53" />
            <span>被以下 {backlinks.length} 个节点引用 (反向链接):</span>
          </div>
          <div className="backlinks-list">
            {backlinks.map((bl) => (
              <button
                key={bl.id}
                className="backlink-pill"
                title={`跳转至引用节点「${bl.title}」`}
                onClick={() => onNavigateToNode && onNavigateToNode(bl.title)}
              >
                <Link2 size={11} />
                <span>{bl.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="drawer-footer">
        <span className="auto-save-hint">
          <Save size={12} style={{ marginRight: 4 }} /> 输入 <code style={{ color: 'var(--primary-600)', fontWeight: 600 }}>[[</code> 可快速双向链接其他节点 | 支持直接粘贴/插入图片
        </span>
      </div>
    </div>
  );
};
