import { NodeTemplate, NODE_TEMPLATES } from './templates';

const TEMPLATES_STORAGE_KEY = 'req_mindmap_custom_templates_v1';

// 获取所有模板（内置 + 用户自定义）
export const getAllTemplates = (): NodeTemplate[] => {
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!raw) return [...NODE_TEMPLATES];
    const customTemplates: NodeTemplate[] = JSON.parse(raw);
    
    // 自定义模板放在前面，内置模板放在后面
    return [...customTemplates, ...NODE_TEMPLATES];
  } catch (e) {
    console.error('Failed to load custom templates from localStorage', e);
    return [...NODE_TEMPLATES];
  }
};

// 获取仅自定义模板
export const getCustomTemplates = (): NodeTemplate[] => {
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse custom templates', e);
    return [];
  }
};

// 保存自定义模板列表
export const saveCustomTemplates = (templates: NodeTemplate[]): void => {
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch (e) {
    console.error('Failed to save custom templates', e);
  }
};

// 保存或更新单个自定义模板
export const upsertCustomTemplate = (template: NodeTemplate): void => {
  const current = getCustomTemplates();
  const index = current.findIndex((t) => t.id === template.id);
  if (index >= 0) {
    current[index] = template;
  } else {
    current.unshift(template);
  }
  saveCustomTemplates(current);
};

// 删除自定义模板
export const deleteCustomTemplate = (templateId: string): void => {
  const current = getCustomTemplates();
  const updated = current.filter((t) => t.id !== templateId);
  saveCustomTemplates(updated);
};
