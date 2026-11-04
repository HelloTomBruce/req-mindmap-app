import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyThemeToDOM, getInitialTheme } from "./context/ThemeContext";

// 启动时立即恢复持久化的主题，防止首屏闪白
applyThemeToDOM(getInitialTheme());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
