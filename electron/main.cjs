const { tr } = require('./i18n.cjs');
const interfaceLanguage = require('./i18n.cjs');
const { app, BrowserWindow, dialog, ipcMain, shell, Menu, session, safeStorage, screen } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const project = require('./project.cjs');
const { exportProject } = require('./export.cjs');
const server = require('./server.cjs');
const { registerAI } = require('./ai/index.cjs');
const agent = require('./ai/agent.cjs');
const { registerUpdates } = require('./updates/service.cjs');
const { registerConfigTools } = require('./config-tools.cjs');
const { createProjectBootstrap } = require('./project-bootstrap.cjs');
let window, updates, dirty = false, activeOperations = 0;
function register(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) return { ok: false, error: tr("无效请求来源") };
    const protectedOperation = channel.startsWith('project:') || channel.startsWith('ai:') || channel === 'updates:auto-check';
    if (protectedOperation && updates?.state.phase === 'installing') return { ok: false, error: tr("正在安装更新，请稍候") };
    if (protectedOperation) activeOperations++;
    try { return { ok: true, value: await handler(...args) }; }
    catch (e) { return { ok: false, error: e.message || String(e) }; }
    finally { if (protectedOperation) activeOperations--; }
  });
}
async function start() {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await interfaceLanguage.initialize(app);
  const projects = createProjectBootstrap(app);
  const workArea = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const width = Math.min(1560, workArea.width - 16), height = Math.min(1000, workArea.height - 16);
  window = new BrowserWindow({ width, height, minWidth: Math.min(1050, width), minHeight: Math.min(700, height),
    x: workArea.x + Math.floor((workArea.width - width) / 2), y: workArea.y + Math.floor((workArea.height - height) / 2),
    title: 'FutureUI Studio', backgroundColor: '#181a1f', show: false,
    icon: path.join(app.getAppPath(), 'resources/branding/icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#191b20', symbolColor: '#a5abb8', height: 36 } });
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_w, _p, callback) => callback(false));
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  interfaceLanguage.registerLanguage(register, window);
  register('project:bootstrap', () => projects.restore(process.argv.find(a => a.startsWith('--project='))?.slice(10)));
  register('project:open', async () => { const chosen = await dialog.showOpenDialog(window, { title: tr("打开 FutureUI 工程"), properties: ['openDirectory'] }); return chosen.canceled ? null : projects.remember(await project.loadProject(chosen.filePaths[0])); });
  register('project:create', async () => { const chosen = await dialog.showOpenDialog(window, { title: tr("选择新工程保存位置"), properties: ['openDirectory', 'createDirectory'] }); return chosen.canceled ? null : projects.create(chosen.filePaths[0]); });
  register('project:refresh', id => project.loadProject(project.getRoot(id)));
  register('project:save', project.saveFiles);
  register('project:export', async (id, files) => { const chosen = await dialog.showSaveDialog(window, { title: tr("导出 FutureUI 配置包"), defaultPath: `${path.basename(project.getRoot(id))}.zip`, filters: [{ name: tr("配置包"), extensions: ['zip'] }] }); return chosen.canceled ? null : exportProject(id, files, chosen.filePath); });
  register('project:image', async id => { const chosen = await dialog.showOpenDialog(window, { title: tr("导入像素图片"), filters: [{ name: tr("PNG 图片"), extensions: ['png'] }], properties: ['openFile'] }); return chosen.canceled ? null : project.importImage(id, chosen.filePaths[0]); });
  register('project:reveal', id => shell.openPath(project.getRoot(id)));
  register('server:command', server.command);
  register('link:open', value => { const url = new URL(String(value)); if (!['https:','http:'].includes(url.protocol)) throw Error(tr("只允许打开 HTTP(S) 链接")); return shell.openExternal(url.href); });
  registerAI({ app, window, dialog, safeStorage, register });
  registerConfigTools({ window, dialog, register });
  updates = registerUpdates({ app, window, register, canInstall: () => {
    if (dirty) return tr("请先保存工程中的修改，再安装更新");
    if (agent.isRunning()) return tr("Agent 仍在执行任务，请等待完成或先停止任务");
    if (activeOperations) return tr("文件或会话正在处理中，请稍后再安装更新");
    return '';
  } });
  ipcMain.on('project:dirty', (event, value) => { if (event.sender === window.webContents) dirty = !!value; });
  ipcMain.on('window:action', (event, action) => { if (event.sender !== window.webContents) return; if (action === 'minimize') window.minimize(); if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize(); if (action === 'close') window.close(); });
  window.on('close', event => { if (dirty && dialog.showMessageBoxSync(window, { type: 'question', title: tr("尚有未保存的修改"), message: tr("关闭前请保存工程。"), buttons: [tr("返回编辑"), tr("放弃修改并关闭")], defaultId: 0, cancelId: 0 }) === 0) event.preventDefault(); });
  window.once('ready-to-show', () => window.show());
  if (process.env.STUDIO_DEV_URL) await window.loadURL(process.env.STUDIO_DEV_URL); else await window.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
}
app.setAppUserModelId('gg.fotia.futureui.studio');
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(start).catch(error => { dialog.showErrorBox('FutureUI Studio', error.message); app.quit(); });
}
app.on('window-all-closed', () => app.quit());
