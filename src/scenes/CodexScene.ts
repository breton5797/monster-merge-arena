import Phaser from 'phaser';
import { creatureKey } from '../art';
import { iconKey } from '../art/icons';
import { getData, getServices } from '../registry';
import type { GameData, MonsterDef } from '../types';
import { Button } from '../ui/Button';
import { rangeLabel, skillText } from '../ui/skillText';
import { COLORS, drawPanel, hexToNum, textStyle, titleStyle } from '../ui/theme';
import type { ResultSceneData } from './ResultScene';

const COLS = 5;
const CELL = 130;
const GRID_TOP = 372;
const SILHOUETTE = 0x10131c;

type Tab = 1 | 2 | 0;
const TABS: readonly { tier: Tab; label: string }[] = [
  { tier: 1, label: '기본' },
  { tier: 2, label: '합성' },
  { tier: 0, label: '특수' },
];

export interface CodexSceneData {
  readonly from: 'menu' | 'result';
  readonly result?: ResultSceneData;
  readonly tab?: Tab;
}

/** 도감: 탭(기본·합성·특수), 미발견은 실루엣 + 속성 테두리 + 힌트, 탭하면 상세 */
export class CodexScene extends Phaser.Scene {
  private grid: Phaser.GameObjects.Container | null = null;
  private detail: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('CodexScene');
  }

  create(d: CodexSceneData): void {
    const gd = getData(this);
    const sv = getServices(this);
    const { width, height } = this.scale;
    const click = () => sv.sound.play('button');
    this.grid = null;
    this.detail = null;
    const discovered = new Set(sv.save.data.discovered);
    const found = gd.monsters.filter((m) => discovered.has(m.id)).length;
    this.cameras.main.fadeIn(200);
    this.add.graphics().fillGradientStyle(0x1f2a44, 0x1f2a44, 0x0f1729, 0x0f1729, 1).fillRect(0, 0, width, height);

    this.add.image(width / 2 - 92, 70, iconKey('book')).setDisplaySize(64, 64);
    this.add.text(width / 2 + 20, 70, '도감', titleStyle(54)).setOrigin(0.5);
    this.add.text(width / 2, 136, `${found} / ${gd.monsters.length}`, titleStyle(32, COLORS.accentText)).setOrigin(0.5);
    const barW = 520;
    this.add.rectangle(width / 2, 176, barW, 16, 0x000000).setStrokeStyle(3, 0x2a1f2d);
    this.add.rectangle(width / 2 - barW / 2, 176, barW * (found / gd.monsters.length), 16, COLORS.accent).setOrigin(0, 0.5);
    if (found === gd.monsters.length) this.add.text(width / 2, 206, '도감 완성!', titleStyle(24, '#FFD54F')).setOrigin(0.5);

    const tabButtons = TABS.map((t, i) => {
      const count = gd.monsters.filter((m) => m.tier === t.tier);
      const own = count.filter((m) => discovered.has(m.id)).length;
      return new Button(this, width / 2 + (i - 1) * 216, 252, 200, 70, `${t.label} ${own}/${count.length}`, () => show(t.tier), { fontSize: 24, onPressSound: click });
    });
    const show = (tier: Tab) => {
      tabButtons.forEach((b, i) => b.setColor(TABS[i].tier === tier ? 0x7c4dff : COLORS.panelLight));
      this.renderGrid(gd, tier, discovered, sv.save.data.hints);
    };
    show(d.tab ?? 1);

    const back = () => (d.from === 'result' && d.result ? this.scene.start('ResultScene', d.result) : this.scene.start('MenuScene'));
    new Button(this, width / 2, 1212, 420, 80, d.from === 'result' ? '결과로' : '메뉴로', back, { fontSize: 28, icon: 'home', color: 0x34495e, onPressSound: click });
  }

  private renderGrid(gd: GameData, tier: Tab, discovered: ReadonlySet<string>, hints: Readonly<Record<string, string>>): void {
    this.grid?.destroy();
    const list = gd.monsters.filter((m) => m.tier === tier);
    const left = (this.scale.width - COLS * CELL) / 2 + CELL / 2;
    const entries = list.map((m, i) => this.entry(gd, m, left + (i % COLS) * CELL, GRID_TOP + Math.floor(i / COLS) * (CELL + 6), discovered.has(m.id), hints[m.id]));
    this.grid = this.add.container(0, 0, entries);
  }

  private entry(gd: GameData, m: MonsterDef, x: number, y: number, known: boolean, hint: string | undefined): Phaser.GameObjects.Container {
    const color = hexToNum(gd.elements.elements[m.element].color);
    const g = drawPanel(this.add.graphics(), -CELL / 2 + 6, -CELL / 2 + 6, CELL - 12, CELL - 12, known ? COLORS.panel : 0x161b26, 16);
    g.lineStyle(4, known && m.tier === 2 ? 0xffd54f : color, known ? 0.9 : 0.75).strokeRoundedRect(-CELL / 2 + 6, -CELL / 2 + 6, CELL - 12, CELL - 12, 16);
    const art = this.add.image(0, -12, creatureKey(m.id)).setDisplaySize(104, 104);
    const items: Phaser.GameObjects.GameObject[] = [g, art];
    if (known) items.push(this.add.text(0, 44, m.name, titleStyle(16)).setOrigin(0.5));
    else {
      art.setTintFill(SILHOUETTE).setAlpha(0.9);
      items.push(this.add.text(0, -14, '?', titleStyle(40, '#5A6478')).setOrigin(0.5));
      const label = m.tier === 2 ? (hint ? `${gd.monsterById.get(hint)?.name ?? '?'}\n+ ???` : '??? + ???') : '???';
      items.push(this.add.text(0, hint ? 40 : 44, label, textStyle(hint ? 14 : 16, hint ? '#FFD54F' : COLORS.textDim, { align: 'center' })).setOrigin(0.5));
    }
    const c = this.add.container(x, y, items).setSize(CELL - 12, CELL - 12).setInteractive({ useHandCursor: true });
    let pressed = false;
    c.on('pointerdown', () => (pressed = true));
    c.on('pointerout', () => (pressed = false));
    c.on('pointerup', () => pressed && this.showDetail(gd, m, known, hint));
    return c;
  }

  private showDetail(gd: GameData, m: MonsterDef, known: boolean, hint: string | undefined): void {
    this.detail?.destroy();
    getServices(this).sound.play('button');
    const { width, height } = this.scale;
    const el = gd.elements.elements[m.element];
    const recipe = gd.fusions.recipes.find((r) => r.result === m.id);
    const name = (id: string) => gd.monsterById.get(id)?.name ?? '?';
    const close = () => {
      this.detail?.destroy();
      this.detail = null;
    };
    const items: Phaser.GameObjects.GameObject[] = [this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6).setInteractive().on('pointerup', close)];
    const g = drawPanel(this.add.graphics(), 60, 300, width - 120, 640, COLORS.panel);
    g.lineStyle(5, hexToNum(el.color), 1).strokeRoundedRect(60, 300, width - 120, 640, 22);
    items.push(g);
    const art = this.add.image(width / 2, 430, creatureKey(m.id)).setDisplaySize(230, 230);
    if (!known) art.setTintFill(SILHOUETTE);
    items.push(art, this.add.image(width / 2 + 120, 340, iconKey(`el_${m.element}`)).setDisplaySize(56, 56));
    items.push(this.add.text(width / 2, 570, known ? m.name : '???', titleStyle(42)).setOrigin(0.5));
    items.push(this.add.text(width / 2, 616, `${el.name} 속성 · ${rangeLabel(m)}`, textStyle(24, el.color)).setOrigin(0.5));
    let body: string;
    if (known) body = `HP ${m.hp}  ·  공격 ${m.atk}  ·  공속 ${m.atkSpeed}\n${skillText(m)}`;
    else if (m.tier === 2) body = hint && recipe ? `힌트: "${recipe.hint}"` : '서로 다른 기본 몬스터를 합쳐 발견하세요';
    else body = m.tier === 0 ? '레시피가 없는 조합을 합치면 태어난다' : '소환하거나 보상으로 얻으면 기록됩니다';
    items.push(this.add.text(width / 2, 690, body, textStyle(24, COLORS.text, { align: 'center', lineSpacing: 8, wordWrap: { width: width - 180 } })).setOrigin(0.5));
    if (recipe) items.push(...this.recipeRow(recipe.a, recipe.b, known ? 'both' : hint ? hint : 'none', name));
    items.push(new Button(this, width / 2, 900, 240, 64, '닫기', close, { fontSize: 24, icon: 'close', color: 0x34495e }));
    this.detail = this.add.container(0, 0, items).setDepth(50);
  }

  /** 레시피: 재료 2개 그림 (발견 전에는 힌트로 공개된 재료만) */
  private recipeRow(a: string, b: string, reveal: string, name: (id: string) => string): Phaser.GameObjects.GameObject[] {
    const cx = this.scale.width / 2;
    const y = 790;
    const slot = (id: string, x: number) => {
      const shown = reveal === 'both' || reveal === id;
      const img = this.add.image(x, y, shown ? creatureKey(id) : iconKey('question')).setDisplaySize(shown ? 96 : 60, shown ? 96 : 60);
      const label = this.add.text(x, y + 50, shown ? name(id) : '???', textStyle(18, COLORS.textDim)).setOrigin(0.5);
      return [img, label];
    };
    return [...slot(a, cx - 110), this.add.text(cx, y, '+', titleStyle(48)).setOrigin(0.5), ...slot(b, cx + 110)];
  }
}
