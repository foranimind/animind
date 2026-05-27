import "./layout.css";

export const AppLoadingShell = () => (
  <div className="app-loading-shell" role="status" aria-label="正在加载页面">
    <div className="app-loading-shell__panel">
      <p className="app-loading-shell__eyebrow">Animind Studio</p>
      <h1 className="app-loading-shell__title">正在加载页面</h1>
      <p className="app-loading-shell__meta">正在准备欢迎页与创作空间资源。</p>
    </div>
  </div>
);
