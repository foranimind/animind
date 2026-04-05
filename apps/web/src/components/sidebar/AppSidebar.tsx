import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { useDismissable } from "../../hooks/useDismissable";
import { useSessions } from "../../hooks/useSessions";
import { createNewSession, ensureDraftSession } from "../../lib/sessionActions";
import {
  findLatestDraftSessionDetail,
  getActiveSessionId,
  getDraftSessionDetail,
  hasMeaningfulDraftContent,
  listEmptySessions,
  removeSession,
  renameSession,
  setActiveSessionId,
  setSessionPinned,
  touchSession,
} from "../../lib/storage";
import { resolveSessionHref } from "../../lib/sessionRouting";
import { SidebarSessionItem } from "./SidebarSessionItem";
import "./sidebar.css";

const SIDEBAR_COLLAPSE_KEY = "foranimind.sidebarCollapsed";

export const AppSidebar = () => {
  const { items } = useSessions();
  const location = useLocation();
  const navigate = useNavigate();
  const activeSessionId = getActiveSessionId();
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [isDraftResetOpen, setIsDraftResetOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof localStorage === "undefined") {
      return false;
    }
    return localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1";
  });

  useDismissable({
    enabled: Boolean(menuOpenId),
    refs: menuRef,
    onDismiss: () => setMenuOpenId(null),
  });

  useEffect(() => {
    if (activeSessionId) {
      return;
    }
    ensureDraftSession();
  }, [activeSessionId, items]);

  const handleNewProject = () => {
    const emptySessions = listEmptySessions();
    emptySessions.forEach((session) => removeSession(session.id));
    const currentDraft = getDraftSessionDetail() ?? findLatestDraftSessionDetail();
    if (currentDraft && hasMeaningfulDraftContent(currentDraft)) {
      setIsDraftResetOpen(true);
      return;
    }
    setMenuOpenId(null);
    setRenamingId(null);
    ensureDraftSession();
    navigate("/studio");
  };

  const handleConfirmDraftReset = () => {
    const currentDraft = getDraftSessionDetail() ?? findLatestDraftSessionDetail();
    if (currentDraft) {
      removeSession(currentDraft.id);
    }
    setIsDraftResetOpen(false);
    setMenuOpenId(null);
    setRenamingId(null);
    createNewSession();
    navigate("/studio");
  };

  const handleSessionSelect = (sessionId: string) => {
    const session = items.find((entry) => entry.id === sessionId);
    if (!session) {
      return;
    }
    touchSession(sessionId);
    setActiveSessionId(sessionId);
    navigate(resolveSessionHref({ status: session.status, jobId: session.jobId }));
  };

  const resolveNextSessionId = (targetId: string) => {
    const index = items.findIndex((session) => session.id === targetId);
    if (index < 0) {
      return null;
    }
    return items[index + 1]?.id ?? items[index - 1]?.id ?? null;
  };

  const handleRemoveSession = (sessionId: string) => {
    if (activeSessionId === sessionId) {
      const nextId = resolveNextSessionId(sessionId);
      if (nextId) {
        setActiveSessionId(nextId);
      }
    }
    removeSession(sessionId);
  };

  const handleSessionKeyDown = (sessionId: string, event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSessionSelect(sessionId);
    }
  };

  const handleOpenDetail = (
    session: { status: "draft" | "queued" | "running" | "done" | "error" | "canceled"; jobId?: string },
    event: ReactMouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();
    navigate(resolveSessionHref(session));
  };

  const startRename = (sessionId: string, title: string) => {
    setMenuOpenId(null);
    setRenamingId(sessionId);
    setRenameValue(title);
  };

  const commitRename = (sessionId: string) => {
    if (renamingId !== sessionId) {
      return;
    }
    const trimmed = renameValue.trim();
    if (trimmed) {
      renameSession(sessionId, trimmed);
    }
    setRenamingId(null);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? "1" : "0");
      }
      return next;
    });
  };

  const pathname = location.pathname;
  const isJobRoute = pathname.startsWith("/jobs/");
  const isDeliveryRoute = pathname.startsWith("/works/");
  const isCreateNavActive = pathname === "/studio" || isJobRoute || isDeliveryRoute;
  const routeSessionId = (() => {
    if (!isJobRoute && !isDeliveryRoute) {
      return null;
    }
    const rawJobId = pathname.split("/")[2];
    if (!rawJobId) {
      return null;
    }
    const jobId = decodeURIComponent(rawJobId);
    return items.find((item) => item.jobId === jobId)?.id ?? null;
  })();
  const highlightedSessionId =
    isJobRoute || isDeliveryRoute ? routeSessionId : null;
  const resolvedHighlightedSessionId = items.some((item) => item.id === highlightedSessionId)
    ? highlightedSessionId
    : null;

  return (
    <aside className={`app-sidebar ${isCollapsed ? "collapsed" : ""}`} aria-label="工作室导航">
      <div className="sidebar-rail-header">
        <div className="sidebar-user" title="当前用户">
          <div className="sidebar-avatar" aria-hidden="true" />
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">当前用户</div>
            <div className="sidebar-user-meta">Genesis Studio</div>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-new"
          onClick={handleNewProject}
          aria-label="新建项目"
          title="新建项目"
        >
          <span className="sidebar-new-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <path
                d="M10 4v12M4 10h12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="sidebar-new-label">新建项目</span>
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="主导航">
        <NavLink
          end
          to="/studio"
          className={() => `sidebar-link ${isCreateNavActive ? "active" : ""}`}
          aria-label="创作"
          title="创作"
          onClick={() => {
            setMenuOpenId(null);
            setRenamingId(null);
            ensureDraftSession();
          }}
        >
          <span className="sidebar-link-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <path
                d="M4 5.5h12v7H7l-3 3z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="sidebar-link-label">创作</span>
        </NavLink>
        <NavLink
          end
          to="/works"
          className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
          aria-label="我的作品"
          title="我的作品"
        >
          <span className="sidebar-link-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <path
                d="M4 5.5h12v9H4z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path
                d="M6.5 12l2.2-2.4 2.4 2.6 2-2.2 2.4 2.8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="sidebar-link-label">我的作品</span>
        </NavLink>
      </nav>

      <section className="sidebar-session-region" aria-label="最近项目">
        <div className="sidebar-list-header">最近项目</div>
        <div className={`sidebar-list-body ui-scrollbar${menuOpenId ? " menu-open" : ""}`}>
          {items.length === 0 ? (
            <div className="sidebar-empty">暂无项目</div>
          ) : (
            items.map((session) => {
              const isActive = resolvedHighlightedSessionId === session.id;
              const isMenuOpen = menuOpenId === session.id;
              const isRenaming = renamingId === session.id;
              const statusClass =
                session.status === "error"
                  ? "session-status-error"
                  : session.status === "canceled"
                    ? "session-status-canceled"
                  : session.status === "running" || session.status === "queued"
                    ? "session-status-running"
                  : session.status === "done"
                      ? "session-status-done"
                      : "";
              const titleNode = isRenaming ? (
                <input
                  className="session-title-input"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.stopPropagation();
                      commitRename(session.id);
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      cancelRename();
                    }
                  }}
                  onBlur={() => commitRename(session.id)}
                  autoFocus
                />
              ) : (
                <div
                  className="session-title"
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    startRename(session.id, session.title);
                  }}
                >
                  {session.title}
                </div>
              );
              const menuNode = (
                <div
                  ref={(node) => {
                    if (isMenuOpen) {
                      menuRef.current = node;
                    }
                  }}
                >
                  <button
                    type="button"
                    className="session-action-button"
                    aria-label="更多操作"
                    aria-expanded={isMenuOpen}
                    aria-haspopup="menu"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setMenuOpenId((prev) => (prev === session.id ? null : session.id));
                    }}
                  >
                    <span className="session-action-icon" aria-hidden="true">
                      <svg viewBox="0 0 20 20">
                        <circle cx="5" cy="10" r="1.4" fill="currentColor" />
                        <circle cx="10" cy="10" r="1.4" fill="currentColor" />
                        <circle cx="15" cy="10" r="1.4" fill="currentColor" />
                      </svg>
                    </span>
                  </button>
                  {isMenuOpen ? (
                    <div
                      className="session-menu open"
                      role="menu"
                    >
                      <button
                        type="button"
                        className="session-menu-item"
                        role="menuitem"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          startRename(session.id, session.title);
                        }}
                      >
                        重命名
                      </button>
                      <button
                        type="button"
                        className="session-menu-item"
                        role="menuitem"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setMenuOpenId(null);
                          setSessionPinned(session.id, !session.pinned);
                        }}
                      >
                        {session.pinned ? "取消置顶" : "置顶"}
                      </button>
                      <button
                        type="button"
                        className="session-menu-item"
                        role="menuitem"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setMenuOpenId(null);
                          handleRemoveSession(session.id);
                        }}
                      >
                        删除
                      </button>
                    </div>
                  ) : null}
                </div>
              );

              return (
                <SidebarSessionItem
                  key={session.id}
                  title={session.title}
                  isActive={isActive}
                  isMenuOpen={isMenuOpen}
                  statusClass={statusClass}
                  pinned={Boolean(session.pinned)}
                  showOpenDetail={session.status === "done" && Boolean(session.jobId)}
                  titleNode={titleNode}
                  actions={menuNode}
                  onSelect={() => handleSessionSelect(session.id)}
                  onKeyDown={(event) => handleSessionKeyDown(session.id, event)}
                  onOpenDetail={(event) => handleOpenDetail(session, event)}
                />
              );
            })
          )}
        </div>
      </section>

      {isDraftResetOpen ? (
        <div className="project-reset-dialog" role="dialog" aria-modal="true" aria-label="开始新的草稿">
          <button
            type="button"
            className="project-reset-overlay"
            aria-label="关闭新建草稿提示"
            onClick={() => setIsDraftResetOpen(false)}
          />
          <div className="project-reset-panel">
            <div className="project-reset-title">开始新的草稿</div>
            <p className="project-reset-copy">
              当前创作台里还有未提交的内容。继续新建会清空它，并切换到一张新的空白草稿。
            </p>
            <div className="project-reset-actions">
              <button
                type="button"
                className="ui-button ui-button-ghost project-reset-cancel"
                onClick={() => setIsDraftResetOpen(false)}
              >
                继续编辑
              </button>
              <button
                type="button"
                className="ui-button ui-button-primary project-reset-confirm"
                onClick={handleConfirmDraftReset}
              >
                新建草稿
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-collapse"
          onClick={toggleCollapsed}
          aria-label={isCollapsed ? "展开侧栏" : "收起侧栏"}
          data-tooltip={isCollapsed ? "展开侧栏" : "收起侧栏"}
        >
          <span className="sidebar-collapse-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <path
                d="M4 6h12M4 10h12M4 14h12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </button>
      </div>
    </aside>
  );
};
