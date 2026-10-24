// npm run art:sheet → .playwright-mcp/art-sheet.html (캐릭터 아트 검수용 한 장)
import { writeFileSync, mkdirSync } from 'node:fs';
import { creatureSvg, loadArt } from '../src/art';
import monsters from '../src/data/monsters.json';
import enemies from '../src/data/enemies.json';

const names = new Map<string, string>([...monsters.monsters, ...enemies.enemies].map((m) => [m.id, m.name]));
const cells = loadArt()
  .map((s) => `<figure><div class="bg">${creatureSvg(s)}</div><figcaption>${names.get(s.id) ?? s.id}<br><small>${s.id}</small></figcaption></figure>`)
  .join('');
mkdirSync('.playwright-mcp', { recursive: true });
writeFileSync(
  '.playwright-mcp/art-sheet.html',
  `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:12px;background:#1b2230;font-family:sans-serif;color:#eee;display:grid;grid-template-columns:repeat(6,1fr);gap:8px}figure{margin:0;text-align:center}.bg{background:#2d3a4a;border-radius:12px}svg{width:100%;height:auto;display:block}figcaption{font-size:13px;margin-top:4px}small{color:#9aa3b2}</style>${cells}`,
);
console.log('written .playwright-mcp/art-sheet.html');
