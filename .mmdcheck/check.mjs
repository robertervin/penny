import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.SVGElement = dom.window.SVGElement;
global.DOMPurify = undefined;

const mermaid = (await import('mermaid')).default;
mermaid.initialize({ startOnLoad: false });

const md = fs.readFileSync(process.argv[2], 'utf8');
const blocks = [...md.matchAll(/```mermaid\n([\s\S]*?)```/g)];
console.log(`found ${blocks.length} mermaid blocks\n`);

let failed = 0;
for (const [i, b] of blocks.entries()) {
  const code = b[1];
  const line = md.slice(0, b.index).split('\n').length;
  const kind = code.trim().split(/\s|\n/)[0];
  try {
    await mermaid.parse(code);
    console.log(`OK    block ${i + 1} (line ${line}, ${kind})`);
  } catch (e) {
    failed++;
    console.log(`FAIL  block ${i + 1} (line ${line}, ${kind})`);
    console.log(`      ${String(e.message).split('\n').slice(0, 6).join('\n      ')}\n`);
  }
}
process.exit(failed ? 1 : 0);
