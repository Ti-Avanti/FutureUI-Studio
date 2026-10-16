const { NsisUpdater } = require('electron-updater');
const { loadConfiguration, preferenceStore, distribution } = require('./config.cjs');
const { release, updateError } = require('./presentation.cjs');
const { updateNotifications } = require('./notification.cjs');

class UpdateService {
  constructor({ app, window, canInstall }) {
    this.app = app;
    this.window = window;
    this.canInstall = canInstall;
    this.preferences = preferenceStore(app);
    this.notifications = updateNotifications(app, window);
    this.state = {
      revision: 0, phase: 'idle', currentVersion: app.getVersion(), distribution: 'development',
      autoCheck: false, releaseUrl: '', nextVersion: '', releaseName: '', releaseDate: '', releaseNotes: '',
      percent: 0, transferred: 0, total: 0, bytesPerSecond: 0, lastChecked: null, error: '', cancelling: false,
    };
    this.ready = this.initialize();
  }

  async initialize() {
    try {
      this.config = await loadConfiguration(this.app);
      const mode = await distribution(this.app);
      const autoCheck = await this.preferences.read(this.config.autoCheck);
      this.patch({ distribution: mode, autoCheck, releaseUrl: this.config.releaseUrl });
      if (mode !== 'installed') { this.patch({ phase: 'unsupported' }); return; }
      this.updater = new NsisUpdater(this.config.feed);
      // 检查可自动进行；下载、安装以及退出时安装都必须由用户分别点击触发。
      this.updater.autoDownload = false;
      this.updater.autoInstallOnAppQuit = false;
      this.updater.autoRunAppAfterInstall = true;
      this.updater.allowDowngrade = false;
      this.updater.allowPrerelease = false;
      this.updater.disableWebInstaller = true;
      this.updater.disableDifferentialDownload = false;
      this.updater.logger = { info() {}, warn() {}, error() {}, debug() {} };
      this.attachEvents();
      this.schedule(true);
    } catch (error) {
      this.patch({ phase: 'error', error: '更新模块无法初始化，请检查发布配置或重新安装编辑器。' });
    }
  }

  patch(value) {
    this.state = { ...this.state, ...value, revision: this.state.revision + 1 };
    if (!this.window.isDestroyed() && !this.window.webContents.isDestroyed()) this.window.webContents.send('updates:state', this.state);
  }

  attachEvents() {
    this.updater.on('update-available', info => {
      this.patch({ phase: 'available', ...release(info), error: '' });
      this.notifications.available(String(info.version));
    });
    this.updater.on('update-not-available', () => this.patch({ phase: 'current', nextVersion: '', releaseNotes: '', error: '' }));
    this.updater.on('download-progress', progress => this.patch({
      percent: Math.min(100, Math.max(0, Number(progress.percent) || 0)),
      transferred: Number(progress.transferred) || 0, total: Number(progress.total) || 0,
      bytesPerSecond: Number(progress.bytesPerSecond) || 0,
    }));
    this.updater.on('update-downloaded', info => {
      if (!this.state.cancelling) this.patch({ phase: 'downloaded', ...release(info), percent: 100, error: '' });
    });
    this.updater.on('error', error => {
      if (!this.state.cancelling) this.patch({ phase: this.state.phase === 'installing' ? 'downloaded' : 'error', error: updateError(error) });
    });
  }

  schedule(startup = false) {
    clearTimeout(this.startupTimer);
    clearInterval(this.interval);
    if (!this.updater || !this.state.autoCheck) return;
    const check = () => this.check().catch(() => {});
    if (startup) this.startupTimer = setTimeout(check, 8000);
    this.interval = setInterval(check, this.config.intervalMs);
  }

  async snapshot() { await this.ready; return this.state; }

  async setAutoCheck(value) {
    await this.ready;
    if (this.state.phase === 'installing') throw Error('正在安装更新，请稍候');
    await this.preferences.save(value);
    this.patch({ autoCheck: value });
    this.schedule();
    return this.state;
  }

  async check() {
    await this.ready;
    if (!this.updater || this.downloadPromise || ['downloaded', 'installing'].includes(this.state.phase)) return this.state;
    if (this.checkPromise) return this.checkPromise;
    this.checkPromise = this.performCheck().finally(() => { this.checkPromise = null; });
    return this.checkPromise;
  }

  async performCheck() {
    this.patch({ phase: 'checking', error: '' });
    try {
      const result = await this.updater.checkForUpdates();
      if (!result) throw Error('Update service is not active');
      this.cancellationToken = result?.cancellationToken ?? null;
      this.patch({ lastChecked: Date.now() });
    } catch (error) {
      this.patch({ phase: 'error', error: updateError(error) });
    }
    return this.state;
  }

  async download() {
    await this.ready;
    if (this.checkPromise) await this.checkPromise;
    if (this.downloadPromise || ['downloaded', 'installing'].includes(this.state.phase)) return this.state;
    if (!this.updater) throw Error('请安装正式安装版后使用应用内更新');
    if (!this.cancellationToken || this.cancellationToken.cancelled || this.state.phase === 'error') await this.check();
    if (this.state.phase !== 'available') throw Error('请先检查并找到可用的新版本');
    this.patch({ phase: 'downloading', percent: 0, transferred: 0, total: 0, error: '', cancelling: false });
    this.downloadPromise = this.performDownload().finally(() => { this.downloadPromise = null; });
    return this.state;
  }

  async performDownload() {
    try { await this.updater.downloadUpdate(this.cancellationToken); }
    catch (error) {
      if (!this.state.cancelling) this.patch({ phase: 'error', error: updateError(error) });
    } finally {
      if (this.state.cancelling) this.patch({ phase: 'available', cancelling: false, error: '' });
    }
  }

  cancel() {
    if (this.state.phase === 'downloading') {
      this.patch({ cancelling: true });
      this.cancellationToken?.cancel();
    }
    return this.state;
  }

  async install() {
    await this.ready;
    if (this.state.phase !== 'downloaded' || !this.updater) throw Error('请先完成更新包下载');
    const reason = this.canInstall();
    if (reason) throw Error(reason);
    this.patch({ phase: 'installing', error: '' });
    // 先完成 IPC 响应；安装前再次确认没有新写入或正在执行的 Agent 任务。
    this.installTimer = setTimeout(() => {
      const blocked = this.canInstall();
      if (blocked) { this.patch({ phase: 'downloaded', error: blocked }); return; }
      try { this.updater.quitAndInstall(true, true); }
      catch (error) { this.patch({ phase: 'downloaded', error: updateError(error) }); }
    }, 200);
    return this.state;
  }

  dispose() {
    clearTimeout(this.startupTimer);
    clearTimeout(this.installTimer);
    clearInterval(this.interval);
    this.notifications.dispose();
    if (this.state.phase === 'downloading') this.cancellationToken?.cancel();
  }
}

function registerUpdates(options) {
  const service = new UpdateService(options);
  const { register, app } = options;
  register('updates:state', () => service.snapshot());
  register('updates:check', () => service.check());
  register('updates:download', () => service.download());
  register('updates:cancel', () => service.cancel());
  register('updates:install', () => service.install());
  register('updates:auto-check', value => service.setAutoCheck(value));
  app.once('will-quit', () => service.dispose());
  return service;
}

module.exports = { registerUpdates };
