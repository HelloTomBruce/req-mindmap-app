import React, { useState, useEffect } from 'react';
import { gitDiff } from '../gitHelper';
import { GitCompare } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from '@/components/ui/button';

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
    <Modal
      onClose={onClose}
      className="diff-modal max-w-4xl"
      title={
        <div className="flex items-center gap-2">
          <GitCompare size={18} /> 版本差异对比 ({filePath})
        </div>
      }
      footer={
        <div className="flex justify-end items-center w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>
      }
    >
      <div className="diff-viewer max-h-[60vh] overflow-y-auto">
        {diffText.startsWith('加载中') || diffText.startsWith('无差异') || diffText.startsWith('加载差异') ? (
          <div className="diff-empty p-8 text-center text-sm text-[var(--ll-ink)] opacity-70">{diffText}</div>
        ) : (
          <div className="diff-lines-container font-mono text-xs">
            {renderDiffLines()}
          </div>
        )}
      </div>
    </Modal>
  );
};
