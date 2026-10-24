import Phaser from 'phaser';
import type { ArtSpec } from '../art';
import { backgroundKey } from '../art/backgrounds';
import { getArt, getData, getServices } from '../registry';
import type { Services } from '../services';
import { Battle } from '../systems/Battle';
import { RandomBot } from '../systems/Bot';
import { boardLeft, cellCenter } from '../systems/layout';
import { optionKey } from '../systems/PickSystem';
import { starRating } from '../systems/Progress';
import { createRng } from '../systems/rng';
import type { GameData } from '../types';
import { Button } from '../ui/Button';
import { showToast } from '../ui/Toast';
import { openSettings } from '../ui/SettingsPanel';
import { COLORS, hexToNum, textStyle, titleStyle } from '../ui/theme';
import { BattleFeedback } from '../views/BattleFeedback';
import { BoardView, type DropFeedback } from '../views/BoardView';
import { DebugPanel } from '../views/DebugPanel';
import { EnemyView } from '../views/EnemyView';
import { FxLayer } from '../views/FxLayer';
import { HudView } from '../views/HudView';
import type { PickSceneData } from './PickScene';
import type { ResultSceneData } from './ResultScene';

const MAX_FRAME_SEC = 0.1;
const END_DELAY_MS = 1600;

/** 3분 전투 본체. Battle 모델을 매 프레임 진행시키고 화면에 그린다. */
export class BattleScene extends Phaser.Scene {
  private gd!: GameData;
  private art!: ReadonlyMap<string, ArtSpec>;
  private sv!: Services;
  private battle!: Battle;
  private board!: BoardView;
  private hud!: HudView;
  private fx!: FxLayer;
  private feedback!: BattleFeedback;
  private enemyViews = new Map<number, EnemyView>();
  private bot: RandomBot | null = null;
  private speed = 1;
  private slowmoLeft = 0;
  private paused = false;
  private ended = false;
  private pauseLayer: Phaser.GameObjects.Container | null = null;
  private tutorial: Phaser.GameObjects.Container | null = null;
  /** 오늘의 도전 시드 (일반 판이면 null) */
  private daily: number | null = null;

  constructor() {
    super('BattleScene');
  }

  create(params: { stageId: number; daily?: number }): void {
    this.daily = params.daily ?? null;
    this.gd = getData(this);
    this.art = getArt(this);
    this.sv = getServices(this);
    this.enemyViews = new Map();
    this.speed = 1;
    this.slowmoLeft = 0;
    this.paused = false;
    this.ended = false;
    this.pauseLayer = null;
    this.tutorial = null;

    const save = this.sv.save.data;
    this.battle = new Battle(this.gd, { stageId: params.stageId, rng: createRng(this.daily ?? Date.now() >>> 0), discovered: save.discovered, hints: save.hints });
    this.drawField();
    const click = () => this.sv.sound.play('button');
    this.board = new BoardView(this, this.battle, this.gd, { onDrop: (f, t) => this.handleDrop(f, t), onDragStart: () => this.dismissTutorial() });
    const st = this.battle.state.stage;
    const title = this.daily ? `오늘의 도전 · ${st.name}` : `${st.id}. ${st.name}`;
    this.hud = new HudView(this, this.battle, this.gd, { onSummon: () => this.summon(), onPause: () => this.setPaused(true) }, click, title);
    this.sv.sound.music.play('battle');
    this.fx = new FxLayer(this, this.gd, this.hud.energyPos);
    this.feedback = new BattleFeedback(this, this.battle, this.gd, this.sv, this.fx, this.hud, this.board, (uid) => this.enemyViews.get(uid));
    this.board.sync();
    this.persistDiscoveries();

    this.sv.runIndex++;
    this.sv.analytics.track('run_start', { stageId: params.stageId, runIndex: this.sv.runIndex });
    this.setupDebug();
    if (!save.tutorialDone) this.time.delayedCall(700, () => this.showTutorial());
    this.cameras.main.fadeIn(200);
  }

  private drawField(): void {
    const cfg = this.gd.config;
    const stage = this.battle.state.stage;
    const top = cfg.layout.fieldTop;
    const h = cfg.layout.boardTop - top;
    this.add.rectangle(cfg.screen.width / 2, top + h / 2, cfg.screen.width, h, hexToNum(stage.background)).setDepth(0);
    this.add.image(cfg.screen.width / 2, top + h / 2, backgroundKey(stage.theme)).setDepth(0);
    const g = this.add.graphics().setDepth(0);
    const left = boardLeft(cfg);
    // 근접 사거리 표시선
    g.lineStyle(3, 0xffffff, 0.18).lineBetween(left, cfg.layout.boardTop - cfg.board.meleeReachPx, left + cfg.board.cols * cfg.board.cellSize, cfg.layout.boardTop - cfg.board.meleeReachPx);
  }

  private setupDebug(): void {
    if (!this.sv.debug) return;
    new DebugPanel(this, this.battle, this.gd, this.sv.analytics, () => this.afterBoardChange());
    const key = this.input.keyboard?.addKey(this.gd.config.debug.fastForwardKey);
    key?.on('down', () => {
      this.speed = this.speed === 1 ? this.gd.config.fx.debugSpeed : 1;
      this.hud.speedText.setText(this.speed > 1 ? `×${this.speed} (F)` : '');
    });
    if (new URLSearchParams(window.location.search).get('bot') === '1') {
      this.bot = new RandomBot(createRng(Date.now() >>> 0));
      this.hud.speedText.setText('🤖 BOT');
    }
  }

  override update(_time: number, deltaMs: number): void {
    if (this.paused || this.ended) return;
    const real = Math.min(deltaMs / 1000, MAX_FRAME_SEC);
    let dt = real * this.speed;
    if (this.slowmoLeft > 0) {
      this.slowmoLeft -= real;
      dt *= this.gd.config.fx.slowmoScale;
    }
    if (this.bot) {
      this.bot.update(this.battle, dt);
      if (!this.battle.state.awaitingPick) this.afterBoardChange();
    }
    this.battle.update(dt);
    for (const ev of this.battle.drainEvents()) {
      if (ev.type === 'pick') this.openPick();
      else if (ev.type === 'end') this.finish(ev.result);
      else this.feedback.handle(ev);
    }
    this.board.sync();
    this.syncEnemies();
    this.hud.update();
  }

  private syncEnemies(): void {
    const alive = new Set<number>();
    for (const e of this.battle.state.enemies) {
      alive.add(e.uid);
      const v = this.enemyViews.get(e.uid);
      if (v) v.sync();
      else this.enemyViews.set(e.uid, new EnemyView(this, e, this.gd, this.art.get(e.def.id)));
    }
    for (const [uid, v] of this.enemyViews) {
      if (alive.has(uid)) continue;
      v.destroy();
      this.enemyViews.delete(uid);
    }
  }

  // ------------------------------------------------------------ 플레이어 행동

  private summon(): void {
    if (this.paused || this.ended) return;
    const cost = this.battle.summonCost();
    const unit = this.battle.summon();
    if (!unit) return;
    this.sv.sound.play('summon');
    this.sv.analytics.track('summon', { monsterId: unit.defId, cost });
    this.afterBoardChange();
  }

  private handleDrop(from: number, to: number): DropFeedback {
    if (this.paused || this.ended) return 'none';
    const out = this.battle.dragDrop(from, to);
    if (out.kind !== 'merge') return out.kind;
    const { result } = out;
    const timeSec = Math.round(this.battle.state.time * 10) / 10;
    this.sv.analytics.track('merge', {
      result: result.kind,
      aId: out.aId,
      bId: out.bId,
      resultId: result.kind === 'invalid' ? null : result.resultId,
      isNewDiscovery: out.isNewDiscovery || out.isFirstChimera,
      timeSec,
    });
    if (result.kind === 'invalid') {
      this.sv.sound.play('invalid');
      this.sv.haptics.vibrate(25);
      showToast(this, '합칠 수 없어요', 0.8, 780);
      return 'invalid';
    }
    const def = this.gd.monsterById.get(result.resultId);
    const color = def ? hexToNum(this.gd.elements.elements[def.element].color) : 0xffffff;
    this.feedback.mergeFx(to, color);
    this.sv.sound.play('merge');
    if (out.isNewDiscovery && def) this.celebrateDiscovery(def.name, def.emoji, timeSec, result.resultId);
    else if (out.isFirstChimera) {
      this.fx.cutin('실패…?', '🧪 키메라가 태어났다', 0xb06cff);
      showToast(this, '이 조합은 레시피가 없습니다', this.gd.config.fx.toastSec, 760);
      this.sv.sound.play('chimera');
      this.trackDiscovery(result.resultId, timeSec);
    } else if (result.kind === 'recipe' && def) {
      const p = cellCenter(to, this.gd.config);
      this.fx.floatText(p.x, p.y - 70, def.name, '#FFD54F', 26);
    }
    this.afterBoardChange();
    return 'merge';
  }

  private celebrateDiscovery(name: string, emoji: string, timeSec: number, id: string): void {
    this.slowmoLeft = this.gd.config.discoveryCutinSec;
    this.fx.cutin(`NEW! ${emoji} ${name}`, '새로운 조합을 발견했다! 도감에 기록됨', 0xffd700);
    this.sv.sound.play('discover');
    this.sv.haptics.vibrate([30, 30, 60]);
    this.trackDiscovery(id, timeSec);
  }

  private trackDiscovery(monsterId: string, timeSec: number): void {
    this.hud.showCodexDot();
    this.persistDiscoveries();
    this.sv.analytics.track('discovery', { monsterId, totalDiscovered: this.sv.save.data.discovered.length, timeSec });
  }

  private afterBoardChange(): void {
    this.board.sync();
    this.persistDiscoveries();
  }

  private persistDiscoveries(): void {
    this.sv.save.addDiscoveries([...this.battle.state.discovered]);
  }

  // ------------------------------------------------------------ 3택 / 일시정지 / 종료

  private openPick(): void {
    this.board.cancelDrags();
    this.sv.sound.play('pick');
    this.trackPickShown(false);
    if (this.bot) return; // 봇은 다음 프레임에 직접 고른다
    const data: PickSceneData = { battle: this.battle, onChosen: (index, rerolled) => this.onPickChosen(index, rerolled), onRerolled: () => this.trackPickShown(true) };
    this.scene.pause();
    this.scene.launch('PickScene', data);
  }

  private trackPickShown(rerolled: boolean): void {
    this.sv.analytics.track('pick_shown', { options: this.battle.state.currentPick.map(optionKey), rerolled });
  }

  private onPickChosen(index: number, rerolled: boolean): void {
    const option = this.battle.state.currentPick[index];
    const res = this.battle.choosePick(index);
    if (!res || !option) return;
    this.sv.analytics.track('pick_chosen', { option: optionKey(option), index, rerolled });
    if (option.kind === 'recipe_hint') this.sv.save.setHint(option.resultId, option.revealId);
    this.afterBoardChange();
  }

  private setPaused(v: boolean): void {
    if (this.ended || v === this.paused) return;
    this.paused = v;
    this.board.cancelDrags();
    if (!v) {
      this.pauseLayer?.destroy();
      this.pauseLayer = null;
      return;
    }
    const { width, height } = this.scale;
    const blocker = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7).setInteractive();
    const title = this.add.text(width / 2, 460, '일시정지', textStyle(56, COLORS.text, { fontStyle: 'bold' })).setOrigin(0.5);
    const click = () => this.sv.sound.play('button');
    const resume = new Button(this, width / 2, 590, 420, 100, '계속하기', () => this.setPaused(false), { color: 0x2e7d32, icon: 'play', onPressSound: click });
    const settings = new Button(this, width / 2, 720, 420, 100, '설정', () => openSettings(this, this.sv), { color: 0x34495e, icon: 'gear', onPressSound: click });
    const quit = new Button(this, width / 2, 850, 420, 100, '메뉴로 나가기', () => this.quit(), { color: 0x8e2430, icon: 'home', onPressSound: click });
    this.pauseLayer = this.add.container(0, 0, [blocker, title, resume, settings, quit]).setDepth(500);
  }

  private quit(): void {
    const s = this.battle.state;
    this.ended = true;
    this.sv.analytics.track('run_end', { stageId: s.stage.id, result: 'lose', quit: true, timeSec: Math.round(s.time), kills: s.kills, mergesTotal: s.mergesTotal, newDiscoveries: s.newDiscoveries });
    this.scene.start('MenuScene');
  }

  private finish(result: 'win' | 'lose'): void {
    if (this.ended) return;
    this.ended = true;
    this.board.cancelDrags();
    if (result === 'lose' && this.battle.canRevive() && this.sv.ads.available) {
      this.offerRevive();
      return;
    }
    this.finalize(result);
  }

  /** 보상형 광고 부활 제안 (광고 서비스가 없으면 호출되지 않음) */
  private offerRevive(): void {
    const { width, height } = this.scale;
    const click = () => this.sv.sound.play('button');
    const layer = this.add.container(0, 0).setDepth(600);
    const decline = () => {
      layer.destroy();
      this.finalize('lose');
    };
    const watch = async () => {
      layer.destroy();
      const ok = await this.sv.ads.showRewarded('revive');
      if (!this.scene.isActive()) return; // 광고 보는 동안 화면이 바뀜
      if (ok && this.battle.revive()) {
        this.ended = false;
        this.fx.cutin('부활!', '기지가 다시 일어섰다', 0x69f0ae);
      } else this.finalize('lose');
    };
    layer.add([
      this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7).setInteractive(),
      this.add.text(width / 2, 470, '기지가 무너졌다!', titleStyle(48, '#FF6B6B')).setOrigin(0.5),
      new Button(this, width / 2, 610, 460, 104, '광고 보고 부활', () => void watch(), { color: 0x2e7d32, icon: 'heart', onPressSound: click }),
      new Button(this, width / 2, 740, 460, 90, '결과 보기', decline, { color: 0x4a4f5a, onPressSound: click }),
    ]);
  }

  private finalize(result: 'win' | 'lose'): void {
    const s = this.battle.state;
    const timeSec = Math.round(s.time);
    const stars = starRating(result, s.baseHp, s.baseHpMax);
    if (this.daily) this.sv.save.recordDaily(this.daily, s.stage.id, result, s.time, stars);
    else this.sv.save.recordRun(s.stage.id, result, s.time, this.gd.stages.length, stars);
    this.persistDiscoveries();
    this.sv.analytics.track('run_end', { stageId: s.stage.id, result, timeSec, kills: s.kills, mergesTotal: s.mergesTotal, newDiscoveries: s.newDiscoveries, stars, daily: this.daily !== null });
    this.sv.sound.music.stop();
    this.sv.sound.play(result === 'win' ? 'win' : 'lose');
    this.sv.haptics.vibrate(result === 'win' ? [50, 50, 50, 50, 150] : 300);
    this.fx.cutin(result === 'win' ? '승리!' : '패배…', result === 'win' ? '기지를 지켜냈다' : '기지가 무너졌다', result === 'win' ? 0xffd700 : 0xe53935);
    const data: ResultSceneData = { stageId: s.stage.id, result, timeSec, kills: s.kills, mergesTotal: s.mergesTotal, newDiscoveries: [...s.newDiscoveries], stars, daily: this.daily };
    this.time.delayedCall(END_DELAY_MS, () => this.scene.start('ResultScene', data));
  }

  // ------------------------------------------------------------ 튜토리얼

  private showTutorial(): void {
    if (this.ended || this.sv.save.data.tutorialDone) return;
    const pair = this.board.suggestMergePair();
    if (!pair) return;
    const cfg = this.gd.config;
    const a = cellCenter(pair[0], cfg);
    const b = cellCenter(pair[1], cfg);
    const hand = this.add.text(a.x, a.y, '👆', textStyle(72)).setOrigin(0.3, 0.1);
    const label = this.add.text(cfg.screen.width / 2, cfg.layout.boardTop - 60, '몬스터를 드래그해서 다른 몬스터에 합쳐보세요!', textStyle(26, '#FFFFFF', { backgroundColor: '#000000CC', padding: { x: 16, y: 10 } })).setOrigin(0.5);
    this.tweens.add({ targets: hand, x: b.x, y: b.y, duration: cfg.fx.tutorialHandSec * 500, hold: 300, repeat: -1, repeatDelay: 300, ease: 'Sine.InOut' });
    this.tutorial = this.add.container(0, 0, [hand, label]).setDepth(150);
  }

  private dismissTutorial(): void {
    if (!this.tutorial) return;
    this.tutorial.destroy();
    this.tutorial = null;
    this.sv.save.markTutorialDone();
  }
}
