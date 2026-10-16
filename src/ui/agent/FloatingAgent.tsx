import { useEffect, useRef, useState } from 'react';
export function FloatingAgent({children}:{children:React.ReactNode}){
  const [position,setPosition]=useState({x:Math.max(12,window.innerWidth-650),y:70});
  const drag=useRef<{x:number;y:number;left:number;top:number}|null>(null);
  const windowRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{const clamp=()=>{const box=windowRef.current?.getBoundingClientRect();if(box)setPosition(p=>({x:Math.max(0,Math.min(window.innerWidth-box.width,p.x)),y:Math.max(36,Math.min(window.innerHeight-60,p.y))}));};window.addEventListener('resize',clamp);return()=>window.removeEventListener('resize',clamp);},[]);
  return <div className="agent-float-shade"><div className="agent-float" ref={windowRef} style={{left:position.x,top:position.y}} onPointerDown={e=>{
    const target=e.target as HTMLElement;if(!target.closest('.agent-toolbar')||target.closest('button,input,select'))return;
    drag.current={x:e.clientX,y:e.clientY,left:position.x,top:position.y};e.currentTarget.setPointerCapture(e.pointerId);
  }} onPointerMove={e=>{if(!drag.current)return;const box=e.currentTarget.getBoundingClientRect();setPosition({x:Math.max(0,Math.min(window.innerWidth-box.width,drag.current.left+e.clientX-drag.current.x)),y:Math.max(36,Math.min(window.innerHeight-60,drag.current.top+e.clientY-drag.current.y))});}} onPointerUp={()=>drag.current=null}>{children}</div></div>;
}
