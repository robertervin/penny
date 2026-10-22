import fs from 'node:fs';

const mod = await import('mermaid/dist/chunks/mermaid.core/ganttDiagram-FUAMR5RP.mjs');
const diagram = mod.diagram ?? mod.default;
const parser = diagram.parser;
parser.yy = diagram.db;

const md = fs.readFileSync(process.argv[2], 'utf8');
const blocks = [...md.matchAll(/```mermaid\n([\s\S]*?)```/g)].filter((b) =>
  b[1].trim().startsWith('gantt')
);

for (const b of blocks) {
  const line = md.slice(0, b.index).split('\n').length;
  console.log(`--- gantt block at line ${line} ---`);
  try {
    diagram.db.clear?.();
    parser.parse(b[1]);
    const tasks = diagram.db.getTasks();
    console.log(`OK: parsed ${tasks.length} tasks`);
    for (const t of tasks) {
      console.log(
        `   ${t.id.padEnd(4)} ${String(t.task).slice(0, 48).padEnd(50)} ${
          t.startTime?.toISOString?.().slice(0, 10)
        } -> ${t.endTime?.toISOString?.().slice(0, 10)}`
      );
    }
  } catch (e) {
    console.log('FAIL:');
    console.log(String(e.message));
  }
}
