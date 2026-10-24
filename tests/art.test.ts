import { describe, expect, it } from 'vitest';
import artJson from '../src/data/art.json';
import { creatureSvg, loadArt, validateArt } from '../src/art';
import { backgroundSvg, THEME_IDS } from '../src/art/backgrounds';
import { ICON_NAMES, iconSvg } from '../src/art/icons';
import { shade, mix, toDataUri } from '../src/art/svg';
import { loadGameData } from '../src/gameData';

const data = loadGameData();
const art = loadArt();
const wellFormed = (svg: string) => {
  expect(svg.startsWith('<svg')).toBe(true);
  expect(svg.endsWith('</svg>')).toBe(true);
  expect(svg).not.toMatch(/NaN|undefined|Infinity/);
  for (const tag of ['g', 'defs', 'clipPath', 'linearGradient']) {
    expect((svg.match(new RegExp(`<${tag}[ >]`, 'g')) ?? []).length, tag).toBe((svg.match(new RegExp(`</${tag}>`, 'g')) ?? []).length);
  }
};

describe('캐릭터 아트', () => {
  it('모든 몬스터·적에 아트 스펙이 있고, 남는 스펙도 없다', () => {
    const ids = new Set([...data.monsters.map((m) => m.id), ...data.enemies.map((e) => e.id)]);
    expect(new Set(art.map((a) => a.id))).toEqual(ids);
  });

  it.each(art.map((a) => [a.id, a] as const))('%s: SVG가 올바르게 생성된다 (NaN·미닫힘 태그 없음)', (_id, spec) => {
    wellFormed(creatureSvg(spec));
  });

  it('무작위 속성 적과 보스는 tint (게임에서 속성 색을 입힘)', () => {
    for (const e of data.enemies) {
      if (e.element === 'random' || e.boss) expect(art.find((a) => a.id === e.id)?.tint, e.id).toBe(true);
    }
  });

  it('잘못된 스펙은 어떤 캐릭터의 어떤 필드인지 에러', () => {
    const bad = JSON.parse(JSON.stringify(artJson));
    bad.creatures[0].body = 'square';
    expect(() => validateArt(bad)).toThrow(/creatures\[0\] \(ember_pup\)\.body/);
    const bad2 = JSON.parse(JSON.stringify(artJson));
    bad2.creatures[1].parts = ['wings_laser'];
    expect(() => validateArt(bad2)).toThrow(/알 수 없는 파츠 'wings_laser'/);
    const bad3 = JSON.parse(JSON.stringify(artJson));
    bad3.creatures[2].color = 'red';
    expect(() => validateArt(bad3)).toThrow(/color: #RRGGBB/);
  });
});

describe('아이콘·배경·색', () => {
  it.each(ICON_NAMES)('아이콘 %s', (n) => wellFormed(iconSvg(n, 64)));
  it('알 수 없는 아이콘은 에러', () => expect(() => iconSvg('nope')).toThrow());
  it.each(THEME_IDS)('배경 %s (시드 고정 → 같은 그림)', (t) => {
    const a = backgroundSvg(t, [135, 285, 435, 585], 110, 700);
    wellFormed(a);
    expect(a).toBe(backgroundSvg(t, [135, 285, 435, 585], 110, 700));
  });
  it('shade/mix/toDataUri', () => {
    expect(shade('#808080', 1)).toBe('#ffffff');
    expect(shade('#808080', -1)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(() => shade('zz', 0)).toThrow();
    expect(toDataUri('<svg>한</svg>')).toMatch(/^data:image\/svg\+xml;base64,/);
  });
});
