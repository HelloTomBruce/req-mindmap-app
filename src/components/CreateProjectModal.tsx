import React, { useState } from 'react';
import { X, FolderOpen, Plus, Sparkles, Code2, Database, BookOpen, FileText, Check } from 'lucide-react';
import { PROJECT_PRESETS, ProjectPreset } from '../projectPresets';

interface CreateProjectModalProps {
  onClose: () => void;
  onSelectFolder: () => Promise<string | null>;
  onCreate: (name: string, path: string, presetId: string) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  onClose,
  onSelectFolder,
  onCreate
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('prd');
  const [name, setName] = useState('智能新零售业务 PRD');
  const [path, setPath] = useState('');

  const handleSelectPreset = (preset: ProjectPreset) => {
    setSelectedPresetId(preset.id);
    if (!name || name === '智能新零售业务 PRD' || PROJECT_PRESETS.some((p) => p.defaultProjectName === name)) {
      setName(preset.defaultProjectName);
    }
  };

  const renderIcon = (iconName: ProjectPreset['iconName'], size = 18) => {
    switch (iconName) {
      case 'Sparkles':
        return <Sparkles size={size} color="#8b5cf6" />;
      case 'Database':
        return <Database size={size} color="#059669" />;
      case 'Code2':
        return <Code2 size={size} color="#3b82f6" />;
      case 'BookOpen':
        return <BookOpen size={size} color="#ea580c" />;
      case 'FileText':
      default:
        return <FileText size={size} color="#64748b" />;
    }
  };

  const handlePickFolder = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const selected = await onSelectFolder();
    if (selected) {
      setPath(selected);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !path) return;
    onCreate(name.trim(), path, selectedPresetId);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content create-project-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Plus size={18} /> 新建 DocMind 文档项目
          </div>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body create-project-body">
            <div className="form-group">
              <label>选择项目场景预设</label>
              <div className="preset-cards-grid">
                {PROJECT_PRESETS.map((preset) => {
                  const isSelected = preset.id === selectedPresetId;
                  return (
                    <div
                      key={preset.id}
                      className={`preset-card ${isSelected ? 'active' : ''}`}
                      onClick={() => handleSelectPreset(preset)}
                    >
                      <div className="preset-card-header">
                        <div className="preset-card-icon-wrapper">
                          {renderIcon(preset.iconName)}
                        </div>
                        <div className="preset-card-title">{preset.name}</div>
                        {isSelected && (
                          <div className="preset-selected-badge">
                            <Check size={12} />
                          </div>
                        )}
                      </div>
                      <div className="preset-card-desc">{preset.description}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label>项目名称 <span className="text-danger">*</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="例如: 智能商城需求规格说明书"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label>存储目录 (本地文件夹) <span className="text-danger">*</span></label>
              <div className="folder-picker-group">
                <input
                  type="text"
                  className="form-input"
                  readOnly
                  placeholder="请选择项目在本地磁盘的存放目录..."
                  value={path}
                  required
                />
                <button type="button" className="btn outline" onClick={handlePickFolder}>
                  <FolderOpen size={14} /> 浏览文件夹
                </button>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn outline" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn primary" disabled={!name.trim() || !path}>
              立即创建项目
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
