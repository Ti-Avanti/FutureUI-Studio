const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

async function loadConfiguration(app) {
  const value = JSON.parse(await fs.readFile(path.join(app.getAppPath(), 'resources/updates.json'), 'utf8'));
  if (value.provider !== 'github' || !/^[a-z0-9-]+$/i.test(value.owner ?? '') || !/^[a-z0-9_.-]+$/i.test(value.repo ?? '')) {
    throw Error('更新源配置无效，请检查 resources/updates.json');
  }
  const interval = Number(value.checkIntervalMinutes);
  if (!Number.isInteger(interval) || interval < 15 || interval > 10080 || typeof value.checkOnStartup !== 'boolean') {
    throw Error('更新检查间隔须为 15–10080 分钟，启动检查须为布尔值');
  }
  return {
    feed: { provider: 'github', owner: value.owner, repo: value.repo, private: false },
    releaseUrl: `https://github.com/${value.owner}/${value.repo}/releases`,
    autoCheck: value.checkOnStartup,
    intervalMs: interval * 60_000,
  };
}

function preferenceStore(app) {
  const file = path.join(app.getPath('userData'), 'update-preferences.json');
  let pending = Promise.resolve();
  return {
    async read(fallback) {
      const value = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => null);
      return typeof value?.autoCheck === 'boolean' ? value.autoCheck : fallback;
    },
    save(autoCheck) {
      if (typeof autoCheck !== 'boolean') throw Error('无效的更新检查选项');
      const operation = pending.catch(() => {}).then(async () => {
        const temporary = `${file}.${randomUUID()}.tmp`;
        await fs.writeFile(temporary, JSON.stringify({ autoCheck }), { encoding: 'utf8', mode: 0o600 });
        await fs.rename(temporary, file);
      });
      pending = operation;
      return operation;
    },
  };
}

async function distribution(app) {
  if (!app.isPackaged) return 'development';
  if (process.platform !== 'win32') return 'unsupported';
  if (process.env.PORTABLE_EXECUTABLE_FILE) return 'portable';
  const marker = path.join(process.resourcesPath, 'studio-installed');
  return await fs.readFile(marker, 'utf8').then(value => value.trim() === 'nsis' ? 'installed' : 'directory').catch(() => 'directory');
}

module.exports = { loadConfiguration, preferenceStore, distribution };
