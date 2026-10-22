import fs from 'node:fs';
const cands = fs.readdirSync('node_modules/mermaid/dist').filter(f => f.includes('ganttDiagram') && f.endsWith('.js'));
console.log('candidates:', cands.join(', '));
const mod = await import('mermaid/dist/' + cands[0]);
const diagram = mod.diagram ?? mod.default;
const parser = diagram.parser; parser.yy = diagram.db;
const cases = JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
for (const [name, code] of Object.entries(cases)) {
  try { diagram.db.clear?.(); parser.parse(code); console.log(`OK    ${name}`); }
  catch (e) { console.log(`FAIL  ${name}\n      ${String(e.message).split('\n')[0]}`); }
}
