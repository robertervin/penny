import fs from 'node:fs';
const mod = await import('mermaid/dist/chunks/mermaid.core/ganttDiagram-EL5Y4UJY.mjs');
const diagram = mod.diagram ?? mod.default;
const parser = diagram.parser;
parser.yy = diagram.db;

const cases = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const [name, code] of Object.entries(cases)) {
  try {
    diagram.db.clear?.();
    parser.parse(code);
    console.log(`OK    ${name}  (${diagram.db.getTasks().length} tasks)`);
  } catch (e) {
    console.log(`FAIL  ${name}`);
    console.log(`      ${String(e.message).split('\n')[0]}`);
  }
}
