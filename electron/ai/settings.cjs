const fs = require('node:fs/promises');
const path = require('node:path');
let filename, vault, memoryKey = '';
const defaults = { baseURL: 'https://api.openai.com/v1', model: '', protocol: 'chat', tokenField: 'max_tokens', maxTokens: 8192, maxSteps: 16, contextLimit:128000, compressionThreshold:85, anthropicThinking:'off', thinkingBudget:1024, reasoningSummary: false, rememberKey: true };
function init(userData, safeStorage) { filename = path.join(userData, 'ai-settings.json'); vault = safeStorage; }
async function stored() { return fs.readFile(filename, 'utf8').then(JSON.parse).catch(e => { if (e.code === 'ENOENT') return {}; throw Error('AI 设置无法读取'); }); }
function normalize(value) {
  const settings = { ...defaults, ...value };
  let url; try { url = new URL(String(settings.baseURL).trim()); } catch { throw Error('Base URL 格式不正确'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw Error('Base URL 只能包含 HTTP(S) 地址和路径');
  settings.baseURL = url.href.replace(/\/+$/, '').replace(/\/(?:chat\/completions|responses|messages)$/, '');
  settings.model = String(settings.model ?? '').trim().slice(0,200);
  if (!['chat','responses','anthropic'].includes(settings.protocol)) throw Error('不支持的 API 协议');
  if (!['max_tokens','max_completion_tokens'].includes(settings.tokenField)) throw Error('无效的输出参数');
  settings.maxTokens = Math.max(256, Math.min(65536, Math.floor(Number(settings.maxTokens) || 8192)));
  settings.maxSteps = Math.max(1, Math.min(40, Math.floor(Number(settings.maxSteps) || 16)));
  if(!['off','adaptive','enabled'].includes(settings.anthropicThinking))throw Error('无效的思考方式');
  settings.thinkingBudget=Math.max(1024,Math.min(32768,Math.floor(Number(settings.thinkingBudget)||1024)));
  settings.contextLimit = Math.max(4096, Math.min(2000000, Math.floor(Number(settings.contextLimit) || 128000)));
  settings.compressionThreshold = Math.max(50, Math.min(95, Math.floor(Number(settings.compressionThreshold) || 85)));
  return Object.fromEntries(Object.keys(defaults).map(key => [key, settings[key]]));
}
async function keyFor(data) {
  if (memoryKey) return memoryKey;
  if (!data.encryptedKey) return '';
  if (!vault.isEncryptionAvailable()) throw Error('系统密钥存储不可用，请重新输入 API Key');
  try { return vault.decryptString(Buffer.from(data.encryptedKey, 'base64')); } catch { throw Error('无法解密 API Key，请在当前设备重新输入'); }
}
async function read() { const data = await stored(); return { ...normalize(data), hasKey: !!(memoryKey || data.encryptedKey), secureStorage: vault.isEncryptionAvailable() }; }
async function save(input) {
  const before = await stored(), settings = normalize(input);
  let key = input.keyAction === 'clear' ? '' : input.keyAction === 'replace' ? String(input.apiKey ?? '').trim() : await keyFor(before);
  if (key.length > 8192 || /[\r\n]/.test(key)) throw Error('API Key 格式不正确');
  const encryptedKey = key && settings.rememberKey ? (vault.isEncryptionAvailable() ? vault.encryptString(key).toString('base64') : null) : null;
  if (key && settings.rememberKey && !encryptedKey) throw Error('系统加密不可用；请关闭“在此设备保存密钥”，改用仅会话保存');
  const temporary = `${filename}.tmp`;
  await fs.writeFile(temporary, JSON.stringify({ ...settings, encryptedKey }), { encoding:'utf8', mode:0o600 });
  await fs.rename(temporary, filename); memoryKey = key;
  return read();
}
async function credentials() { const data = await stored(); return { ...normalize(data), apiKey: await keyFor(data) }; }
module.exports = { init, read, save, credentials };
