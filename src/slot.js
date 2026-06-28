// slot.js — 🎰 스타 슬롯 (별 충전 + 운명 슬롯)
import { playTick, getAudioCtx } from './sound.js';
import { getState } from './clicker.js';
import { updateContext } from './achievements.js';

const SAVE_KEY = 'tomato_slot';

const SYMBOLS = ['🍅', '🍀', '💎', '⭐', '🎰', '🍌'];
const REEL_SIZE = 3;
const MAX_STARS = 10;

// 별 레벨별 보상 배수 (0~10)
const STAR_MULT = [1.5, 2.0, 2.8, 3.5, 4.5, 5.5, 7.0, 9.0, 12.0, 16.0, 25.0];

let state = {
    totalSpins: 0, totalWon: 0, totalSpent: 0,
    biggestWin: 0, starMaxCount: 0, jackpots: 0
};

let isSpinning = false;
// 보유 토마토 기준 베팅 비율 (%)
const BET_PCTS = [0.01, 0.05, 0.10]; // 1%, 5%, 10%

let betPctIndex = 0; // 0 = 1%

function loadState() {
    try {
        const saved = localStorage.getItem(SAVE_KEY);
        if (saved) state = { ...state, ...JSON.parse(saved) };
    } catch {}
}
function save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

// 현재 별 레벨에 따른 충전 확률 (역곡선: 높을수록 어려움)
function starChance(level) {
    return Math.max(0.08, 0.55 - level * 0.05);
}

// 현재 베팅 금액 = balance × betPct × (1 + star × 0.5)
function getBetAmount(starLevel) {
    const cs = getState();
    const balance = cs ? cs.score : 0;
    const base = Math.max(1, Math.floor(balance * BET_PCTS[betPctIndex]));
    return Math.floor(base * (1 + starLevel * 0.5));
}

// 릴 생성
function spinReels() {
    return Array.from({ length: REEL_SIZE }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
}

// 결과 분석 (매치 티어)
function analyzeMatch(reel) {
    const counts = {};
    reel.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
    const maxCount = Math.max(...Object.values(counts));
    if (maxCount === 3) return 3;
    if (maxCount === 2) return 2;
    return 0;
}

// 매치 티어별 페이트 확률 (3매치=+ 높음, 노매치=- 높음)
function rollFate(matchTier) {
    const probs = { 3: 0.75, 2: 0.50, 0: 0.25 };
    return Math.random() < (probs[matchTier] || 0.5) ? '+' : '-';
}

// ── 효과음 ──
function playSlotSound(type) {
    try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const t = ctx.currentTime;
        if (type === 'spin') {
            for (let i = 0; i < 10; i++) {
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(200 + Math.random() * 300, t + i * 0.05);
                g.gain.setValueAtTime(0.03, t + i * 0.05);
                g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.03);
                osc.connect(g); g.connect(ctx.destination);
                osc.start(t + i * 0.05); osc.stop(t + i * 0.05 + 0.03);
            }
        } else if (type === 'charge') {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, t);
            osc.frequency.exponentialRampToValueAtTime(1760, t + 0.1);
            g.gain.setValueAtTime(0.06, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            osc.connect(g); g.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.15);
        } else if (type === 'win') {
            [523, 659, 784, 1047].forEach((f, i) => {
                const o = ctx.createOscillator(), g = ctx.createGain();
                o.type = 'square'; o.frequency.setValueAtTime(f, t + i * 0.1);
                g.gain.setValueAtTime(0.05, t + i * 0.1);
                g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.12);
                o.connect(g); g.connect(ctx.destination);
                o.start(t + i * 0.1); o.stop(t + i * 0.1 + 0.12);
            });
        } else if (type === 'lose') {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'sawtooth'; o.frequency.setValueAtTime(200, t);
            o.frequency.exponentialRampToValueAtTime(60, t + 0.3);
            g.gain.setValueAtTime(0.05, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            o.connect(g); g.connect(ctx.destination);
            o.start(t); o.stop(t + 0.3);
        } else if (type === 'jackpot') {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(200, t);
            o.frequency.exponentialRampToValueAtTime(1200, t + 0.4);
            o.frequency.exponentialRampToValueAtTime(200, t + 0.8);
            g.gain.setValueAtTime(0.08, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 1);
            o.connect(g); g.connect(ctx.destination);
            o.start(t); o.stop(t + 1);
        }
    } catch {}
}

// ── 실시간 별 충전 (릴 도는 동안) ──
let chargeTimer = null;

function startStarCharging(starDisplay, betDisplay) {
    if (chargeTimer) clearInterval(chargeTimer);

    chargeTimer = setInterval(() => {
        const currentStars = parseInt(starDisplay.dataset.stars || '0');
        if (currentStars >= MAX_STARS) {
            stopStarCharging();
            return;
        }
        const prob = starChance(currentStars);
        if (Math.random() < prob) {
            const newStars = currentStars + 1;
            starDisplay.dataset.stars = newStars;
            starDisplay.textContent = '⭐'.repeat(newStars) + '☆'.repeat(MAX_STARS - newStars);
            starDisplay.classList.remove('slot-star-flash');
            void starDisplay.offsetWidth;
            starDisplay.classList.add('slot-star-flash');
            playSlotSound('charge');

            if (newStars >= MAX_STARS) {
                state.starMaxCount++;
                save();
                stopStarCharging();
            }

            // 실시간 베팅 업데이트
            const newBet = getBetAmount(newStars);
            if (betDisplay) betDisplay.textContent = newBet.toLocaleString();
        }
    }, 120); // 120ms마다 충전 시도 (활 게임 느낌)
}

function stopStarCharging() {
    if (chargeTimer) {
        clearInterval(chargeTimer);
        chargeTimer = null;
    }
}

// ── 메인 스핀 로직 ──
function doSpin() {
    if (isSpinning) return;
    isSpinning = true;

    const cs = getState();
    if (!cs || cs.score < 100) {
        isSpinning = false;
        return;
    }

    const starLevel = parseInt(document.getElementById('slotStarLevel').dataset.stars || '0');
    const bet = getBetAmount(starLevel);

    if (cs.score < bet) {
        isSpinning = false;
        return;
    }

    // 비용 차감
    cs.score -= bet;
    state.totalSpins++;
    state.totalSpent += bet;
    save();
    if (window.clickerRender) window.clickerRender();

    playSlotSound('spin');

    // UI 요소
    const btn = document.getElementById('slotSpinBtn');
    const resultEl = document.getElementById('slotResult');
    const reelEls = [
        document.getElementById('slotReel0'),
        document.getElementById('slotReel1'),
        document.getElementById('slotReel2')
    ];
    const starDisplay = document.getElementById('slotStarLevel');
    const fateEl = document.getElementById('slotFate');
    const betDisplay = document.getElementById('slotCurrentBet');

    if (btn) btn.disabled = true;
    if (resultEl) resultEl.textContent = '🎰 Spinning...';

    // 릴 흔들림
    reelEls.forEach(el => { if (el) el.classList.add('slot-spinning'); });
    if (fateEl) { fateEl.textContent = '❓'; fateEl.className = 'slot-fate'; }

    // 실시간 별 충전 시작 (릴 도는 동안)
    startStarCharging(starDisplay, betDisplay);

    const result = spinReels();

    // 릴 순차 애니메이션
    reelEls.forEach((el, i) => {
        const interval = setInterval(() => {
            if (el) el.textContent = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        }, 60);
        setTimeout(() => {
            clearInterval(interval);
            if (el) {
                el.textContent = result[i];
                el.classList.remove('slot-spinning');
                el.classList.add('slot-land');
                setTimeout(() => el.classList.remove('slot-land'), 300);
            }
        }, 300 + i * 200);
    });

    // 마지막 릴 멈춘 후 → 별 충전 중단 → 페이트
    const totalDelay = 300 + 2 * 200 + 300;

    setTimeout(() => {
        stopStarCharging();

        const finalStars = parseInt(starDisplay.dataset.stars || '0');

        // 릴 결과 표시
        const matchTier = analyzeMatch(result);
        if (resultEl) {
            if (matchTier === 3) {
                resultEl.textContent = `🎯 3-MATCH!`;
                resultEl.className = 'slot-result-text slot-big-win';
            } else if (matchTier === 2) {
                resultEl.textContent = `✨ 2-MATCH`;
                resultEl.className = 'slot-result-text slot-win';
            } else {
                resultEl.textContent = finalStars > 0 ? `⭐ Charged ${finalStars}⭐` : `❌ No match`;
                resultEl.className = 'slot-result-text ' + (finalStars > 0 ? 'slot-win' : 'slot-lose');
            }
        }

        // 베팅 업데이트
        const finalBet = getBetAmount(finalStars);
        if (betDisplay) betDisplay.textContent = finalBet.toLocaleString();

        // ── 페이트 슬롯 (+/-) ──
        setTimeout(() => {
            const fate = rollFate(matchTier);
            if (fateEl) {
                fateEl.textContent = fate;
                fateEl.className = 'slot-fate ' + (fate === '+' ? 'slot-fate-plus' : 'slot-fate-minus');
                fateEl.classList.add('slot-fate-spin');
                setTimeout(() => fateEl.classList.remove('slot-fate-spin'), 400);
            }

            if (fate === '+') {
                const winMult = STAR_MULT[Math.min(finalStars, MAX_STARS)];
                const winAmount = Math.floor(getBetAmount(0) * winMult);
                cs.score += winAmount;
                if (window.clickerRender) window.clickerRender();

                state.totalWon += winAmount;
                if (winAmount > state.biggestWin) state.biggestWin = winAmount;
                if (finalStars >= MAX_STARS) state.jackpots++;
                save();

                if (resultEl) {
                    resultEl.textContent = `💰 +${winAmount.toLocaleString()} 🍅 (x${winMult.toFixed(1)})`;
                    resultEl.className = 'slot-result-text ' + (finalStars >= MAX_STARS ? 'slot-jackpot' : winMult >= 7 ? 'slot-big-win' : 'slot-win');
                }

                if (finalStars >= MAX_STARS) {
                    playSlotSound('jackpot');
                    const flash = document.getElementById('slotJackpotFlash');
                    if (flash) { flash.classList.add('show'); setTimeout(() => flash.classList.remove('show'), 2000); }
                } else {
                    playSlotSound('win');
                }

                // 별 리셋
                if (starDisplay) {
                    starDisplay.dataset.stars = 0;
                    starDisplay.textContent = '☆'.repeat(MAX_STARS);
                }

                updateContext({
                    slotTotalWon: state.totalWon, slotJackpots: state.jackpots,
                    slotSpins: state.totalSpins, slotNet: state.totalWon - state.totalSpent
                });

            } else {
                // 패배
                playSlotSound('lose');

                if (resultEl) {
                    resultEl.textContent = `💸 -${finalBet.toLocaleString()} 🍅`;
                    resultEl.className = 'slot-result-text slot-lose';
                }

                // 별 리셋
                if (starDisplay) {
                    starDisplay.dataset.stars = 0;
                    starDisplay.textContent = '☆'.repeat(MAX_STARS);
                }

                updateContext({
                    slotTotalWon: state.totalWon, slotJackpots: state.jackpots,
                    slotSpins: state.totalSpins, slotNet: state.totalWon - state.totalSpent
                });
            }

            // 베팅 리셋
            const resetBet = getBetAmount(0);
            if (betDisplay) betDisplay.textContent = resetBet.toLocaleString();

            if (btn) btn.disabled = false;
            updateStats();
            updateBalance();
            isSpinning = false;
        }, 500);
    }, totalDelay);
}

function updateStats() {
    const net = state.totalWon - state.totalSpent;
    document.getElementById('slotTotalSpins').textContent = state.totalSpins;
    document.getElementById('slotTotalWon').textContent = state.totalWon.toLocaleString();
    document.getElementById('slotJackpotCount').textContent = state.jackpots;
    const netEl = document.getElementById('slotNet');
    if (netEl) {
        netEl.textContent = (net >= 0 ? '+' : '') + net.toLocaleString();
        netEl.style.color = net >= 0 ? 'var(--accent2)' : 'var(--danger)';
    }
    document.getElementById('slotBiggestWin').textContent = state.biggestWin.toLocaleString();
    updateBalance();
}

function updateBalance() {
    const el = document.getElementById('slotBalance');
    const cs = getState();
    if (el) el.textContent = cs ? cs.score.toLocaleString() : '0';
}

function renderPanel() {
    document.querySelectorAll('.slot-bet-btn').forEach(btn => {
        btn.onclick = () => {
            betPctIndex = parseInt(btn.dataset.bet);
            setBet();
        };
    });
    document.getElementById('slotSpinBtn').onclick = doSpin;
    setBet();
    updateStats();

    const starDisplay = document.getElementById('slotStarLevel');
    if (starDisplay) {
        starDisplay.dataset.stars = 0;
        starDisplay.textContent = '☆'.repeat(MAX_STARS);
    }
}

function setBet() {
    document.querySelectorAll('.slot-bet-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.bet) === betPctIndex);
    });
    const starLevel = parseInt(document.getElementById('slotStarLevel').dataset.stars || '0');
    const pct = (BET_PCTS[betPctIndex] * 100).toFixed(0);
    const amount = getBetAmount(starLevel);
    document.getElementById('slotCurrentBet').textContent = amount.toLocaleString() + ` (${pct}%)`;
    playTick('click');
}

export function initSlot() {
    loadState();

    const panel = document.getElementById('slot-panel');
    const overlay = document.getElementById('slot-overlay');

    function show() { panel.classList.add('show'); overlay.classList.add('show'); renderPanel(); }
    function hide() { panel.classList.remove('show'); overlay.classList.remove('show'); }

    const headerBtn = document.getElementById('headerSlotBtn');
    if (headerBtn) headerBtn.onclick = e => { e.preventDefault(); show(); };
    const heroBtn = document.getElementById('heroSlotBtn');
    if (heroBtn) heroBtn.onclick = e => { e.preventDefault(); show(); };
    document.getElementById('closeSlotBtn').onclick = hide;
    if (overlay) overlay.onclick = hide;
}