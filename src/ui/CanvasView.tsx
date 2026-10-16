import { useEffect, useRef, useState } from 'react';
import { MousePointer2, Hand, Type, ImagePlus, SquarePlus, Scan, ZoomIn, ZoomOut, Grid2X2, Play, Eye, Code2, Columns2, Maximize2 } from 'lucide-react';
import { useStudio } from '../state/store';
import { usePreview } from './context';
import { IconButton } from './controls';
import { paint } from '../preview/paint';
import { keyOf } from '../model/types';
import type { Box } from '../model/types';
import { simulate } from '../preview/simulate';
import { useAgent } from '../agent/store';
import { CodeEditor } from './CodeEditor';
import { loadPixelFont } from '../preview/pixel-font';
import { useCanvasViewport, zoomSteps } from './useCanvasViewport';

export function CanvasView({ onFocus }: { onFocus: () => void }) {
  const state = useStudio(), preview = usePreview();
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewport = useCanvasViewport(preview.width, preview.height, state.view);
  const { stage, scale, dpr, pan, setPan } = viewport;
  const [hover, setHover] = useState<string | null>(null), [repaint, setRepaint] = useState(0);
  const [hand, setHand] = useState(false), [interactive, setInteractive] = useState(false);
  const drag = useRef<{x:number;y:number;panX:number;panY:number} | null>(null);
  useEffect(() => { let active = true; loadPixelFont().then(() => { if (active) setRepaint(v => v + 1); }).catch(() => state.set({notice:'像素字库加载失败，已使用系统字体'})); return () => { active = false; }; }, []);
  useEffect(() => {
    if (!canvas.current) return;
    const ctx = canvas.current.getContext('2d'); if (!ctx) return;
    const resolution = Math.min(scale * dpr, 8192 / Math.max(preview.width, preview.height));
    canvas.current.width = Math.max(1, Math.ceil(preview.width * resolution));
    canvas.current.height = Math.max(1, Math.ceil(preview.height * resolution));
    ctx.scale(resolution, resolution);
    paint(ctx, preview, hover, state.hoveredState, () => setRepaint(v => v + 1));
  }, [preview, hover, state.hoveredState, repaint, scale, dpr]);
  const selectedBoxes = preview.boxes.filter(b => state.selected && keyOf(b.node._origin) === keyOf(state.selected));
  function hit(event: React.MouseEvent): Box | undefined {
    const rect = canvas.current?.getBoundingClientRect(); if (!rect) return;
    const x = (event.clientX - rect.left) / scale, y = (event.clientY - rect.top) / scale;
    return [...preview.boxes].reverse().find(b => x >= b.x && y >= b.y && x < b.x + b.width && y < b.y + b.height && (!b.clip || x >= b.clip.x && y >= b.clip.y && x < b.clip.x + b.clip.width && y < b.clip.y + b.clip.height));
  }
  const artboard = <div className={`canvas-stage ${state.grid ? 'show-grid' : ''} ${hand ? 'hand-tool' : ''}`} ref={stage} onWheel={e => { if (e.ctrlKey || e.metaKey) viewport.zoomBy(-Math.sign(e.deltaY)); }} onPointerDown={e => { if (hand || e.button === 1) { drag.current = { x:e.clientX,y:e.clientY,panX:pan.x,panY:pan.y }; e.currentTarget.setPointerCapture(e.pointerId); } }} onPointerMove={e => { if (drag.current) setPan({x:drag.current.panX+e.clientX-drag.current.x,y:drag.current.panY+e.clientY-drag.current.y}); }} onPointerUp={() => drag.current=null}>
    <div className="canvas-meta"><span className="status-dot"/>{state.previewOverrides ? 'Agent 方案预览 · 尚未应用' : interactive ? '交互模拟 · 不执行真实交易' : '本地设计预览'}<span>Canvas · {preview.width} × {preview.height}</span></div>
    <div className="ruler horizontal-ruler">{Array.from({length:Math.ceil(preview.width/50)},(_,i) => <span key={i} style={{left:viewport.left+i*50*scale}}>{i*50}</span>)}</div>
    <div className="artboard-wrap" style={{ width:preview.width*scale,height:preview.height*scale,left:viewport.left,top:viewport.top }}>
      <canvas ref={canvas} onContextMenu={e=>{e.preventDefault();const box=hit(e);if(box){state.set({selected:box.node._origin});useAgent.getState().compose('优化当前选中组件，保持现有交互和页面风格。');}}} style={{width:preview.width*scale,height:preview.height*scale}} onMouseMove={e => { if (!hand) setHover(hit(e)?.key ?? null); }} onMouseLeave={() => setHover(null)} onClick={e => { if (hand) return; const box=hit(e); if (box) { if (interactive) simulate(box.node); else state.set({selected:box.node._origin}); } }}/>
      {!interactive && <svg className="selection-overlay" viewBox={`0 0 ${preview.width} ${preview.height}`}><g fill="none" stroke="#69d6b3" strokeWidth={1/scale}>{state.outlines && preview.boxes.map(b => <rect key={b.key} x={b.x} y={b.y} width={b.width} height={b.height} opacity=".23"/>)}{selectedBoxes.map(b => <g key={b.key}><rect x={b.x} y={b.y} width={b.width} height={b.height}/>{[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y],i) => <rect key={i} x={x-2/scale} y={y-2/scale} width={4/scale} height={4/scale} fill="#1b2928"/>)}</g>)}</g></svg>}
    </div>
    <div className="canvas-bottom-info"><span>{selectedBoxes.length ? `${selectedBoxes[0].node.id} · ${selectedBoxes[0].width} × ${selectedBoxes[0].height}${selectedBoxes.length>1 ? ` · ${selectedBoxes.length} 个模板实例` : ''}` : '点击选择组件 · 拖动图层调整布局'}</span><span>文字与着色器以游戏内效果为准</span></div>
  </div>;
  return <div className="canvas-panel"><div className="canvas-toolbar"><div className="toolbar-group"><IconButton icon={MousePointer2} title="选择组件" active={!hand} onClick={()=>setHand(false)}/><IconButton icon={Hand} title="平移画布" active={hand} onClick={()=>setHand(true)}/><span className="toolbar-divider"/><IconButton icon={Type} title="添加文字" onClick={()=>state.add('text')}/><IconButton icon={ImagePlus} title="添加图片" onClick={()=>state.add('image')}/><IconButton icon={SquarePlus} title="添加按钮" onClick={()=>state.add('button')}/></div><div className="toolbar-group"><IconButton icon={Grid2X2} title="显示像素网格" active={state.grid} onClick={()=>state.set({grid:!state.grid})}/><IconButton icon={Eye} title="显示组件边界" active={state.outlines} onClick={()=>state.set({outlines:!state.outlines})}/><span className="toolbar-divider"/><select aria-label="预览状态" value={state.hoveredState} onChange={e=>state.set({hoveredState:e.target.value as any})}><option value="normal">默认状态</option><option value="hover">悬停状态</option><option value="selected">选中状态</option><option value="disabled">禁用状态</option></select><IconButton icon={Play} title="交互模拟" active={interactive} onClick={()=>setInteractive(!interactive)}/></div><div className="toolbar-group view-tabs"><IconButton icon={Maximize2} title="专注画布 / 还原 · F" onClick={onFocus}/><IconButton icon={Scan} title="画布视图" active={state.view==='canvas'} onClick={()=>state.set({view:'canvas'})}/><IconButton icon={Columns2} title="画布与源码并排" active={state.view==='split'} onClick={()=>state.set({view:'split'})}/><IconButton icon={Code2} title="YAML 源码" active={state.view==='code'} onClick={()=>state.set({view:'code'})}/></div></div><div className={`document-area ${state.view==='split'?'split-view':''}`}>{state.view!=='code' && artboard}{state.view!=='canvas' && <div className="code-area"><CodeEditor/></div>}</div>{state.view!=='code' && <div className="canvas-zoom"><span className="pixel-label">像素预览</span><IconButton icon={ZoomOut} title="缩小" onClick={()=>viewport.zoomBy(-1)}/><select aria-label="画布缩放" value={state.zoom} onChange={e=>{state.set({zoom:Number(e.target.value)});setPan({x:0,y:0});}}><option value={0}>适合 · {Math.round(scale*100)}%</option>{zoomSteps.map(v=><option key={v} value={v}>{v*100}%</option>)}</select><IconButton icon={ZoomIn} title="放大" onClick={()=>viewport.zoomBy(1)}/><button onClick={viewport.reset}>适合</button></div>}</div>;
}
