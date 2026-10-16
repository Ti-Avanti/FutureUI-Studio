import { create } from 'zustand';
import { at, editYaml, moveYaml, readYaml } from '../model/documents';
import type { Change, Config, Origin, Project, ProjectFile, Workspace } from '../model/types';
import type { Proposal } from '../agent/types';

interface State {
  project:Project|null; saved:Record<string,string>; active:string; tabs:string[];
  selected:Origin|null; workspace:Workspace; view:'canvas'|'code'|'split';
  past:Change[]; future:Change[]; error:string; notice:string; busy:boolean;
  locale:string; zoom:number; grid:boolean; outlines:boolean; time:number; playing:boolean;
  variables:Config; hoveredState:'normal'|'hover'|'selected'|'disabled';
  bottom:'assets'|'problems'|'history'|'timeline'; previewOverrides:Record<string,string>|null;
  set:(value:Partial<State>)=>void; load:(project:Project)=>void; openFile:(path:string)=>void;
  replace:(path:string,text:string,label:string)=>void; createFile:(path:string,text:string)=>void;
  field:(origin:Origin,property:string,value:unknown,remove?:boolean)=>void;
  move:(from:Origin,to:Origin,before?:number)=>void;
  duplicate:()=>void; remove:()=>void; add:(type:string)=>void;
  undo:()=>void; redo:()=>void; save:()=>Promise<void>;
  applyProposals:(proposals:Proposal[],projectId:string)=>void;
}
export const useStudio=create<State>((set,get)=>({
  project:null,saved:{},active:'',tabs:[],selected:null,workspace:'design',view:'canvas',
  past:[],future:[],error:'',notice:'',busy:false,locale:'zh_cn',zoom:0,grid:true,outlines:false,
  time:0,playing:false,hoveredState:'normal',bottom:'assets',previewOverrides:null,
  variables:{'player.name':'像素商人',balance:1280,page:1,pages:1,category:'building','data.input.hints':true,'studio.preview':true},
  set,
  load:project=>{
    const active=project.files.find(f=>f.path==='menus/compact/shop.yml')?.path??project.files.find(f=>f.path.startsWith('menus/'))?.path??project.files[0]?.path??'';
    set({project,saved:Object.fromEntries(project.files.map(f=>[f.path,f.text])),active,tabs:[active],past:[],future:[],selected:null,error:'',notice:'工程已载入',time:0,previewOverrides:null});
  },
  openFile:active=>set(s=>({active,tabs:s.tabs.includes(active)?s.tabs:[...s.tabs,active],selected:null})),
  createFile:(path,text)=>{
    const s=get();if(!s.project)return;
    if(s.project.files.some(f=>f.path===path)){set({error:'文件已存在'});return;}
    set({project:{...s.project,files:[...s.project.files,{path,text,hash:null}]},past:[...s.past,{path,before:null,after:text,label:'创建文件',time:Date.now()}],future:[]});
  },
  replace:(path,text,label)=>{
    const s=get(),file=s.project?.files.find(f=>f.path===path);if(!file||file.text===text)return;
    const change={label,path,before:file.text,after:text,time:Date.now()},last=s.past.at(-1);
    const coalesce=label==='编辑 YAML'&&last?.label===label&&last.path===path&&change.time-last.time<1200;
    set({project:{...s.project!,files:s.project!.files.map(f=>f.path===path?{...f,text}:f)},past:[...(coalesce?s.past.slice(0,-1):s.past),coalesce?{...change,before:last!.before}:change].slice(-200),future:[],error:''});
  },
  field:(origin,property,value,remove)=>{
    const file=get().project?.files.find(f=>f.path===origin.file);if(!file)return;
    try{get().replace(file.path,editYaml(file.text,[...origin.path,property],value,remove),`${remove?'恢复默认':'修改'} ${property}`);}catch(e){set({error:(e as Error).message});}
  },
  move:(from,to,before)=>{
    if(from.file!==to.file){set({error:'跨文件移动请先复制组件，避免破坏模板引用'});return;}
    const file=get().project?.files.find(f=>f.path===from.file);if(!file)return;
    try{get().replace(file.path,moveYaml(file.text,from.path,to.path,before),'移动组件');set({selected:null});}catch(e){set({error:(e as Error).message});}
  },
  duplicate:()=>{
    const s=get(),o=s.selected;if(!o)return;const file=s.project?.files.find(f=>f.path===o.file);if(!file||!o.path.length)return;
    const root=readYaml(file).value,node=at(root,o.path),parent=at(root,o.path.slice(0,-1));if(!Array.isArray(parent)||!node)return;
    const suffix=crypto.randomUUID().slice(0,5);
    const rename=(v:any):any=>Array.isArray(v)?v.map(rename):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,item])=>[k,k==='id'?`${item}_${suffix}`:rename(item)])):v;
    const next=[...parent];next.splice(Number(o.path.at(-1))+1,0,rename(node));s.replace(file.path,editYaml(file.text,o.path.slice(0,-1),next),'复制组件');
  },
  remove:()=>{const s=get(),o=s.selected;if(!o?.path.length)return;const file=s.project?.files.find(f=>f.path===o.file);if(file){s.replace(file.path,editYaml(file.text,o.path,null,true),'删除组件');set({selected:null});}},
  add:type=>{
    const s=get(),file=s.project?.files.find(f=>f.path===s.active);if(!file)return;
    if(!/^(menus|templates)\//.test(file.path)){set({error:'请先打开菜单或组件模板，再添加可视组件'});return;}
    const root=readYaml(file).value,id=`${type.replace(/-/g,'_')}_${crypto.randomUUID().slice(0,6)}`;
    let node:Config={id,type};
    if(['row','column','grid'].includes(type))node={...node,gap:9,padding:9,skin:'panel',children:[{id:`${id}_text`,type:'text',text:'<!i>新内容',height:27,padding:9}]};
    else if(type==='button')node={...node,text:'<!i>按钮',height:27,skin:'button',actions:[{type:'close'}]};
    else if(type==='image')node={...node,image:'stone',size:72};
    else if(type==='progress')node={...node,value:.65,height:9};
    else if(type==='spacer')node.height=9;
    else if(type.endsWith('input'))node={...node,label:'输入内容',width:270,initial:type==='number-input'?1:''};
    else node={...node,text:'<!i>新文本',height:27,padding:9,skin:'readout'};
    const selected=s.selected?.file===file.path?at(root,s.selected.path):null;
    const parent=selected&&['row','column','grid'].includes(selected.type)?[...s.selected!.path,'children']:root.type&&['row','column','grid'].includes(root.type)?['children']:['components'];
    const components=at(root,parent)??[];if(!Array.isArray(components)){set({error:'目标容器的组件配置不是列表，请先修复 YAML'});return;}
    s.replace(file.path,editYaml(file.text,parent,[...components,node]),`添加 ${type}`);set({selected:{file:file.path,path:[...parent,components.length]}});
  },
  applyProposals:(proposals,projectId)=>{
    const s=get();if(!s.project||s.project.id!==projectId)throw Error('工程已切换，请重新生成方案');
    for(const p of proposals)if((s.project.files.find(f=>f.path===p.path)?.text??null)!==p.before)throw Error(`${p.path} 在生成期间发生了修改，请重新生成或手动合并`);
    const files=new Map(s.project.files.map(f=>[f.path,f]));for(const p of proposals)files.set(p.path,{path:p.path,text:p.after,hash:files.get(p.path)?.hash??null});
    set({project:{...s.project,files:[...files.values()]},past:[...s.past,{path:`${proposals.length} 个文件`,before:'',after:'',files:proposals,label:'应用 Agent 方案',time:Date.now()}].slice(-200),future:[],previewOverrides:null,notice:`已应用 ${proposals.length} 个文件，可撤销；尚未保存到磁盘`});
  },
  undo:()=>{
    const s=get(),item=s.past.at(-1);if(!item||!s.project)return;const changes=item.files??[item];
    if(changes.some(c=>c.before===null&&s.saved[c.path]!==undefined)){set({notice:'新文件已经保存；请通过文件管理器处理文件删除，以免误删工程文件'});return;}
    const files=new Map(s.project.files.map(f=>[f.path,f]));for(const c of changes){if(c.before===null)files.delete(c.path);else{const file=files.get(c.path);if(file)files.set(c.path,{...file,text:c.before});}}
    const active=files.has(s.active)?s.active:[...files.keys()].find(p=>p.startsWith('menus/'))??[...files.keys()][0]??'';
    set({project:{...s.project,files:[...files.values()]},active,tabs:s.tabs.filter(p=>files.has(p)),past:s.past.slice(0,-1),future:[...s.future,item],selected:null,previewOverrides:null});
  },
  redo:()=>{
    const s=get(),item=s.future.at(-1);if(!item||!s.project)return;const files=new Map(s.project.files.map(f=>[f.path,f]));
    for(const c of item.files??[item])files.set(c.path,{path:c.path,text:c.after,hash:files.get(c.path)?.hash??null});
    set({project:{...s.project,files:[...files.values()]},past:[...s.past,item],future:s.future.slice(0,-1),selected:null,previewOverrides:null});
  },
  save:async()=>{
    const s=get();if(!s.project||s.busy)return;const files=s.project.files.filter(f=>s.saved[f.path]!==f.text);if(!files.length){set({notice:'所有修改已保存'});return;}
    set({busy:true,error:''});try{
      const result=await window.studio.save(s.project.id,files),hashes=new Map(result.files.map(f=>[f.path,f.hash]));
      set(current=>current.project?.id!==s.project?.id?{}:{project:{...current.project!,files:current.project!.files.map(f=>hashes.has(f.path)?{...f,hash:hashes.get(f.path)!}:f)},saved:{...current.saved,...Object.fromEntries(files.map(f=>[f.path,f.text]))},notice:`已保存 ${files.length} 个文件 · 已创建恢复副本`});
    }catch(e){set({error:(e as Error).message});}finally{set({busy:false});}
  }
}));
export const dirtyFiles=(state:Pick<State,'project'|'saved'>):ProjectFile[]=>state.project?.files.filter(f=>state.saved[f.path]!==f.text)??[];
