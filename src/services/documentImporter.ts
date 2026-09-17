import { invoke } from '@tauri-apps/api/core';
import { ProjectData, MindNode } from '../types';
import { ProjectMeta } from '../components/ProjectManager';
import { countNodes } from './treeOperations';
import { syncToDisk } from './projectIO';

/**
 * 辅助函数：清洗标题展示文本（去除 markdown 粗体/斜体包裹及尾部多余标点）
 */
const cleanNodeTitle = (title: string): string => {
  let t = title.trim();
  t = t.replace(/^[*_`#]+|[*_`#]+$/g, '').trim();
  return t || '未命名章节';
};

/**
 * 异步辅助函数：处理并替换一行中的所有图片引用（支持 Markdown 语法与 HTML <img> 语法）
 */
const processLineImages = async (
  textLine: string,
  sourceDir: string,
  targetPath: string,
  isWordFile: boolean,
  imgCounterRef: { count: number }
): Promise<string> => {
  let newLine = textLine;

  // 1. 处理 Markdown 图片: ![alt](url)
  const mdMatches = Array.from(textLine.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g));
  for (const match of mdMatches) {
    const fullMatch = match[0];
    const altText = match[1];
    const rawSrc = match[2].trim();

    if (/^(https?:\/\/|data:)/i.test(rawSrc)) continue;
    // 仅在 Word 导入时跳过 assets/ 目录（因为已由后端保存至 targetPath/assets/），Markdown 导入时仍需拷贝
    if (isWordFile && rawSrc.startsWith('assets/')) continue;

    // 解码 URL 编码并清理前缀
    const decodedSrc = decodeURIComponent(rawSrc).replace(/^file:\/\//i, '');
    const cleanRel = decodedSrc.startsWith('/')
      ? decodedSrc
      : `${sourceDir}/${decodedSrc.replace(/^\.\//, '')}`;
    const fileExt = decodedSrc.split('.').pop()?.split('?')[0] || 'png';
    const newFileName = `md_img_${Date.now()}_${imgCounterRef.count++}.${fileExt}`;
    const destPath = `${targetPath}/assets/${newFileName}`;
    const newRelativeSrc = `assets/${newFileName}`;

    try {
      await invoke('copy_local_file_custom', {
        srcPath: cleanRel,
        destPath
      });
      newLine = newLine.replace(fullMatch, `![${altText}](${newRelativeSrc})`);
    } catch (err) {
      console.warn(`Failed to copy md image ${cleanRel}:`, err);
    }
  }

  // 2. 处理 HTML <img> 标签: <img ... src="..." ... />
  const htmlImgMatches = Array.from(
    newLine.matchAll(/<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)\/?>/gi)
  );
  for (const match of htmlImgMatches) {
    const fullTag = match[0];
    const beforeSrc = match[1];
    const rawSrc = match[2].trim();
    const afterSrc = match[3];

    if (/^(https?:\/\/|data:)/i.test(rawSrc)) continue;
    if (isWordFile && rawSrc.startsWith('assets/')) continue;

    const decodedSrc = decodeURIComponent(rawSrc).replace(/^file:\/\//i, '');
    const cleanRel = decodedSrc.startsWith('/')
      ? decodedSrc
      : `${sourceDir}/${decodedSrc.replace(/^\.\//, '')}`;
    const fileExt = decodedSrc.split('.').pop()?.split('?')[0] || 'png';
    const newFileName = `md_img_${Date.now()}_${imgCounterRef.count++}.${fileExt}`;
    const destPath = `${targetPath}/assets/${newFileName}`;
    const newRelativeSrc = `assets/${newFileName}`;

    try {
      await invoke('copy_local_file_custom', {
        srcPath: cleanRel,
        destPath
      });
      newLine = newLine.replace(
        fullTag,
        `<img ${beforeSrc}src="${newRelativeSrc}"${afterSrc} />`
      );
    } catch (err) {
      console.warn(`Failed to copy html image ${cleanRel}:`, err);
    }
  }

  return newLine;
};

/**
 * 解析源文档 (Word / Markdown)，按标题层级精准拆分为树结构，并持久化到磁盘
 */
export const importDocumentToProject = async (
  mdPath: string,
  targetPath: string,
  name: string
): Promise<{
  importedProject: ProjectData;
  docsMapResult: Record<string, string>;
  meta: ProjectMeta;
}> => {
  const isWordFile = /\.(docx?|docm?)$/i.test(mdPath);
  let fullMarkdown: string;

  if (isWordFile) {
    // Word → Markdown（图片自动提取到 targetPath/assets/）
    fullMarkdown = await invoke<string>('convert_word_to_markdown', {
      docxPath: mdPath,
      assetsDir: `${targetPath}/assets`
    });
  } else {
    fullMarkdown = await invoke<string>('read_text_file_custom', { path: mdPath });
  }

  // 预处理：仅针对 Markdown 导入保留兼容补丁（把 "20. 流程管理" 这类行提升为 #### 小节标题）
  // Word 导入已由后端 docx2md 按样式精确还原标题与有序列表，不需要此补丁（否则会把有序列表项误判为标题）
  const rawLines = fullMarkdown.split('\n');
  const lines: string[] = [];
  let inBody = false;

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];
    if (line.match(/^(\#{1,6})\s+/)) {
      inBody = true;
    }

    if (!isWordFile && inBody && !line.startsWith('#')) {
      const singleNumMatch = line.match(/^\s*(\d+)[\.、\s]\s*([^\n:：;；。，,!\?？]{2,35})$/);
      if (singleNumMatch) {
        const title = singleNumMatch[2].trim();
        if (
          !line.includes('：') &&
          !line.includes(':') &&
          !title.endsWith('。') &&
          !title.endsWith('；')
        ) {
          line = `#### ${title}`;
        }
      }
    }
    lines.push(line);
  }

  const sourceFileName = mdPath.split('/').pop() || mdPath.split('\\').pop() || '';
  const sourceType = isWordFile ? 'Word' : 'Markdown';

  const rootNode: MindNode = {
    id: 'root-node',
    title: name,
    docPath: 'index.md',
    status: 'in_progress',
    priority: 'P0',
    tags: [isWordFile ? 'Word导入' : 'MD导入'],
    children: []
  };

  const docsMapResult: Record<string, string> = {
    'index.md': `# ${name}\n\n从${sourceType}文件 ${sourceFileName} 拆分导入。\n\n`
  };

  const stack: { node: MindNode; level: number }[] = [{ node: rootNode, level: 0 }];
  let nodeIdx = 1;
  let activeContentKey = 'index.md';

  const sourceDir = mdPath.substring(0, mdPath.lastIndexOf('/'));
  const imgCounter = { count: 1 };

  let passedFirstHeading = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line.includes('![') || /<img\b/i.test(line)) {
      line = await processLineImages(line, sourceDir, targetPath, isWordFile, imgCounter);
    }

    // 1. 标准 Markdown 标题匹配: # ~ ######
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    let level = 0;
    let rawTitleText = '';

    if (match) {
      level = match[1].length;
      rawTitleText = match[2].trim();
      passedFirstHeading = true;
    } else if (passedFirstHeading) {
      // 2. 容错匹配正文中的纯数字分级标题
      const numMatch = line.match(/^\s*(\d+(\.\d+)+)\s+([^\n]{2,60})$/);
      if (numMatch && !line.endsWith('。') && !line.endsWith('；')) {
        const titlePart = numMatch[3].trim();
        const isTocPageNumber = /\d{1,4}$/.test(titlePart);
        if (!isTocPageNumber) {
          const dots = (numMatch[1].match(/\./g) || []).length;
          level = Math.min(Math.max(dots + 1, 1), 6);
          rawTitleText = line.trim();
        }
      }
    }

    if (level > 0 && rawTitleText) {
      const maxSplitLevel = 6;

      if (level > maxSplitLevel) {
        docsMapResult[activeContentKey] += `${line}\n`;
        continue;
      }

      const docRelPath = `modules/sec_${nodeIdx++}.md`;
      const displayTitle = cleanNodeTitle(rawTitleText);

      const tag = level <= 2 ? '章节' : level <= 4 ? '模块' : '功能';
      const newNode: MindNode = {
        id: `md-node-${nodeIdx}`,
        title: displayTitle,
        docPath: docRelPath,
        status: 'todo',
        priority: level <= 2 ? 'P0' : level <= 4 ? 'P1' : 'P2',
        tags: [tag]
      };

      docsMapResult[docRelPath] = `${'#'.repeat(level)} ${displayTitle}\n\n`;

      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const parentNode = stack[stack.length - 1].node;
      if (!parentNode.children) {
        parentNode.children = [];
      }
      parentNode.children.push(newNode);

      stack.push({ node: newNode, level });
      activeContentKey = docRelPath;
    } else {
      docsMapResult[activeContentKey] += `${line}\n`;
    }
  }

  // 保底处理：如果 Markdown 中无任何 # 标题，按空行切分节点
  if (!rootNode.children || rootNode.children.length === 0) {
    const rawBlocks = fullMarkdown.split(/\n\s*\n/);
    let fallbackIdx = 1;
    for (const block of rawBlocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      const firstLine = trimmed.split('\n')[0].substring(0, 30);
      const docRelPath = `modules/sec_${fallbackIdx}.md`;

      const child: MindNode = {
        id: `fallback-node-${fallbackIdx}`,
        title: firstLine || `段落 ${fallbackIdx}`,
        docPath: docRelPath,
        status: 'todo',
        priority: 'P2',
        tags: ['段落']
      };
      rootNode.children = rootNode.children || [];
      rootNode.children.push(child);
      docsMapResult[docRelPath] = `# ${firstLine}\n\n${trimmed}\n`;
      fallbackIdx++;
    }
  }

  const importedProject: ProjectData = {
    version: '1.0.0',
    projectName: name,
    root: rootNode
  };

  await syncToDisk(targetPath, importedProject, docsMapResult);

  const meta: ProjectMeta = {
    id: `proj-${Date.now()}`,
    name,
    path: targetPath,
    lastOpened: new Date().toLocaleDateString(),
    nodeCount: countNodes(rootNode)
  };

  return {
    importedProject,
    docsMapResult,
    meta
  };
};
