const { contextBridge, ipcRenderer } = require('electron');
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args).then(result => {
  if (!result.ok) throw Error(result.error); return result.value;
});
contextBridge.exposeInMainWorld('studio', {
  language: {
    state: () => invoke('language:state'),
    set: preference => invoke('language:set', preference),
    onState: handler => { const listener = (_event, value) => handler(value); ipcRenderer.on('language:state', listener); return () => ipcRenderer.removeListener('language:state', listener); },
  },
  bootstrap: () => invoke('project:bootstrap'),
  open: () => invoke('project:open'),
  create: () => invoke('project:create'),
  refresh: id => invoke('project:refresh', id),
  save: (id, files) => invoke('project:save', id, files),
  export: (id, files) => invoke('project:export', id, files),
  importImage: id => invoke('project:image', id),
  reveal: id => invoke('project:reveal', id),
  openLink: url => invoke('link:open', url),
  server: (settings, operation, player, menu) => invoke('server:command', settings, operation, player, menu),
  transfer: {
    import: kind => invoke('project:import-config', kind),
    export: (id, files, format, assets) => invoke('project:export-selection', id, files, format, assets),
  },
  history: {
    list: id => invoke('project:history-list', id),
    read: (id, node) => invoke('project:history-read', id, node),
  },
  updates: {
    state: () => invoke('updates:state'),
    check: () => invoke('updates:check'),
    download: () => invoke('updates:download'),
    cancel: () => invoke('updates:cancel'),
    install: () => invoke('updates:install'),
    autoCheck: value => invoke('updates:auto-check', value),
    onState: handler => { const listener = (_event, value) => handler(value); ipcRenderer.on('updates:state', listener); return () => ipcRenderer.removeListener('updates:state', listener); },
    onOpen: handler => { const listener = () => handler(); ipcRenderer.on('updates:open', listener); return () => ipcRenderer.removeListener('updates:open', listener); },
  },
  ai: {
    settings: () => invoke('ai:settings'),
    conversations: id => invoke('ai:conversations', id),
    saveConversations: (id, value) => invoke('ai:save-conversations', id, value),
    saveSettings: settings => invoke('ai:save-settings', settings),
    models: () => invoke('ai:models'),
    skills: () => invoke('ai:skills'),
    enableSkill: (id, enabled) => invoke('ai:enable-skill', id, enabled),
    readSkill: (id, path) => invoke('ai:read-skill', id, path),
    importSkill: kind => invoke('ai:import-skill', kind),
    start: input => invoke('ai:start', input),
    cancel: id => invoke('ai:cancel', id),
    onEvent: handler => { const listener = (_e,value) => handler(value); ipcRenderer.on('ai:event',listener); return () => ipcRenderer.removeListener('ai:event',listener); }
  },
  dirty: value => ipcRenderer.send('project:dirty', !!value),
  window: action => ipcRenderer.send('window:action', action),
  onMenu: handler => { const listener = (_e, value) => handler(value); ipcRenderer.on('menu:action', listener); return () => ipcRenderer.removeListener('menu:action', listener); },
});
