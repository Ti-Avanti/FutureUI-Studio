const { tr } = require('./i18n.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { parseDocument } = require('yaml');

const folders = new Set(['menus', 'templates', 'languages', 'shops', 'assets', 'functions', 'rules', 'hud']);
const limits = { file: 8 * 1024 * 1024, total: 64 * 1024 * 1024, count: 4000 };
const hash = value => createHash('sha256').update(value).digest('hex');
const within = (root, target) => target === root || target.startsWith(root + path.sep);

function relative(value) {
  if (typeof value !== 'string' || !value || /[\\\x00-\x1f:*?"<>|]/.test(value) || path.isAbsolute(value)) throw Error(tr("无效的工程路径"));
  const parts = value.split('/');
  if (parts.some(p => !p || p === '..' || p === '.' || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) throw Error(tr("工程路径含有不允许的名称"));
  if (!folders.has(parts[0]) && value !== 'config.yml') throw Error(tr("文件不在 FutureUI 配置目录中"));
  return value;
}

async function destination(root, rel, create = false) {
  relative(rel);
  const full = path.resolve(root, rel);
  if (!within(root, full)) throw Error(tr("路径超出工程范围"));
  let dir = root;
  for (const part of rel.split('/').slice(0, -1)) {
    dir = path.join(dir, part);
    if (create) await fs.mkdir(dir).catch(e => { if (e.code !== 'EEXIST') throw e; });
    const stat = await fs.lstat(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink() || !within(root, await fs.realpath(dir))) throw Error(tr("工程中不允许链接目录"));
  }
  const stat = await fs.lstat(full).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
  if (stat?.isSymbolicLink() || (stat && !stat.isFile())) throw Error(tr("目标不是普通文件"));
  return full;
}

function verifyText(file) {
  relative(file.path);
  if (!/\.ya?ml$/i.test(file.path)) throw Error(tr("只允许保存 YAML 配置"));
  if (typeof file.text !== 'string' || Buffer.byteLength(file.text) > limits.file || file.text.startsWith('\uFEFF')) throw Error(tr("配置内容无效"));
  const parsed = parseDocument(file.text, { uniqueKeys: true });
  if (parsed.errors.length) throw Error(`${file.path}: ${parsed.errors[0].message}`);
  parsed.toJS({ maxAliasCount: 100 });
}

async function collectProject(root, includeImages = true) {
  const files = [], images = [];
  let bytes = 0;
  async function walk(dir, prefix = '') {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) { if (prefix || folders.has(entry.name)) await walk(path.join(dir, entry.name), rel); continue; }
      if (!entry.isFile() || (!prefix && rel !== 'config.yml')) continue;
      const yaml = /\.ya?ml$/i.test(rel), png = includeImages && /^assets\/textures\/.*\.png$/i.test(rel);
      if (!yaml && !png) continue;
      const full = await destination(root, rel), size = (await fs.stat(full)).size;
      bytes += size;
      if (size > limits.file || bytes > limits.total || files.length >= limits.count) throw Error(tr("工程超过载入上限（64 MB / 4000 个配置文件）"));
      const data = await fs.readFile(full);
      if (yaml) {
        if (data.subarray(0, 3).equals(Buffer.from([239, 187, 191]))) throw Error(tr("{0} 含 UTF-8 BOM，请先移除", rel));
        files.push({ path: rel, text: new TextDecoder('utf-8', { fatal: true }).decode(data), hash: hash(data) });
      } else images.push({ path: rel, url: `data:image/png;base64,${data.toString('base64')}` });
    }
  }
  await walk(root);
  if (new Set(files.map(f => f.path.toLowerCase())).size !== files.length) throw Error(tr("存在仅大小写不同的配置路径"));
  return { files, images };
}

async function metadataDirectory(root, name) {
  let dir = root;
  for (const segment of ['.futureui-studio', name]) {
    dir = path.join(dir, segment);
    await fs.mkdir(dir).catch(e => { if (e.code !== 'EEXIST') throw e; });
    const stat = await fs.lstat(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink() || !within(root, await fs.realpath(dir))) throw Error(tr("编辑记录目录不能是链接"));
  }
  return dir;
}

module.exports = { folders, limits, relative, destination, verifyText, collectProject, metadataDirectory, hash, within };
