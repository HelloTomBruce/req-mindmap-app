import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { NodeTemplate } from '../templates';
import { Priority, Status } from '../types';

interface TemplateEditModalProps {
  initialTemplate?: NodeTemplate | null;
  onClose: () => void;
  onSave: (template: NodeTemplate) => void;
}

const AVAILABLE_ICONS: Array<{ name: NodeTemplate['iconName']; label: string }> = [
  { name: 'Sparkles', label: '特性 / 亮点' },
  { name: 'Code2', label: '代码 / 接口' },
  { name: 'Database', label: '数据库 / 实体' },
  { name: 'Layout', label: 'UI / 布局' },
  { name: 'Wrench', label: '工具 / 任务' },
  { name: 'FileText', label: '通用文档' }
];

export const TemplateEditModal: React.FC<TemplateEditModalProps> = ({
  initialTemplate,
  onClose,
  onSave
}) => {
  const isEditMode = !!initialTemplate;

  const [name, setName] = useState(initialTemplate?.name || '');
  const [description, setDescription] = useState(initialTemplate?.description || '');
  const [iconName, setIconName] = useState<NodeTemplate['iconName']>(initialTemplate?.iconName || 'Sparkles');
  const [defaultTitle, setDefaultTitle] = useState(initialTemplate?.defaultTitle || '');
  const [defaultPriority, setDefaultPriority] = useState<Priority>(initialTemplate?.defaultPriority || 'P1');
  const [defaultStatus, setDefaultStatus] = useState<Status>(initialTemplate?.defaultStatus || 'todo');
  const [tagsStr, setTagsStr] = useState((initialTemplate?.defaultTags || ['自定义']).join(', '));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const tags = tagsStr
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const title = defaultTitle.trim() || name.trim();
    const prevSkeleton = initialTemplate?.markdownSkeleton || `# ${title}\n\n## 1. 需求概述\n请在此编辑该模板的文档骨架...\n`;

    const templateToSave: NodeTemplate = {
      id: initialTemplate?.id || `custom-tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      description: description.trim() || '用户自定义需求模板',
      iconName,
      category: 'general',
      defaultTitle: title,
      defaultPriority,
      defaultStatus,
      defaultTags: tags.length > 0 ? tags : ['自定义'],
      markdownSkeleton: prevSkeleton
    };

    onSave(templateToSave);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content template-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Sparkles size={18} color="#2563eb" /> {isEditMode ? '编辑模板元信息' : '创建自定义需求模板'}
          </div>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body template-edit-body">
            <div className="form-row">
              <div className="form-group flex-1">
                <label>模板名称 <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="例如: 埋点事件规范"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="form-group flex-1">
                <label>模板图标</label>
                <select
                  className="form-input"
                  value={iconName}
                  onChange={(e) => setIconName(e.target.value as NodeTemplate['iconName'])}
                >
                  {AVAILABLE_ICONS.map((ic) => (
                    <option key={ic.name} value={ic.name}>
                      {ic.label} ({ic.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>模板描述</label>
              <input
                type="text"
                className="form-input"
                placeholder="例如: 适用于前端/客户端数据埋点、上报参数与业务触发时机定义"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="form-row">
              <div className="form-group flex-2">
                <label>默认节点标题</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="新建节点时的默认名称"
                  value={defaultTitle}
                  onChange={(e) => setDefaultTitle(e.target.value)}
                />
              </div>

              <div className="form-group flex-1">
                <label>默认优先级</label>
                <select
                  className="form-input"
                  value={defaultPriority}
                  onChange={(e) => setDefaultPriority(e.target.value as Priority)}
                >
                  <option value="P0">P0 (紧急关键)</option>
                  <option value="P1">P1 (高优先级)</option>
                  <option value="P2">P2 (中优先级)</option>
                  <option value="P3">P3 (低优先级)</option>
                </select>
              </div>

              <div className="form-group flex-1">
                <label>默认状态</label>
                <select
                  className="form-input"
                  value={defaultStatus}
                  onChange={(e) => setDefaultStatus(e.target.value as Status)}
                >
                  <option value="draft">草稿 (Draft)</option>
                  <option value="todo">待办 (Todo)</option>
                  <option value="in_progress">进行中 (In Progress)</option>
                  <option value="completed">已完成 (Completed)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>默认标签 (逗号或空格隔开)</label>
              <input
                type="text"
                className="form-input"
                placeholder="例如: 埋点, 数据, 客户端"
                value={tagsStr}
                onChange={(e) => setTagsStr(e.target.value)}
              />
            </div>

            {!isEditMode && (
              <div className="template-create-hint">
                💡 创建后将自动在右侧抽屉打开该模板的 <strong>Markdown 文档骨架编辑器</strong>，方便直接编写内容骨架。
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn outline" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn primary" disabled={!name.trim()}>
              {isEditMode ? '保存' : '创建并开始编辑骨架'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
