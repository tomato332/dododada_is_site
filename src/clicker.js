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
    document.getElementById('clicker-score').textContent = state.score.toLocaleString();
    document.getElementById('clicker-power').textContent = `+${state.power}`;
    document.getElementById('clicker-auto').textContent = state.auto;
    document.getElementById('clicker-stats').textContent = `TOTAL CLICKS: ${state.totalClicks}`;
    const btnPower = document.getElementById('upgrade-power');
    const btnAuto = document.getElementById('upgrade-auto');
    btnPower.textContent = `⬆ UPGRADE POWER (${state.powerCost} 🍅)`;
    btnPower.disabled = state.score < state.powerCost;
    btnAuto.textContent = `⏰ AUTO CLICKER (${state.autoCost} 🍅)`;
    btnAuto.disabled = state.score < state.autoCost;
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

    tomato.onclick = (e) => {
        const rect = tomato.getBoundingClientRect();
        tomato.classList.remove('bounce');
        void tomato.offsetWidth;
        tomato.classList.add('bounce');
        addScore(state.power, e.clientX || rect.left + rect.width / 2, e.clientY || rect.top + rect.height / 2);
        render();
    };

    document.getElementById('upgrade-power').onclick = () => {
        if (state.score < state.powerCost) return;
        state.score -= state.powerCost;
        state.power++;
        state.powerCost = Math.floor(state.powerCost * 1.35);
        render();
        playTick('open');
    };

    document.getElementById('upgrade-auto').onclick = () => {
        if (state.score < state.autoCost) return;
        state.score -= state.autoCost;
        state.auto++;
        state.autoCost = Math.floor(state.autoCost * 1.45);
        if (autoInterval) clearInterval(autoInterval);
        startAuto();
        render();
        playTick('open');
    };

    // 패널 열기/닫기
    function show() { panel.classList.add('show'); overlay.classList.add('show'); }
    function hide() { panel.classList.remove('show'); overlay.classList.remove('show'); }
    document.getElementById('headerClickerBtn').onclick = e => { e.preventDefault(); show(); };
    document.getElementById('heroClickerBtn').onclick = e => { e.preventDefault(); show(); };
    document.getElementById('closeClickerBtn').onclick = hide;
    overlay.onclick = hide;

    startAuto();
    render();
}