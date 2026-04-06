import type { KeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";

type SidebarSessionItemProps = {
  title: string;
  isActive: boolean;
  isMenuOpen: boolean;
  statusClass: string;
  pinned: boolean;
  showOpenDetail: boolean;
  titleNode: ReactNode;
  actions: ReactNode;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onOpenDetail?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
};

export const SidebarSessionItem = ({
  title,
  isActive,
  isMenuOpen,
  statusClass,
  pinned,
  showOpenDetail,
  titleNode,
  actions,
  onSelect,
  onKeyDown,
  onOpenDetail,
}: SidebarSessionItemProps) => (
  <div
    role="button"
    tabIndex={0}
    title={title}
    aria-label={title}
    className={`session-item ${statusClass} ${isActive ? "active" : ""}${isMenuOpen ? " menu-open" : ""}`}
    style={isMenuOpen ? { overflow: "visible" } : undefined}
    onClick={onSelect}
    onKeyDown={onKeyDown}
  >
    <div className="session-main">
      <span className="session-dot" aria-hidden="true" />
      {pinned ? <span className="session-pin" aria-label="置顶" /> : null}
      {titleNode}
    </div>
    <div className="session-actions">
      {showOpenDetail && onOpenDetail ? (
        <button type="button" className="session-open" aria-label="打开详情" onClick={onOpenDetail}>
          查看
        </button>
      ) : null}
      {actions}
    </div>
  </div>
);
