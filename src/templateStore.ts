import { invoke } from '@tauri-apps/api/core';
import { NodeTemplate, NODE_TEMPLATES } from './templates';

const TEMPLATES_STORAGE_KEY = 'req_mindmap_custom_templates_v1';

// 内存缓存层：保证 UI 同步渲染无空白闪烁，同时底层落盘至 AppData 纯文本
let customTemplatesCache: NodeTemplate[] | null = null;
let isInitialized = false;

/**
 * 初始化模板存储：从磁盘读取并自动从 localStorage 迁移旧数据
 */
export const initTemplateStore = async (): Promise<void> => {
  if (isInitialized) return;
  try {
    const raw = await invoke<string>('load_custom_templates_custom');
    if (raw && raw !== '[]') {
      customTemplatesCache = JSON.parse(raw);
    } else {
      // 检查是否存在历史 localStorage 数据进行一次性平滑迁移
      const legacyRaw = typeof window !== 'undefined' ? localStorage.getItem(TEMPLATES_STORAGE_KEY) : null;
      if (legacyRaw) {
        try {
          const parsed = JSON.parse(legacyRaw);
          customTemplatesCache = parsed;
          await invoke('save_custom_templates_custom', { content: JSON.stringify(parsed, null, 2) });
          localStorage.removeItem(TEMPLATES_STORAGE_KEY);
          console.log('✅ 自定义模板已从 localStorage 成功迁移至 AppData 磁盘文件');
        } catch (e) {
          console.warn('迁移旧模板数据失败:', e);
          customTemplatesCache = [];
        }
      } else {
        customTemplatesCache = [];
      }
    }
  } catch (err) {
    console.warn('从磁盘读取自定义模板失败，使用默认配置:', err);
    customTemplatesCache = [];
  } finally {
    isInitialized = true;
  }
};

// 预触发初始化
if (typeof window !== 'undefined') {
  initTemplateStore();
}

/**
 * 获取所有模板（用户自定义 + 系统内置）
 */
export const getAllTemplates = (): NodeTemplate[] => {
  const custom = getCustomTemplates();
  // 自定义模板在前，内置模板在后
  return [...custom, ...NODE_TEMPLATES];
};

/**
 * 获取仅用户自定义模板列表
 */
export const getCustomTemplates = (): NodeTemplate[] => {
  if (customTemplatesCache !== null) {
    return customTemplatesCache;
  }

  // 兜底降级：尝试读取 localStorage（尚未初始化完毕时）
  if (typeof window !== 'undefined') {
    const legacy = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (legacy) {
      try {
        customTemplatesCache = JSON.parse(legacy);
        return customTemplatesCache || [];
      } catch {
        // ignore
      }
    }
  }

  return [];
};

/**
 * 保存自定义模板列表并持久化至磁盘
 */
export const saveCustomTemplates = (templates: NodeTemplate[]): void => {
  customTemplatesCache = templates;
  invoke('save_custom_templates_custom', { content: JSON.stringify(templates, null, 2) }).catch((err) => {
    console.error('Failed to save custom templates to disk:', err);
  });
};

/**
 * 保存或更新单个自定义模板
 */
export const upsertCustomTemplate = (template: NodeTemplate): void => {
  const current = [...getCustomTemplates()];
  const index = current.findIndex((t) => t.id === template.id);
  if (index >= 0) {
    current[index] = template;
  } else {
    current.unshift(template);
  }
  saveCustomTemplates(current);
};

/**
 * 删除指定自定义模板
 */
export const deleteCustomTemplate = (templateId: string): void => {
  const current = getCustomTemplates();
  const updated = current.filter((t) => t.id !== templateId);
  saveCustomTemplates(updated);
};
