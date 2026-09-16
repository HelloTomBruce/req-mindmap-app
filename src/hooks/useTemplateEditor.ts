import { useState } from 'react';
import { NodeTemplate, renderTemplateMarkdown } from '../templates';
import { upsertCustomTemplate } from '../templateStore';

export interface EditingTemplateState {
  template: NodeTemplate;
  content: string;
  isCustom: boolean;
}

export const useTemplateEditor = (onOpenDrawer: () => void) => {
  const [selectedEditingTemplate, setSelectedEditingTemplate] =
    useState<EditingTemplateState | null>(null);

  const handleSelectTemplateForEdit = (tmpl: NodeTemplate, isCustom: boolean) => {
    const rawContent = tmpl.markdownSkeleton || renderTemplateMarkdown(tmpl, tmpl.defaultTitle);
    setSelectedEditingTemplate({
      template: tmpl,
      content: rawContent,
      isCustom
    });
    onOpenDrawer();
  };

  const handleTemplateContentChange = (newContent: string) => {
    if (!selectedEditingTemplate || !selectedEditingTemplate.isCustom) return;

    const updatedTemplate: NodeTemplate = {
      ...selectedEditingTemplate.template,
      markdownSkeleton: newContent
    };

    upsertCustomTemplate(updatedTemplate);
    setSelectedEditingTemplate({
      template: updatedTemplate,
      content: newContent,
      isCustom: true
    });
  };

  const handleTemplateMetaChange = (_templateId: string, updates: Partial<NodeTemplate>) => {
    if (!selectedEditingTemplate || !selectedEditingTemplate.isCustom) return;
    const updatedTemplate: NodeTemplate = {
      ...selectedEditingTemplate.template,
      ...updates
    };

    upsertCustomTemplate(updatedTemplate);
    setSelectedEditingTemplate({
      ...selectedEditingTemplate,
      template: updatedTemplate
    });
  };

  return {
    selectedEditingTemplate,
    setSelectedEditingTemplate,
    handleSelectTemplateForEdit,
    handleTemplateContentChange,
    handleTemplateMetaChange
  };
};
