import React, { useState } from 'react';
import { FileText, FolderOpen, FileUp, Loader2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from '@/components/ui/button';

interface ImportMdModalProps {
  onClose: () => void;
  onSelectMd: () => Promise<string | null>;
  onSelectFolder: () => Promise<string | null>;
  onImport: (mdPath: string, targetPath: string, projectName: string) => Promise<void>;
}

export const ImportMdModal: React.FC<ImportMdModalProps> = ({
  onClose,
  onSelectMd,
  onSelectFolder,
  onImport
}) => {
  const [mdPath, setMdPath] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPickingDoc, setIsPickingDoc] = useState(false);
  const [isPickingFolder, setIsPickingFolder] = useState(false);

  const handlePickMd = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isPickingDoc) return;
    setIsPickingDoc(true);
    try {
      const selected = await onSelectMd();
      if (selected) {
        setMdPath(selected);
        const fileName = selected.split('/').pop()?.replace(/\.(md|markdown|docx?|docm?)$/i, '') || '从文档导入的项目';
        if (!projectName) {
          setProjectName(fileName);
        }
      }
    } finally {
      setIsPickingDoc(false);
    }
  };

  const handlePickFolder = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isPickingFolder) return;
    setIsPickingFolder(true);
    try {
      const selected = await onSelectFolder();
      if (selected) {
        setTargetPath(selected);
      }
    } finally {
      setIsPickingFolder(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!mdPath || !targetPath || !projectName.trim()) return;
    setLoading(true);
    try {
      await onImport(mdPath, targetPath, projectName.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      className="import-md-modal max-w-xl"
      title={
        <div className="flex items-center gap-2">
          <FileUp size={18} /> 从文档导入转换项目
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={!mdPath || !targetPath || !projectName.trim() || loading}
            onClick={handleSubmit}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" /> 转换中...
              </>
            ) : (
              '解析并转换项目'
            )}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-group">
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-[var(--ll-ink)] opacity-80">
            选择源文档 (Markdown / Word) <span className="text-danger">*</span>
          </label>
          <div className="folder-picker-group">
            <input
              type="text"
              className="form-input form-input-clickable"
              readOnly
              placeholder="点击选择 Markdown 或 Word (.docx/.doc) 文档..."
              value={mdPath}
              onClick={handlePickMd}
              title="点击选择源文档"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handlePickMd}
              disabled={isPickingDoc}
              title="浏览文档"
            >
              <FileText size={14} /> {isPickingDoc ? '选择中...' : '浏览文档'}
            </Button>
          </div>
        </div>

        <div className="form-group">
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-[var(--ll-ink)] opacity-80">
            生成项目名称 <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="例如: 导入的需求规范"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-[var(--ll-ink)] opacity-80">
            新项目存储目录 <span className="text-danger">*</span>
          </label>
          <div className="folder-picker-group">
            <input
              type="text"
              className="form-input form-input-clickable"
              readOnly
              placeholder="选择拆分解析后生成的项目保存路径..."
              value={targetPath}
              onClick={handlePickFolder}
              title="点击选择存储目录"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handlePickFolder}
              disabled={isPickingFolder}
              title="浏览文件夹"
            >
              <FolderOpen size={14} /> {isPickingFolder ? '选择中...' : '浏览文件夹'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
