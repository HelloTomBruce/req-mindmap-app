import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { ProjectMeta } from './ProjectManager';

interface DeleteConfirmModalProps {
  project: ProjectMeta;
  onClose: () => void;
  onConfirm: (deletePhysicalFiles: boolean) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  project,
  onClose,
  onConfirm
}) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title text-danger">
            <AlertTriangle size={18} color="#ef4444" /> 删除项目
          </div>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <p className="delete-warning-text">
            您正在从列表移除项目 <strong>「{project.name}」</strong>。
          </p>
          <div className="path-display-box">
            磁盘路径: <code>{project.path}</code>
          </div>
          <p className="delete-question">
            是否同时从本地磁盘彻底删除该项目的源文件及文件夹？
          </p>
        </div>

        <div className="modal-footer justify-between">
          <button className="btn outline" onClick={onClose}>
            取消
          </button>
          <div className="btn-group">
            <button
              className="btn outline"
              title="仅从最近项目记录中移除，保留本地磁盘文件"
              onClick={() => onConfirm(false)}
            >
              仅移除历史记录
            </button>
            <button
              className="btn danger"
              title="将物理删除磁盘上的该项目文件夹及所有 Markdown 文件"
              onClick={() => onConfirm(true)}
            >
              <Trash2 size={14} /> 彻底删除项目文件夹
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
