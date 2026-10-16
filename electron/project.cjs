const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { parseDocument } = require('yaml');

const roots = new Map();
const folders = new Set(['menus', 'templates', 'languages', 'shops', 'assets', 'functions', 'rules', 'hud']);
const hash = value => createHash('sha256').update(value).digest('hex');
const within = (root, target) => target === root || target.startsWith(root + path.sep);

function relative(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0') || path.isAbsolute(value)) throw Error('无效的工程路径');
  const parts = value.split('/');
  if (parts.some(p => !p || p === '..' || p === '.') || (!folders.has(parts[0]) && value !== 'config.yml')) throw Error('文件不在 FutureUI 配置目录中');
  return value;
}

async function destination(root, rel, create = false) {
  relative(rel);
  const full = path.resolve(root, rel);
  if (!within(root, full)) throw Error('路径超出工程范围');
  const pieces = rel.split('/');
  let dir = root;
  for (const part of pieces.slice(0, -1)) {
    dir = path.join(dir, part);
    if (create) await fs.mkdir(dir, { recursive: false }).catch(e => { if (e.code !== 'EEXIST') throw e; });
    const stat = await fs.lstat(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink() || !within(root, await fs.realpath(dir))) throw Error('工程中不允许链接目录');
  }
  const stat = await fs.lstat(full).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
  if (stat?.isSymbolicLink() || (stat && !stat.isFile())) throw Error('目标不是普通文件');
  return full;
}

async function loadProject(input) {
  let root = await fs.realpath(input);
  if (await fs.stat(path.join(root, 'src/main/resources/menus')).catch(() => null)) root = await fs.realpath(path.join(root, 'src/main/resources'));
  if (!await fs.stat(path.join(root, 'menus')).catch(() => null)) throw Error('请选择包含 menus 的 FutureUI 配置目录，或插件源码目录');
  const files = [], images = [];
  let bytes = 0;
  async function walk(dir, prefix = '') {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) { if (prefix || folders.has(entry.name)) await walk(path.join(dir, entry.name), rel); continue; }
      if (!entry.isFile() || (!prefix && rel !== 'config.yml')) continue;
      const yaml = /\.ya?ml$/i.test(rel), png = /^assets\/textures\/.*\.png$/i.test(rel);
      if (!yaml && !png) continue;
      const data = await fs.readFile(await destination(root, rel));
      bytes += data.length;
      if (bytes > 64 * 1024 * 1024 || data.length > 8 * 1024 * 1024 || files.length > 4000) throw Error('工程超过载入上限（64 MB / 4000 个配置文件）');
      if (yaml) {
        if (data.subarray(0, 3).equals(Buffer.from([239, 187, 191]))) throw Error(`${rel} 含 UTF-8 BOM，请先移除`);
        files.push({ path: rel, text: new TextDecoder('utf-8', { fatal: true }).decode(data), hash: hash(data) });
      } else images.push({ path: rel, url: `data:image/png;base64,${data.toString('base64')}` });
    }
  }
  await walk(root);
  const id = randomUUID(); roots.set(id, root);
  return { id, root, name: path.basename(root) === 'resources' ? path.basename(path.resolve(root, '../../..')) : path.basename(root), files, images };
}

function getRoot(id) { const root = roots.get(id); if (!root) throw Error('工程已关闭，请重新打开'); return root; }
function verifyText(file) {
  if (typeof file.text !== 'string' || Buffer.byteLength(file.text) > 8 * 1024 * 1024 || file.text.startsWith('\uFEFF')) throw Error('配置内容无效');
  relative(file.path);
  if (!/\.ya?ml$/i.test(file.path)) throw Error('只允许保存 YAML 配置');
  const parsed = parseDocument(file.text, { uniqueKeys: true });
  if (parsed.errors.length) throw Error(`${file.path}: ${parsed.errors[0].message}`);
  parsed.toJS({ maxAliasCount: 100 });
}

async function saveFiles(id, files) {
  const root = getRoot(id);
  if (!Array.isArray(files) || !files.length || files.length > 4000) throw Error('没有可保存的文件');
  if (new Set(files.map(f => f.path)).size !== files.length) throw Error('存在重复文件路径');
  const prepared = [];
  for (const file of files) {
    verifyText(file);
    const full = await destination(root, file.path, true);
    const before = await fs.readFile(full).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
    if ((before ? hash(before) : null) !== file.hash) throw Error(`${file.path} 已被其他程序修改。请重新载入后合并，未覆盖磁盘文件。`);
    prepared.push({ ...file, full, before, after: hash(Buffer.from(file.text)) });
  }
  const revision = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const backup = path.join(root, '.futureui-studio', 'backups', revision);
  const meta = path.join(root, '.futureui-studio');
  for (const dir of [meta, path.join(meta, 'backups')]) {
    await fs.mkdir(dir).catch(e => { if (e.code !== 'EEXIST') throw e; });
    if ((await fs.lstat(dir)).isSymbolicLink()) throw Error('备份目录不能是链接');
  }
  await fs.mkdir(backup);
  for (const file of prepared) {
    if (file.before) { const dest = path.join(backup, file.path); await fs.mkdir(path.dirname(dest), { recursive: true }); await fs.writeFile(dest, file.before); }
  }
  await fs.writeFile(path.join(backup, 'revision.json'), JSON.stringify({ revision, created: new Date().toISOString(), files: prepared.map(f => ({ path: f.path, existed: !!f.before, before: f.before ? hash(f.before) : null, after: f.after })) }, null, 2), 'utf8');
  const applied = [];
  try {
    for (const file of prepared) {
      const current = await fs.readFile(await destination(root, file.path)).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
      if ((current ? hash(current) : null) !== file.hash) throw Error(`${file.path} 在保存过程中被外部修改，保存已停止。`);
      const temporary = `${file.full}.${revision}.tmp`;
      await fs.writeFile(temporary, file.text, { encoding: 'utf8', flag: 'wx' });
      try { await fs.rename(temporary, file.full); applied.push(file); } finally { await fs.unlink(temporary).catch(() => {}); }
    }
  } catch (error) {
    for (const file of applied.reverse()) {
      const current = await fs.readFile(file.full).catch(() => null);
      if (current && hash(current) === file.after) { if (file.before) await fs.writeFile(file.full, file.before); else await fs.unlink(file.full); }
    }
    throw error;
  }
  return { revision, files: prepared.map(f => ({ path: f.path, hash: f.after })) };
}

async function importImage(id, source) {
  const root = getRoot(id), data = await fs.readFile(source);
  if (data.length > 8 * 1024 * 1024 || data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error('请选择不超过 8 MB 的 PNG 图片');
  const name = path.basename(source).replace(/[^a-zA-Z0-9_.-]/g, '_');
  const rel = `assets/textures/studio/${hash(data).slice(0, 8)}-${name}`;
  await fs.writeFile(await destination(root, rel, true), data, { flag: 'wx' }).catch(e => { if (e.code !== 'EEXIST') throw e; });
  return { path: rel, url: `data:image/png;base64,${data.toString('base64')}` };
}

module.exports = { loadProject, saveFiles, importImage, getRoot, destination, verifyText, hash };
