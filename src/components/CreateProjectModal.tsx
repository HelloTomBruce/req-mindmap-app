import React, { useState } from 'react';
import { X, FolderOpen, Plus } from 'lucide-react';

interface CreateProjectModalProps {
  onClose: () => void;
  onSelectFolder: () => Promise<string | null>;
  onCreate: (name: string, path: string) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  onClose,
  onSelectFolder,
  onCreate
}) => {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');

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
    onCreate(name.trim(), path);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content create-project-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Plus size={18} /> 新建需求项目
          </div>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>项目名称</label>
              <input
                type="text"
                className="form-input"
                placeholder="例如: 智能商城 PRD"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>存储目录</label>
              <div className="folder-picker-group">
                <input
                  type="text"
                  className="form-input"
                  readOnly
                  placeholder="请选择项目在本地磁盘的存放目录..."
                  value={path}
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
              立即创建
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
