import { memo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAgent } from '../../agent/store';
export const MarkdownMessage=memo(function MarkdownMessage({text}:{text:string}){
  return <div className="agent-prose"><Markdown skipHtml remarkPlugins={[remarkGfm]} components={{a:({href,children})=><a href={href} onClick={e=>{e.preventDefault();if(href)window.studio.openLink(href).catch(error=>useAgent.getState().set({error:error.message}));}}>{children}</a>}}>{text}</Markdown></div>;
});
