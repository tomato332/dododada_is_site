// clicker.js — 🍅 Tomato Clicker 게임
import { playTick } from './sound.js';

const SAVE_KEY = 'tomato_clicker';

let state;
let autoInterval = null;

function loadState() {
    try {
        const saved = localStorage.getItem(SAVE_KEY);
        if (saved) return JSON.parse(saved);
    } catch {}
    return { score: 0, power: 1, auto: 0, autoCost: 25, powerCost: 10, totalClicks: 0 };
}

function save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function getState() {
    return state;
}

export function render() {
    const scoreEl = document.getElementById('clicker-score');
    const powerEl = document.getElementById('clicker-power');
    const autoEl = document.getElementById('clicker-auto');
    const statsEl = document.getElementById('clicker-stats');
    const btnPower = document.getElementById('upgrade-power');
    const btnAuto = document.getElementById('upgrade-auto');

    if (scoreEl) scoreEl.textContent = state.score.toLocaleString();
    if (powerEl) powerEl.textContent = `+${state.power}`;
    if (autoEl) autoEl.textContent = state.auto;
    if (statsEl) statsEl.textContent = `TOTAL CLICKS: ${state.totalClicks}`;
    if (btnPower) {
        btnPower.textContent = `⬆ UPGRADE POWER (${state.powerCost} 🍅)`;
        btnPower.disabled = state.score < state.powerCost;
    }
    if (btnAuto) {
        btnAuto.textContent = `⏰ AUTO CLICKER (${state.autoCost} 🍅)`;
        btnAuto.disabled = state.score < state.autoCost;
    }
    save();
    // 샵 잔액 실시간 동기화
    window.shopRender?.();
}

function spawnParticle(x, y) {
    const emojis = ['🍅', '🔴', '✨', '💥'];
    for (let i = 0; i < 3; i++) {
        const p = document.createElement('div');
        p.className = 'clicker-particle';
        p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        p.style.left = (x + (Math.random() - .5) * 40) + 'px';
        p.style.top = (y + (Math.random() - .5) * 40) + 'px';
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 600);
    }
}

function addScore(amount, x, y) {
    state.score += amount;
    state.totalClicks++;
    render();
    if (x !== undefined && y !== undefined) {
        spawnParticle(x, y);
        const ft = document.createElement('div');
        ft.className = 'clicker-float-text';
        ft.textContent = `+${amount}`;
        ft.style.left = (x - 20) + 'px';
        ft.style.top = (y - 10) + 'px';
        document.body.appendChild(ft);
        setTimeout(() => ft.remove(), 700);
    }
    playTick('click');
}

function startAuto() {
    if (autoInterval) clearInterval(autoInterval);
    if (state.auto > 0) {
        autoInterval = setInterval(() => {
            state.score += state.auto;
            render();
        }, 1000);
    }
}

export function initClicker() {
    state = loadState();

    const tomato = document.getElementById('clicker-tomato');
    const panel = document.getElementById('clicker-panel');
    const overlay = document.getElementById('clicker-overlay');
    const upPower = document.getElementById('upgrade-power');
    const upAuto = document.getElementById('upgrade-auto');

    if (tomato) {
        tomato.onclick = (e) => {
            const rect = tomato.getBoundingClientRect();
            tomato.classList.remove('bounce');
            void tomato.offsetWidth;
            tomato.classList.add('bounce');
            addScore(state.power, e.clientX || rect.left + rect.width / 2, e.clientY || rect.top + rect.height / 2);
            render();
        };
    }

    if (upPower) {
        upPower.onclick = () => {
            if (state.score < state.powerCost) return;
            state.score -= state.powerCost;
            state.power++;
            state.powerCost = Math.floor(state.powerCost * 1.35);
            render();
            playTick('open');
        };
    }

    if (upAuto) {
        upAuto.onclick = () => {
            if (state.score < state.autoCost) return;
            state.score -= state.autoCost;
            state.auto++;
            state.autoCost = Math.floor(state.autoCost * 1.45);
            if (autoInterval) clearInterval(autoInterval);
            startAuto();
            render();
            playTick('open');
        };
    }

    // 패널 열기/닫기 (메인 페이지 모달용)
    function show() { if (panel && overlay) { panel.classList.add('show'); overlay.classList.add('show'); } }
    function hide() { if (panel && overlay) { panel.classList.remove('show'); overlay.classList.remove('show'); } }
    if (document.getElementById('headerClickerBtn')) document.getElementById('headerClickerBtn').onclick = e => { e.preventDefault(); show(); };
    if (document.getElementById('heroClickerBtn')) document.getElementById('heroClickerBtn').onclick = e => { e.preventDefault(); show(); };
    if (document.getElementById('closeClickerBtn')) document.getElementById('closeClickerBtn').onclick = hide;
    if (overlay) overlay.onclick = hide;

    startAuto();
    render();
}