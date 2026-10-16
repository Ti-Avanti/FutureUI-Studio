const { tr } = require('../i18n.cjs');
const fs=require('node:fs/promises'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto');
const {getRoot}=require('../project.cjs');
let directory;
const pending=new Map();
function init(userData){directory=path.join(userData,'agent-conversations');}
function location(projectId){return path.join(directory,createHash('sha256').update(getRoot(projectId).toLowerCase()).digest('hex')+'.json');}
async function read(projectId){const file=location(projectId);await pending.get(file)?.catch(()=>{});return fs.readFile(file,'utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return null;throw Error(tr("会话记录无法读取，请保留原文件后检查磁盘"));});}
async function save(projectId,value){
  if(!value||!Array.isArray(value.sessions)||value.sessions.length>100)throw Error(tr("每个工程最多保存 100 个会话"));
  const text=JSON.stringify(value);if(Buffer.byteLength(text)>32*1024*1024)throw Error(tr("会话记录超过 32 MB，请删除不再需要的会话记录"));
  const file=location(projectId),before=pending.get(file)??Promise.resolve();
  const operation=before.catch(()=>{}).then(async()=>{await fs.mkdir(directory,{recursive:true});const temporary=`${file}.${randomUUID()}.tmp`;await fs.writeFile(temporary,text,{encoding:'utf8',mode:0o600});await fs.rename(temporary,file);});
  pending.set(file,operation);try{await operation;}finally{if(pending.get(file)===operation)pending.delete(file);}
}
module.exports={init,read,save};
