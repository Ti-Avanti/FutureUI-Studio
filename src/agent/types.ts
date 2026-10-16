import type { Issue, Origin, ProjectFile } from '../model/types';
export interface AISettings { baseURL:string; model:string; protocol:'chat'|'responses'|'anthropic'; tokenField:'max_tokens'|'max_completion_tokens'; maxTokens:number; maxSteps:number; contextLimit:number; compressionThreshold:number; anthropicThinking:'off'|'adaptive'|'enabled'; thinkingBudget:number; reasoningSummary:boolean; rememberKey:boolean; hasKey:boolean; secureStorage:boolean }
export interface Skill { id:string; name:string; description:string; version:string; hash:string; files:string[]; updatedAt:string; enabled:boolean; builtin:boolean }
export interface Attachment { id:string; kind:'asset'|'selection'|'file'|'preview'; name:string; resourceId?:string; path?:string; url?:string }
export interface Proposal { path:string; before:string|null; after:string; summary:string }
export interface ToolTrace { callId:string; name:string; target:string; status:'running'|'done'|'error'; message?:string }
export interface AgentMessage { id:string; role:'user'|'assistant'; text:string; thinking?:string; thinkingKind?:'provided'|'summary'; tools?:ToolTrace[]; attachments?:Attachment[]; status?:string }
export interface ContextUsage { used:number;limit:number;reserved:number;estimated:boolean;compressions:number;threshold:number }
export interface Conversation {
  id:string;title:string;archived:boolean;createdAt:number;messages:AgentMessage[];draft:string;attachments:Attachment[];
  running:boolean;runId:string|null;projectId:string|null;proposals:Proposal[];tokens:number;step:number;limit:number;status:string;error:string;
  summary:string;historyStart:number;context:ContextUsage|null;compacting:boolean;
}
export interface ConversationArchive { activeId:string;sessions:Conversation[] }
export interface AgentEvent { runId:string; type:string; delta?:string; kind?:'provided'|'summary'; message?:string; step?:number; limit?:number; tokens?:number; proposals?:Proposal[]; callId?:string; name?:string; target?:string; status?:'running'|'done'|'error';context?:ContextUsage;summary?:string;compressions?:number }
export interface AgentRequest { runId:string;conversationId:string;projectId:string;prompt:string;files:ProjectFile[];active:string;selected:Origin|null;locale:string;issues:Issue[];skills:string[];vision:boolean;attachments:Attachment[];assets:{id:string;path:string;url?:string}[];history:{role:'user'|'assistant';content:string}[];summary:string;compressions:number }
export interface AIAPI { settings():Promise<AISettings>;saveSettings(settings:Partial<AISettings>&{apiKey?:string;keyAction?:'keep'|'replace'|'clear'}):Promise<AISettings>;models():Promise<string[]>;skills():Promise<Skill[]>;enableSkill(id:string,enabled:boolean):Promise<Skill[]>;readSkill(id:string,path:string):Promise<string>;importSkill(kind:'folder'|'file'):Promise<(Skill&{updated:boolean})|null>;start(input:AgentRequest):Promise<void>;cancel(id:string):Promise<void>;onEvent(handler:(event:AgentEvent)=>void):()=>void;conversations(projectId:string):Promise<ConversationArchive|null>;saveConversations(projectId:string,value:ConversationArchive):Promise<void> }
