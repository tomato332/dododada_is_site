// main.js — 진입점, 전역 이벤트 바인딩
import { playTick } from './sound.js';
import { initTheme, toggleTheme } from './theme.js';
import { initGlow } from './glow.js';
import { initRepos } from './repos.js';
import { initClicker, render } from './clicker.js';
import { initShop } from './shop.js';

// 전역 노출 (inline onclick 대응)
window.toggleTheme = function() {
    toggleTheme();
    playTick('click');
};

// ── 전역 사운드 이벤트 ──
document.addEventListener('click', e => {
    if (e.target.closest('a')) playTick('click');
    if (e.target.closest('.header-toggle')) playTick('open');
    if (e.target.closest('.close-btn')) playTick('close');
    if (e.target.closest('.theme-btn')) return;
});
document.addEventListener('mouseover', e => {
    if (e.target.closest('a, button, .theme-btn, .header-toggle')) playTick('hover');
});

// ── 모듈 초기화 ──
initTheme();
initGlow();
initRepos();
initClicker();
initShop();

// clickerRender 노출 (shop에서 사용)
window.clickerRender = render;