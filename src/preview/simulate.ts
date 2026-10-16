import { tr } from '../i18n';
import { useStudio } from '../state/store';
import { documentId } from '../model/documents';
import { condition, indexProject, resolver } from './environment';
import type { Config, Element } from '../model/types';

export function simulate(node: Element) {
  const state = useStudio.getState(); if (!state.project || node._enabled === false) return;
  const language = indexProject(state.project, state.locale).language;
  let variables = { ...state.variables }, scoped = { ...node._variables }, steps = 0;
  const notes: string[] = [];
  function run(actions: Config[]): boolean {
    for (const action of actions) {
      if (++steps > 128) { notes.push(tr("达到本地模拟步数上限")); return false; }
      const resolve = resolver(language, { ...scoped, ...variables });
      if (!condition(action.condition, resolve, variables)) continue;
      const key = String(resolve(action.key));
      switch (action.type) {
        case 'set-variable': variables[key] = resolve(action.value); break;
        case 'adjust-number': variables[key] = Math.max(Number(resolve(action.min ?? 0)), Math.min(Number(resolve(action.max ?? 9999)), Number(variables[key] ?? resolve(action.initial ?? 1)) + Number(resolve(action.delta ?? 1)))); break;
        case 'toggle': variables[key] = !variables[key]; break;
        case 'page': variables.page = Math.max(1, Math.min(Number(scoped.pages ?? variables.pages ?? 1), action.absolute !== undefined ? Number(action.absolute)+1 : Number(variables.page ?? 1) + Number(action.offset ?? 0))); break;
        case 'open-menu': { const id = resolve(action.menu), file = state.project!.files.find(f => f.path.startsWith('menus/') && documentId(f) === id); if (file) { Object.assign(variables, Object.fromEntries(Object.entries(action.arguments ?? {}).map(([k,v]) => [k,resolve(v)]))); state.openFile(file.path); } break; }
        case 'if': if (!run(condition(action.when, resolve, variables) ? action.then ?? [] : action.else ?? [])) return false; break;
        case 'require': if (!condition(action.requirements, resolve, variables)) { notes.push(tr("条件未通过 · 流程已停止")); return false; } break;
        case 'refresh': case 'sound': break;
        case 'message': notes.push(String(resolve(action.text))); break;
        case 'close': notes.push(tr("模拟关闭菜单")); break;
        default: notes.push(tr("{0} 需要游戏环境，本地未执行业务操作", action.type));
      }
    }
    return true;
  }
  run(node.actions ?? []);
  state.set({ variables, notice: notes.join(' · ') || tr("模拟状态已更新") });
}
