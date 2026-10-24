import Phaser from 'phaser';
import { getData, getServices } from '../registry';
import type { GameData, MonsterDef } from '../types';
import { Button } from '../ui/Button';
import { skillText, rangeLabel } from '../ui/skillText';
import { COLORS, hexToNum, textStyle } from '../ui/theme';
import type { ResultSceneData } from './ResultScene';

const COLS = 5;
const CELL = 132;
const GRID_TOP = 250;

export interface CodexSceneData {
  readonly from: 'menu' | 'result';
  readonly result?: ResultSceneData;
}

/** 도감: 기본 10 → 합성 15 → 키메라. 미발견은 실루엣 + 속성 테두리 + 힌트 */
export class CodexScene extends Phaser.Scene {
  private detail: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('CodexScene');
  }

  create(d: CodexSceneData): void {
    const gd = getData(this);
    const sv = getServices(this);
    const { width } = this.scale;
    this.detail = null;
    const discovered = new Set(sv.save.data.discovered);
    const hints = sv.save.data.hints;
    const order = [...gd.monsters.filter((m) => m.tier === 1), ...gd.monsters.filter((m) => m.tier === 2), ...gd.monsters.filter((m) => m.tier === 0)];
    const found = order.filter((m) => discovered.has(m.id)).length;
    this.cameras.main.fadeIn(200);

    this.add.text(width / 2, 70, '📖 도감', textStyle(48, COLORS.text, { fontStyle: 'bold' })).setOrigin(0.5);
    this.add.text(width / 2, 130, `${found} / ${order.length}`, textStyle(32, COLORS.accentText, { fontStyle: 'bold' })).setOrigin(0.5);
    const barW = 520;
    this.add.rectangle(width / 2, 170, barW, 14, 0x000000).setStrokeStyle(2, COLORS.line);
    this.add.rectangle(width / 2 - barW / 2, 170, barW * (found / order.length), 14, COLORS.accent).setOrigin(0, 0.5);
    if (found === order.length) this.add.text(width / 2, 205, '🎉 도감 완성!', textStyle(26, '#FFD54F')).setOrigin(0.5);

    const left = (width - COLS * CELL) / 2 + CELL / 2;
    order.forEach((m, i) => {
      const x = left + (i % COLS) * CELL;
      const y = GRID_TOP + Math.floor(i / COLS) * CELL;
      this.makeEntry(gd, m, x, y, discovered.has(m.id), hints[m.id], () => this.showDetail(gd, m, discovered.has(m.id), hints[m.id]));
    });

    const back = () => {
      if (d.from === 'result' && d.result) this.scene.start('ResultScene', d.result);
      else this.scene.start('MenuScene');
    };
    new Button(this, width / 2, 1222, 420, 80, d.from === 'result' ? '← 결과로' : '← 메뉴로', back, { fontSize: 30, onPressSound: () => sv.sound.play('button') });
  }

  private makeEntry(gd: GameData, m: MonsterDef, x: number, y: number, known: boolean, hint: string | undefined, onTap: () => void): void {
    const color = hexToNum(gd.elements.elements[m.element].color);
    const items: Phaser.GameObjects.GameObject[] = [this.add.rectangle(0, 0, CELL - 10, CELL - 10, COLORS.panel).setStrokeStyle(2, known && m.tier === 2 ? 0xffd700 : COLORS.line)];
    if (known) {
      items.push(this.add.circle(0, -14, 38, color), this.add.text(0, -14, m.emoji, textStyle(40)).setOrigin(0.5), this.add.text(0, 44, m.name, textStyle(17)).setOrigin(0.5));
    } else {
      items.push(this.add.circle(0, -14, 38, 0x000000).setStrokeStyle(4, color), this.add.text(0, -14, '?', textStyle(40, '#555555', { fontStyle: 'bold' })).setOrigin(0.5));
      const label = m.tier === 2 ? (hint ? `${gd.monsterById.get(hint)?.name ?? '?'}\n+ ???` : '??? + ???') : '???';
      items.push(this.add.text(0, hint ? 40 : 44, label, textStyle(hint ? 14 : 15, hint ? '#FFD54F' : COLORS.textDim, { align: 'center' })).setOrigin(0.5));
    }
    const c = this.add.container(x, y, items).setSize(CELL - 10, CELL - 10).setInteractive({ useHandCursor: true });
    c.on('pointerup', onTap);
  }

  private showDetail(gd: GameData, m: MonsterDef, known: boolean, hint: string | undefined): void {
    this.detail?.destroy();
    const { width } = this.scale;
    const y = 1068;
    const name = (id: string) => gd.monsterById.get(id)?.name ?? '?';
    const recipe = gd.fusions.recipes.find((r) => r.result === m.id);
    const el = gd.elements.elements[m.element];
    let title: string;
    let body: string;
    if (known) {
      title = `${m.emoji} ${m.name}  ·  ${el.name} ${rangeLabel(m)}`;
      const how = recipe ? `레시피: ${name(recipe.a)} + ${name(recipe.b)}` : m.tier === 0 ? '레시피 없는 기본 몬스터 조합' : '기본 몬스터 (소환·보상으로 획득)';
      body = `HP ${m.hp} · 공격 ${m.atk} · 공속 ${m.atkSpeed}\n${skillText(m)}\n${how}`;
    } else if (m.tier === 2) {
      title = `??? · ${el.name} 속성`;
      body = hint && recipe ? `레시피: ${name(hint)} + ???\n"${recipe.hint}"` : '레시피: ??? + ???\n서로 다른 기본 몬스터를 합쳐 발견하세요';
    } else {
      title = `??? · ${el.name} 속성`;
      body = m.tier === 0 ? '레시피가 없는 조합을 합치면 태어난다' : '소환하거나 보상으로 얻으면 기록됩니다';
    }
    this.detail = this.add.container(0, 0, [
      this.add.rectangle(width / 2, y, width - 40, 180, COLORS.panelLight).setStrokeStyle(3, hexToNum(el.color)),
      this.add.text(width / 2, y - 54, title, textStyle(28, COLORS.text, { fontStyle: 'bold' })).setOrigin(0.5),
      this.add.text(width / 2, y + 22, body, textStyle(22, COLORS.textDim, { align: 'center', lineSpacing: 6 })).setOrigin(0.5),
    ]);
  }
}
