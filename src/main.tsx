import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// 启动时恢复用户持久化的窗口主题（'light' | 'dark'，未设置则跟随系统外观）
try {
  const saved = localStorage.getItem("docmind-theme");
  if (saved === "light" || saved === "dark") {
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) =>
      getCurrentWindow().setTheme(saved).catch(() => {})
    );
  }
} catch {
  /* 非 Tauri 环境忽略 */
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
