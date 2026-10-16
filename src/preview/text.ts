const colors: Record<string, string> = { white:'#ffffff',gray:'#aaaaaa',dark_gray:'#555555',green:'#55ff55',dark_green:'#00aa00',yellow:'#ffff55',gold:'#ffaa00',aqua:'#55ffff',dark_aqua:'#00aaaa',red:'#ff5555',dark_red:'#aa0000',blue:'#5555ff',dark_blue:'#0000aa',light_purple:'#ff55ff',dark_purple:'#aa00aa',black:'#000000' };
const legacy = ['#000000','#0000aa','#00aa00','#00aaaa','#aa0000','#aa00aa','#ffaa00','#aaaaaa','#555555','#5555ff','#55ff55','#55ffff','#ff5555','#ff55ff','#ffff55','#ffffff'];
function normalize(input: unknown) {
  return String(input ?? '')
    .replace(/(?:&|§)x((?:[&§][\da-f]){6})/gi, (_, hex) => `<${'#'+hex.replace(/[&§]/g,'')}>`)
    .replace(/[&§]#([\da-f]{6})/gi, '<#$1>')
    .replace(/[&§]([\da-f])/gi, (_, code) => `<${legacy[parseInt(code,16)]}>`)
    .replace(/[&§]l/gi, '<bold>').replace(/[&§]r/gi, '<reset>')
    .replace(/[&§][kmno]/gi, '').replace(/<(?:newline|br)>/g, '\n');
}
export const plain = (input: unknown) => normalize(input).replace(/<[^>]*>/g, '');
export interface TextSegment { text: string; color: string; bold: boolean }
export function textSegments(input: unknown): TextSegment[] {
  const result: TextSegment[] = [], stack: { tag: string; color: string; bold: boolean }[] = [];
  let color = '#e6e8e3', bold = false;
  for (const part of normalize(input).split(/(<[^>]+>)/g)) {
    if (!part.startsWith('<')) { if (part) result.push({ text: part, color, bold }); continue; }
    const tag = part.slice(1,-1).toLowerCase(), value = tag.replace(/^color:/,'');
    if (tag === 'reset') { color = '#e6e8e3'; bold = false; stack.length = 0; }
    else if (tag.startsWith('/')) {
      let index = stack.length - 1;
      while (index >= 0 && stack[index].tag !== tag.slice(1)) index--;
      if (index >= 0) { ({ color, bold } = stack[index]); stack.splice(index); }
    } else if (colors[value] || /^#[\da-f]{6}$/i.test(value)) { stack.push({tag,color,bold}); color = colors[value] ?? value; }
    else if (['bold','b','!bold','!b'].includes(tag)) { stack.push({tag,color,bold}); bold = !tag.startsWith('!'); }
  }
  return result;
}
