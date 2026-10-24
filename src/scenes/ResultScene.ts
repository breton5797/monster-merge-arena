import Phaser from 'phaser';
import { getData, getServices } from '../registry';
import { summarize } from '../services/Analytics';
import type { GameData } from '../types';
import { Button } from '../ui/Button';
import { discoveredCount } from '../ui/codex';
import { showToast } from '../ui/Toast';
import { COLORS, formatTime, hexToNum, textStyle } from '../ui/theme';

export interface ResultSceneData {
  readonly stageId: number;
  readonly result: 'win' | 'lose';
  readonly timeSec: number;
  readonly kills: number;
  readonly mergesTotal: number;
  readonly newDiscoveries: readonly string[];
}

/** 승패, 생존 시간, 처치 수, 신규 발견, 다시하기·도감·메뉴, 플레이 로그 복사 */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  create(d: ResultSceneData): void {
    const gd = getData(this);
    const cx = this.scale.width / 2;
    const win = d.result === 'win';
    const stage = gd.stages.find((s) => s.id === d.stageId);
    this.cameras.main.fadeIn(250);
    this.add.text(cx, 150, win ? '🏆 승리!' : '💥 패배…', textStyle(76, win ? '#FFD54F' : '#FF6B6B', { fontStyle: 'bold' })).setOrigin(0.5);
    this.add.text(cx, 230, `${d.stageId}. ${stage?.name ?? ''}`, textStyle(28, COLORS.textDim)).setOrigin(0.5);
    this.renderStats(d, cx);
    this.renderDiscoveries(gd, d, cx);
    this.renderButtons(gd, d, cx);
  }

  private renderStats(d: ResultSceneData, cx: number): void {
    const stats: [string, string][] = [['생존 시간', formatTime(d.timeSec)], ['처치', `${d.kills}`], ['합성', `${d.mergesTotal}회`]];
    stats.forEach(([k, v], i) => {
      const x = cx + (i - 1) * 210;
      this.add.rectangle(x, 330, 190, 110, COLORS.panel).setStrokeStyle(2, COLORS.line);
      this.add.text(x, 305, k, textStyle(22, COLORS.textDim)).setOrigin(0.5);
      this.add.text(x, 350, v, textStyle(38, COLORS.text, { fontStyle: 'bold' })).setOrigin(0.5);
    });
  }

  private renderDiscoveries(gd: GameData, d: ResultSceneData, cx: number): void {
    this.add.text(cx, 440, `이번 판 신규 발견 ${d.newDiscoveries.length}`, textStyle(30, COLORS.accentText, { fontStyle: 'bold' })).setOrigin(0.5);
    if (d.newDiscoveries.length === 0) {
      this.add.text(cx, 540, '새 발견 없음\n다른 몬스터끼리 합쳐보세요!', textStyle(26, COLORS.textDim, { align: 'center' })).setOrigin(0.5);
    }
    d.newDiscoveries.slice(0, 8).forEach((id, i) => {
      const m = gd.monsterById.get(id);
      if (!m) return;
      const x = cx + ((i % 4) - 1.5) * 160;
      const y = 540 + Math.floor(i / 4) * 150;
      const card = this.add.container(x, y, [
        this.add.rectangle(0, 0, 146, 136, COLORS.panel).setStrokeStyle(3, 0xffd700),
        this.add.circle(0, -18, 38, hexToNum(gd.elements.elements[m.element].color)),
        this.add.text(0, -18, m.emoji, textStyle(40)).setOrigin(0.5),
        this.add.text(0, 44, m.name, textStyle(20)).setOrigin(0.5),
      ]);
      card.setScale(0).setAlpha(0);
      this.tweens.add({ targets: card, scale: 1, alpha: 1, delay: 200 + i * 120, duration: 300, ease: 'Back.Out' });
    });
  }

  private renderButtons(gd: GameData, d: ResultSceneData, cx: number): void {
    const sv = getServices(this);
    const click = () => sv.sound.play('button');
    const next = gd.stages.find((s) => s.id === d.stageId + 1);
    const canNext = d.result === 'win' && !!next && next.id <= sv.save.data.unlockedStages;
    const replay = (stageId: number, isNext: boolean) => () => {
      sv.analytics.track('replay_click', { from: 'result', next: isNext });
      this.scene.start('BattleScene', { stageId });
    };
    new Button(this, cx, 880, 560, 110, canNext ? '다음 스테이지 ▶' : '🔁 다시하기', replay(canNext && next ? next.id : d.stageId, canNext), { color: 0x2e7d32, fontSize: 36, onPressSound: click });
    if (canNext) new Button(this, cx - 145, 1010, 270, 96, '🔁 다시하기', replay(d.stageId, false), { fontSize: 28, onPressSound: click });
    new Button(this, canNext ? cx + 145 : cx - 145, 1010, 270, 96, `📖 도감${d.newDiscoveries.length ? ' •' : ''}`, () => {
      sv.analytics.track('codex_open', { from: 'result', discoveredCount: discoveredCount(gd, sv.save.data.discovered) });
      this.scene.start('CodexScene', { from: 'result', result: d });
    }, { color: 0x34495e, fontSize: 28, onPressSound: click });
    const toMenu = () => this.scene.start('MenuScene');
    if (canNext) new Button(this, cx, 1125, 270, 80, '🏠 메뉴', toMenu, { fontSize: 26, onPressSound: click });
    else new Button(this, cx + 145, 1010, 270, 96, '🏠 메뉴', toMenu, { fontSize: 28, onPressSound: click });
    const sum = summarize(sv.analytics.sessionEvents());
    new Button(this, cx, 1215, 560, 76, `📋 플레이 로그 복사  (이번 세션 ${sum.runs}판 · 발견 ${sum.discoveries})`, () => void this.copyLog(sv.analytics.exportLog()), { color: 0x263238, fontSize: 22, onPressSound: click });
  }

  private async copyLog(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      showToast(this, '복사됨! 테스트 담당자에게 붙여넣어 주세요', 2, 1130);
    } catch {
      // 클립보드 API가 막힌 환경(http, 구형 웹뷰) 대비
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      showToast(this, ok ? '복사됨!' : '복사 실패 — 브라우저가 클립보드를 막았습니다', 2, 1130);
    }
  }
}
