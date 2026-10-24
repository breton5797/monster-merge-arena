// npm run assets → public/icons/*.png, public/og-image.png
// 게임 캐릭터 SVG를 헤드리스 Chromium으로 래스터화한다 (앱 아이콘·공유 이미지가 게임 아트와 같은 그림).
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { creatureSvg, loadArt } from '../src/art';
import { toDataUri } from '../src/art/svg';

const art = new Map(loadArt().map((a) => [a.id, a]));
const img = (id: string, size: number, style = '') => `<img src="${toDataUri(creatureSvg(art.get(id)!))}" style="width:${size}px;height:${size}px;${style}">`;
const font = readFileSync('node_modules/@fontsource/jua/files/jua-korean-400-normal.woff2').toString('base64');
const latin = readFileSync('node_modules/@fontsource/jua/files/jua-latin-400-normal.woff2').toString('base64');
const css = `@font-face{font-family:Jua;src:url(data:font/woff2;base64,${latin}) format('woff2')}@font-face{font-family:JuaK;src:url(data:font/woff2;base64,${font}) format('woff2')}
*{margin:0;box-sizing:border-box}body{font-family:Jua,JuaK,sans-serif}.bg{background:radial-gradient(circle at 50% 35%,#7c4dff,#2b1b5a 70%);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.t{color:#fff;-webkit-text-stroke:0;text-shadow:0 0 0 #000;paint-order:stroke fill}`;

const icon = (size: number, pad: number) => `<style>${css}</style><div class="bg" style="width:${size}px;height:${size}px">${img('ember_pup', size - pad * 2, 'margin-top:4%')}</div>`;
const og = `<style>${css}
.title{font-size:96px;color:#FFD54F;-webkit-text-stroke:14px #2A1F2D;paint-order:stroke fill;line-height:1}.sub{font-size:76px;color:#fff;-webkit-text-stroke:12px #2A1F2D;paint-order:stroke fill;line-height:1.1}
.tag{font-family:JuaK,Jua;font-size:40px;color:#E9DDFF;margin-top:18px;-webkit-text-stroke:6px #2A1F2D;paint-order:stroke fill}</style>
<div class="bg" style="width:1200px;height:630px;flex-direction:column">
<div style="position:absolute;bottom:-30px;left:0;right:0;display:flex;justify-content:center;gap:0">${['sprout_bunny', 'drip_slime', 'ember_pup', 'zap_mouse', 'pebble_turtle'].map((id) => img(id, 230)).join('')}</div>
<div style="position:absolute;top:70px;text-align:center"><div class="title">MONSTER</div><div class="sub">MERGE ARENA</div><div class="tag">이 둘을 합치면 뭐가 나올까?</div></div></div>`;

const jobs: [string, string, number, number][] = [
  ['public/icons/icon-192.png', icon(192, 12), 192, 192],
  ['public/icons/icon-512.png', icon(512, 32), 512, 512],
  ['public/icons/maskable-512.png', icon(512, 96), 512, 512],
  ['public/icons/apple-touch-icon.png', icon(180, 12), 180, 180],
  ['public/og-image.png', og, 1200, 630],
];
const browser = await chromium.launch();
for (const [out, html, w, h] of jobs) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(`<!doctype html><meta charset="utf-8">${html}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
  console.log('wrote', out);
}
await browser.close();
