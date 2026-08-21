import React from 'react';
import MDEditor from '@uiw/react-md-editor';
import { MindNode, Priority, Status } from '../types';
import { X, Save, FileCode, Image as ImageIcon } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

interface MarkdownDrawerProps {
  node: MindNode | null;
  content: string;
  projectPath: string;
  onClose: () => void;
  onContentChange: (newContent: string) => void;
  onUpdateMeta: (nodeId: string, updates: Partial<MindNode>) => void;
}

// 本地图片 DataURL 全局内存缓存，避免输入文本导致组件重新渲染时的频繁 IPC 重新读取与图片闪烁
const imageCache = new Map<string, string>();

export const MarkdownDrawer: React.FC<MarkdownDrawerProps> = ({
  node,
  content,
  projectPath,
  onClose,
  onContentChange,
  onUpdateMeta
}) => {
  if (!node) return null;

  // 上传/粘贴图片处理
  const handleImageSave = async (file: File) => {
    if (!projectPath) {
      alert('请先选择或创建项目保存目录后再上传图片');
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
                  // 读取图片文件字符串并传给 Rust
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

      <div className="drawer-editor-container" onPaste={handlePaste}>
        <MDEditor
          value={content}
          onChange={(val) => onContentChange(val || '')}
          height="100%"
          preview="live"
          previewOptions={{
            components: {
              img: ({ src, alt, ...rest }: any) => {
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
                    invoke<string>('read_image_data_url', {
                      projectPath,
                      relativePath: src
                    }).then((dataUrl) => {
                      imageCache.set(cacheKey, dataUrl);
                      if (isMounted) {
                        setSrcUrl(dataUrl);
                      }
                    }).catch((e) => {
                      console.warn('Failed to load image preview:', src, e);
                    });
                    return () => {
                      isMounted = false;
                    };
                  } else {
                    setSrcUrl(src);
                  }
                }, [src, projectPath, cacheKey]);

                return (
                  <img
                    {...rest}
                    src={srcUrl}
                    style={{ maxWidth: '100%', borderRadius: 6, margin: '8px 0', display: 'block' }}
                    alt={alt || '图片'}
                  />
                );
              }
            }
          }}
        />
      </div>

      <div className="drawer-footer">
        <span className="auto-save-hint">
          <Save size={12} style={{ marginRight: 4 }} /> 防抖自动保存 | 支持直接粘贴/插入图片到 assets/
        </span>
      </div>
    </div>
  );
};
