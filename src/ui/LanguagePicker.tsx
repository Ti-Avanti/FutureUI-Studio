import { useEffect, useRef, useState } from 'react';
import { Check, Languages } from 'lucide-react';
import { selectLanguage, tr, useInterfaceLanguage } from '../i18n';
import type { LanguagePreference } from '../i18n/types';

export function LanguagePicker() {
  const state = useInterfaceLanguage(), [open, setOpen] = useState(false), root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); root.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const options: [LanguagePreference, string][] = [['auto', tr('跟随系统')], ['zh-CN', '简体中文'], ['en', 'English']];
  return <div className="interface-language" ref={root}>
    <button className="icon-button" aria-label={tr('界面语言')} title={tr('界面语言')} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}><Languages size={16}/></button>
    {open && <div className="language-menu" role="menu" aria-label={tr('界面语言')}>
      <strong>{tr('编辑器语言')}</strong>
      {options.map(([value, label]) => <button key={value} role="menuitemradio" aria-checked={state.preference === value} disabled={state.saving} onClick={() => void selectLanguage(value)}><span>{label}</span>{state.preference === value && <Check size={15}/>}</button>)}
      <p>{tr('系统语言：{0}', state.systemLanguage === 'zh-CN' ? tr('简体中文') : 'English')}</p>
      <small>{tr('只切换编辑器界面；菜单预览语言在底部设置。')}</small>
      {state.error && <p className="error-text" role="alert">{state.error}</p>}
    </div>}
  </div>;
}
