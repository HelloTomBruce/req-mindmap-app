/**
 * 容错的 URI 解码：链接 href 可能携带畸形百分号序列（如 "100%off.md"），
 * 裸调 decodeURIComponent 会抛 URIError——渲染期抛错将导致整棵 React 树卸载白屏，
 * 故解码失败时原样返回。
 */
export const safeDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
