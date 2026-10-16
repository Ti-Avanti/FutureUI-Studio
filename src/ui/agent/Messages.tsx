import { tr, useInterfaceLanguage } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, Circle, LoaderCircle, AlertCircle, BrainCircuit } from 'lucide-react';
import { useAgent } from '../../agent/store';
import { MarkdownMessage } from './MarkdownMessage';

function Thinking({text,kind,running}:{text:string;kind?:string;running:boolean}){
  useInterfaceLanguage();const[expanded,setExpanded]=useState(true);return <div className="agent-thinking"><button onClick={()=>setExpanded(!expanded)}><BrainCircuit size={13}/>{kind==='summary'?tr("思考摘要"):tr("模型思考")}{running&&<LoaderCircle className="spin" size={11}/>}<ChevronDown size={12} className={expanded?'expanded':''}/></button>{expanded&&<pre>{text}</pre>}</div>;}
export function Messages(){
  useInterfaceLanguage();
  const toolNames:Record<string,string>={list_files:tr("浏览工程"),read_file:tr("读取配置"),find_text:tr("搜索配置"),read_skill:tr("查阅 Skill"),list_assets:tr("查找资源"),read_asset:tr("查看图片"),edit_yaml:tr("调整配置"),propose_file:tr("生成文件方案"),validate_changes:tr("检查方案")};

  const a=useAgent(),scroll=useRef<HTMLDivElement>(null),[follow,setFollow]=useState(true);
  useEffect(()=>{if(follow&&scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;},[a.messages,follow]);
  return <div className="agent-messages" ref={scroll} onScroll={e=>setFollow(e.currentTarget.scrollHeight-e.currentTarget.scrollTop-e.currentTarget.clientHeight<80)}>{!a.messages.length?<div className="agent-welcome"><div className="agent-orbit"><BrainCircuit size={24}/></div><h3>{tr("从一个想法开始")}</h3><p>{tr("选中画布组件、拖入资源，")}<br/>{tr("或直接描述你想做的菜单。")}</p><div className="agent-suggestions">{[[tr("创建菜单"),tr("参考当前主题，新建一个有左侧导航和右侧内容的菜单。先读取现有规范，内容未知时向我确认。")],[tr("优化选中组件"),tr("优化当前选中组件的布局与可读性，保持现有功能和主题一致。")],[tr("检查当前页面"),tr("检查当前菜单及引用的模板，修复尺寸、语言键和交互配置中能够确定的问题。")]].map(([label,prompt])=><button key={label} onClick={()=>a.compose(prompt)}>{label}<span>↗</span></button>)}</div></div>:a.messages.map(m=><article key={m.id} className={`agent-message ${m.role}`}><div className="message-label">{m.role==='user'?tr("你"):'FutureUI Agent'}{m.status==='running'&&<LoaderCircle className="spin" size={12}/>}</div>{m.attachments?.length? <div className="sent-attachments">{m.attachments.map(item=><span key={item.id}>{item.url&&<img src={item.url} alt=""/>}{item.name}</span>)}</div>:null}{m.thinking&&<Thinking text={m.thinking} kind={m.thinkingKind} running={m.status==='running'}/>}<MarkdownMessage text={m.text}/>{m.tools?.length?<div className="tool-traces">{m.tools.map(t=><div key={t.callId} className={t.status} title={t.message}>{t.status==='running'?<LoaderCircle className="spin" size={11}/>:t.status==='done'?<Check size={11}/>:<AlertCircle size={11}/>}<span>{toolNames[t.name]??t.name}</span><small>{t.target}</small></div>)}</div>:null}{m.status==='running'&&!m.text&&!m.thinking&&!m.tools?.length&&<div className="agent-wait"><Circle size={5} className="pulse"/>{tr("等待模型响应…")}</div>}{m.status==='cancelled'&&<small className="agent-message-status">{tr("已停止")}</small>}</article>)}</div>;
}
