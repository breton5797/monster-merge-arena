// JSON 스키마 타입 + 로드 시 검증. 검증 실패 시 "파일: 경로 (id): 이유" 형태로 에러를 던진다.

export const ELEMENT_IDS = ['fire', 'grass', 'rock', 'volt', 'water', 'none'] as const;
export type ElementId = (typeof ELEMENT_IDS)[number];
export type RangeType = 'melee' | 'ranged';

/** 스킬 id → 필수 숫자 파라미터 목록. 새 스킬은 여기와 systems/skills 레지스트리에 추가한다. */
export const SKILL_PARAMS = {
  slow_shot: ['slowPct', 'durationSec'],
  heal_adjacent: ['amount', 'intervalSec'],
  reflect: ['pct'],
  multi_target: ['targets'],
  lane_slow: ['slowPct'],
  revive_once: ['hpPct'],
  chain_lanes: ['jumps', 'falloff'],
  taunt_adjacent_lanes: [],
  stun_chance: ['chance', 'durationSec'],
  heal_all: ['amount', 'intervalSec'],
  burn: ['dps', 'durationSec'],
  ground_flyers: [],
  summon_minion: ['minionAtk', 'minionAtkSpeed', 'intervalSec', 'lifeSec', 'max'],
  burn_aura: ['dps', 'radius'],
  splash: ['radius', 'pct'],
  row_shield: ['amount', 'intervalSec'],
  crit: ['chance', 'mult'],
  poison_cloud: ['dps', 'armorShred', 'durationSec'],
} as const satisfies Record<string, readonly string[]>;

export type SkillId = keyof typeof SKILL_PARAMS;
export type SkillDef = { readonly id: SkillId; readonly [param: string]: number | string };

export interface MonsterDef {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly tier: 0 | 1 | 2;
  readonly element: ElementId;
  readonly range: RangeType;
  readonly hp: number;
  readonly atk: number;
  readonly atkSpeed: number;
  readonly skill: SkillDef | null;
}

export interface Recipe {
  readonly a: string;
  readonly b: string;
  readonly result: string;
  readonly hint: string;
}

export interface FusionsFile {
  readonly chimeraId: string;
  readonly recipes: readonly Recipe[];
}

export interface ElementInfo {
  readonly name: string;
  readonly color: string;
  readonly beats: ElementId | null;
}

export interface ElementsFile {
  readonly elements: Readonly<Record<ElementId, ElementInfo>>;
  readonly multiplier: { readonly advantage: number; readonly disadvantage: number; readonly neutral: number };
}

export type EnemyFlag = 'armored' | 'flying' | 'split' | 'healer' | 'boss';

export interface BossDef {
  readonly elementCycle: readonly ElementId[];
  readonly cycleSec: number;
  readonly summonAtHpPct: number;
  readonly summonId: string;
  readonly summonCount: number;
}

export interface EnemyDef {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly element: ElementId | 'random';
  readonly hp: number;
  readonly atk: number;
  readonly atkSpeed: number;
  readonly speed: number;
  readonly baseDamage: number;
  readonly energy: number;
  readonly flags: readonly EnemyFlag[];
  readonly armor?: number;
  readonly splitInto?: string;
  readonly splitCount?: number;
  readonly healAmount?: number;
  readonly healRadius?: number;
  readonly healIntervalSec?: number;
  readonly boss?: BossDef;
}

export interface WaveDef {
  readonly atSec: number;
  readonly durationSec: number;
  readonly enemyId: string;
  readonly everySec: number;
  readonly count: number;
  readonly hpScale: number;
  readonly lane?: 'center' | number;
}

export interface StageDef {
  readonly id: number;
  readonly name: string;
  readonly durationSec: number;
  readonly baseHp: number;
  readonly bossRequired: boolean;
  readonly background: string;
  readonly waves: readonly WaveDef[];
}

export type PickKind = 'monster' | 'monster_pair' | 'recipe_hint' | 'buff_element' | 'heal' | 'energy';
export const PICK_KINDS: readonly PickKind[] = ['monster', 'monster_pair', 'recipe_hint', 'buff_element', 'heal', 'energy'];

export interface GameConfig {
  readonly screen: { readonly width: number; readonly height: number };
  readonly board: { readonly cols: number; readonly rows: number; readonly cellSize: number; readonly minTouchPx: number; readonly meleeReachPx: number };
  readonly starMultiplier: number;
  readonly maxStar: number;
  readonly knockoutSec: number;
  readonly knockoutReturnHpPct: number;
  readonly startingMonsters: number;
  readonly energy: { readonly start: number; readonly summonBaseCost: number; readonly summonCostStep: number };
  readonly pick: {
    readonly intervalSec: number;
    readonly optionCount: number;
    readonly freeRerollsPerRun: number;
    readonly guaranteeUndiscoveredRecipeCard: boolean;
    readonly weights: Readonly<Record<PickKind, number>>;
    readonly buffElementPct: number;
    readonly healBasePct: number;
    readonly energyAmount: number;
  };
  readonly discoveryCutinSec: number;
  readonly debug: { readonly queryParam: string; readonly fastForwardKey: string };
  readonly layout: {
    readonly topBarBottom: number;
    readonly fieldTop: number;
    readonly boardTop: number;
    readonly boardBottom: number;
    readonly spawnY: number;
    readonly enemyRadius: number;
    readonly monsterRadius: number;
    /** 꿀벌 하수인 위치: 레인 중심에서 가로 오프셋, 보드 위 기본 높이, 마리당 높이 간격 */
    readonly minionOffsetX: number;
    readonly minionBaseY: number;
    readonly minionStepY: number;
  };
  readonly combat: {
    readonly projectileSpeedPx: number;
    readonly minDamage: number;
    readonly minArmor: number;
    readonly bossLanes: readonly number[];
    readonly auraTickSec: number;
    readonly enemyStackOffsetPx: number;
    /** 도발로 끌려갈 때 가로 이동 속도 = 이동 속도 × 이 값 */
    readonly pullSpeedFactor: number;
    /** 둔화 합산 상한 (0~1) */
    readonly maxSlowPct: number;
  };
  readonly fx: {
    readonly slowmoScale: number;
    readonly debugSpeed: number;
    readonly shakeMs: number;
    readonly shakeIntensity: number;
    readonly toastSec: number;
    readonly tutorialHandSec: number;
  };
}

export interface GameData {
  readonly monsters: readonly MonsterDef[];
  readonly monsterById: ReadonlyMap<string, MonsterDef>;
  readonly fusions: FusionsFile;
  readonly elements: ElementsFile;
  readonly enemies: readonly EnemyDef[];
  readonly enemyById: ReadonlyMap<string, EnemyDef>;
  readonly stages: readonly StageDef[];
  readonly config: GameConfig;
}

// ---------------------------------------------------------------------------
// 검증 헬퍼
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;

class Ctx {
  constructor(readonly file: string, readonly path: string) {}
  at(key: string | number, label?: string): Ctx {
    const seg = typeof key === 'number' ? `[${key}]` : this.path ? `.${key}` : key;
    return new Ctx(this.file, `${this.path}${seg}${label ? ` (${label})` : ''}`);
  }
  fail(reason: string): never {
    throw new Error(`${this.file}: ${this.path || '(root)'}: ${reason}`);
  }
}

function obj(v: unknown, c: Ctx): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) c.fail('객체여야 합니다');
  return v as Obj;
}
function arr(v: unknown, c: Ctx): unknown[] {
  if (!Array.isArray(v)) c.fail('배열이어야 합니다');
  return v;
}
function num(o: Obj, k: string, c: Ctx): number {
  const v = o[k];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return c.at(k).fail('숫자여야 합니다');
}
function str(o: Obj, k: string, c: Ctx): string {
  const v = o[k];
  if (typeof v === 'string' && v.length > 0) return v;
  return c.at(k).fail('비어있지 않은 문자열이어야 합니다');
}
function bool(o: Obj, k: string, c: Ctx): boolean {
  const v = o[k];
  if (typeof v === 'boolean') return v;
  return c.at(k).fail('true/false여야 합니다');
}
function oneOf<T extends string>(o: Obj, k: string, allowed: readonly T[], c: Ctx): T {
  const v = str(o, k, c);
  if (!(allowed as readonly string[]).includes(v)) c.at(k).fail(`허용값 ${allowed.join('|')} 중 하나여야 합니다 (받은 값: ${v})`);
  return v as T;
}
function optNum(o: Obj, k: string, c: Ctx): number | undefined {
  return o[k] === undefined ? undefined : num(o, k, c);
}
function numRecord<K extends string>(v: unknown, keys: readonly K[], c: Ctx): Record<K, number> {
  const o = obj(v, c);
  const out = {} as Record<K, number>;
  for (const k of keys) out[k] = num(o, k, c);
  return out;
}

// ---------------------------------------------------------------------------
// 파일별 검증
// ---------------------------------------------------------------------------

function validateSkill(v: unknown, c: Ctx): SkillDef | null {
  if (v === null) return null;
  const o = obj(v, c);
  const id = oneOf(o, 'id', Object.keys(SKILL_PARAMS) as SkillId[], c);
  for (const p of SKILL_PARAMS[id]) num(o, p, c);
  return o as SkillDef;
}

export function validateMonsters(raw: unknown): MonsterDef[] {
  const c = new Ctx('monsters.json', '');
  const list = arr(obj(raw, c).monsters, c.at('monsters'));
  return list.map((m, i) => {
    const mc = c.at('monsters').at(i);
    const o = obj(m, mc);
    const id = str(o, 'id', mc);
    const ic = c.at('monsters').at(i, id);
    const rawTier = num(o, 'tier', ic);
    const tier = rawTier === 0 || rawTier === 1 || rawTier === 2 ? rawTier : ic.at('tier').fail('0, 1, 2 중 하나여야 합니다');
    return {
      id,
      name: str(o, 'name', ic),
      emoji: str(o, 'emoji', ic),
      tier,
      element: oneOf(o, 'element', ELEMENT_IDS, ic),
      range: oneOf(o, 'range', ['melee', 'ranged'] as const, ic),
      hp: num(o, 'hp', ic),
      atk: num(o, 'atk', ic),
      atkSpeed: num(o, 'atkSpeed', ic),
      skill: validateSkill(o.skill, ic.at('skill')),
    };
  });
}

export function validateFusions(raw: unknown): FusionsFile {
  const c = new Ctx('fusions.json', '');
  const o = obj(raw, c);
  const recipes = arr(o.recipes, c.at('recipes')).map((r, i) => {
    const rc = c.at('recipes').at(i);
    const ro = obj(r, rc);
    return { a: str(ro, 'a', rc), b: str(ro, 'b', rc), result: str(ro, 'result', rc), hint: str(ro, 'hint', rc) };
  });
  return { chimeraId: str(o, 'chimeraId', c), recipes };
}

export function validateElements(raw: unknown): ElementsFile {
  const c = new Ctx('elements.json', '');
  const o = obj(raw, c);
  const elObj = obj(o.elements, c.at('elements'));
  const elements = {} as Record<ElementId, ElementInfo>;
  for (const id of ELEMENT_IDS) {
    const ec = c.at('elements').at(id);
    const e = obj(elObj[id], ec);
    const beats = e.beats === null ? null : oneOf(e, 'beats', ELEMENT_IDS, ec);
    elements[id] = { name: str(e, 'name', ec), color: str(e, 'color', ec), beats };
  }
  const multiplier = numRecord(o.multiplier, ['advantage', 'disadvantage', 'neutral'] as const, c.at('multiplier'));
  return { elements, multiplier };
}

const ENEMY_FLAGS: readonly EnemyFlag[] = ['armored', 'flying', 'split', 'healer', 'boss'];

export function validateEnemies(raw: unknown): EnemyDef[] {
  const c = new Ctx('enemies.json', '');
  const list = arr(obj(raw, c).enemies, c.at('enemies'));
  return list.map((e, i) => {
    const o = obj(e, c.at('enemies').at(i));
    const id = str(o, 'id', c.at('enemies').at(i));
    const ec = c.at('enemies').at(i, id);
    const flags = arr(o.flags, ec.at('flags')).map((f, j) => {
      if (typeof f !== 'string' || !(ENEMY_FLAGS as readonly string[]).includes(f)) ec.at('flags').at(j).fail(`알 수 없는 flag: ${String(f)}`);
      return f as EnemyFlag;
    });
    const def: EnemyDef = {
      id,
      name: str(o, 'name', ec),
      emoji: str(o, 'emoji', ec),
      element: oneOf(o, 'element', [...ELEMENT_IDS, 'random'] as const, ec),
      hp: num(o, 'hp', ec),
      atk: num(o, 'atk', ec),
      atkSpeed: num(o, 'atkSpeed', ec),
      speed: num(o, 'speed', ec),
      baseDamage: num(o, 'baseDamage', ec),
      energy: num(o, 'energy', ec),
      flags,
      armor: optNum(o, 'armor', ec),
      splitInto: typeof o.splitInto === 'string' ? o.splitInto : undefined,
      splitCount: optNum(o, 'splitCount', ec),
      healAmount: optNum(o, 'healAmount', ec),
      healRadius: optNum(o, 'healRadius', ec),
      healIntervalSec: optNum(o, 'healIntervalSec', ec),
      boss: o.boss === undefined ? undefined : validateBoss(o.boss, ec.at('boss')),
    };
    if (flags.includes('armored') && def.armor === undefined) ec.at('armor').fail('armored 적은 armor가 필요합니다');
    if (flags.includes('split') && (def.splitInto === undefined || def.splitCount === undefined)) ec.fail('split 적은 splitInto/splitCount가 필요합니다');
    if (flags.includes('healer') && (def.healAmount === undefined || def.healRadius === undefined || def.healIntervalSec === undefined)) ec.fail('healer 적은 healAmount/healRadius/healIntervalSec가 필요합니다');
    if (flags.includes('boss') && def.boss === undefined) ec.at('boss').fail('boss 적은 boss 설정이 필요합니다');
    return def;
  });
}

function validateBoss(v: unknown, c: Ctx): BossDef {
  const o = obj(v, c);
  const cycle = arr(o.elementCycle, c.at('elementCycle')).map((e, i) => {
    if (typeof e !== 'string' || !(ELEMENT_IDS as readonly string[]).includes(e)) c.at('elementCycle').at(i).fail('속성 id여야 합니다');
    return e as ElementId;
  });
  if (cycle.length === 0) c.at('elementCycle').fail('비어 있으면 안 됩니다');
  return {
    elementCycle: cycle,
    cycleSec: num(o, 'cycleSec', c),
    summonAtHpPct: num(o, 'summonAtHpPct', c),
    summonId: str(o, 'summonId', c),
    summonCount: num(o, 'summonCount', c),
  };
}

export function validateStages(raw: unknown): StageDef[] {
  const c = new Ctx('stages.json', '');
  const list = arr(obj(raw, c).stages, c.at('stages'));
  return list.map((s, i) => {
    const sc = c.at('stages').at(i);
    const o = obj(s, sc);
    const waves = arr(o.waves, sc.at('waves')).map((w, j) => {
      const wc = sc.at('waves').at(j);
      const wo = obj(w, wc);
      const lane = wo.lane;
      if (lane !== undefined && lane !== 'center' && typeof lane !== 'number') wc.at('lane').fail("'center' 또는 레인 번호여야 합니다");
      const everySec = num(wo, 'everySec', wc);
      if (everySec <= 0) wc.at('everySec').fail('0보다 커야 합니다');
      return {
        atSec: num(wo, 'atSec', wc),
        durationSec: num(wo, 'durationSec', wc),
        enemyId: str(wo, 'enemyId', wc),
        everySec,
        count: num(wo, 'count', wc),
        hpScale: num(wo, 'hpScale', wc),
        lane: lane as WaveDef['lane'],
      };
    });
    return {
      id: num(o, 'id', sc),
      name: str(o, 'name', sc),
      durationSec: num(o, 'durationSec', sc),
      baseHp: num(o, 'baseHp', sc),
      bossRequired: bool(o, 'bossRequired', sc),
      background: str(o, 'background', sc),
      waves,
    };
  });
}

export function validateConfig(raw: unknown): GameConfig {
  const c = new Ctx('config.json', '');
  const o = obj(raw, c);
  const pick = obj(o.pick, c.at('pick'));
  const pc = c.at('pick');
  const energy = numRecord(o.energy, ['start', 'summonBaseCost', 'summonCostStep'] as const, c.at('energy'));
  const combat = obj(o.combat, c.at('combat'));
  const cc = c.at('combat');
  const bossLanes = arr(combat.bossLanes, cc.at('bossLanes')).map((l, i) => (typeof l === 'number' ? l : cc.at('bossLanes').at(i).fail('숫자여야 합니다')));
  const debug = obj(o.debug, c.at('debug'));
  return {
    screen: numRecord(o.screen, ['width', 'height'] as const, c.at('screen')),
    board: numRecord(o.board, ['cols', 'rows', 'cellSize', 'minTouchPx', 'meleeReachPx'] as const, c.at('board')),
    starMultiplier: num(o, 'starMultiplier', c),
    maxStar: num(o, 'maxStar', c),
    knockoutSec: num(o, 'knockoutSec', c),
    knockoutReturnHpPct: num(o, 'knockoutReturnHpPct', c),
    startingMonsters: num(o, 'startingMonsters', c),
    energy,
    pick: {
      intervalSec: num(pick, 'intervalSec', pc),
      optionCount: num(pick, 'optionCount', pc),
      freeRerollsPerRun: num(pick, 'freeRerollsPerRun', pc),
      guaranteeUndiscoveredRecipeCard: bool(pick, 'guaranteeUndiscoveredRecipeCard', pc),
      weights: numRecord(pick.weights, PICK_KINDS, pc.at('weights')),
      buffElementPct: num(pick, 'buffElementPct', pc),
      healBasePct: num(pick, 'healBasePct', pc),
      energyAmount: num(pick, 'energyAmount', pc),
    },
    discoveryCutinSec: num(o, 'discoveryCutinSec', c),
    debug: { queryParam: str(debug, 'queryParam', c.at('debug')), fastForwardKey: str(debug, 'fastForwardKey', c.at('debug')) },
    layout: numRecord(o.layout, ['topBarBottom', 'fieldTop', 'boardTop', 'boardBottom', 'spawnY', 'enemyRadius', 'monsterRadius', 'minionOffsetX', 'minionBaseY', 'minionStepY'] as const, c.at('layout')),
    combat: {
      projectileSpeedPx: num(combat, 'projectileSpeedPx', cc),
      minDamage: num(combat, 'minDamage', cc),
      minArmor: num(combat, 'minArmor', cc),
      bossLanes,
      auraTickSec: num(combat, 'auraTickSec', cc),
      enemyStackOffsetPx: num(combat, 'enemyStackOffsetPx', cc),
      pullSpeedFactor: num(combat, 'pullSpeedFactor', cc),
      maxSlowPct: num(combat, 'maxSlowPct', cc),
    },
    fx: numRecord(o.fx, ['slowmoScale', 'debugSpeed', 'shakeMs', 'shakeIntensity', 'toastSec', 'tutorialHandSec'] as const, c.at('fx')),
  };
}

export interface RawGameData {
  readonly monsters: unknown;
  readonly fusions: unknown;
  readonly elements: unknown;
  readonly enemies: unknown;
  readonly stages: unknown;
  readonly config: unknown;
}

/** 모든 JSON을 검증하고 파일 간 참조(id)까지 확인한 GameData를 만든다. */
export function buildGameData(raw: RawGameData): GameData {
  const monsters = validateMonsters(raw.monsters);
  const fusions = validateFusions(raw.fusions);
  const elements = validateElements(raw.elements);
  const enemies = validateEnemies(raw.enemies);
  const stages = validateStages(raw.stages);
  const config = validateConfig(raw.config);

  const monsterById = new Map(monsters.map((m) => [m.id, m]));
  const enemyById = new Map(enemies.map((e) => [e.id, e]));
  if (monsterById.size !== monsters.length) throw new Error('monsters.json: 중복된 id가 있습니다');
  if (enemyById.size !== enemies.length) throw new Error('enemies.json: 중복된 id가 있습니다');

  if (!monsterById.has(fusions.chimeraId)) throw new Error(`fusions.json: chimeraId '${fusions.chimeraId}'가 monsters.json에 없습니다`);
  fusions.recipes.forEach((r, i) => {
    for (const key of ['a', 'b', 'result'] as const) {
      if (!monsterById.has(r[key])) throw new Error(`fusions.json: recipes[${i}].${key}: '${r[key]}'가 monsters.json에 없습니다`);
    }
  });
  enemies.forEach((e) => {
    if (e.splitInto && !enemyById.has(e.splitInto)) throw new Error(`enemies.json: ${e.id}.splitInto '${e.splitInto}'가 없습니다`);
    if (e.boss && !enemyById.has(e.boss.summonId)) throw new Error(`enemies.json: ${e.id}.boss.summonId '${e.boss.summonId}'가 없습니다`);
  });
  stages.forEach((s) =>
    s.waves.forEach((w, j) => {
      if (!enemyById.has(w.enemyId)) throw new Error(`stages.json: stage ${s.id} waves[${j}].enemyId '${w.enemyId}'가 enemies.json에 없습니다`);
    }),
  );

  return { monsters, monsterById, fusions, elements, enemies, enemyById, stages, config };
}
