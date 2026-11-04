import React, { useState } from 'react';
import { FolderOpen, Plus, Sparkles, Code2, Database, BookOpen, FileText, Check } from 'lucide-react';
import { PROJECT_PRESETS, ProjectPreset } from '../projectPresets';
import { Modal } from './ui/Modal';
import { Button } from '@/components/ui/button';

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
  const [isPicking, setIsPicking] = useState(false);

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

  const handlePickFolder = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isPicking) return;
    setIsPicking(true);
    try {
      const selected = await onSelectFolder();
      if (selected) {
        setPath(selected);
      }
    } finally {
      setIsPicking(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim() || !path) return;
    onCreate(name.trim(), path, selectedPresetId);
  };

  return (
    <Modal
      onClose={onClose}
      className="create-project-modal max-w-2xl"
      title={
        <div className="flex items-center gap-2">
          <Plus size={18} /> 新建 DocMind 文档项目
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button type="button" variant="default" size="sm" disabled={!name.trim() || !path} onClick={handleSubmit}>
            立即创建项目
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-group">
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-[var(--text-secondary)]">
            选择项目场景预设
          </label>
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
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-[var(--text-secondary)]">
            项目名称 <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="例如: 智能商城需求规格说明书"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-[var(--text-secondary)]">
            存储目录 (本地文件夹) <span className="text-danger">*</span>
          </label>
          <div className="folder-picker-group">
            <input
              type="text"
              className="form-input form-input-clickable"
              readOnly
              placeholder="点击选择项目在本地磁盘的存放目录..."
              value={path}
              onClick={handlePickFolder}
              title="点击选择存放目录"
              required
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              onClick={handlePickFolder}
              disabled={isPicking}
              title="浏览文件夹"
            >
              <FolderOpen size={14} /> {isPicking ? '选择中...' : '浏览文件夹'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
