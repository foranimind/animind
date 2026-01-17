import type { RefObject } from "react";
import type { ChatMessage, TemplateSnippet } from "../../pages/create/types";

type CreateChatPanelProps = {
  messages: ChatMessage[];
  templateSnippets: TemplateSnippet[];
  draft: string;
  canSend: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onInsertTemplate: (template: string) => void;
  chatThreadRef: RefObject<HTMLUListElement>;
  chatThreadWrapRef: RefObject<HTMLDivElement>;
  chatInputBoxRef: RefObject<HTMLDivElement>;
  inputRef: RefObject<HTMLTextAreaElement>;
};

export const CreateChatPanel = ({
  messages,
  templateSnippets,
  draft,
  canSend,
  onDraftChange,
  onSend,
  onInsertTemplate,
  chatThreadRef,
  chatThreadWrapRef,
  chatInputBoxRef,
  inputRef,
}: CreateChatPanelProps) => (
  <main className="create-chat">
    <div className="chat-header">
      <div className="chat-header-main">
        <div className="chat-title">创作助理</div>
        <div className="chat-subtitle">一句话描述场景，系统会在侧栏拆解风格与节奏。</div>
      </div>
      <div className="chat-header-right">
        <div className="chat-meta">
          <span className="meta-pill">Atlas-3 Preview</span>
          <span className="meta-pill">Storyboard</span>
        </div>
        <div className="chat-status">
          <span className="status-dot" aria-hidden="true" />
          在线
        </div>
      </div>
    </div>

    <div className="chat-panel">
      <div className="chat-thread-wrap" ref={chatThreadWrapRef}>
        <ul className="chat-thread" ref={chatThreadRef}>
          {messages.map((message) => (
            <li key={message.id} className={`chat-message chat-message-${message.role}`}>
              <div className="chat-message-content">{message.content}</div>
            </li>
          ))}
        </ul>
        <div className="chat-thread-scroll" aria-hidden="true">
          <div className="chat-thread-scroll-thumb" />
        </div>
      </div>

      <form
        className="chat-input"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <div className="chat-input-field">
          <div className="chat-template-row">
            {templateSnippets.map((snippet) => (
              <button
                key={snippet.id}
                type="button"
                className="chat-template-button"
                onClick={() => onInsertTemplate(snippet.template)}
              >
                {snippet.label}
              </button>
            ))}
          </div>
          <div className="chat-input-box" ref={chatInputBoxRef}>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSend();
                }
              }}
              placeholder="描述你的场景、光线、动作与配乐..."
              rows={3}
            />
            <div className="chat-input-scroll" aria-hidden="true">
              <div className="chat-input-scroll-thumb" />
            </div>
            <button
              type="submit"
              className="send-button"
              disabled={!canSend}
              aria-label="发送"
            >
              <svg className="button-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path
                  d="M4 10h9"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M10 5l5 5-5 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className="chat-input-hint">Enter 发送，Shift + Enter 换行。</div>
        </div>
      </form>
    </div>
  </main>
);
