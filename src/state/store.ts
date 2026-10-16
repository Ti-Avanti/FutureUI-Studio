import { create } from 'zustand';
import { at, editYaml, moveYaml, readYaml } from '../model/documents';
import type { Change, Config, FileEdit, FileWrite, Origin, Project, Workspace } from '../model/types';
import type { Proposal } from '../agent/types';
import { applyFileEdits, selectionAfter, timelineFiles } from './history';
import { configPathError } from '../model/paths';

interface State {
  project:Project|null; saved:Record<string,string>; savedHashes:Record<string,string|null>; active:string; tabs:string[];
  selected:Origin|null; workspace:Workspace; view:'canvas'|'code'|'split';
  past:Change[]; future:Change[]; historyTruncated:boolean; historyRevision:number; error:string; notice:string; busy:boolean;
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
  applyChanges:(edits:FileEdit[],label:string,projectId:string)=>void;
  restoreOperation:(index:number)=>void;
}
export const useStudio=create<State>((set,get)=>({
  project:null,saved:{},savedHashes:{},active:'',tabs:[],selected:null,workspace:'design',view:'canvas',
  past:[],future:[],historyTruncated:false,historyRevision:0,error:'',notice:'',busy:false,locale:'zh_cn',zoom:0,grid:true,outlines:false,
  time:0,playing:false,hoveredState:'normal',bottom:'assets',previewOverrides:null,
  variables:{'player.name':'像素商人',balance:1280,page:1,pages:1,category:'building','data.input.hints':true,'studio.preview':true},
  set,
  load:project=>{
    const active=project.files.find(f=>f.path==='menus/compact/shop.yml')?.path??project.files.find(f=>f.path.startsWith('menus/'))?.path??project.files[0]?.path??'';
    set({project,saved:Object.fromEntries(project.files.map(f=>[f.path,f.text])),savedHashes:Object.fromEntries(project.files.map(f=>[f.path,f.hash])),historyTruncated:false,historyRevision:0,active,tabs:[active],past:[],future:[],selected:null,error:'',notice:'工程已载入',time:0,previewOverrides:null});
  },
  openFile:active=>set(s=>({active,tabs:s.tabs.includes(active)?s.tabs:[...s.tabs,active],selected:null})),
  applyChanges:(edits,label,projectId)=>{
    const s=get();if(!s.project||s.project.id!==projectId)throw Error('工程已切换，请重新选择');
    const unique=new Set<string>(),existing=new Map(s.project.files.map(f=>[f.path.toLowerCase(),f]));
    for(const edit of edits){
      const error=configPathError(edit.path);if(error)throw Error(error);
      const key=edit.path.toLowerCase();if(unique.has(key))throw Error('同一次操作不能重复修改相同路径');unique.add(key);
      const file=existing.get(key);if(file&&file.path!==edit.path)throw Error(`${edit.path} 与已有文件大小写冲突`);
      if((file?.text??null)!==edit.before)throw Error(`${edit.path} 已被修改，请重新预览后再应用`);
    }
    const changes=edits.filter(e=>e.before!==e.after);if(!changes.length)return;
    const time=Date.now(),last=s.past.at(-1),coalesce=label==='编辑 YAML'&&last?.label===label&&changes.length===1&&last.files.length===1&&last.files[0].path===changes[0].path&&time-last.time<1200&&!s.future.length;
    const files=applyFileEdits(s.project.files,changes,'after',s.savedHashes);
    const node:Change={id:coalesce?last!.id:crypto.randomUUID(),label,path:changes.length===1?changes[0].path:`${changes.length} 个文件`,time,files:coalesce?[{...changes[0],before:last!.files[0].before}]:changes};
    const past=[...(coalesce?s.past.slice(0,-1):s.past),node];
    set({project:{...s.project,files},...selectionAfter(files,s.active,s.tabs),selected:s.selected&&files.some(f=>f.path===s.selected!.file)?s.selected:null,past:past.slice(-200),future:[],historyTruncated:s.historyTruncated||past.length>200,error:''});
  },
  createFile:(path,text)=>{
    const s=get();if(!s.project)return;
    if(s.project.files.some(f=>f.path.toLowerCase()===path.toLowerCase())){set({error:'文件已存在'});return;}
    try{s.applyChanges([{path,before:null,after:text}],'创建文件',s.project.id);}catch(e){set({error:(e as Error).message});}
  },
  replace:(path,text,label)=>{
    const s=get(),file=s.project?.files.find(f=>f.path===path);if(!file||file.text===text)return;
    try{s.applyChanges([{path,before:file.text,after:text}],label,s.project!.id);}catch(e){set({error:(e as Error).message});}
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
    get().applyChanges(proposals,'应用 Agent 方案',projectId);
    set({notice:`已应用 ${proposals.length} 个文件，可撤销；尚未保存到磁盘`});
  },
  restoreOperation:index=>{
    const s=get();if(!s.project||s.busy)return;
    try{
      const files=timelineFiles(s.project.files,s.past,s.future,index,s.savedHashes),all=[...s.past,...[...s.future].reverse()];
      set({project:{...s.project,files},...selectionAfter(files,s.active,s.tabs),past:all.slice(0,index),future:all.slice(index).reverse(),notice:'已回到所选操作节点；可继续前进或保存',error:''});
    }catch(e){set({error:(e as Error).message});}
  },
  undo:()=>{const s=get();if(s.past.length)s.restoreOperation(s.past.length-1);},
  redo:()=>{const s=get();if(s.future.length)s.restoreOperation(s.past.length+1);},
  save:async()=>{
    const s=get();if(!s.project||s.busy)return;const files=dirtyFiles(s);if(!files.length){set({notice:'所有修改已保存'});return;}
    set({busy:true,error:''});try{
      const result=await window.studio.save(s.project.id,files),hashes=new Map(result.files.map(f=>[f.path,f.hash]));
      set(current=>{
        if(current.project?.id!==s.project?.id)return{};
        const saved={...current.saved},savedHashes={...current.savedHashes};
        for(const f of files){if(f.text===null){delete saved[f.path];delete savedHashes[f.path];}else{saved[f.path]=f.text;savedHashes[f.path]=hashes.get(f.path)??null;}}
        return{project:{...current.project!,files:current.project!.files.map(f=>hashes.has(f.path)?{...f,hash:hashes.get(f.path)??null}:f)},saved,savedHashes,historyRevision:current.historyRevision+1,notice:`已保存 ${files.length} 个文件 · 已创建回退节点`};
      });
    }catch(e){set({error:(e as Error).message});}finally{set({busy:false});}
  }
}));
export function dirtyFiles(state:Pick<State,'project'|'saved'|'savedHashes'>):FileWrite[]{
  if(!state.project)return[];
  const current=new Map(state.project.files.map(f=>[f.path,f]));
  const changed:FileWrite[]=state.project.files.filter(f=>state.saved[f.path]!==f.text).map(f=>({...f,hash:state.savedHashes[f.path]??null}));
  for(const path of Object.keys(state.saved))if(!current.has(path))changed.push({path,text:null,hash:state.savedHashes[path]??null});
  return changed;
}
