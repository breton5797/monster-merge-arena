import Phaser from 'phaser';
import type { Services } from '../services';
import type { Battle } from '../systems/Battle';
import type { BattleEvent } from '../systems/BattleState';
import { cellCenter } from '../systems/layout';
import type { GameData } from '../types';
import type { BoardView } from './BoardView';
import type { FxLayer } from './FxLayer';
import type { HudView } from './HudView';

/** 모델 이벤트 → 연출·사운드·진동 매핑 (pick/end는 BattleScene이 처리) */
export class BattleFeedback {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly battle: Battle,
    private readonly data: GameData,
    private readonly sv: Services,
    private readonly fx: FxLayer,
    private readonly hud: HudView,
    private readonly board: BoardView,
  ) {}

  private shake(scale = 1): void {
    const { shakeMs, shakeIntensity } = this.data.config.fx;
    this.scene.cameras.main.shake(shakeMs * scale, shakeIntensity * scale);
  }

  private monsterPos(uid: number): { x: number; y: number } | null {
    const v = this.board.viewOf(uid);
    return v ? { x: v.x, y: v.y } : null;
  }

  handle(ev: BattleEvent): void {
    switch (ev.type) {
      case 'attack':
        this.fx.projectile(ev);
        break;
      case 'damage':
        this.fx.damage(ev.x, ev.y, ev.amount, ev.effect);
        this.sv.sound.play('hit');
        break;
      case 'skill':
        this.fx.skill(ev);
        break;
      case 'enemyHeal':
        this.fx.ring(ev.x, ev.y, ev.radius, 0x5bc35b);
        break;
      case 'kill':
      case 'baseHit':
        this.onImpact(ev);
        break;
      case 'monsterDamage':
      case 'ko':
      case 'revive':
      case 'heal':
        this.onMonster(ev);
        break;
      case 'bossSpawn':
      case 'bossElement':
      case 'bossSummon':
        this.onBoss(ev);
        break;
      case 'recover':
      case 'pick':
      case 'end':
        break;
    }
  }

  private onImpact(ev: Extract<BattleEvent, { type: 'kill' | 'baseHit' }>): void {
    if (ev.type === 'baseHit') {
      this.fx.baseFlash(ev.x);
      this.shake(ev.amount >= 100 ? 3 : 1);
      this.sv.sound.play('baseHit');
      this.sv.haptics.vibrate(40);
      return;
    }
    this.fx.kill(ev.x, ev.y, ev.energy, () => this.hud.pulseEnergy());
    this.sv.sound.play('kill');
    if (!ev.boss) return;
    this.fx.cutin('보스 처치!', '킹 키메라를 쓰러뜨렸다', 0xffd700);
    this.fx.burst(ev.x, ev.y, 0xffd700, 30, 220);
    this.shake(2);
    this.sv.haptics.vibrate([60, 40, 120]);
  }

  private onMonster(ev: Extract<BattleEvent, { type: 'monsterDamage' | 'ko' | 'revive' | 'heal' }>): void {
    const p = this.monsterPos(ev.uid);
    if (!p) return;
    if (ev.type === 'monsterDamage' && ev.amount >= 1) this.fx.floatText(p.x + 30, p.y - 30, `-${Math.round(ev.amount)}`, '#FF6B6B', 18);
    else if (ev.type === 'heal' && ev.amount >= 1) this.fx.floatText(p.x - 30, p.y - 20, `+${Math.round(ev.amount)}`, '#69F0AE', 18);
    else if (ev.type === 'ko') this.fx.floatText(p.x, p.y - 40, '기절!', '#BDBDBD', 24);
    else if (ev.type === 'revive') {
      this.fx.floatText(p.x, p.y - 40, '부활!', '#FFD54F', 30);
      this.fx.burst(p.x, p.y, 0xff6b3d, 12, 80);
    }
  }

  private onBoss(ev: Extract<BattleEvent, { type: 'bossSpawn' | 'bossElement' | 'bossSummon' }>): void {
    const boss = this.battle.boss;
    if (ev.type === 'bossSpawn') {
      this.fx.cutin('👹 킹 키메라 등장!', '30초마다 속성이 바뀐다 — 상성으로 대응!', 0xff1744);
      this.shake(2.5);
      this.sv.sound.play('boss');
      this.sv.haptics.vibrate([100, 50, 100]);
    } else if (ev.type === 'bossElement') {
      const el = this.data.elements.elements[ev.element];
      if (boss) this.fx.floatText(boss.x, boss.y - 90, `속성 변화! → ${el.name}`, el.color, 30);
      if (boss) this.fx.ring(boss.x, boss.y, 120, this.hud.bossColor(), 500);
      this.shake(0.6);
    } else if (boss) {
      this.fx.floatText(boss.x, boss.y - 90, '졸개 소환!', '#FF8A80', 30);
    }
  }

  /** 합성 결과 연출 */
  mergeFx(cell: number, color: number): void {
    const p = cellCenter(cell, this.data.config);
    this.fx.burst(p.x, p.y, color);
    this.fx.ring(p.x, p.y, 90, color);
  }
}
