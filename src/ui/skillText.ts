import type { MonsterDef, SkillDef, SkillId } from '../types';

// 스킬 설명 문구. 숫자는 monsters.json에서 읽어 넣는다.

const pct = (v: unknown) => `${Math.round(Number(v) * 100)}%`;

const TEXT: Record<SkillId, (s: SkillDef) => string> = {
  slow_shot: (s) => `맞은 적 ${pct(s.slowPct)} 둔화 (${s.durationSec}초)`,
  heal_adjacent: (s) => `${s.intervalSec}초마다 옆 칸 아군 ${s.amount} 회복`,
  reflect: (s) => `받은 피해의 ${pct(s.pct)} 반사`,
  multi_target: (s) => `한 번에 ${s.targets}마리 공격`,
  lane_slow: (s) => `레인 전체 적 ${pct(s.slowPct)} 둔화 안개`,
  revive_once: () => `기절 시 1회 즉시 부활`,
  chain_lanes: (s) => `옆 레인으로 ${s.jumps}번 튀는 연쇄 번개`,
  taunt_adjacent_lanes: () => `빈 옆 레인 적을 끌어와 막음`,
  stun_chance: (s) => `공격 시 ${pct(s.chance)} 확률 기절 ${s.durationSec}초`,
  heal_all: (s) => `${s.intervalSec}초마다 보드 전체 ${s.amount} 회복`,
  burn: (s) => `화상: 초당 ${s.dps} 피해 ${s.durationSec}초`,
  ground_flyers: () => `레인의 비행 적을 끌어내림`,
  summon_minion: (s) => `${s.intervalSec}초마다 꿀벌 소환 (최대 ${s.max})`,
  burn_aura: (s) => `주변 적 초당 ${s.dps} 화상 오라`,
  splash: (s) => `주변 적에게 ${pct(s.pct)} 범위 피해`,
  row_shield: (s) => `${s.intervalSec}초마다 같은 줄 아군 보호막 ${s.amount}`,
  crit: (s) => `${pct(s.chance)} 확률 치명타 ×${s.mult}`,
  poison_cloud: (s) => `독 구름: 초당 ${s.dps} + 방어 ${pct(s.armorShred)} 감소`,
};

export function skillText(m: MonsterDef): string {
  if (!m.skill) return m.tier === 0 ? '레시피가 없는 조합의 결과. 무난한 원거리.' : m.range === 'melee' ? '근접 기본 공격' : '원거리 기본 공격';
  return TEXT[m.skill.id](m.skill);
}

export function rangeLabel(m: MonsterDef): string {
  return m.range === 'melee' ? '근접' : '원거리';
}
