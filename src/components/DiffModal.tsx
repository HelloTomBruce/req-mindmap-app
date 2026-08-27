import React, { useState, useEffect } from 'react';
import { gitDiff } from '../gitHelper';
import { X } from 'lucide-react';

interface DiffModalProps {
  projectPath: string;
  filePath: string;
  commitHash?: string;
  onClose: () => void;
}

export const DiffModal: React.FC<DiffModalProps> = ({ projectPath, filePath, commitHash, onClose }) => {
  const [diffText, setDiffText] = useState('');

  useEffect(() => {
    let active = true;
    const fetchDiff = async () => {
      setDiffText('加载中...');
      try {
        const text = await gitDiff(projectPath, filePath, commitHash);
        if (active) setDiffText(text || '无差异，或者这是二进制文件。');
      } catch (e) {
        if (active) setDiffText(`加载差异失败: ${e}`);
      }
    };
    fetchDiff();
    return () => { active = false; };
  }, [projectPath, filePath, commitHash]);

  const renderDiffLines = () => {
    const lines = diffText.split('\n');
    return lines.map((line, idx) => {
      let className = 'diff-line';
      if (line.startsWith('+') && !line.startsWith('+++')) {
        className += ' diff-add';
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        className += ' diff-remove';
      } else if (line.startsWith('@@')) {
        className += ' diff-header';
      }
      
      return (
        <div key={idx} className={className}>
          <span className="diff-line-number">{idx + 1}</span>
          <span className="diff-line-content">{line}</span>
        </div>
      );
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content diff-modal">
        <div className="modal-header">
          <h2 className="modal-title">Diff: {filePath}</h2>
          <button className="btn outline icon-only" onClick={onClose} title="关闭">
            <X size={16} />
          </button>
        </div>
        
        <div className="modal-body diff-viewer">
          {diffText.startsWith('加载中') || diffText.startsWith('无差异') || diffText.startsWith('加载差异') ? (
            <div className="diff-empty">{diffText}</div>
          ) : (
            <div className="diff-lines-container">
              {renderDiffLines()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
