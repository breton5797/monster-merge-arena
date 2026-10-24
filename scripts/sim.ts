// npm run sim [-- --runs 10 --stage 2]
// 무작위 합성 봇으로 각 스테이지를 시뮬레이션해 승률을 출력한다. 목표: 1스테이지 80%+, 2는 50%, 3은 25% 수준.
import { loadGameData } from '../src/gameData';
import { Battle } from '../src/systems/Battle';
import { RandomBot } from '../src/systems/Bot';
import { createRng } from '../src/systems/rng';

const TARGET: Record<number, number> = { 1: 0.8, 2: 0.5, 3: 0.25 };
const DT = 0.05;
const OVERTIME_CAP_SEC = 300;

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

const data = loadGameData();
const runs = arg('runs', 10);
const onlyStage = arg('stage', 0);
const seedBase = arg('seed', 1000);

console.log(`Monster Merge Arena 시뮬레이션 — 무작위 합성 봇, 스테이지당 ${runs}판\n`);
console.log('스테이지 | 승률   | 목표  | 평균 생존 | 평균 기지HP | 평균 처치 | 평균 합성 | 평균 발견 | 패배 원인(보스생존)');
for (const stage of data.stages) {
  if (onlyStage && stage.id !== onlyStage) continue;
  let wins = 0, time = 0, hp = 0, kills = 0, merges = 0, finds = 0, bossAlive = 0;
  for (let r = 0; r < runs; r++) {
    const rng = createRng(seedBase + stage.id * 1000 + r);
    const battle = new Battle(data, { stageId: stage.id, rng, discovered: [], hints: {} });
    const bot = new RandomBot(createRng(seedBase * 7 + r));
    while (!battle.state.result && battle.state.time < OVERTIME_CAP_SEC) {
      bot.update(battle, DT);
      battle.update(DT);
    }
    const s = battle.state;
    if (s.result === 'win') wins++;
    else if (s.bossSpawned && !s.bossDefeated) bossAlive++;
    time += s.time;
    hp += s.baseHp;
    kills += s.kills;
    merges += s.mergesTotal;
    finds += s.newDiscoveries.length;
  }
  const pct = (v: number) => `${Math.round(v * 100)}%`.padStart(4);
  const avg = (v: number) => (v / runs).toFixed(1).padStart(6);
  console.log(`   ${stage.id}     | ${pct(wins / runs)}   | ${pct(TARGET[stage.id] ?? 0)}  |  ${avg(time)}s  |   ${avg(hp)}    |  ${avg(kills)}   |  ${avg(merges)}   |  ${avg(finds)}   | ${bossAlive}`);
}
