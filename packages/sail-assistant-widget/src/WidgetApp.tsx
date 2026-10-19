import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { remarkBrToBreak } from './markdownBreaks';
import type { Message, WidgetSession } from './widgetSession';

export interface WidgetLabels {
  title: string;
  subtitle?: string;
  launcher: string;
  placeholder: string;
  intro: string;
}

interface Props {
  session: WidgetSession;
  labels: WidgetLabels;
  /** id prefix so two widgets on one page (never intended, but possible) cannot collide on aria ids. */
  uid: string;
}

function Citations({ items }: { items: NonNullable<Message['citations']> }) {
  if (!items.length) return null;
  const seen = new Set<string>();
  const unique = items.filter((c) => {
    const k = `${c.manual}§${c.section}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return (
    <div className="sa-cite">
      <span className="sa-cite-label">Sources</span>
      <ul>
        {unique.map((c) => (
          <li key={`${c.manual}§${c.section}`}>
            <span className="sa-cite-manual">{c.manual}</span>
            {c.section ? <span className="sa-cite-section"> — {c.section}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bubble({ m }: { m: Message }) {
  if (m.role === 'user') {
    return <div className="sa-msg sa-user"><div className="sa-bubble">{m.content}</div></div>;
  }
  return (
    <div className={`sa-msg sa-bot${m.error ? ' sa-err' : ''}`}>
      <div className="sa-bubble">
        {m.error ? <p>{m.content}</p> : (
          <div className="sa-md">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBrToBreak]}
              components={{
                table: ({ node: _n, ...p }) => <div className="sa-table-wrap" tabIndex={0}><table {...p} /></div>,
                a: ({ node: _n, ...p }) => <a {...p} target="_blank" rel="noopener noreferrer" />,
              }}
            >
              {m.content}
            </ReactMarkdown>
          </div>
        )}
        {m.citations && m.citations.length > 0 ? <Citations items={m.citations} /> : null}
      </div>
    </div>
  );
}

export function WidgetApp({ session, labels, uid }: Props) {
  const s = useSyncExternalStore((cb) => session.subscribe(cb), () => session.getState());
  const [draft, setDraft] = useState('');
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  // Focus: into the input when the panel opens, back to the launcher when it closes.
  useEffect(() => {
    if (s.open && !wasOpen.current) inputRef.current?.focus();
    if (!s.open && wasOpen.current) launcherRef.current?.focus();
    wasOpen.current = s.open;
  }, [s.open]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [s.messages.length, s.pending]);

  // A session reset (module / vessel / user / tenant change) also discards the half-typed question.
  const ctxKey = `${s.context.module}|${s.context.vesselId ?? ''}|${s.context.userKey ?? ''}|${s.context.tenantKey ?? ''}`;
  useEffect(() => setDraft(''), [ctxKey]);

  const submit = useCallback((text: string) => {
    if (!text.trim() || s.pending) return;
    void session.send(text);
    setDraft('');
  }, [session, s.pending]);

  if (!s.signedIn) return null;

  const panelId = `${uid}-panel`;
  const titleId = `${uid}-title`;
  const showSuggestions = s.messages.length === 0 && !!s.suggestions && s.suggestions.length > 0;

  return (
    <div className="sa-root" onKeyDown={(e) => {
      if (e.key === 'Escape' && s.open) { e.stopPropagation(); session.setOpen(false); }
    }}>
      {s.open ? (
        <section id={panelId} className="sa-panel" role="dialog" aria-modal="false" aria-labelledby={titleId}>
          <header className="sa-head">
            <div className="sa-head-text">
              <h2 id={titleId} className="sa-title">{labels.title}</h2>
              {labels.subtitle || s.context.vesselName ? (
                <p className="sa-sub">{[labels.subtitle, s.context.vesselName].filter(Boolean).join(' · ')}</p>
              ) : null}
            </div>
            <button type="button" className="sa-icon-btn" onClick={() => session.newChat()} aria-label="Start a new chat"
                    title="New chat" disabled={s.messages.length === 0 && !s.pending}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            </button>
            <button type="button" className="sa-icon-btn" onClick={() => session.setOpen(false)} aria-label="Close assistant" title="Close">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>

          <div className="sa-list" ref={listRef} role="log" aria-live="polite" aria-relevant="additions" aria-busy={s.pending}>
            {s.messages.length === 0 ? (
              <div className="sa-empty">
                <p>{labels.intro}</p>
                {s.suggestionsLoading ? <p className="sa-muted" aria-live="polite">Loading suggestions…</p> : null}
                {showSuggestions ? (
                  <div className="sa-sugg" role="group" aria-label="Suggested questions">
                    {s.suggestions!.map((q) => (
                      <button key={q} type="button" className="sa-chip" onClick={() => submit(q)} disabled={s.pending}>{q}</button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : s.messages.map((m) => <Bubble key={m.id} m={m} />)}
            {s.pending ? (
              <div className="sa-msg sa-bot" aria-label="The assistant is answering">
                <div className="sa-bubble sa-typing"><span /><span /><span /><span className="sa-vh">The assistant is answering…</span></div>
              </div>
            ) : null}
            {s.retryable && !s.pending ? (
              <div className="sa-retry"><button type="button" className="sa-link" onClick={() => session.retry()}>Try again</button></div>
            ) : null}
          </div>

          <form className="sa-form" onSubmit={(e) => { e.preventDefault(); submit(draft); }}>
            <label htmlFor={`${uid}-input`} className="sa-vh">Your question</label>
            <textarea
              id={`${uid}-input`}
              ref={inputRef}
              className="sa-input"
              rows={1}
              maxLength={2000}
              value={draft}
              placeholder={labels.placeholder}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(draft); }
              }}
            />
            <button type="submit" className="sa-send" disabled={!draft.trim() || s.pending} aria-label="Send question">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2-7-8-1z" /></svg>
            </button>
          </form>
        </section>
      ) : null}

      <button
        ref={launcherRef}
        type="button"
        className="sa-launcher"
        aria-label={s.open ? 'Close assistant' : labels.launcher}
        aria-expanded={s.open}
        aria-controls={s.open ? panelId : undefined}
        onClick={() => session.setOpen(!s.open)}
      >
        {s.open
          ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z" /></svg>}
      </button>
    </div>
  );
}
