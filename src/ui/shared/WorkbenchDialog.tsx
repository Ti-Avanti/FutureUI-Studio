import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function WorkbenchDialog({ title, subtitle, close, busy = false, children }: { title: string; subtitle: string; close(): void; busy?: boolean; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (!busy) close(); return; }
      if ((e.ctrlKey || e.metaKey) && !['a', 'c', 'v', 'x', 'f'].includes(e.key.toLowerCase())) e.stopImmediatePropagation();
      if (e.key !== 'Tab') return;
      const targets = [...panel.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el => el.offsetParent !== null);
      const first = targets[0], last = targets.at(-1);
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard, true);
    return () => { document.removeEventListener('keydown', keyboard, true); if (previous?.isConnected) previous.focus(); };
  }, [busy, close]);
  return <div className="workbench-shade"><div className="workbench-dialog" role="dialog" aria-modal="true" aria-label={title} ref={panel} tabIndex={-1}>
    <header className="workbench-dialog-header"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" aria-label={`关闭${title}`} disabled={busy} onClick={close}><X size={19}/></button></header>
    {children}
  </div></div>;
}
