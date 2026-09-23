import { useEffect } from 'react';

interface GlobalShortcutOptions {
  onToggleCommandPalette: () => void;
  onToggleDrawer?: () => void;
  onCycleStatus?: () => void;
  onAddChild?: () => void;
  onQuickSearch?: () => void;
}

/**
 * 监听全局快捷键（Obsidian 风格键盘流）
 * - Cmd/Ctrl + K 或 Cmd/Ctrl + O: 唤起全局搜索与指令面板
 * - Alt + D: 快速折叠/展开右侧 Markdown 需求抽屉
 * - Space: 在选中节点且不在编辑状态时，轮转状态 (draft -> todo -> in_progress -> completed)
 * - Tab: 在选中节点时快速新建子需求
 */
export const useGlobalShortcuts = ({
  onToggleCommandPalette,
  onToggleDrawer,
  onCycleStatus,
  onAddChild,
  onQuickSearch
}: GlobalShortcutOptions) => {
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isInputActive =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable;

      // Cmd/Ctrl + K 或 Cmd/Ctrl + O 打开全局快速切换器
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'o')) {
        e.preventDefault();
        if (onQuickSearch) onQuickSearch();
        else onToggleCommandPalette();
        return;
      }

      // Alt + D 开关右侧 Markdown 抽屉
      if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        onToggleDrawer?.();
        return;
      }

      // 如果当前正在输入框中编辑，忽略以下节点导航快捷键
      if (isInputActive) {
        return;
      }

      // Space: 快速循环轮转选中节点的状态
      if (e.code === 'Space') {
        e.preventDefault();
        onCycleStatus?.();
        return;
      }

      // Tab: 快速为当前选中的节点添加子节点
      if (e.key === 'Tab') {
        e.preventDefault();
        onAddChild?.();
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onToggleCommandPalette, onToggleDrawer, onCycleStatus, onAddChild, onQuickSearch]);
};

