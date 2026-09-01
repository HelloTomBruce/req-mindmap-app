import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Sparkles, Code2, Database, Layout, Wrench, FileText, Search, Bookmark } from 'lucide-react';
import { NodeTemplate, NODE_TEMPLATES } from '../templates';
import { getCustomTemplates, saveCustomTemplates } from '../templateStore';
import { TemplateEditModal } from './TemplateEditModal';

interface TemplateSidebarProps {
  selectedTemplateId?: string | null;
  onSelectTemplate: (template: NodeTemplate, isCustom: boolean) => void;
  onDeleteTemplate?: (templateId: string) => void;
}

export const TemplateSidebar: React.FC<TemplateSidebarProps> = ({
  selectedTemplateId,
  onSelectTemplate,
  onDeleteTemplate
}) => {
  const [customTemplates, setCustomTemplates] = useState<NodeTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<NodeTemplate | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'custom' | 'builtin'>('all');

  const refreshTemplates = () => {
    setCustomTemplates(getCustomTemplates());
  };

  useEffect(() => {
    refreshTemplates();
  }, []);

  const renderIcon = (iconName: NodeTemplate['iconName'], size = 16) => {
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

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (tmpl: NodeTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTemplate(tmpl);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (templateId: string, templateName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { ask } = await import('@tauri-apps/plugin-dialog');
    const confirmed = await ask(`确定要删除自定义模板「${templateName}」吗？`, {
      title: '确认删除模板',
      kind: 'warning'
    });
    if (confirmed) {
      const updated = customTemplates.filter((t) => t.id !== templateId);
      saveCustomTemplates(updated);
      setCustomTemplates(updated);
      if (onDeleteTemplate) {
        onDeleteTemplate(templateId);
      }
    }
  };

  const handleSaveTemplate = (savedTemplate: NodeTemplate) => {
    const existsIndex = customTemplates.findIndex((t) => t.id === savedTemplate.id);
    let updated: NodeTemplate[];
    if (existsIndex >= 0) {
      updated = [...customTemplates];
      updated[existsIndex] = savedTemplate;
    } else {
      updated = [savedTemplate, ...customTemplates];
    }
    saveCustomTemplates(updated);
    setCustomTemplates(updated);
    setIsEditModalOpen(false);

    // 新建或修改后，直接让右侧抽屉打开编辑它的骨架
    onSelectTemplate(savedTemplate, true);
  };

  const allList = [
    ...customTemplates.map((t) => ({ ...t, isCustom: true })),
    ...NODE_TEMPLATES.map((t) => ({ ...t, isCustom: false }))
  ];

  const filteredList = allList.filter((t) => {
    if (activeTab === 'custom' && !t.isCustom) return false;
    if (activeTab === 'builtin' && t.isCustom) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.defaultTags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <aside className="app-sidebar template-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title-group">
          <Bookmark size={16} />
          <span className="sidebar-title">需求模板库</span>
        </div>
        <button
          className="btn outline icon-only"
          title="创建自定义需求模板"
          onClick={handleOpenCreate}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* 搜索与 Tab 筛选 */}
      <div className="template-sidebar-search-box">
        <div className="template-search-wrapper">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="template-search-input"
            placeholder="搜索模板名称/描述/标签..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="template-filter-tabs">
          <button
            className={`template-filter-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            全部 ({allList.length})
          </button>
          <button
            className={`template-filter-tab ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            自定义 ({customTemplates.length})
          </button>
          <button
            className={`template-filter-tab ${activeTab === 'builtin' ? 'active' : ''}`}
            onClick={() => setActiveTab('builtin')}
          >
            内置 ({NODE_TEMPLATES.length})
          </button>
        </div>
      </div>

      {/* 模板列表 */}
      <div className="template-sidebar-content">
        {filteredList.length === 0 ? (
          <div className="template-empty-state">
            <Bookmark size={28} color="#94a3b8" />
            <p>暂无符合条件的模板</p>
            {activeTab === 'custom' && (
              <button className="btn outline" onClick={handleOpenCreate}>
                <Plus size={12} /> 新建首个模板
              </button>
            )}
          </div>
        ) : (
          filteredList.map((tmpl) => {
            const isSelected = selectedTemplateId === tmpl.id;
            return (
              <div
                key={tmpl.id}
                className={`template-sidebar-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectTemplate(tmpl, tmpl.isCustom)}
                onDoubleClick={() => onSelectTemplate(tmpl, tmpl.isCustom)}
                title="单击或双击在右侧抽屉打开文档骨架编辑"
              >
                <div className="template-sidebar-item-main">
                  <div className="template-sidebar-item-header">
                    <div className="template-item-icon">{renderIcon(tmpl.iconName)}</div>
                    <div className="template-item-name" title={tmpl.name}>
                      {tmpl.name}
                    </div>
                    {tmpl.isCustom && <span className="template-custom-badge">自定义</span>}
                  </div>

                  <div className="template-item-desc" title={tmpl.description}>
                    {tmpl.description}
                  </div>

                  <div className="template-item-meta">
                    <span className="template-meta-badge priority">{tmpl.defaultPriority}</span>
                    {tmpl.defaultTags.slice(0, 2).map((tag) => (
                      <span key={tag} className="template-meta-badge">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {tmpl.isCustom && (
                  <div className="template-sidebar-item-actions">
                    <button
                      className="template-action-btn edit"
                      title="编辑模板属性"
                      onClick={(e) => handleOpenEdit(tmpl, e)}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      className="template-action-btn delete"
                      title="删除此模板"
                      onClick={(e) => handleDelete(tmpl.id, tmpl.name, e)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {isEditModalOpen && (
        <TemplateEditModal
          initialTemplate={editingTemplate}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSaveTemplate}
        />
      )}
    </aside>
  );
};
