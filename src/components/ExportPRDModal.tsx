import React, { useState } from 'react';
import { MindNode } from '../types';
import { X, FileDown, CheckCircle } from 'lucide-react';

interface ExportPRDModalProps {
  rootNode: MindNode;
  docsMap: Record<string, string>;
  projectName: string;
  onClose: () => void;
}

export const ExportPRDModal: React.FC<ExportPRDModalProps> = ({
  rootNode,
  docsMap,
  projectName,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  // 深度优先遍历所有节点并整合 Markdown
  const generateFullPRD = (node: MindNode, depth: number = 1): string => {
    const headingHashes = '#'.repeat(Math.min(depth, 6));
    let docBody = docsMap[node.docPath] || '';
    
    // 清理 docBody 中的 frontmatter (如果存在)
    docBody = docBody.replace(/^---[\s\S]*?---\n*/, '');

    let result = `${headingHashes} ${node.title}\n\n`;
    result += `> **状态**: ${node.status} | **优先级**: ${node.priority}\n\n`;
    if (docBody.trim()) {
      result += `${docBody.trim()}\n\n`;
    }

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        result += generateFullPRD(child, depth + 1);
      }
    }

    return result;
  };

  const fullPRDText = `# ${projectName} - 完整需求规格说明书 (PRD)\n\n> 自动生成时间: ${new Date().toLocaleString()}\n\n---\n\n` + generateFullPRD(rootNode);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullPRDText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([fullPRDText], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${projectName}_PRD.md`);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (e) {
      console.error('Download failed', e);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content export-prd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <FileDown size={18} /> 导出全量 PRD 需求文档
          </div>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <p className="export-hint">
            系统已按思维导图结构层级自动拼装拼接了所有节点的 Markdown 需求内容：
          </p>
          <textarea
            className="prd-preview-textarea"
            readOnly
            value={fullPRDText}
          />
        </div>

        <div className="modal-footer">
          <button className="btn outline" onClick={handleCopy}>
            {copied ? <CheckCircle size={14} color="#10b981" /> : null}
            {copied ? '已复制到剪贴板' : '复制全量内容'}
          </button>
          <button className="btn primary" onClick={handleDownload}>
            <FileDown size={14} /> 下载导出 .md 文件
          </button>
        </div>
      </div>
    </div>
  );
};
