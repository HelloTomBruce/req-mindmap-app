import React, { useState } from 'react';
import { X, Sparkles, Code2, Database, Layout, Wrench, FileText, Check } from 'lucide-react';
import { NodeTemplate } from '../templates';
import { getAllTemplates } from '../templateStore';

interface TemplatePickerModalProps {
  parentNodeTitle: string;
  onClose: () => void;
  onSelectTemplate: (template: NodeTemplate) => void;
}

export const TemplatePickerModal: React.FC<TemplatePickerModalProps> = ({
  parentNodeTitle,
  onClose,
  onSelectTemplate
}) => {
  const templates = getAllTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || 'feature');

  const renderIcon = (iconName: NodeTemplate['iconName'], size = 20) => {
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

  const currentTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content template-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Sparkles size={18} color="#2563eb" /> 选择需求节点模板
          </div>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body template-picker-body">
          <div className="template-picker-tip">
            正在为父节点 <strong>「{parentNodeTitle}」</strong> 添加子需求，请选择要套用的规范模板：
          </div>

          <div className="template-cards-grid">
            {templates.map((tmpl) => {
              const isSelected = tmpl.id === selectedTemplateId;
              return (
                <div
                  key={tmpl.id}
                  className={`template-card ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedTemplateId(tmpl.id)}
                  onDoubleClick={() => onSelectTemplate(tmpl)}
                >
                  <div className="template-card-header">
                    <div className="template-card-icon-wrapper">
                      {renderIcon(tmpl.iconName)}
                    </div>
                    <div className="template-card-title">{tmpl.name}</div>
                    {isSelected && (
                      <div className="template-selected-badge">
                        <Check size={14} />
                      </div>
                    )}
                  </div>
                  <div className="template-card-desc">{tmpl.description}</div>
                  <div className="template-card-footer">
                    <span className="template-tag-badge">{tmpl.defaultPriority}</span>
                    {tmpl.defaultTags.map((tag) => (
                      <span key={tag} className="template-tag-badge">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn outline" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            onClick={() => onSelectTemplate(currentTemplate)}
          >
            使用此模板创建
          </button>
        </div>
      </div>
    </div>
  );
};
