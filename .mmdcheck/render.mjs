import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body><div id="c"></div></body></html>', { pretendToBeVisual: true });
for (const k of ['window','document','navigator','Element','SVGElement','HTMLElement','Node','DOMParser','MutationObserver','getComputedStyle','requestAnimationFrame'])
  global[k] = dom.window[k] ?? dom.window[k.charAt(0).toLowerCase()+k.slice(1)];
global.window = dom.window; global.document = dom.window.document;
const mermaid = (await import('mermaid')).default;
mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });
const md = fs.readFileSync('../README.md','utf8');
const blocks = [...md.matchAll(/```mermaid\n([\s\S]*?)```/g)];
for (const [i,b] of blocks.entries()) {
  const line = md.slice(0,b.index).split('\n').length;
  const kind = b[1].trim().split(/\s|\n/)[0];
  try { await mermaid.render('d'+i, b[1]); console.log(`RENDER OK   block ${i+1} line ${line} (${kind})`); }
  catch(e){ console.log(`RENDER FAIL block ${i+1} line ${line} (${kind})`); console.log('   '+String(e.message||e).split('\n').slice(0,4).join('\n   ')); }
}
