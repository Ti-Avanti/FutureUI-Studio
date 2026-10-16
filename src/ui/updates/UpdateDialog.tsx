import { useEffect, useRef } from 'react';
import { ArrowDownToLine, BellRing, CheckCircle2, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react';
import Markdown from 'react-markdown';
import { useUpdates } from '../../updates/store';
import { dirtyFiles, useStudio } from '../../state/store';
import { useAgent } from '../../agent/store';
import type { UpdateState } from '../../updates/types';

const distributionLabels = { installed: '安装版', portable: '便携版', directory: '未安装版本', development: '开发版本', unsupported: '当前平台' };
const unsupportedHelp = {
  portable: '当前使用便携版。请从发布页安装一次安装版，之后即可在这里接收提醒并手动更新。',
  directory: '当前直接运行程序目录。请先使用安装包安装编辑器，之后即可在这里更新。',
  development: '开发版本不会连接更新服务。安装版会提供新版提醒、下载和重启安装。',
  unsupported: '当前平台暂未提供应用内更新，可在发布页查看可用安装包。',
  installed: '',
};

function statusLabel(state: UpdateState | null) {
  if (!state) return '正在读取版本信息';
  switch (state.phase) {
    case 'checking': return '正在检查新版本';
    case 'current': return '已是最新版本';
    case 'available': return `发现新版本 ${state.nextVersion}`;
    case 'downloading': return state.cancelling ? '正在取消下载' : `正在下载 ${state.nextVersion}`;
    case 'downloaded': return '更新已下载，等待你安装';
    case 'installing': return '正在安装，完成后将自动启动';
    case 'error': return '更新操作未完成';
    case 'unsupported': return '请使用安装版更新';
    default: return '随时检查新版本';
  }
}

const bytes = (value: number) => value >= 1048576 ? `${(value / 1048576).toFixed(1)} MB` : `${Math.round(value / 1024)} KB`;

export function UpdateLauncher() {
  const { state, show } = useUpdates();
  const available = !!state?.nextVersion;
  return <button className={`secondary-button update-launcher ${available ? 'has-update' : ''}`} title={statusLabel(state)} onClick={() => void show()}>
    <ArrowDownToLine size={14}/><span>{available ? '有更新' : '更新'}</span>{available && <i className="update-dot"/>}
  </button>;
}

function UpdateNotice() {
  const u = useUpdates(), state = u.state;
  if (u.open || !state || state.phase !== 'available' || state.nextVersion === u.dismissedVersion) return null;
  return <aside className="update-notice" role="status" aria-live="polite">
    <img src="./studio-icon.png" width="38" height="38" alt=""/>
    <div><strong>FutureUI Studio {state.nextVersion} 已发布</strong><p>查看更新内容，由你决定何时更新。</p><div className="update-notice-actions"><button className="primary-button" onClick={() => void u.show()}>查看更新</button><button className="secondary-button" onClick={u.dismissNotice}>稍后提醒</button></div></div>
    <button className="icon-button" title="暂时关闭更新提醒" onClick={u.dismissNotice}><X size={14}/></button>
  </aside>;
}

export function UpdateDialog() {
  const u = useUpdates(), studio = useStudio(), agent = useAgent();
  const panel = useRef<HTMLDivElement>(null), state = u.state;
  const locked = u.preparing || state?.phase === 'installing';
  const agentBusy = agent.sessions.some(session => session.running);
  const dirtyCount = dirtyFiles(studio).length;
  useEffect(() => { void useUpdates.getState().initialize(); }, []);
  useEffect(() => {
    if (!u.open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); if (!locked) useUpdates.getState().close(); }
      if (event.key !== 'Tab') return;
      const targets = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]') ?? [])];
      const first = targets[0], last = targets.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard, true);
    return () => { document.removeEventListener('keydown', keyboard, true); if (previous?.isConnected) previous.focus(); };
  }, [u.open, locked]);

  const busy = ['checking', 'downloading', 'installing'].includes(state?.phase ?? '') || u.preparing;
  const installed = state?.distribution === 'installed';
  const canDownload = state?.phase === 'available' || state?.phase === 'error' && !!state.nextVersion;
  return <><UpdateNotice/>{u.open && <div className="update-shade" onClick={() => !locked && u.close()}>
    <div className="update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-title" ref={panel} tabIndex={-1} onClick={event => event.stopPropagation()}>
      <header className="update-header"><img src="./studio-icon.png" width="56" height="56" alt="FutureUI Studio 图标"/><div><h2 id="update-title">FutureUI Studio</h2><p>版本 {state?.currentVersion ?? '…'}<span>·</span>{state ? distributionLabels[state.distribution] : '软件更新'}</p></div><button className="icon-button" title="关闭更新窗口" disabled={locked} onClick={u.close}><X size={18}/></button></header>
      <div className="update-status" aria-live="polite">{busy ? <Loader2 className="update-spinner" size={21}/> : state?.phase === 'current' ? <CheckCircle2 size={21}/> : <BellRing size={21}/>}<div><strong>{u.preparing ? '正在保存工程与 Agent 会话' : statusLabel(state)}</strong><p>{installed ? '更新需要你手动点击，关闭编辑器也不会自动安装。' : state ? unsupportedHelp[state.distribution] : '正在载入更新设置。'}</p></div></div>
      {state?.phase === 'downloading' && <div className="update-download"><progress aria-label="更新下载进度" max="100" value={state.percent}/><div><span>{state.percent.toFixed(1)}%</span><span>{bytes(state.transferred)}{state.total ? ` / ${bytes(state.total)}` : ''} · {bytes(state.bytesPerSecond)}/s</span></div></div>}
      {state?.nextVersion && <section className="update-release"><div className="update-section-label"><strong>更新内容 · {state.nextVersion}</strong>{state.releaseDate && Number.isFinite(Date.parse(state.releaseDate)) && <span>{new Date(state.releaseDate).toLocaleDateString()}</span>}</div><div className="update-notes"><Markdown skipHtml allowedElements={['p','strong','em','ul','ol','li','h1','h2','h3','h4','code','pre','blockquote','hr','br','a']} components={{a:({children}) => <span>{children}</span>}}>{state.releaseNotes || '此版本暂未提供更新说明。'}</Markdown></div></section>}
      {installed && <label className="update-preference"><input type="checkbox" checked={state?.autoCheck ?? false} disabled={locked} onChange={event => void u.autoCheck(event.target.checked)}/><span>启动时及运行期间自动检查新版本</span></label>}
      {installed && <p className="update-hint">优先增量下载；无法使用增量时自动下载完整安装包。安装完成后自动启动，并重新打开上次的工程。</p>}
      {state?.phase === 'downloaded' && agentBusy && <p className="update-warning">Agent 仍在执行任务。完成或停止任务后即可安装。</p>}
      {(u.error || state?.error) && <p className="update-error" role="alert">{u.error || state?.error}</p>}
      <footer className="update-actions">
        <button className="update-release-link" disabled={!state?.releaseUrl || locked} onClick={() => void u.openRelease()}><ExternalLink size={13}/>发布页</button>
        <span className="spacer"/>
        {state?.phase === 'downloading' ? <button className="secondary-button" disabled={state.cancelling} onClick={() => void u.cancel()}>取消下载</button> : installed && state?.phase !== 'downloaded' && <button className="secondary-button" disabled={busy} onClick={() => void u.check()}><RefreshCw size={13}/>检查更新</button>}
        {canDownload && <button className="primary-button" disabled={busy} onClick={() => void u.download()}><ArrowDownToLine size={14}/>{state?.phase === 'error' ? '重新下载' : '下载更新'}</button>}
        {state?.phase === 'downloaded' && <button className="primary-button" disabled={locked || studio.busy || agentBusy} onClick={() => void u.install()}>{dirtyCount ? '保存并重启安装' : '重启并安装'}</button>}
      </footer>
      {state?.lastChecked && <div className="update-checked">上次检查：{new Date(state.lastChecked).toLocaleString()}</div>}
    </div>
  </div>}</>;
}
