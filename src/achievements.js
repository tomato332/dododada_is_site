// achievements.js — 🏆 도전과제 시스템
import { playTick } from './sound.js';

const SAVE_KEY = 'tomato_achievements';

const ACHIEVEMENTS = [
    // ── 클릭커 ──
    { id: 'first-click',    icon: '🍅', name: 'FIRST CLICK',      desc: 'Click the tomato for the first time',      check: s => s.totalClicks >= 1 },
    { id: 'click-100',      icon: '👆', name: 'CLICKER 100',      desc: 'Reach 100 total clicks',                   check: s => s.totalClicks >= 100 },
    { id: 'click-1k',       icon: '👆', name: 'CLICKER 1K',       desc: 'Reach 1,000 total clicks',                 check: s => s.totalClicks >= 1000 },
    { id: 'click-10k',      icon: '💪', name: 'CLICKER 10K',      desc: 'Reach 10,000 total clicks',                check: s => s.totalClicks >= 10000 },
    { id: 'power-up',       icon: '⬆', name: 'POWER UP',         desc: 'Upgrade click power to 10',                check: s => s.power >= 10 },
    { id: 'auto-king',      icon: '⏰', name: 'AUTO KING',        desc: 'Get auto clicker to 10',                   check: s => s.auto >= 10 },
    { id: 'millionaire',    icon: '💰', name: 'MILLIONAIRE',      desc: 'Reach 1,000,000 tomatoes',                 check: s => s.score >= 1000000 },
    // ── 상점 ──
    { id: 'shopper',        icon: '🛒', name: 'SHOPPER',          desc: 'Buy your first decoration',                check: (_, ctx) => ctx.shopCount >= 1 },
    { id: 'collector',      icon: '🏛️', name: 'COLLECTOR',        desc: 'Buy all decorations',                      check: (_, ctx) => ctx.shopCount >= 9 },
    // ── 포모도로 ──
    { id: 'first-focus',    icon: '🍅', name: 'FIRST FOCUS',      desc: 'Complete your first focus session',        check: (_, ctx) => ctx.sessions >= 1 },
    { id: 'focus-5',        icon: '🔥', name: 'FOCUS x5',         desc: 'Complete 5 focus sessions',                check: (_, ctx) => ctx.sessions >= 5 },
    { id: 'focus-25',       icon: '⚡', name: 'FOCUS x25',        desc: 'Complete 25 focus sessions',               check: (_, ctx) => ctx.sessions >= 25 },
    { id: 'focus-100',      icon: '👑', name: 'FOCUS x100',       desc: 'Complete 100 focus sessions',              check: (_, ctx) => ctx.sessions >= 100 },
    // ── BGM ──
    { id: 'tune-in',        icon: '🎵', name: 'TUNE IN',          desc: 'Play music for the first time',            check: (_, ctx) => ctx.bgmPlayed },
    { id: 'sequencer',      icon: '🎛️', name: 'SEQUENCER',        desc: 'Edit a sequencer pattern',                 check: (_, ctx) => ctx.patternEdited },
    { id: 'beat-maker',     icon: '💾', name: 'BEAT MAKER',       desc: 'Save a pattern to slots',                  check: (_, ctx) => ctx.patternSaved },
    // ── 슬롯 ──
    { id: 'first-spin',     icon: '🎰', name: 'FIRST SPIN',       desc: 'Spin the slot machine once',              check: (_, ctx) => ctx.slotTotalWon > 0 || ctx.slotSpins >= 1 },
    { id: 'slot-50',        icon: '🎰', name: 'SLOT x50',         desc: 'Spin the slot machine 50 times',           check: (_, ctx) => ctx.slotSpins >= 50 },
    { id: 'slot-500',       icon: '🎰', name: 'SLOT x500',        desc: 'Spin the slot machine 500 times',          check: (_, ctx) => ctx.slotSpins >= 500 },
    { id: 'slot-profit',    icon: '💰', name: 'IN THE GREEN',     desc: 'Achieve positive net winnings on slots',   check: (_, ctx) => ctx.slotNet >= 0 && ctx.slotSpins >= 10 },
    // ── 희귀 ──
    { id: 'click-100k',     icon: '🔥', name: 'CLICKER 100K',     desc: 'Reach 100,000 total clicks',              check: s => s.totalClicks >= 100000, rare: true },
    { id: 'billionaire',    icon: '💎', name: 'BILLIONAIRE',       desc: 'Reach 1,000,000,000 tomatoes',            check: s => s.score >= 1e9, rare: true },
    { id: 'power-max',      icon: '💥', name: 'POWER MAX',        desc: 'Upgrade click power to 100',              check: s => s.power >= 100, rare: true },
    { id: 'auto-max',       icon: '🤖', name: 'AUTO MAX',         desc: 'Get auto clicker to 50',                  check: s => s.auto >= 50, rare: true },
    { id: 'focus-500',      icon: '🌟', name: 'FOCUS x500',       desc: 'Complete 500 focus sessions',             check: (_, ctx) => ctx.sessions >= 500, rare: true },
    { id: 'night-owl',      icon: '🦉', name: 'NIGHT OWL',        desc: 'Use the site past midnight',              check: (_, ctx) => ctx.nightOwl, rare: true },
    { id: 'pattern-hoarder', icon: '📦', name: 'PATTERN HOARDER', desc: 'Save 5 different patterns',              check: (_, ctx) => ctx.patternCount >= 5, rare: true },
    { id: 'all-tracks',     icon: '🎶', name: 'ALL TRACKS',       desc: 'Listen to every music track',             check: (_, ctx) => ctx.tracksTried >= 6, rare: true },
    { id: 'completionist',  icon: '🏆', name: 'COMPLETIONIST',    desc: 'Unlock all other achievements',           check: (_, ctx) => ctx.completionistReady, rare: true },
];

let unlocked = new Set();
let context = { shopCount: 0, sessions: 0, bgmPlayed: false, patternEdited: false, patternSaved: false, nightOwl: false, patternCount: 0, tracksTried: 0, completionistReady: false, slotTotalWon: 0, slotJackpots: 0, slotSpins: 0, slotNet: 0 };

function load() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            unlocked = new Set(data.unlocked || []);
            context = { ...context, ...(data.context || {}) };
        }
    } catch {}
}

function save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
        unlocked: [...unlocked],
        context
    }));
}

function notify(id) {
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (!ach) return;
    playTick('open');
    // 토스트 표시
    const toast = document.createElement('div');
    toast.className = 'ach-toast';
    toast.innerHTML = `<span class="ach-toast-icon">${ach.icon}</span>
        <div class="ach-toast-body">
            <div class="ach-toast-title">ACHIEVEMENT UNLOCKED!</div>
            <div class="ach-toast-name">${ach.name}</div>
            <div class="ach-toast-desc">${ach.desc}</div>
        </div>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

export function checkAchievements(getClickerState) {
    const s = getClickerState ? getClickerState() : null;
    let newUnlock = false;

    // Night Owl: 현재 시간이 00:00~05:59 사이면 true
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 6) {
        context.nightOwl = true;
    }

    // Completionist: 희귀를 제외한 모든 도전과제 해제
    const normalTotal = ACHIEVEMENTS.filter(a => !a.rare).length;
    const normalUnlocked = ACHIEVEMENTS.filter(a => !a.rare && unlocked.has(a.id)).length;
    context.completionistReady = normalUnlocked >= normalTotal;

    for (const ach of ACHIEVEMENTS) {
        if (unlocked.has(ach.id)) continue;
        let earned = false;
        if (ach.id === 'shopper' || ach.id === 'collector') {
            earned = ach.check(null, context);
        } else if (ach.id === 'first-focus' || ach.id === 'focus-5' || ach.id === 'focus-25' || ach.id === 'focus-100' || ach.id === 'focus-500') {
            earned = ach.check(null, context);
        } else if (ach.id === 'tune-in' || ach.id === 'sequencer' || ach.id === 'beat-maker' || ach.id === 'night-owl' || ach.id === 'pattern-hoarder' || ach.id === 'all-tracks' || ach.id === 'completionist' || ach.id === 'first-spin' || ach.id === 'slot-50' || ach.id === 'slot-500' || ach.id === 'slot-profit') {
            earned = ach.check(null, context);
        } else if (s) {
            earned = ach.check(s, context);
        }
        if (earned) {
            unlocked.add(ach.id);
            notify(ach.id);
            newUnlock = true;
        }
    }

    if (newUnlock) {
        save();
        renderPanel();
    }
}

// ── 컨텍스트 업데이트 ──
export function updateContext(updates) {
    Object.assign(context, updates);
    save();
}

// ── 패널 렌더링 ──
function renderPanel() {
    const list = document.getElementById('achList');
    if (!list) return;

    const total = ACHIEVEMENTS.length;
    const count = unlocked.size;

    document.getElementById('achCount').textContent = `${count} / ${total}`;

    list.innerHTML = ACHIEVEMENTS.map(ach => {
        const done = unlocked.has(ach.id);
        return `<div class="ach-item ${done ? 'ach-unlocked' : 'ach-locked'}">
            <span class="ach-icon">${done ? ach.icon : '🔒'}</span>
            <div class="ach-info">
                <div class="ach-name">${ach.name}${ach.rare ? ' <span class="ach-rare-badge">★RARE</span>' : ''}</div>
                <div class="ach-desc">${ach.desc}</div>
            </div>
            ${done ? '<span class="ach-check">✓</span>' : ''}
        </div>`;
    }).join('');
}

export function initAchievements() {
    load();
    renderPanel();

    // 헤더 버튼 토글
    const btn = document.getElementById('achBtn');
    const panel = document.getElementById('ach-panel');
    let open = false;

    if (btn && panel) {
        btn.onclick = e => {
            e.preventDefault();
            open = !open;
            panel.classList.toggle('open', open);
            playTick('click');
            if (open) renderPanel();
        };

        document.addEventListener('click', e => {
            if (!open) return;
            if (!panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
                open = false;
                panel.classList.remove('open');
            }
        });
    }
}

// 강제 재렌더 (외부에서 호출)
export function refreshAchievements() {
    renderPanel();
}
