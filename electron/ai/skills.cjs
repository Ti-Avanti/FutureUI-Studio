const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { parse } = require('yaml');
const Zip = require('adm-zip');
let directory, builtin;
const limit = 8 * 1024 * 1024;
const allowed = /\.(md|txt|ya?ml|json|py|js|ts)$/i;
function init(userData, resourcePath) { directory = path.join(userData, 'skills'); builtin = path.join(resourcePath, 'futureui-ui'); }
function safeName(value) { if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(value)) throw Error('Skill name 只能包含字母、数字、横线与下划线'); return value.toLowerCase(); }
function safeRelative(value) { if (typeof value !== 'string' || value.includes('\\') || value.includes(':') || value.split('/').some(p => !p || p === '..' || p === '.') || path.isAbsolute(value)) throw Error('Skill 包包含不安全的路径'); return value; }
function metadata(files) {
  const content = files['SKILL.md'];
  if (!content) throw Error('请选择含 SKILL.md 的目录或 ZIP');
  const front = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  const values = front ? parse(front[1], { maxAliasCount:100 }) ?? {} : {};
  const id = safeName(String(values.name ?? ''));
  const hash = createHash('sha256').update(JSON.stringify(Object.entries(files).sort())).digest('hex');
  return { id, name: String(values.name), description: String(values.description ?? ''), version: String(values.version ?? values.metadata?.version ?? hash.slice(0,8)), hash, files: Object.keys(files), updatedAt: new Date().toISOString() };
}
async function folderFiles(root) {
  const files = {}; let total = 0, count = 0;
  async function walk(dir, prefix = '') {
    for (const item of await fs.readdir(dir, {withFileTypes:true})) {
      if (item.name.startsWith('.') || item.name === 'node_modules') continue;
      const rel = prefix + item.name;
      if (item.isSymbolicLink()) throw Error('Skill 不允许包含链接文件');
      if (++count > 500) throw Error('Skill 文件数量超过 500');
      if (item.isDirectory()) { await walk(path.join(dir,item.name), rel+'/'); continue; }
      if (!item.isFile() || !allowed.test(rel)) continue;
      const stat = await fs.stat(path.join(dir,item.name)); total += stat.size;
      if (total > limit || stat.size > 2*1024*1024) throw Error('Skill 超过大小限制（总计 8 MB，单文件 2 MB）');
      const data = await fs.readFile(path.join(dir,item.name));
      files[safeRelative(rel)] = new TextDecoder('utf-8',{fatal:true}).decode(data).replace(/^\uFEFF/,'');
    }
  }
  await walk(root); return files;
}
async function collect(source) {
  const stat = await fs.lstat(source);
  if (stat.isSymbolicLink()) throw Error('Skill 来源不能是链接');
  if (stat.isDirectory()) return folderFiles(source);
  if (path.basename(source).toLowerCase() === 'skill.md') return folderFiles(path.dirname(source));
  if (!source.toLowerCase().endsWith('.zip') || stat.size > limit) throw Error('请选择 Skill 目录、SKILL.md 或不超过 8 MB 的 ZIP');
  const zip = new Zip(source), entries = zip.getEntries(); let total = 0;
  if (entries.length > 500) throw Error('Skill 文件数量超过 500');
  for (const entry of entries) {
    const name = entry.entryName.replace(/\/$/,''); if (name) safeRelative(name);
    if (((entry.attr >>> 16) & 0xf000) === 0xa000) throw Error('Skill ZIP 不允许包含链接');
    total += entry.header.size;
    if (total > limit || entry.header.size > 2*1024*1024) throw Error('Skill 解压后超过大小限制');
  }
  const roots = entries.filter(e => !e.isDirectory && /(^|\/)SKILL\.md$/.test(e.entryName));
  if (roots.length !== 1) throw Error('每次导入一个 Skill；ZIP 中需要唯一的 SKILL.md');
  const prefix = roots[0].entryName.slice(0,-8), files = {};
  for (const entry of entries) if (!entry.isDirectory && entry.entryName.startsWith(prefix) && allowed.test(entry.entryName)) files[entry.entryName.slice(prefix.length)] = new TextDecoder('utf-8',{fatal:true}).decode(entry.getData()).replace(/^\uFEFF/,'');
  return files;
}
async function readRecord(id) {
  id = safeName(id);
  const record = await fs.readFile(path.join(directory,`${id}.json`),'utf8').then(JSON.parse).catch(e => { if(e.code==='ENOENT') return null; throw e; });
  if (record) return record;
  if (id === 'futureui-ui') { const files = await folderFiles(builtin); return { ...metadata(files), builtin:true, enabled:true, contents:files }; }
  throw Error('Skill 不存在');
}
const publicRecord = ({contents,...rest}) => rest;
async function list() {
  await fs.mkdir(directory,{recursive:true}); const ids = new Set(['futureui-ui']);
  for (const file of await fs.readdir(directory)) if (/^[a-z0-9_-]+\.json$/.test(file)) ids.add(file.slice(0,-5));
  return Promise.all([...ids].map(async id=>publicRecord(await readRecord(id))));
}
async function install(source) {
  const contents = await collect(source), meta = metadata(contents), previous = await readRecord(meta.id).catch(()=>null);
  const record = { ...meta, builtin:false, enabled:previous?.enabled ?? true, contents };
  await fs.mkdir(directory,{recursive:true});
  if (previous && !previous.builtin) { const versions=path.join(directory,'versions'); await fs.mkdir(versions,{recursive:true}); await fs.writeFile(path.join(versions,`${meta.id}-${Date.now()}-${randomUUID().slice(0,6)}.json`),JSON.stringify(previous),'utf8'); }
  const target=path.join(directory,`${meta.id}.json`), temporary=`${target}.tmp`;
  await fs.writeFile(temporary,JSON.stringify(record),'utf8'); await fs.rename(temporary,target);
  return { ...publicRecord(record), updated:!!previous };
}
async function enable(id, value) { const record=await readRecord(id); record.enabled=!!value; await fs.mkdir(directory,{recursive:true}); const target=path.join(directory,`${safeName(id)}.json`),temporary=`${target}.${randomUUID()}.tmp`;await fs.writeFile(temporary,JSON.stringify(record),'utf8');await fs.rename(temporary,target);return list(); }
async function readFile(id, file, inspect = false) { const record=await readRecord(id); if(!record.enabled&&!inspect)throw Error('Skill 尚未启用'); const value=record.contents[safeRelative(file)];if(value===undefined)throw Error('Skill 文件不存在');return value; }
module.exports={init,list,install,enable,readFile};
