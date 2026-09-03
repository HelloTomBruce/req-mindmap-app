import { ICommand, commands, ExecuteState, TextAreaTextApi } from '@uiw/react-md-editor';

/**
 * Markdown 文本颜色与高亮扩展语法解析器
 * 
 * 支持的扩展语法：
 * 1. [文字]{color}: 例如 [红色文字]{red} 或 [十六进制颜色]{#3b82f6} 或 [文字]{color=#ef4444}
 * 2. [文字]{bg=color}: 例如 [黄色背景]{bg=yellow} 或 [背景与文字]{color=#fff,bg=#ef4444}
 * 3. ==高亮文字==: 快捷荧光高亮
 */

export const PRESET_COLORS: Record<string, { label: string; text: string; bg?: string }> = {
  red: { label: '朱红', text: '#ef4444', bg: '#fef2f2' },
  orange: { label: '雌黄', text: '#f97316', bg: '#fff7ed' },
  yellow: { label: '藤黄', text: '#eab308', bg: '#fefce8' },
  green: { label: '竹青', text: '#10b981', bg: '#f0fdf4' },
  blue: { label: '景泰', text: '#3b82f6', bg: '#eff6ff' },
  purple: { label: '紫藤', text: '#8b5cf6', bg: '#f5f3ff' },
  pink: { label: '胭脂', text: '#ec4899', bg: '#fdf2f8' },
  gray: { label: '水墨灰', text: '#6b7280', bg: '#f3f4f6' },
};

/**
 * 将扩展语法预处理为 Markdown 超链接虚拟协议格式：
 * 1. [文本]{red} -> [文本](#color:text=red)
 * 2. [文本]{#1890ff} -> [文本](#color:text=%231890ff)
 * 3. [文本]{color=red,bg=yellow} -> [文本](#color:text=red&bg=yellow)
 * 4. ==高亮文字== -> [高亮文字](#color:highlight=1)
 */
export function processCustomMarkdownSyntax(markdown: string): string {
  if (!markdown) return '';

  // 1. 先处理 WikiLink：[[节点名称]] 转为 [节点名称](#wikilink:节点名称)
  let res = markdown.replace(/\[\[(.*?)\]\]/g, '[$1](#wikilink:$1)');

  // 2. 处理 ==高亮文字==
  res = res.replace(/==([^=\n]+)==/g, '[$1](#color:highlight=1)');

  // 3. 处理 [文本]{样式属性}
  // 例如：[重点关注]{red} 或 [强调内容]{#ff0000} 或 [警告]{color=red,bg=yellow}
  res = res.replace(/\[([^\]\n]+)\]\{([a-zA-Z0-9_#=,;\s-]+)\}/g, (_, text, styleAttr) => {
    const rawAttr = styleAttr.trim();
    let textCol = '';
    let bgCol = '';

    if (rawAttr.includes('=') || rawAttr.includes(',')) {
      // 键值对形式：color=red, bg=yellow 或 c=red,bg=yellow
      const parts = rawAttr.split(/[,;]/);
      for (const part of parts) {
        const [k, v] = part.split('=').map((s: string) => s.trim());
        if (k === 'color' || k === 'c' || k === 'text') {
          textCol = v;
        } else if (k === 'bg' || k === 'background') {
          bgCol = v;
        }
      }
    } else {
      // 简写：直接传颜色名或 hex，如 {red} 或 {#f43f5e}
      textCol = rawAttr;
    }

    const params = new URLSearchParams();
    if (textCol) params.set('c', textCol);
    if (bgCol) params.set('bg', bgCol);

    return `[${text}](#color:${params.toString()})`;
  });

  return res;
}

/**
 * 解析 color 虚拟协议参数
 */
export function parseColorQuery(href: string): { textColor?: string; bgColor?: string; isHighlight?: boolean } {
  if (!href.startsWith('#color:')) {
    return {};
  }
  const queryString = href.slice(7);
  const params = new URLSearchParams(queryString);
  const isHighlight = params.get('highlight') === '1';
  const c = params.get('c');
  const bg = params.get('bg');

  let textColor = undefined;
  let bgColor = undefined;

  if (c) {
    if (PRESET_COLORS[c.toLowerCase()]) {
      textColor = PRESET_COLORS[c.toLowerCase()].text;
    } else {
      textColor = c.startsWith('#') || c.startsWith('rgb') ? c : `#${c}`;
    }
  }

  if (bg) {
    if (PRESET_COLORS[bg.toLowerCase()]) {
      bgColor = PRESET_COLORS[bg.toLowerCase()].bg || PRESET_COLORS[bg.toLowerCase()].text;
    } else {
      bgColor = bg.startsWith('#') || bg.startsWith('rgb') ? bg : `#${bg}`;
    }
  }

  return { textColor, bgColor, isHighlight };
}

/**
 * 执行文本前后缀包裹替换
 */
function executeWrap(state: ExecuteState, api: TextAreaTextApi, prefix: string, suffix: string, placeholder = '文字') {
  const selected = state.selectedText || placeholder;
  const newText = `${prefix}${selected}${suffix}`;
  api.replaceSelection(newText);
  if (!state.selectedText) {
    // 选中占位符便于用户直接输入替换
    api.setSelectionRange({
      start: state.selection.start + prefix.length,
      end: state.selection.start + prefix.length + placeholder.length,
    });
  } else {
    // 选中被包裹后的完整内容
    api.setSelectionRange({
      start: state.selection.start,
      end: state.selection.start + newText.length,
    });
  }
}

/**
 * 创建文字颜色 / 高亮下拉菜单命令
 */
export function createColorCommands(): ICommand {
  const subCommands: ICommand[] = [
    {
      name: 'highlight',
      keyCommand: 'highlight',
      buttonProps: { 'aria-label': '荧光高亮 (==文本==)', title: '荧光高亮 (==文本==)' },
      prefix: '==',
      suffix: '==',
      icon: (
        <span style={{ fontWeight: 600, fontSize: 11, background: '#fef08a', color: '#854d0e', padding: '1px 4px', borderRadius: 2 }}>
          高亮
        </span>
      ),
      execute: (state: ExecuteState, api: TextAreaTextApi) => {
        executeWrap(state, api, '==', '==', '高亮文字');
      },
    },
    ...Object.entries(PRESET_COLORS).map(([colorKey, info]) => ({
      name: `color-${colorKey}`,
      keyCommand: `color-${colorKey}`,
      buttonProps: { 'aria-label': `${info.label} (${colorKey})`, title: `${info.label} (${colorKey})` },
      prefix: '[',
      suffix: `]{${colorKey}}`,
      icon: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: info.text, display: 'inline-block' }} />
          <span>{info.label}</span>
        </span>
      ),
      execute: (state: ExecuteState, api: TextAreaTextApi) => {
        executeWrap(state, api, '[', `]{${colorKey}}`, `${info.label}文字`);
      },
    })),
  ];

  return commands.group(subCommands, {
    name: 'textColor',
    groupName: 'textColor',
    keyCommand: 'textColor',
    buttonProps: { 'aria-label': '设置文字颜色 / 高亮', title: '设置文字颜色 / 高亮' },
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20h16" />
        <path d="m6 16 6-12 6 12" />
        <path d="M8 12h8" />
      </svg>
    ),
  });
}
