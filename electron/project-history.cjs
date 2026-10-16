const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { promisify } = require('node:util');
const gzip = promisify(require('node:zlib').gzip), gunzip = promisify(require('node:zlib').gunzip);
const { metadataDirectory, relative, hash, limits } = require('./project-files.cjs');
const maxNodes = 30, maxStorage = 256 * 1024 * 1024;

async function safeRead(file, max) {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > max) throw Error('保存节点文件无效或超过大小限制');
  return fs.readFile(file);
}

async function index(root) {
  const dir = await metadataDirectory(root, 'snapshots');
  const records = await safeRead(path.join(dir, 'index.json'), 1024 * 1024).then(b => JSON.parse(b.toString('utf8'))).catch(e => { if (e.code === 'ENOENT') return []; throw Error('保存节点索引无法读取，请保留 .futureui-studio 目录后检查文件'); });
  if (!Array.isArray(records) || records.length > maxNodes || records.some(n => !n || !/^[\d]+-[a-f0-9-]{36}$/.test(n.id) || typeof n.label !== 'string' || !Number.isFinite(n.time) || !Number.isInteger(n.size) || n.size < 0 || !Number.isInteger(n.count) || n.count < 0 || !/^[a-f0-9]{64}$/.test(n.fingerprint))) throw Error('保存节点索引格式无效');
  return { dir, records };
}

async function list(root) { return (await index(root)).records.map(({ fingerprint, ...node }) => node); }

async function capture(root, files, label) {
  const { dir, records } = await index(root);
  const content = files.map(({ path, text }) => ({ path, text })).sort((a, b) => a.path.localeCompare(b.path));
  const fingerprint = hash(JSON.stringify(content));
  if (records.at(-1)?.fingerprint === fingerprint) return records.at(-1).id;
  const time = Date.now(), id = `${time}-${randomUUID()}`;
  const data = await gzip(Buffer.from(JSON.stringify({ version: 1, files: content }), 'utf8'));
  if (data.length > 64 * 1024 * 1024) throw Error('保存节点超过大小限制');
  const snapshot = path.join(dir, `${id}.json.gz`);
  await fs.writeFile(snapshot, data, { flag: 'wx' });
  const next = [...records, { id, time, label: label.slice(0, 100), count: files.length, size: data.length, fingerprint }];
  const removed = [];
  let size = next.reduce((total, n) => total + n.size, 0);
  while (next.length > maxNodes || next.length > 1 && size > maxStorage) { const old = next.shift(); size -= old.size; removed.push(old); }
  const target = path.join(dir, 'index.json'), temporary = `${target}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, JSON.stringify(next), { encoding: 'utf8', flag: 'wx' }); await fs.rename(temporary, target); }
  catch (error) { await fs.unlink(snapshot).catch(() => {}); throw error; }
  finally { await fs.unlink(temporary).catch(() => {}); }
  await Promise.all(removed.map(n => fs.unlink(path.join(dir, `${n.id}.json.gz`)).catch(() => {})));
  return id;
}

async function read(root, id) {
  const { dir, records } = await index(root);
  const record = records.find(n => n.id === id);
  if (!record) throw Error('保存节点不存在或已超过保留范围');
  const bytes = await safeRead(path.join(dir, `${id}.json.gz`), 64 * 1024 * 1024);
  const data = JSON.parse((await gunzip(bytes, { maxOutputLength: 192 * 1024 * 1024 })).toString('utf8'));
  if (data.version !== 1 || !Array.isArray(data.files) || data.files.length > limits.count) throw Error('保存节点格式无效');
  let size = 0;
  for (const file of data.files) {
    relative(file.path);
    if (!/\.ya?ml$/i.test(file.path) || typeof file.text !== 'string' || file.text.startsWith('\uFEFF')) throw Error('保存节点包含无效配置');
    const length = Buffer.byteLength(file.text); size += length;
    if (length > limits.file || size > limits.total) throw Error('保存节点超过工程限制');
  }
  if (new Set(data.files.map(f => f.path.toLowerCase())).size !== data.files.length) throw Error('保存节点含重复路径');
  if (hash(JSON.stringify(data.files)) !== record.fingerprint) throw Error('保存节点内容校验失败，未恢复配置');
  return data.files;
}

module.exports = { list, read, capture };
