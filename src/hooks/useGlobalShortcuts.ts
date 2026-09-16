import { useEffect } from 'react';

interface GlobalShortcutOptions {
  onToggleCommandPalette: () => void;
}

/**
 * 监听全局快捷键（如 Cmd/Ctrl + K 唤起全局搜索）
 */
export const useGlobalShortcuts = ({ onToggleCommandPalette }: GlobalShortcutOptions) => {
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onToggleCommandPalette();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onToggleCommandPalette]);
};
