const fs = require('node:fs/promises');
const path = require('node:path');
const catalog = Object.assign({}, ...['editor', 'agent', 'transfer', 'system'].map(name => require(`../resources/i18n/${name}.en.json`)));
let state = { preference: 'auto', language: 'en', systemLanguage: 'en' };
let filename, writes = Promise.resolve();

const resolveLanguage = locale => /^zh(?:[-_]|$)/i.test(String(locale)) ? 'zh-CN' : 'en';
function tr(message, ...values) {
  const text = state.language === 'en' ? catalog[message] ?? message : message;
  return text.replace(/\{(\d+)\}/g, (match, index) => index < values.length ? String(values[index]) : match);
}

async function initialize(app) {
  const languages = app.getPreferredSystemLanguages();
  const systemLanguage = resolveLanguage(languages[0] || app.getSystemLocale());
  filename = path.join(app.getPath('userData'), 'ui-language.json');
  let saved;
  try { saved = JSON.parse(await fs.readFile(filename, 'utf8')); } catch { /* Invalid preferences fall back to the system language. */ }
  const preference = ['auto', 'zh-CN', 'en'].includes(saved?.preference) ? saved.preference : 'auto';
  state = { preference, systemLanguage, language: preference === 'auto' ? systemLanguage : preference };
}

function change(preference) {
  if (!['auto', 'zh-CN', 'en'].includes(preference)) return Promise.reject(Error(tr('不支持的界面语言')));
  const task = writes.then(async () => {
    const next = { ...state, preference, language: preference === 'auto' ? state.systemLanguage : preference };
    const temporary = `${filename}.tmp`;
    await fs.writeFile(temporary, JSON.stringify({ preference }), 'utf8');
    await fs.rename(temporary, filename);
    state = next;
    return { ...state };
  });
  writes = task.catch(() => {});
  return task;
}

function registerLanguage(register, window) {
  register('language:state', () => ({ ...state }));
  register('language:set', async preference => {
    const next = await change(preference);
    if (!window.isDestroyed()) window.webContents.send('language:state', next);
    return next;
  });
}

module.exports = { tr, initialize, registerLanguage, resolveLanguage, language: () => state.language };
