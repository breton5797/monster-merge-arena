import Phaser from 'phaser';
import { getData, getServices } from '../registry';
import type { Battle } from '../systems/Battle';
import type { PickOption } from '../systems/PickSystem';
import type { GameData } from '../types';
import { Button } from '../ui/Button';
import { COLORS, hexToNum, textStyle, titleStyle } from '../ui/theme';
import { creatureKey } from '../art';
import { iconKey } from '../art/icons';

export interface PickSceneData {
  readonly battle: Battle;
  readonly onChosen: (index: number, rerolled: boolean) => void;
  readonly onRerolled: () => void;
}

interface CardInfo {
  /** 텍스처 키 목록 (캐릭터/아이콘). 2개면 겹쳐 그림 */
  readonly art: readonly string[];
  readonly title: string;
  readonly desc: string;
  readonly color: number;
  readonly ribbon?: string;
}

const CARD_W = 214;
const CARD_H = 400;
const CARD_Y = 640;
/** 오버레이가 뜬 직후 입력 무시 시간 (드래그 중이던 손가락이 카드를 고르지 않게) */
const INPUT_GUARD_MS = 300;

/** 라운드 3택 오버레이. BattleScene은 일시정지된 상태 */
export class PickScene extends Phaser.Scene {
  private cards: Phaser.GameObjects.Container[] = [];
  private rerolled = false;
  private chosen = false;
  private openedAt = 0;

  constructor() {
    super('PickScene');
  }

  create(d: PickSceneData): void {
    const gd = getData(this);
    const sv = getServices(this);
    const { width, height } = this.scale;
    this.cards = [];
    this.rerolled = false;
    this.chosen = false;
    this.openedAt = this.time.now;
    const s = d.battle.state;
    const total = Math.floor((s.stage.durationSec - 1e-6) / gd.config.pick.intervalSec);

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72).setInteractive();
    this.add.text(width / 2, 330, '보상 선택', titleStyle(56, '#FFD54F')).setOrigin(0.5);
    this.add.text(width / 2, 390, `${s.picksShown} / ${total}  ·  하나를 골라 전투를 이어가세요`, textStyle(24, COLORS.textDim)).setOrigin(0.5);

    const choose = (i: number) => {
      if (this.chosen) return;
      this.chosen = true;
      sv.sound.play('button');
      this.tweens.add({ targets: this.cards[i], scale: 1.1, duration: 120, yoyo: true });
      this.time.delayedCall(180, () => {
        d.onChosen(i, this.rerolled);
        this.scene.resume('BattleScene');
        this.scene.stop();
      });
    };
    const render = () => {
      this.cards.forEach((c) => c.destroy());
      this.cards = d.battle.state.currentPick.map((o, i) => this.makeCard(gd, o, i, () => choose(i)));
    };
    const reroll = new Button(this, width / 2, 960, 320, 90, '', () => {
      if (this.chosen || !d.battle.reroll()) return;
      this.rerolled = true;
      d.onRerolled();
      sv.sound.play('pick');
      render();
      refreshReroll();
    }, { color: 0x4527a0, fontSize: 30, icon: 'dice' });
    const refreshReroll = () => {
      reroll.setText(`리롤 (${d.battle.state.rerollsLeft})`);
      reroll.setEnabled(d.battle.state.rerollsLeft > 0);
    };
    render();
    refreshReroll();
  }

  private makeCard(gd: GameData, option: PickOption, index: number, onPick: () => void): Phaser.GameObjects.Container {
    const info = describe(gd, option);
    const x = this.scale.width / 2 + (index - 1) * (CARD_W + 16);
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 1).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 20);
    g.fillStyle(info.color, 0.9).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, 150, { tl: 20, tr: 20, bl: 0, br: 0 });
    g.lineStyle(4, info.ribbon ? 0xffd700 : 0xffffff, info.ribbon ? 1 : 0.25).strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 20);
    const arts = info.art.map((key, i, all) => {
      const size = key.startsWith('cr-') ? 140 : 84;
      const dx = all.length > 1 ? (i === 0 ? -34 : 34) : 0;
      return this.add.image(dx, -CARD_H / 2 + 78 + (all.length > 1 && i === 1 ? 10 : 0), key).setDisplaySize(size, size);
    });
    const items: Phaser.GameObjects.GameObject[] = [
      g,
      ...arts,
      this.add.text(0, -CARD_H / 2 + 190, info.title, titleStyle(27)).setOrigin(0.5).setWordWrapWidth(CARD_W - 20).setAlign('center'),
      this.add.text(0, -CARD_H / 2 + 280, info.desc, textStyle(20, COLORS.textDim, { align: 'center', wordWrap: { width: CARD_W - 24 } })).setOrigin(0.5),
    ];
    if (info.ribbon) items.push(this.add.text(0, CARD_H / 2 - 4, info.ribbon, textStyle(20, '#000000', { backgroundColor: '#FFD700', padding: { x: 10, y: 6 }, fontStyle: 'bold' })).setOrigin(0.5));
    const card = this.add.container(x, CARD_Y, items).setSize(CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    let pressed = false;
    card.on('pointerdown', () => (pressed = this.time.now - this.openedAt >= INPUT_GUARD_MS));
    card.on('pointerout', () => (pressed = false));
    card.on('pointerup', () => {
      if (pressed) onPick();
      pressed = false;
    });
    card.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 220, delay: index * 70, ease: 'Back.Out' });
    return card;
  }
}

function describe(gd: GameData, o: PickOption): CardInfo {
  const el = (id: string) => gd.elements.elements[gd.monsterById.get(id)?.element ?? 'none'];
  const mon = (id: string) => gd.monsterById.get(id);
  switch (o.kind) {
    case 'monster': {
      const m = mon(o.monsterId);
      return { art: [creatureKey(o.monsterId)], title: m?.name ?? o.monsterId, desc: `${el(o.monsterId).name} · ${m?.range === 'melee' ? '근접' : '원거리'}\n몬스터 1마리 지급`, color: hexToNum(el(o.monsterId).color), ribbon: o.recipeHint ? '✨ 새 조합 가능?' : undefined };
    }
    case 'monster_pair': {
      const m = mon(o.monsterId);
      return { art: [creatureKey(o.monsterId), creatureKey(o.monsterId)], title: `${m?.name ?? o.monsterId} ×2`, desc: '같은 몬스터 2마리\n바로 ★강화 가능', color: hexToNum(el(o.monsterId).color) };
    }
    case 'recipe_hint': {
      const r = gd.fusions.recipes.find((x) => x.result === o.resultId);
      const reveal = mon(o.revealId);
      return { art: [creatureKey(o.revealId), iconKey('question')], title: '레시피 힌트', desc: `"${r?.hint ?? ''}"\n${reveal?.name ?? ''} + ???\n(${reveal?.name ?? ''} 지급)`, color: 0x8d6e63 };
    }
    case 'buff_element': {
      const e = gd.elements.elements[o.element];
      return { art: [iconKey(`el_${o.element}`)], title: `${e.name} 속성 강화`, desc: `${e.name} 몬스터 공격력\n+${Math.round(gd.config.pick.buffElementPct * 100)}% (이번 판)`, color: hexToNum(e.color) };
    }
    case 'heal':
      return { art: [iconKey('heart')], title: '치유', desc: `기지 HP +${Math.round(gd.config.pick.healBasePct * 100)}%\n기절한 몬스터 즉시 복귀`, color: 0xc2185b };
    case 'energy':
      return { art: [iconKey('energy')], title: '에너지', desc: `에너지 +${gd.config.pick.energyAmount}\n소환에 사용`, color: 0x0277bd };
  }
}
