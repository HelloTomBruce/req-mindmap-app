import { MindNode } from '../types';

/**
 * 递归计算树中节点总数
 */
export const countNodes = (node: MindNode): number => {
  let count = 1;
  if (node.children) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
};

/**
 * 根据 ID 递归查找节点
 */
export const findNodeById = (node: MindNode, id: string): MindNode | null => {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
};

/**
 * 根据 ID 查找节点标题
 */
export const findNodeTitleById = (root: MindNode, id: string, defaultTitle: string = '该节点'): string => {
  const node = findNodeById(root, id);
  return node ? node.title : defaultTitle;
};

/**
 * 获取整棵树的所有节点扁平列表
 */
export const flattenTreeNodes = (root: MindNode): MindNode[] => {
  const list: MindNode[] = [];
  const traverse = (n: MindNode) => {
    list.push(n);
    if (n.children) n.children.forEach(traverse);
  };
  if (root) traverse(root);
  return list;
};

/**
 * 向指定父节点添加子节点
 */
export const addChildNodeToTree = (
  root: MindNode,
  parentId: string,
  newNode: MindNode
): MindNode => {
  const updateTree = (node: MindNode): MindNode => {
    if (node.id === parentId) {
      return {
        ...node,
        children: [...(node.children || []), newNode]
      };
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map(updateTree)
      };
    }
    return node;
  };
  return updateTree(root);
};

/**
 * 更新指定节点的属性元信息
 */
export const updateNodeInTree = (
  root: MindNode,
  nodeId: string,
  updates: Partial<MindNode>
): MindNode => {
  const updateTree = (node: MindNode): MindNode => {
    if (node.id === nodeId) {
      return { ...node, ...updates };
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map(updateTree)
      };
    }
    return node;
  };
  return updateTree(root);
};

/**
 * 切换节点的折叠展开状态
 */
export const toggleNodeCollapseInTree = (root: MindNode, nodeId: string): MindNode => {
  const toggleTree = (node: MindNode): MindNode => {
    if (node.id === nodeId) {
      return { ...node, collapsed: !node.collapsed };
    }
    if (node.children) {
      return { ...node, children: node.children.map(toggleTree) };
    }
    return node;
  };
  return toggleTree(root);
};

/**
 * 从树中删除指定节点及其子节点，并收集所有被删除的 Markdown 文档路径
 */
export const deleteNodeFromTree = (
  root: MindNode,
  nodeId: string
): { updatedRoot: MindNode; deletedDocPaths: string[] } => {
  const deletedDocPaths: string[] = [];

  const collectDeletedDocs = (node: MindNode) => {
    if (node.docPath) deletedDocPaths.push(node.docPath);
    if (node.children) node.children.forEach(collectDeletedDocs);
  };

  const targetNode = findNodeById(root, nodeId);
  if (targetNode) {
    collectDeletedDocs(targetNode);
  }

  const deleteFromTree = (node: MindNode): MindNode => {
    if (node.children) {
      return {
        ...node,
        children: node.children.filter((child) => child.id !== nodeId).map(deleteFromTree)
      };
    }
    return node;
  };

  return {
    updatedRoot: deleteFromTree(root),
    deletedDocPaths
  };
};
