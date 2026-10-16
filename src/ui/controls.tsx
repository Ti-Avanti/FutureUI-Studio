import { tr, useInterfaceLanguage } from '../i18n';
import { RotateCcw, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

export function IconButton({ icon: Icon, title, onClick, active, disabled, className = '' }: { icon: LucideIcon; title: string; onClick?: () => void; active?: boolean; disabled?: boolean; className?: string }) {
  useInterfaceLanguage();
  return <button type="button" className={`icon-button ${active ? 'active' : ''} ${className}`} title={title} aria-label={title} onClick={onClick} disabled={disabled}><Icon size={16} strokeWidth={1.6}/></button>;
}
export function Field({ label, value, onChange, numeric = false, options, wide = false, reset }: { label: string; value: any; onChange: (value: any) => void; numeric?: boolean; options?: string[]; wide?: boolean; reset?: () => void }) {
  useInterfaceLanguage();
  const [draft, setDraft] = useState(String(value ?? ''));
  useEffect(() => setDraft(String(value ?? '')), [value]);
  function submit() { if (draft !== String(value ?? '')) onChange(numeric && /^-?\d+(\.\d+)?$/.test(draft) ? Number(draft) : draft); }
  return <label className={`field ${wide ? 'wide' : ''}`}><span>{label}{reset && <button type="button" onClick={e => { e.preventDefault(); reset(); }} title={tr("恢复默认值")}><RotateCcw size={11}/></button>}</span>{options ? <div className="select-wrap"><select aria-label={label} value={String(value ?? '')} onChange={e => onChange(e.target.value)}><option value="">{tr("默认")}</option>{[...new Set([...options, ...(value && !options.includes(String(value)) ? [String(value)] : [])])].map(v => <option key={v} value={v}>{v}</option>)}</select><ChevronDown size={11}/></div> : <input aria-label={label} value={draft} placeholder={tr("自动")} onChange={e => setDraft(e.target.value)} onBlur={submit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setDraft(String(value ?? '')); }}/>}</label>;
}
export function Section({ title, children, detail }: { title: string; children: React.ReactNode; detail?: string }) {
  useInterfaceLanguage();
  return <section className="property-section"><div className="section-title"><span>{title}</span>{detail && <span className="muted">{detail}</span>}</div>{children}</section>;
}
