import { tr, useInterfaceLanguage } from '../i18n';
import { useEffect, useState } from 'react';
import { Plus, Trash2, ArrowDown, ArrowUp, GitBranch, MousePointer2, Play, CircleCheck, Workflow } from 'lucide-react';
import { useStudio } from '../state/store';
import { at, readYaml, documentId } from '../model/documents';
import { capabilities } from '../model/validate';
import { Field } from './controls';
import { usePreview } from './context';
import { simulate } from '../preview/simulate';
import type { Config } from '../model/types';


export function Actions() {
  useInterfaceLanguage();
  const labels: Record<string,string> = { 'open-menu':tr("打开菜单"),message:tr("显示消息"),close:tr("关闭菜单"),refresh:tr("刷新界面"),'set-variable':tr("设置变量"),purchase:tr("购买商品"),sound:tr("播放声音"),if:tr("条件分支"),require:tr("校验条件"),delay:tr("延迟执行"),call:tr("调用函数"),transaction:tr("事务"), 'adjust-number':tr("调整数量") };

  const s = useStudio(), preview = usePreview(), origin = s.selected ?? { file:s.active,path:[] };
  const file = s.project?.files.find(f=>f.path===origin.file), data = at(readYaml(file).value,origin.path) ?? {};
  const event = s.selected ? 'actions' : 'on-open', actions: Config[] = data[event] ?? [];
  const [selected,setSelected] = useState(0),[kind,setKind] = useState('open-menu'),[draft,setDraft] = useState(''),[jsonError,setJsonError] = useState('');
  const action = actions[selected];
  useEffect(()=>{setDraft(JSON.stringify(action??{},null,2));setJsonError('');},[JSON.stringify(action)]);
  const update = (next: Config[])=>s.field(origin,event,next);
  const change = (key:string,value:any)=>update(actions.map((a,i)=>i===selected?{...a,[key]:value}:a));
  function add() {
    const defaults:Record<string,Config>={'open-menu':{menu:'compact/main'},message:{text:tr("<!i>操作完成")},'set-variable':{key:'selected',value:true},if:{when:{type:'true'},then:[{type:'message',text:tr("<!i>条件成立")}],else:[]},require:{requirements:{type:'permission',permission:'futureui.use'}},delay:{ticks:20},purchase:{shop:'system',product:'stone',quantity:1}};
    update([...actions,{type:kind,...defaults[kind]}]);setSelected(actions.length);
  }
  return <div className="workspace-content actions-workspace"><div className="workspace-heading"><div><span className="eyebrow">INTERACTION</span><h2>{tr("动作与条件")}</h2><p>{data.id ?? tr("当前菜单")} · {s.selected?tr("点击组件"):tr("打开菜单时")}{tr(" · 按顺序执行")}</p></div><button className="secondary-button" onClick={()=>{const node=preview.boxes.find(b=>b.node._origin.file===origin.file&&JSON.stringify(b.node._origin.path)===JSON.stringify(origin.path))?.node;if(node)simulate(node);else s.set({notice:tr("请选择有动作的画布组件进行模拟")});}}><Play size={14}/>{tr("模拟执行")}</button></div><div className="action-columns"><div className="flow-list"><div className="flow-start"><MousePointer2 size={16}/>{s.selected?tr("点击"):tr("页面打开")}<span>{tr("事件入口")}</span></div>{actions.map((item,i)=><div key={i}><div className="flow-line"/><button className={`flow-node ${i===selected?'selected':''}`} onClick={()=>setSelected(i)}><span className="flow-number">{String(i+1).padStart(2,'0')}</span>{['if','require'].includes(item.type)?<GitBranch size={18}/>:<Workflow size={18}/>}<div><strong>{labels[item.type]??item.type}</strong><small>{String(item.menu??item.text??item.key??item.shop??tr("按配置执行")).slice(0,45)}</small></div><Chevron item={item}/></button></div>)}<div className="flow-line"/><div className="flow-end"><CircleCheck size={14}/>{tr("流程结束")}</div><div className="add-action"><select aria-label={tr("新动作类型")} value={kind} onChange={e=>setKind(e.target.value)}>{capabilities.actions.map(type=><option key={type} value={type}>{labels[type]??type}</option>)}</select><button title={tr("添加动作")} onClick={add}><Plus size={16}/></button></div></div><div className="action-detail">{action?<><div className="section-title"><strong>{labels[action.type]??action.type}</strong><div className="inline-buttons"><button title={tr("动作上移")} disabled={!selected} onClick={()=>{const copy=[...actions];[copy[selected-1],copy[selected]]=[copy[selected],copy[selected-1]];update(copy);setSelected(selected-1);}}><ArrowUp size={14}/></button><button title={tr("动作下移")} disabled={selected===actions.length-1} onClick={()=>{const copy=[...actions];[copy[selected+1],copy[selected]]=[copy[selected],copy[selected+1]];update(copy);setSelected(selected+1);}}><ArrowDown size={14}/></button><button title={tr("删除动作")} onClick={()=>{update(actions.filter((_,i)=>i!==selected));setSelected(Math.max(0,selected-1));}}><Trash2 size={14}/></button></div></div><div className="fields"><Field label={tr("动作类型")} value={action.type} options={capabilities.actions} onChange={v=>change('type',v)} wide/>{action.type==='open-menu'?<Field label={tr("目标菜单")} value={action.menu} options={s.project?.files.filter(f=>f.path.startsWith('menus/')).map(documentId)??[]} onChange={v=>change('menu',v)} wide/>:Object.entries(action).filter(([key,v])=>key!=='type'&&typeof v!=='object').map(([key,value])=><Field key={key} label={key} value={value} numeric={typeof value==='number'} onChange={v=>change(key,v)} wide/>)}</div><div className="section-title"><span>{tr("完整参数")}</span><small>{tr("JSON · 支持嵌套流程")}</small></div><textarea className="code-textarea" aria-label={tr("动作完整参数")} rows={12} value={draft} onChange={e=>setDraft(e.target.value)}/><button className="primary-button" onClick={()=>{try{const next=JSON.parse(draft);if(!next.type||typeof next.type!=='string')throw Error(tr("动作必须包含 type"));update(actions.map((a,i)=>i===selected?next:a));setJsonError('');}catch(e){setJsonError((e as Error).message);}}}>{tr("应用参数")}</button>{jsonError&&<p className="error-text">{jsonError}</p>}<p className="field-hint">{tr("condition 不满足时跳过此动作。")}<br/>{tr("需要中止流程时使用 require。购买、指令等操作只在游戏中实际执行。")}</p></>:<div className="empty-pane"><Workflow size={30}/><strong>{tr("为这个入口添加动作")}</strong><p>{tr("选择动作类型，组合菜单导航和业务流程。")}</p></div>}</div></div></div>;
}
function Chevron({item}:{item:Config}){
  useInterfaceLanguage();return <span className="tiny-tag">{item.type==='if'?tr("分支"):item.condition?tr("有条件"):tr("动作")}</span>;}
