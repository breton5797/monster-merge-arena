import Phaser from 'phaser';
import type { BattleEvent, DamageEffect } from '../systems/BattleState';
import type { ElementId, GameData, SkillId } from '../types';

type SkillEvent = Extract<BattleEvent, { type: 'skill' }>;
import { COLORS, hexToNum, textStyle } from '../ui/theme';

const MAX_POPUPS = 40;

/** 전투 연출: 투사체, 데미지 숫자, 처치 파티클, 스킬 이펙트, 컷인 */
export class FxLayer {
  private popups = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly data: GameData, private readonly energyTarget: { x: number; y: number }) {}

  private color(el: ElementId): number {
    return hexToNum(this.data.elements.elements[el].color);
  }

  projectile(ev: Extract<BattleEvent, { type: 'attack' }>): void {
    const s = this.scene;
    if (!ev.ranged) {
      const flash = s.add.circle(ev.toX, ev.toY, 14, this.color(ev.element), 0.8).setDepth(20);
      s.tweens.add({ targets: flash, scale: 2, alpha: 0, duration: 140, onComplete: () => flash.destroy() });
      return;
    }
    const dist = Phaser.Math.Distance.Between(ev.fromX, ev.fromY, ev.toX, ev.toY);
    const dot = s.add.circle(ev.fromX, ev.fromY, 7, this.color(ev.element)).setStrokeStyle(2, 0xffffff, 0.8).setDepth(20);
    s.tweens.add({ targets: dot, x: ev.toX, y: ev.toY, duration: (dist / this.data.config.combat.projectileSpeedPx) * 1000, onComplete: () => dot.destroy() });
  }

  damage(x: number, y: number, amount: number, effect: DamageEffect): void {
    if (this.popups >= MAX_POPUPS) return;
    const style: Record<DamageEffect, [number, string]> = { adv: [34, COLORS.adv], dis: [20, COLORS.dis], neutral: [24, '#FFFFFF'], crit: [40, COLORS.crit] };
    const [size, color] = style[effect];
    const label = `${Math.round(amount)}${effect === 'crit' ? '!' : ''}`;
    const t = this.scene.add.text(x + Phaser.Math.Between(-14, 14), y - 20, label, textStyle(size, color, { stroke: '#000', strokeThickness: 5, fontStyle: 'bold' })).setOrigin(0.5).setDepth(40);
    this.popups++;
    this.scene.tweens.add({ targets: t, y: t.y - 46, alpha: 0, duration: 650, ease: 'Quad.Out', onComplete: () => { t.destroy(); this.popups--; } });
  }

  floatText(x: number, y: number, text: string, color: string, size = 24): void {
    const t = this.scene.add.text(x, y, text, textStyle(size, color, { stroke: '#000', strokeThickness: 5, fontStyle: 'bold' })).setOrigin(0.5).setDepth(40);
    this.scene.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  /** 처치: 파티클 + 에너지 구슬이 하단 에너지 표시로 날아감 */
  kill(x: number, y: number, energy: number, onOrbArrive: () => void): void {
    const s = this.scene;
    for (let i = 0; i < 6; i++) {
      const p = s.add.circle(x, y, 6, 0xffffff, 0.9).setDepth(21);
      const a = (Math.PI * 2 * i) / 6;
      s.tweens.add({ targets: p, x: x + Math.cos(a) * 40, y: y + Math.sin(a) * 40, alpha: 0, duration: 260, onComplete: () => p.destroy() });
    }
    if (energy <= 0) return;
    const orb = s.add.circle(x, y, 9, 0x7fdbff).setStrokeStyle(3, 0xffffff).setDepth(60);
    s.tweens.add({
      targets: orb,
      x: this.energyTarget.x,
      y: this.energyTarget.y,
      duration: 520,
      ease: 'Cubic.In',
      onComplete: () => {
        orb.destroy();
        onOrbArrive();
      },
    });
  }

  burst(x: number, y: number, color: number, count = 14, radius = 90): void {
    const s = this.scene;
    for (let i = 0; i < count; i++) {
      const p = s.add.star(x, y, 5, 4, 10, color).setDepth(45);
      const a = Math.random() * Math.PI * 2;
      const r = radius * (0.5 + Math.random() * 0.5);
      s.tweens.add({ targets: p, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, angle: 180, alpha: 0, scale: 0.4, duration: 500, ease: 'Cubic.Out', onComplete: () => p.destroy() });
    }
  }

  ring(x: number, y: number, radius: number, color: number, duration = 350): void {
    const c = this.scene.add.circle(x, y, radius, color, 0.0).setStrokeStyle(5, color, 0.9).setDepth(19).setScale(0.3);
    this.scene.tweens.add({ targets: c, scale: 1, alpha: 0, duration, onComplete: () => c.destroy() });
  }

  line(x1: number, y1: number, x2: number, y2: number, color: number, width = 5): void {
    const g = this.scene.add.graphics().setDepth(22);
    g.lineStyle(width, color, 1).lineBetween(x1, y1, x2, y2);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  skill(ev: SkillEvent): void {
    const handler = this.skillFx[ev.skill];
    if (handler) handler(ev);
    else this.ring(ev.x, ev.y, 60, 0xffffff);
  }

  /** 스킬별 연출 (없는 스킬은 기본 링) */
  private readonly skillFx: Partial<Record<SkillId, (ev: SkillEvent) => void>> = {
    chain_lanes: (e) => this.line(e.x, e.y, e.toX ?? e.x, e.toY ?? e.y, 0xffe066, 6),
    splash: (e) => this.ring(e.x, e.y, e.radius ?? 80, 0x3da5ff),
    burn_aura: (e) => this.ring(e.x, e.y, e.radius ?? 150, 0xff6b3d, 450),
    poison_cloud: (e) => {
      const c = this.scene.add.circle(e.x, e.y, e.radius ?? 40, 0x8bc34a, 0.35).setDepth(19);
      this.scene.tweens.add({ targets: c, scale: 1.6, alpha: 0, duration: 600, onComplete: () => c.destroy() });
    },
    lane_slow: (e) => {
      const top = this.data.config.layout.boardTop;
      const r = this.scene.add.rectangle(e.x, (e.y + top) / 2, this.data.config.board.cellSize - 10, top - e.y, 0xbfe9ff, 0.12).setDepth(2);
      this.scene.tweens.add({ targets: r, alpha: 0, duration: 480, onComplete: () => r.destroy() });
    },
    stun_chance: (e) => this.floatText(e.x, e.y - 30, '💫', '#FFFFFF', 30),
    heal_all: (e) => this.ring(e.x, e.y, 200, 0x5bc35b, 500),
    row_shield: (e) => this.ring(e.x, e.y, 120, 0x7fdbff, 400),
    ground_flyers: (e) => this.floatText(e.x, e.y - 20, '추락!', '#FFD23F', 24),
    taunt_adjacent_lanes: (e) => this.floatText(e.x, e.y - 20, '❗', '#FFFFFF', 30),
    reflect: (e) => this.line(e.x, e.y, e.toX ?? e.x, e.toY ?? e.y, 0x5bc35b, 3),
    summon_minion: (e) => this.floatText(e.toX ?? e.x, e.toY ?? e.y, '🐝', '#FFFFFF', 28),
    meteor: (e) => this.meteor(e.x, e.y, e.radius ?? 80, e.element ?? 'fire'),
    pierce: (e) => this.line(e.x, e.y, e.toX ?? e.x, e.toY ?? e.y, e.element ? this.color(e.element) : 0xffe066, 10),
    knockback: (e) => this.floatText(e.x, e.y - 30, '밀쳐냄!', '#BDE0FE', 22),
    energy_gain: (e) => this.floatText(e.x, e.y - 50, '+⚡', '#7FDBFF', 30),
  };

  /** 하늘에서 떨어지는 메테오/번개 */
  meteor(x: number, y: number, radius: number, element: ElementId): void {
    const s = this.scene;
    const color = this.color(element);
    const rock = s.add.circle(x, this.data.config.layout.fieldTop - 20, 16, color).setStrokeStyle(4, 0xffffff, 0.9).setDepth(25);
    s.tweens.add({
      targets: rock,
      y,
      duration: 220,
      ease: 'Quad.In',
      onComplete: () => {
        rock.destroy();
        this.ring(x, y, radius, color, 380);
        this.burst(x, y, color, 10, radius);
      },
    });
  }

  explosion(x: number, y: number): void {
    this.ring(x, y, 110, 0xff7a1a, 420);
    this.burst(x, y, 0xffb020, 18, 120);
    this.floatText(x, y - 30, '펑!', '#FFB020', 40);
  }

  /** 화면 중앙 컷인 배너 */
  cutin(title: string, sub: string, color: number): void {
    const s = this.scene;
    const { width } = s.scale;
    const y = 470;
    const band = s.add.rectangle(width / 2, y, width, 190, 0x000000, 0.78).setDepth(200);
    const stripe = s.add.rectangle(width / 2, y, width, 190).setStrokeStyle(6, color).setDepth(200);
    const t1 = s.add.text(width / 2, y - 30, title, textStyle(56, '#FFFFFF', { fontStyle: 'bold', stroke: '#000', strokeThickness: 8 })).setOrigin(0.5).setDepth(201);
    const t2 = s.add.text(width / 2, y + 42, sub, textStyle(28, COLORS.textDim, { align: 'center' })).setOrigin(0.5).setDepth(201);
    const items = [band, stripe, t1, t2];
    band.setScale(1, 0);
    stripe.setScale(1, 0);
    t1.setScale(2.2).setAlpha(0);
    t2.setAlpha(0);
    s.tweens.add({ targets: [band, stripe], scaleY: 1, duration: 140 });
    s.tweens.add({ targets: t1, scale: 1, alpha: 1, duration: 260, ease: 'Back.Out' });
    s.tweens.add({ targets: t2, alpha: 1, delay: 120, duration: 200 });
    s.tweens.add({ targets: items, alpha: 0, delay: 1300, duration: 300, onComplete: () => items.forEach((i) => i.destroy()) });
  }

  baseFlash(x: number): void {
    const s = this.scene;
    const cfg = this.data.config;
    const r = s.add.rectangle(x, cfg.layout.boardBottom - 10, cfg.board.cellSize, 30, 0xff1744, 0.8).setDepth(30);
    s.tweens.add({ targets: r, alpha: 0, scaleY: 3, duration: 350, onComplete: () => r.destroy() });
  }
}
