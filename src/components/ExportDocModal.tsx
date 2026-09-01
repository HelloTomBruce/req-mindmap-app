import React, { useState, useMemo } from 'react';
import { MindNode } from '../types';
import { X, FileDown, CheckCircle, FileText, Globe, Copy, Printer } from 'lucide-react';

interface ExportDocModalProps {
  rootNode: MindNode;
  docsMap: Record<string, string>;
  projectName: string;
  onClose: () => void;
}

export const ExportDocModal: React.FC<ExportDocModalProps> = ({
  rootNode,
  docsMap,
  projectName,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'markdown' | 'html'>('markdown');
  const [copied, setCopied] = useState(false);

  // 1. 生成 TOC 目录与深度优先聚合 Markdown
  const { fullMarkdownText, tocList } = useMemo(() => {
    const toc: Array<{ depth: number; title: string; anchor: string }> = [];

    const generateFullDoc = (node: MindNode, depth: number = 1): string => {
      const headingHashes = '#'.repeat(Math.min(depth, 6));
      let docBody = docsMap[node.docPath] || '';
      
      // 清理 docBody 中的第一行一级标题或 frontmatter
      docBody = docBody.replace(/^---[\s\S]*?---\n*/, '');
      if (docBody.startsWith(`# `)) {
        docBody = docBody.replace(/^#\s+[^\n]*\n*/, '');
      }

      const anchor = node.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '');
      toc.push({ depth, title: node.title, anchor });

      let result = `${headingHashes} ${node.title}\n\n`;
      if (node.status || node.priority) {
        result += `> **状态**: \`${node.status}\` | **优先级**: \`${node.priority}\`${node.tags && node.tags.length > 0 ? ` | **标签**: ${node.tags.map(t => `#${t}`).join(' ')}` : ''}\n\n`;
      }
      
      if (docBody.trim()) {
        result += `${docBody.trim()}\n\n`;
      }

      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          result += generateFullDoc(child, depth + 1);
        }
      }

      return result;
    };

    const docBody = generateFullDoc(rootNode);

    // 拼装目录 (Table of Contents)
    let tocMarkdown = `## 📑 目录导航 (Table of Contents)\n\n`;
    for (const item of toc) {
      const indent = '  '.repeat(Math.max(0, item.depth - 1));
      tocMarkdown += `${indent}- [${item.title}](#${item.anchor})\n`;
    }
    tocMarkdown += `\n---\n\n`;

    const fullMarkdownText = `# ${projectName}\n\n> 自动聚合导出时间: ${new Date().toLocaleString()}\n\n---\n\n${tocMarkdown}${docBody}`;

    return { fullMarkdownText, tocList: toc };
  }, [rootNode, docsMap, projectName]);

  // 2. 生成单文件自包含的离线 HTML (带 GitHub 风格排版与响应式目录，支持直接打印为 PDF)
  const fullHtmlContent = useMemo(() => {
    // 简单的 Markdown 转 HTML 渲染器 (支持基础标题、段落、代码块、列表、引用)
    const renderMarkdownToHtml = (md: string): string => {
      let html = md
        .replace(/^### (.*$)/gim, '<h3 id="$1">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 id="$1">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 id="$1">$1</h1>')
        .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
        .replace(/`([^`]+)`/gim, '<code>$1</code>')
        .replace(/\n\n/gim, '<br/><br/>');
      return html;
    };

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${projectName} - DocMind 导出文档</title>
  <style>
    :root {
      --text-color: #1e293b;
      --bg-color: #f8fafc;
      --card-bg: #ffffff;
      --primary-color: #2563eb;
      --border-color: #e2e8f0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 40px 20px;
      background-color: var(--bg-color);
      color: var(--text-color);
      line-height: 1.6;
    }
    .doc-container {
      max-width: 900px;
      margin: 0 auto;
      background: var(--card-bg);
      padding: 48px;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      border: 1px solid var(--border-color);
    }
    h1 { font-size: 28px; border-bottom: 2px solid var(--primary-color); padding-bottom: 12px; margin-top: 0; }
    h2 { font-size: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-top: 32px; }
    h3 { font-size: 16px; margin-top: 24px; }
    blockquote {
      margin: 16px 0;
      padding: 10px 16px;
      background-color: #f1f5f9;
      border-left: 4px solid var(--primary-color);
      border-radius: 0 6px 6px 0;
      color: #475569;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      background-color: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      color: #0f172a;
    }
    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
    }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid var(--border-color); padding: 8px 12px; font-size: 14px; }
    th { background: #f8fafc; font-weight: 600; text-align: left; }
    @media print {
      body { background: #fff; padding: 0; }
      .doc-container { box-shadow: none; border: none; padding: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="doc-container">
    <h1>${projectName}</h1>
    <p style="color: #64748b; font-size: 13px;">自动聚合生成时间: ${new Date().toLocaleString()} · 由 DocMind 输出</p>
    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    ${renderMarkdownToHtml(fullMarkdownText)}
  </div>
</body>
</html>`;
  }, [projectName, fullMarkdownText]);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullMarkdownText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    try {
      const blob = new Blob([fullMarkdownText], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${projectName}.md`);
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

  const handleDownloadHtml = () => {
    try {
      const blob = new Blob([fullHtmlContent], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${projectName}.html`);
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
      <div className="modal-content export-doc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <FileDown size={18} color="#2563eb" /> 聚合导出完整文档
          </div>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* 导出格式切换 Tab */}
        <div className="export-modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'markdown' ? 'active' : ''}`}
            onClick={() => setActiveTab('markdown')}
          >
            <FileText size={15} />
            聚合长篇 Markdown (.md)
          </button>
          <button
            className={`tab-btn ${activeTab === 'html' ? 'active' : ''}`}
            onClick={() => setActiveTab('html')}
          >
            <Globe size={15} />
            独立离线网页 / 打印 PDF (.html)
          </button>
        </div>

        <div className="modal-body export-doc-body">
          {activeTab === 'markdown' ? (
            <>
              <p className="export-hint">
                系统已按拓扑结构树层级，自动为您拼装了包含 <strong>TOC 目录索引</strong> 与 <strong>{tocList.length} 个节点</strong> 的完整 Markdown 长文档：
              </p>
              <textarea
                className="prd-preview-textarea"
                readOnly
                value={fullMarkdownText}
              />
            </>
          ) : (
            <>
              <p className="export-hint">
                已自动生成内嵌排版样式的自包含单文件 HTML，可在浏览器中离线阅读，或直接通过浏览器 <strong>「打印 &rarr; 另存为 PDF」</strong>：
              </p>
              <div className="export-html-preview-box">
                <iframe
                  title="HTML Preview"
                  srcDoc={fullHtmlContent}
                  className="export-html-iframe"
                />
              </div>
            </>
          )}
        </div>

        <div className="modal-footer justify-between">
          <button className="btn outline" onClick={handleCopy}>
            {copied ? <CheckCircle size={14} color="#10b981" /> : <Copy size={14} />}
            {copied ? '已复制到剪贴板' : '复制全量 Markdown'}
          </button>

          <div className="btn-group">
            {activeTab === 'markdown' ? (
              <button className="btn primary" onClick={handleDownloadMarkdown}>
                <FileDown size={14} /> 下载聚合 .md 文件
              </button>
            ) : (
              <button className="btn primary" onClick={handleDownloadHtml}>
                <Printer size={14} /> 下载 .html 网页 (可打印为 PDF)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
