import Phaser from 'phaser';
import type { Analytics, AnalyticsEvent } from '../services/Analytics';
import type { Battle } from '../systems/Battle';
import { emptyCells } from '../systems/BoardSystem';
import type { GameData } from '../types';
import { Button } from '../ui/Button';
import { textStyle } from '../ui/theme';

const LOG_LINES = 16;

/** ?debug=1: 우측 이벤트 로그 + 몬스터 선택 소환 패널 */
export class DebugPanel {
  private readonly log: Phaser.GameObjects.Text;
  private lines: string[] = [];
  private panel: Phaser.GameObjects.Container | null = null;
  private star = 1;
  private readonly off: () => void;

  constructor(private readonly scene: Phaser.Scene, private readonly battle: Battle, private readonly data: GameData, analytics: Analytics, private readonly onPlaced: () => void) {
    const W = data.config.screen.width;
    this.log = scene.add.text(W - 8, 230, '', textStyle(14, '#7CFC00', { backgroundColor: '#000000AA', align: 'right', padding: { x: 6, y: 4 } })).setOrigin(1, 0).setDepth(300);
    this.off = analytics.onEvent((e) => this.push(e));
    new Button(scene, 60, 300, 90, 90, '🧪', () => this.togglePanel(), { fontSize: 40, color: 0x6a1b9a }).setDepth(300);
    scene.events.once('shutdown', () => this.off());
  }

  private push(e: AnalyticsEvent): void {
    const props = Object.entries(e.props).slice(0, 3).map(([k, v]) => `${k}=${Array.isArray(v) ? v.length : String(v)}`).join(' ');
    this.lines = [...this.lines, `${e.name} ${props}`].slice(-LOG_LINES);
    this.log.setText(this.lines.join('\n'));
  }

  private togglePanel(): void {
    if (this.panel) {
      this.panel.destroy();
      this.panel = null;
      return;
    }
    const s = this.scene;
    const items: Phaser.GameObjects.GameObject[] = [s.add.rectangle(360, 560, 700, 760, 0x000000, 0.92)];
    items.push(s.add.text(360, 205, '몬스터 소환 (디버그) — 탭하면 빈칸에 배치', textStyle(22)).setOrigin(0.5));
    const starBtn = new Button(s, 360, 900, 200, 70, `★${this.star}`, () => {
      this.star = (this.star % this.data.config.maxStar) + 1;
      starBtn.setText(`★${this.star}`);
    }, { fontSize: 28 });
    items.push(starBtn);
    this.data.monsters.forEach((m, i) => {
      const x = 70 + (i % 6) * 116;
      const y = 270 + Math.floor(i / 6) * 120;
      const b = new Button(s, x, y, 106, 106, `${m.emoji}\n${m.name.slice(0, 5)}`, () => {
        if (emptyCells(this.battle.state.board).length === 0) return;
        this.battle.placeMonster(m.id, this.star);
        this.onPlaced();
      }, { fontSize: 18, color: m.tier === 2 ? 0x6d4c00 : m.tier === 0 ? 0x4a148c : 0x263238 });
      items.push(b);
    });
    this.panel = s.add.container(0, 0, items).setDepth(400);
  }
}
