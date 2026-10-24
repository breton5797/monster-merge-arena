import Phaser from 'phaser';
import { creatureKey } from '../art';
import { iconKey } from '../art/icons';
import { getData, getServices } from '../registry';
import { summarize } from '../services/Analytics';
import type { GameData } from '../types';
import { Button } from '../ui/Button';
import { discoveredCount } from '../ui/codex';
import { showToast } from '../ui/Toast';
import { COLORS, drawPanel, formatTime, textStyle, titleStyle } from '../ui/theme';

export interface ResultSceneData {
  readonly stageId: number;
  readonly result: 'win' | 'lose';
  readonly timeSec: number;
  readonly kills: number;
  readonly mergesTotal: number;
  readonly newDiscoveries: readonly string[];
  readonly stars: number;
  /** 오늘의 도전 시드 (일반 판이면 null) */
  readonly daily: number | null;
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
    const g = this.add.graphics();
    g.fillGradientStyle(win ? 0x2b1b5a : 0x3a1522, win ? 0x2b1b5a : 0x3a1522, 0x0f1729, 0x0f1729, 1).fillRect(0, 0, this.scale.width, this.scale.height);
    this.add.image(cx, 120, iconKey(win ? 'trophy' : 'skull')).setDisplaySize(110, 110);
    this.add.text(cx, 225, win ? '승리!' : '패배…', titleStyle(80, win ? '#FFD54F' : '#FF6B6B')).setOrigin(0.5);
    this.add.text(cx, 290, d.daily ? `오늘의 도전 · ${stage?.name ?? ''}` : `${d.stageId}. ${stage?.name ?? ''}`, textStyle(26, COLORS.textDim)).setOrigin(0.5);
    this.renderStars(d.stars, cx);
    this.renderStats(d, cx);
    this.renderDiscoveries(gd, d, cx);
    this.renderButtons(gd, d, cx);
  }

  private renderStars(stars: number, cx: number): void {
    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * 96;
      const y = i === 1 ? 350 : 366;
      this.add.image(x, y, iconKey('star_empty')).setDisplaySize(80, 80);
      if (i >= stars) continue;
      const star = this.add.image(x, y, iconKey('star')).setDisplaySize(80, 80).setScale(0);
      this.tweens.add({ targets: star, scale: 80 / star.width, delay: 350 + i * 260, duration: 320, ease: 'Back.Out', onStart: () => getServices(this).sound.play('kill') });
    }
  }

  private renderStats(d: ResultSceneData, cx: number): void {
    const stats: [string, string, string][] = [['clock', '생존', formatTime(d.timeSec)], ['sword', '처치', `${d.kills}`], ['book', '합성', `${d.mergesTotal}회`]];
    stats.forEach(([icon, k, v], i) => {
      const x = cx + (i - 1) * 216;
      drawPanel(this.add.graphics(), x - 98, 430, 196, 104, COLORS.panel, 18);
      this.add.image(x - 58, 482, iconKey(icon)).setDisplaySize(40, 40);
      this.add.text(x + 18, 458, k, textStyle(20, COLORS.textDim)).setOrigin(0.5);
      this.add.text(x + 18, 496, v, titleStyle(32)).setOrigin(0.5);
    });
  }

  private renderDiscoveries(gd: GameData, d: ResultSceneData, cx: number): void {
    this.add.text(cx, 578, `이번 판 신규 발견 ${d.newDiscoveries.length}`, titleStyle(30, COLORS.accentText)).setOrigin(0.5);
    if (d.newDiscoveries.length === 0) {
      this.add.text(cx, 680, '새 발견 없음\n다른 몬스터끼리 합쳐보세요!', textStyle(26, COLORS.textDim, { align: 'center' })).setOrigin(0.5);
    }
    d.newDiscoveries.slice(0, 8).forEach((id, i) => {
      const m = gd.monsterById.get(id);
      if (!m) return;
      const x = cx + ((i % 4) - 1.5) * 160;
      const y = 680 + Math.floor(i / 4) * 150;
      const g = drawPanel(this.add.graphics(), -72, -68, 144, 136, COLORS.panel, 18);
      g.lineStyle(4, 0xffd54f, 1).strokeRoundedRect(-72, -68, 144, 136, 18);
      const card = this.add.container(x, y, [g, this.add.image(0, -12, creatureKey(m.id)).setDisplaySize(112, 112), this.add.text(0, 48, m.name, titleStyle(19)).setOrigin(0.5)]);
      card.setScale(0).setAlpha(0);
      this.tweens.add({ targets: card, scale: 1, alpha: 1, delay: 900 + i * 140, duration: 300, ease: 'Back.Out' });
    });
  }

  private renderButtons(gd: GameData, d: ResultSceneData, cx: number): void {
    const sv = getServices(this);
    const click = () => sv.sound.play('button');
    const next = gd.stages.find((s) => s.id === d.stageId + 1);
    const canNext = !d.daily && d.result === 'win' && !!next && next.id <= sv.save.data.unlockedStages;
    const replay = (stageId: number, isNext: boolean) => () => {
      sv.analytics.track('replay_click', { from: 'result', next: isNext });
      this.scene.start('BattleScene', d.daily && !isNext ? { stageId, daily: d.daily } : { stageId });
    };
    if (canNext && next) new Button(this, cx, 960, 560, 104, `다음 스테이지 · ${next.name}`, replay(next.id, true), { color: 0x2e7d32, fontSize: 32, icon: 'play', onPressSound: click });
    else new Button(this, cx, 960, 560, 104, '다시하기', replay(d.stageId, false), { color: 0x2e7d32, fontSize: 34, icon: 'replay', onPressSound: click });
    const row = [
      ...(canNext ? [{ label: '다시', icon: 'replay', color: 0x34495e, fn: replay(d.stageId, false) }] : []),
      { label: d.newDiscoveries.length ? '도감 •' : '도감', icon: 'book', color: 0x1565c0, fn: () => {
        sv.analytics.track('codex_open', { from: 'result', discoveredCount: discoveredCount(gd, sv.save.data.discovered) });
        this.scene.start('CodexScene', { from: 'result', result: d });
      } },
      { label: '메뉴', icon: 'home', color: 0x34495e, fn: () => this.scene.start('MenuScene') },
    ];
    const w = row.length === 3 ? 178 : 270;
    row.forEach((b, i) => new Button(this, cx + (i - (row.length - 1) / 2) * (w + 14), 1090, w, 88, b.label, b.fn, { color: b.color, fontSize: 26, icon: b.icon, onPressSound: click }));
    const sum = summarize(sv.analytics.sessionEvents());
    new Button(this, cx, 1210, 560, 70, `플레이 로그 복사 (이번 세션 ${sum.runs}판 · 발견 ${sum.discoveries})`, () => void this.copyLog(sv.analytics.exportLog()), { color: 0x263238, fontSize: 20, icon: 'clipboard', onPressSound: click });
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
