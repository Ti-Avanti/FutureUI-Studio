import { useEffect, useRef, useState } from 'react';
import { useStudio } from '../state/store';

export const zoomSteps = [.5, .75, 1, 1.5, 2, 3, 4];

export function useCanvasViewport(width: number, height: number, view: string) {
  const stage = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 800, height: 600 });
  const [dpr, setDpr] = useState(window.devicePixelRatio);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const zoom = useStudio(s => s.zoom);
  useEffect(() => {
    if (!stage.current) return;
    const update = () => { const rect = stage.current?.getBoundingClientRect(); if (rect) setBounds({ width: rect.width, height: rect.height }); setDpr(window.devicePixelRatio); };
    const observer = new ResizeObserver(update); observer.observe(stage.current);
    window.addEventListener('resize', update); update();
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, [view]);
  const rawFit = Math.min(Math.max(80, bounds.width - 60) / width, Math.max(80, bounds.height - 66) / height, 3);
  const fit = Math.max(.001, rawFit * dpr >= 2 ? Math.floor(rawFit * dpr * 2) / (dpr * 2) : Math.floor(rawFit * 100) / 100);
  const scale = zoom || fit;
  const snap = (value: number) => Math.round(value * dpr) / dpr;
  return {
    stage, scale, dpr, pan, setPan,
    left: snap((bounds.width - width * scale) / 2 + pan.x),
    top: snap((bounds.height - height * scale) / 2 + 10 + pan.y),
    reset: () => { useStudio.getState().set({ zoom: 0 }); setPan({ x: 0, y: 0 }); },
    zoomBy: (direction: number) => {
      const next = direction > 0 ? zoomSteps.find(v => v > scale + .01) ?? 4 : [...zoomSteps].reverse().find(v => v < scale - .01) ?? .5;
      useStudio.getState().set({ zoom: next });
    }
  };
}
