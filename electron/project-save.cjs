const { tr } = require('./i18n.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { destination, relative, verifyText, collectProject, metadataDirectory, hash, limits } = require('./project-files.cjs');
const history = require('./project-history.cjs');
const pending = new Map();
const readExisting = full => fs.readFile(full).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
const digest = value => value === null ? null : hash(value);

async function saveProject(root, files) {
  const previous = pending.get(root) ?? Promise.resolve();
  const operation = previous.catch(() => {}).then(() => save(root, files));
  pending.set(root, operation);
  try { return await operation; } finally { if (pending.get(root) === operation) pending.delete(root); }
}

async function save(root, files) {
  if (!Array.isArray(files) || !files.length || files.length > limits.count) throw Error(tr("没有可保存的文件"));
  if (new Set(files.map(f => f.path.toLowerCase())).size !== files.length) throw Error(tr("存在重复文件路径"));
  const currentFiles = (await collectProject(root, false)).files;
  const canonical = new Map(currentFiles.map(f => [f.path.toLowerCase(), f.path]));
  const prepared = [];
  for (const file of files) {
    if (file.text === null) { relative(file.path); if (!/\.ya?ml$/i.test(file.path)) throw Error(tr("只允许移除 YAML 配置")); }
    else verifyText(file);
    if (canonical.has(file.path.toLowerCase()) && canonical.get(file.path.toLowerCase()) !== file.path) throw Error(tr("{0} 与已有路径大小写冲突", file.path));
    const full = await destination(root, file.path, true), before = await readExisting(full);
    if (digest(before) !== file.hash) throw Error(tr("{0} 已被其他程序修改。请重新载入后合并，未覆盖磁盘文件。", file.path));
    prepared.push({ ...file, full, before, after: file.text === null ? null : hash(Buffer.from(file.text)) });
  }
  const next = new Map(currentFiles.map(f => [f.path, f]));
  for (const f of prepared) { if (f.text === null) next.delete(f.path); else next.set(f.path, { path: f.path, text: f.text }); }
  if (next.size > limits.count || [...next.values()].reduce((n, f) => n + Buffer.byteLength(f.text), 0) > limits.total) throw Error(tr("合并后的工程超过 64 MB / 4000 个配置文件"));
  await history.capture(root, currentFiles, tr("保存前状态"));
  const revision = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const backup = path.join(await metadataDirectory(root, 'backups'), revision);
  await fs.mkdir(backup);
  for (const file of prepared) {
    if (file.before !== null) { const dest = path.join(backup, file.path); await fs.mkdir(path.dirname(dest), { recursive: true }); await fs.writeFile(dest, file.before); }
  }
  await fs.writeFile(path.join(backup, 'revision.json'), JSON.stringify({ revision, created: new Date().toISOString(), files: prepared.map(f => ({ path: f.path, existed: f.before !== null, before: digest(f.before), after: f.after })) }, null, 2), 'utf8');
  const applied = [];
  try {
    for (const file of prepared) {
      if (digest(await readExisting(await destination(root, file.path))) !== file.hash) throw Error(tr("{0} 在保存过程中被外部修改，保存已停止。", file.path));
      if (file.text === null) { if (file.before !== null) await fs.unlink(file.full); applied.push(file); continue; }
      const temporary = `${file.full}.${revision}.tmp`;
      await fs.writeFile(temporary, file.text, { encoding: 'utf8', flag: 'wx' });
      try { await fs.rename(temporary, file.full); applied.push(file); } finally { await fs.unlink(temporary).catch(() => {}); }
    }
    await history.capture(root, [...next.values()], tr("保存 {0} 个文件", prepared.length));
  } catch (error) {
    const failures = [];
    for (const file of applied.reverse()) {
      try {
        const full = await destination(root, file.path);
        if (digest(await readExisting(full)) !== file.after) { failures.push(file.path); continue; }
        if (file.before !== null) await fs.writeFile(full, file.before); else await fs.unlink(full).catch(e => { if (e.code !== 'ENOENT') throw e; });
      } catch { failures.push(file.path); }
    }
    if (failures.length) throw Error(tr("{0}；部分文件被外部修改，无法自动复原：{1}。恢复副本位于 {2}", error.message, failures.join('、'), backup));
    throw error;
  }
  return { revision, files: prepared.map(f => ({ path: f.path, hash: f.after })) };
}

module.exports = { saveProject };
