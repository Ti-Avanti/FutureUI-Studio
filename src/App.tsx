import { tr, useInterfaceLanguage } from './i18n';
import { useEffect, useRef, useState } from 'react';
import { DockviewReact, type DockviewReadyEvent, type DockviewApi, type IDockviewPanelProps, themeDark } from 'dockview-react';
import { FolderOpen, Save, Undo2, Redo2, Command, ChevronDown, FileCode2, X, PencilRuler, Workflow, Clapperboard, Database, Images, Package, PanelsTopLeft, CircleHelp, Plus, AlertCircle, CheckCircle2, Monitor, Sparkles, FileInput, History } from 'lucide-react';
import { useStudio, dirtyFiles } from './state/store';
import { PreviewProvider, usePreview } from './ui/context';
import { Explorer, Layers } from './ui/Explorer';
import { Inspector } from './ui/Inspector';
import { CanvasView } from './ui/CanvasView';
import { BottomPanel } from './ui/BottomPanel';
import { Actions } from './ui/Actions';
import { Assets } from './ui/Assets';
import { DataWorkspace } from './ui/DataWorkspace';
import { Publish } from './ui/Publish';
import { IconButton } from './ui/controls';
import { shortName } from './model/documents';
import type { Workspace } from './model/types';
import { plain } from './preview/text';
import { AgentPanel } from './ui/agent/AgentPanel';
import { useAgent } from './agent/store';
import { useUpdates } from './updates/store';
import { UpdateDialog, UpdateLauncher } from './ui/updates/UpdateDialog';
import { TransferDialog } from './ui/transfer/TransferDialog';
import { useTransfer } from './transfer/store';
import { HistoryDialog } from './ui/history/HistoryDialog';
import { useHistoryDialog } from './history/store';
import { LanguagePicker } from './ui/LanguagePicker';

function DocumentPane({api}:IDockviewPanelProps){
  useInterfaceLanguage();const s=useStudio(),preview=usePreview();return <div className="document-pane"><div className="file-tabs">{s.tabs.map(path=><div className={`document-tab ${s.active===path?'active':''}`} key={path}><button onClick={()=>s.openFile(path)} title={path}><FileCode2 size={13}/>{shortName(path)}.yml{dirtyFiles(s).some(f=>f.path===path)&&<span className="unsaved-dot"/>}</button><button aria-label={tr("关闭 {0} 标签", shortName(path))} onClick={()=>{const tabs=s.tabs.filter(p=>p!==path);if(tabs.length)s.set({tabs,active:s.active===path?tabs.at(-1)!:s.active,selected:null});}}><X size={11}/></button></div>)}</div>{s.workspace==='interaction'?<Actions/>:s.workspace==='data'?<DataWorkspace/>:s.workspace==='assets'?<Assets expanded/>:s.workspace==='publish'?<Publish/>:<><div className="document-breadcrumb"><span>{s.active.split('/').slice(0,-1).join(' / ')}</span><span>›</span><strong>{plain(preview.title)||shortName(s.active)}</strong><span className="spacer"/><span className="tiny-tag">{s.locale}</span></div><CanvasView onFocus={()=>api.isMaximized()?api.exitMaximized():api.maximize()}/></>}</div>;}
const components={explorer:Explorer,layers:Layers,document:DocumentPane,inspector:Inspector,bottom:BottomPanel,agent:AgentPanel};


export default function App(){
  const interfaceLanguage = useInterfaceLanguage(s => s.language);
  const workspaces:[Workspace,string,any][]=[['design',tr("设计"),PencilRuler],['interaction',tr("交互"),Workflow],['motion',tr("动效"),Clapperboard],['data',tr("数据与语言"),Database],['assets',tr("资源"),Images],['publish',tr("发布"),Package]];

  const s=useStudio(),[menu,setMenu]=useState<string|null>(null),[palette,setPalette]=useState(false),[search,setSearch]=useState('');
  const updater=useUpdates();
  const api=useRef<DockviewApi|null>(null),disposed=useRef<(()=>void)|null>(null);
  const changed=dirtyFiles(s),loading=useRef(false);
  useEffect(()=>{if(loading.current)return;loading.current=true;window.studio.bootstrap().then(s.load).catch(e=>s.set({error:e.message}));},[]);
  useEffect(()=>{window.studio.dirty(changed.length>0);},[changed.length]);
  useEffect(()=>{if(!s.notice)return;const timer=setTimeout(()=>s.set({notice:''}),6500);return()=>clearTimeout(timer);},[s.notice]);
  async function projectAction(action:'open'|'create'|'refresh'){
    const state=useStudio.getState();if(dirtyFiles(state).length&&!window.confirm(tr("尚有未保存的修改。放弃这些修改并切换工程？")))return;
    try{state.set({busy:true,error:''});const result=action==='refresh'&&state.project?await window.studio.refresh(state.project.id):action==='create'?await window.studio.create():await window.studio.open();if(result)state.load(result);}catch(e){state.set({error:(e as Error).message});}finally{state.set({busy:false});}
  }
  function resetLayout(dock:DockviewApi){
    dock.clear();dock.addPanel({id:'document',component:'document',title:tr("工作区"),minimumWidth:400});
    dock.addPanel({id:'inspector',component:'inspector',title:tr("属性"),position:{referencePanel:'document',direction:'right'},initialWidth:282,minimumWidth:230});
    dock.addPanel({id:'explorer',component:'explorer',title:tr("项目"),position:{referencePanel:'document',direction:'left'},initialWidth:238,minimumWidth:190});
    dock.addPanel({id:'layers',component:'layers',title:tr("图层"),position:{referencePanel:'explorer',direction:'below'},initialHeight:320,minimumHeight:100});
    dock.addPanel({id:'bottom',component:'bottom',title:tr("面板"),position:{referencePanel:'document',direction:'below'},initialHeight:150,minimumHeight:110});
    dock.getPanel('document')?.api.setActive();
  }
  function syncPanelTitles(dock:DockviewApi){ for(const [id,title] of Object.entries({document:tr('工作区'),inspector:tr('属性'),explorer:tr('项目'),layers:tr('图层'),bottom:tr('面板'),agent:'Agent'}))dock.getPanel(id)?.api.setTitle(title); }
  useEffect(()=>{if(api.current)syncPanelTitles(api.current);},[interfaceLanguage]);
  function ready(event:DockviewReadyEvent){api.current=event.api;try{const saved=localStorage.getItem('studio.layout.v2');if(saved){event.api.fromJSON(JSON.parse(saved));if(!event.api.getPanel('document'))throw Error();}else resetLayout(event.api);}catch{resetLayout(event.api);}syncPanelTitles(event.api);disposed.current=()=>{};const listener=event.api.onDidLayoutChange(()=>localStorage.setItem('studio.layout.v2',JSON.stringify(event.api.toJSON())));disposed.current=()=>listener.dispose();}
  useEffect(()=>()=>disposed.current?.(),[]);
  function openAgent(){const dock=api.current;if(!dock)return;dock.getPanel('document')?.api.exitMaximized();let panel=dock.getPanel('agent');if(!panel)panel=dock.addPanel({id:'agent',component:'agent',title:'Agent',minimumWidth:330,initialWidth:360,position:dock.getPanel('inspector')?{referencePanel:'inspector',direction:'within'}:{referencePanel:'document',direction:'right'}});panel.api.setActive();}
  useEffect(()=>{window.addEventListener('studio:agent',openAgent);return()=>window.removeEventListener('studio:agent',openAgent);},[]);

  const fileCommands=[
    {name:tr("打开 FutureUI 工程"),hint:'Ctrl+O',action:()=>projectAction('open')},
    {name:tr("新建工作工程"),hint:'',action:()=>projectAction('create')},
    {name:tr("保存全部修改"),hint:'Ctrl+S',action:s.save},
    {name:tr("导入 / 合并配置"),hint:'Ctrl+Shift+I',action:()=>useTransfer.getState().show('import')},
    {name:tr("快捷导出配置"),hint:'Ctrl+Shift+E',action:()=>useTransfer.getState().show('export')},
    {name:tr("重新读取磁盘文件"),hint:'',action:()=>projectAction('refresh')},
  ];
  const editCommands=[{name:tr("撤销"),hint:'Ctrl+Z',action:s.undo},{name:tr("重做"),hint:'Ctrl+Shift+Z',action:s.redo},{name:tr("操作节点与回退"),hint:'Ctrl+Alt+H',action:()=>useHistoryDialog.getState().show()},{name:tr("复制选中组件"),hint:'Ctrl+D',action:s.duplicate},{name:tr("删除选中组件"),hint:'Delete',action:s.remove}];
  const windowCommands=[{name:tr("重置工作区布局"),hint:'',action:()=>api.current&&resetLayout(api.current)},{name:tr("打开发布面板"),hint:'',action:()=>s.set({workspace:'publish'})}];
  const commands=[...fileCommands,...editCommands,...windowCommands,{name:tr("添加纵向容器"),hint:'',action:()=>s.add('column')},{name:tr("添加横向容器"),hint:'',action:()=>s.add('row')}];
  useEffect(()=>{const listener=(e:KeyboardEvent)=>{if(document.querySelector('.workbench-dialog'))return;const typing=(e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true],.monaco-editor');const mod=e.ctrlKey||e.metaKey;if(mod&&e.shiftKey&&e.key.toLowerCase()==='i'){e.preventDefault();useTransfer.getState().show('import');}else if(mod&&e.shiftKey&&e.key.toLowerCase()==='e'){e.preventDefault();useTransfer.getState().show('export');}else if(mod&&e.altKey&&e.key.toLowerCase()==='h'){e.preventDefault();useHistoryDialog.getState().show();}else if(mod&&e.key.toLowerCase()==='s'){e.preventDefault();useStudio.getState().save();}else if(mod&&e.key.toLowerCase()==='o'){e.preventDefault();projectAction('open');}else if(mod&&e.key.toLowerCase()==='j'){e.preventDefault();openAgent();}else if(mod&&e.key.toLowerCase()==='p'){e.preventDefault();setPalette(v=>!v);}else if(!typing&&mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?useStudio.getState().redo():useStudio.getState().undo();}else if(!typing&&mod&&e.key.toLowerCase()==='d'){e.preventDefault();useStudio.getState().duplicate();}else if(!typing&&e.key==='Delete'){e.preventDefault();useStudio.getState().remove();}else if(e.key==='F5'||mod&&e.key.toLowerCase()==='r'){e.preventDefault();projectAction('refresh');}else if(!typing&&!mod&&e.key.toLowerCase()==='f'){const panel=api.current?.getPanel('document');if(panel){panel.api.isMaximized()?panel.api.exitMaximized():panel.api.maximize();}}else if(e.key==='Escape'){setPalette(false);setMenu(null);api.current?.getPanel('document')?.api.exitMaximized();}};window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);},[]);
  return <PreviewProvider><UpdateDialog/><TransferDialog/><HistoryDialog/><div className="app-shell" onClick={()=>menu&&setMenu(null)}><header className="titlebar"><img className="brand-icon" src="./studio-icon.png" alt=""/><strong>FutureUI <span>Studio</span></strong><div className="app-menus">{[tr("文件"),tr("编辑"),tr("窗口"),tr("帮助")].map(item=><div className="menu-anchor" key={item}><button className={menu===item?'active':''} onClick={e=>{e.stopPropagation();setMenu(menu===item?null:item);}}>{item}</button>{menu===item&&<div className="dropdown-menu">{(item===tr("文件")?fileCommands:item===tr("编辑")?editCommands:item===tr("窗口")?windowCommands:[{name:tr("快捷命令与操作"),hint:'Ctrl+P',action:()=>setPalette(true)},{name:tr("检查更新"),hint:'',action:()=>updater.show(true)},{name:tr("关于 FutureUI Studio {0}", updater.state?.currentVersion??''),hint:'',action:()=>updater.show()}]).map(c=><button key={c.name} onClick={()=>{setMenu(null);c.action();}}>{c.name}<kbd>{c.hint}</kbd></button>)}</div>}</div>)}</div><div className="title-project">{s.project?.name ?? tr("正在载入")}{changed.length>0&&<span> •</span>}</div><span className="window-space"/></header><div className="workspace-bar"><div className="workspace-title"><span className="small-logo"><PanelsTopLeft size={16}/></span><span>{tr("菜单设计")}</span><ChevronDown size={12}/></div><nav>{workspaces.map(([key,label,Icon])=><button key={key} className={s.workspace===key?'active':''} onClick={()=>s.set({workspace:key,...(key==='motion'?{bottom:'timeline' as const,view:'canvas' as const}:{})})}><Icon size={14}/>{label}</button>)}</nav><div className="header-actions"><IconButton icon={FileInput} title={tr("配置导入与导出")} onClick={()=>useTransfer.getState().show('import')}/><IconButton icon={History} title={tr("操作节点与回退")} onClick={()=>useHistoryDialog.getState().show()}/><LanguagePicker/><UpdateLauncher/><button className="secondary-button agent-launch" title={tr("打开 Agent · Ctrl+J")} onClick={openAgent}><Sparkles size={14}/>Agent</button><IconButton icon={Undo2} title={tr("撤销 · Ctrl+Z")} disabled={!s.past.length||s.busy} onClick={s.undo}/><IconButton icon={Redo2} title={tr("重做 · Ctrl+Shift+Z")} disabled={!s.future.length||s.busy} onClick={s.redo}/><span className="toolbar-divider"/><button className="secondary-button" onClick={()=>s.set({workspace:'publish'})}><Monitor size={14}/>{tr("游戏预览")}</button><button className="primary-button" disabled={s.busy} onClick={s.save}><Save size={14}/>{tr("保存")}<span className="save-count" style={{visibility:changed.length?'visible':'hidden'}} aria-hidden={!changed.length}>{changed.length}</span></button></div></div><main className="dock-root"><DockviewReact components={components} onReady={ready} theme={themeDark}/></main><footer className="statusbar"><span className="status-mode"><span className="status-dot"/>{tr("本地工程")}</span><span>{s.busy?tr("处理中…"):changed.length?tr("{0} 个未保存文件", changed.length):tr("所有修改已保存")}</span><span className="spacer"/><button onClick={()=>s.set({bottom:'problems'})}><CheckCircle2 size={12}/>{tr("配置检查")}</button><button onClick={()=>setPalette(true)}><Command size={12}/>{tr("命令")}</button><select aria-label={tr("预览语言")} value={s.locale} onChange={e=>s.set({locale:e.target.value})}><option value="zh_cn">{tr("简体中文")}</option><option value="en_us">English</option></select><span>UTF-8</span><span>FutureUI 1.0.0</span></footer>{s.notice&&<div className="toast"><CheckCircle2 size={15}/>{plain(s.notice)}</div>}{s.error&&<div className="error-banner"><AlertCircle size={16}/><span>{s.error}</span><button title={tr("关闭错误提示")} onClick={()=>s.set({error:''})}><X size={15}/></button></div>}{palette&&<div className="modal-shade" onClick={()=>setPalette(false)}><div className="command-palette" onClick={e=>e.stopPropagation()}><div className="palette-input"><Command size={18}/><input autoFocus aria-label={tr("搜索命令")} placeholder={tr("搜索命令…")} value={search} onChange={e=>setSearch(e.target.value)}/><kbd>Esc</kbd></div>{commands.filter(c=>c.name.includes(search)).map(c=><button key={c.name} onClick={()=>{setPalette(false);c.action();}}><span>{c.name}</span><kbd>{c.hint}</kbd></button>)}</div></div>}</div></PreviewProvider>;
}
