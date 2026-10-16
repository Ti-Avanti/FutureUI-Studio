const { tr } = require('../i18n.cjs');
const { parseDocument } = require('yaml');
const project = require('../project.cjs');
const skills = require('./skills.cjs');
const string={type:'string'}, array={type:'array',items:{anyOf:[{type:'string'},{type:'integer'}]}};
const define=(name,description,properties,required=Object.keys(properties))=>({name,description,parameters:{type:'object',properties,required,additionalProperties:false}});
const definitions=[
  define('list_files',tr("列出工程配置文件。先确认已有页面和模板，再修改。"),{prefix:string}),
  define('read_file',tr("按行读取当前工程 YAML；敏感字段会遮蔽。"),{path:string,startLine:{type:'integer'},lineCount:{type:'integer'}}),
  define('find_text',tr("在工程中搜索字面文本，返回最多 60 个匹配。"),{query:string}),
  define('read_skill',tr("按需读取已启用 Skill 的 SKILL.md 或参考文件。"),{id:string,path:string,startLine:{type:'integer'},lineCount:{type:'integer'}}),
  define('list_assets',tr("查找当前工程已注册的图片资源及其 ID。"),{query:string}),
  define('read_asset',tr("查看一个图片资源。返回图片和可用于 YAML 的资源 ID。"),{id:string}),
  define('edit_yaml',tr("对已存在 YAML 的指定键路径设置值，保留注释和其他字段。修改进入待审方案，不直接写磁盘。valueJson 是合法 JSON 字符串。"),{path:string,keyPath:array,valueJson:string,summary:string}),
  define('propose_file',tr("提出新增或完整替换 YAML 的方案。修改已有文件之前必须先 read_file。不要删除无关字段。"),{path:string,content:string,summary:string}),
  define('validate_changes',tr("检查当前暂存方案的 YAML 及静态菜单/模板引用。"),{})
];
const sensitive=/(?:password|passwd|secret|api[-_]?key|access[-_]?token|private[-_]?key|credential)/i;
function sanitize(text){
  try{const doc=parseDocument(text),data=doc.toJS({maxAliasCount:100});let masked=false;
    const walk=(value,keys=[])=>{if(value&&typeof value==='object')for(const [key,entry]of Object.entries(value)){if(sensitive.test(key)&&entry){doc.setIn([...keys,key],'[PRIVATE VALUE]');masked=true;}else walk(entry,[...keys,Array.isArray(value)?Number(key):key]);}};
    walk(data);return{content:masked?doc.toString():text,masked};
  }catch{return{content:tr("此文件存在 YAML 错误，先通过编辑器问题面板处理。"),masked:true};}
}
function createTools(snapshot){
  project.getRoot(snapshot.projectId);
  const files=new Map(snapshot.files.map(f=>[f.path,f.text])), originals=new Map(files),read=new Set(),proposals=new Map();
  const assets=new Map((snapshot.assets??[]).map(a=>[a.id,a]));
  const selectedSkills=new Set(snapshot.skills??[]);
  const maxReadChars=Math.min(40000,Math.max(1200,Math.floor((snapshot.contextLimit??128000)*.45)));
  const slice=(value,args)=>{const lines=value.split(/\r?\n/),start=Math.max(0,Math.floor(Number(args.startLine??1))-1),count=Math.min(400,Math.max(1,Math.floor(Number(args.lineCount??200))));return{startLine:start+1,totalLines:lines.length,content:lines.slice(start,start+count).join('\n').slice(0,maxReadChars)};};
  function stage(path,content,summary){
    project.verifyText({path,text:content});
    if(content.length>200000)throw Error(tr("单个修改文件超过 200 KB，请缩小范围"));
    if(proposals.size>=24&&!proposals.has(path))throw Error(tr("一次任务最多修改 24 个文件"));
    files.set(path,content);proposals.set(path,{path,before:originals.get(path)??null,after:content,summary:String(summary).slice(0,240)});
    return{value:{staged:path,message:tr("已加入待审方案；尚未应用到编辑器或保存")}};
  }
  async function call(name,args){
    switch(name){
      case'list_files':return{value:[...files.keys()].filter(p=>p.startsWith(String(args.prefix??''))).slice(0,500)};
      case'read_file':{const content=files.get(args.path);if(content===undefined)throw Error(tr("工程文件不存在"));read.add(args.path);const safe=sanitize(content);return{value:{...slice(safe.content,args),privateFieldsMasked:safe.masked}};}
      case'find_text':{if(!args.query||args.query.length>200)throw Error(tr("搜索内容应为 1–200 个字符"));const found=[];for(const[path,text]of files){const lines=sanitize(text).content.split(/\r?\n/);for(let i=0;i<lines.length&&found.length<60;i++)if(lines[i].includes(args.query))found.push({path,line:i+1,text:lines[i].slice(0,500)});if(found.length>=60)break;}return{value:found};}
      case'read_skill':if(!selectedSkills.has(args.id))throw Error(tr("此 Skill 未加入当前任务"));return{value:slice(await skills.readFile(args.id,args.path),args)};
      case'list_assets':return{value:[...assets.values()].filter(a=>a.id.includes(String(args.query??''))).map(({id,path})=>({id,path})).slice(0,200)};
      case'read_asset':{const asset=assets.get(args.id);if(!asset)throw Error(tr("图片资源不存在"));return{value:{id:asset.id,path:asset.path},images:snapshot.vision&&asset.url?[asset.url]:[]};}
      case'edit_yaml':{const text=files.get(args.path);if(text===undefined)throw Error(tr("文件不存在；新文件请使用 propose_file"));if(!Array.isArray(args.keyPath)||!args.keyPath.length||args.keyPath.length>24||args.keyPath.some(k=>!['string','number'].includes(typeof k)||sensitive.test(String(k))||['__proto__','prototype','constructor'].includes(String(k))))throw Error(tr("键路径不允许修改"));const doc=parseDocument(text);if(doc.errors.length)throw Error(tr("目标 YAML 存在错误"));const value=JSON.parse(args.valueJson);doc.setIn(args.keyPath,value);return stage(args.path,doc.toString(),args.summary);}
      case'propose_file':{if(originals.has(args.path)&&!read.has(args.path))throw Error(tr("请先 read_file 了解原配置"));if(originals.has(args.path)&&sanitize(originals.get(args.path)).masked)throw Error(tr("含私密字段的配置请用 edit_yaml 精确修改公开字段"));return stage(args.path,args.content,args.summary);}
      case'validate_changes':{const issues=[],menuIds=new Set(),templateIds=new Set();for(const[path,text]of files){const doc=parseDocument(text);if(doc.errors.length){issues.push(`${path}: ${doc.errors[0].message}`);continue;}const value=doc.toJS({maxAliasCount:100});if(path.startsWith('menus/'))menuIds.add(value?.id??path.slice(6).replace(/\.ya?ml$/,''));if(path.startsWith('templates/'))templateIds.add(path.slice(10).replace(/\.ya?ml$/,''));}
        for(const proposal of proposals.values()){const value=parseDocument(proposal.after).toJS({maxAliasCount:100});const walk=(v,depth=0)=>{if(!v||typeof v!=='object'||depth>24)return;if(v.template&&!templateIds.has(v.template))issues.push(tr("{0}: 模板不存在 {1}", proposal.path, v.template));if(v.type==='open-menu'&&typeof v.menu==='string'&&!v.menu.includes('{')&&!menuIds.has(v.menu))issues.push(tr("{0}: 菜单不存在 {1}", proposal.path, v.menu));Object.values(v).forEach(child=>walk(child,depth+1));};walk(value);}
        return{value:{issues:issues.slice(0,40),scope:tr("YAML 与静态引用；画布尺寸、PAPI 与服务器行为需要编辑器及游戏确认")}};}
      default:throw Error(tr("Agent 没有此工具权限"));
    }
  }
  return{call,proposals};
}
module.exports={definitions,createTools,sanitize};
