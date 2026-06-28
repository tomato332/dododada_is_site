// pomodoro.js — 🍅 포모도로 타이머 (닉시관 스타일)
import { playTick } from './sound.js';
import { getAudioCtx } from './sound.js';
import { isBgmPlaying, setTrack, toggleBgm } from './bgm.js';
import { updateContext, checkAchievements } from './achievements.js';

const FOCUS_TIME = 25 * 60; // 25분
const BREAK_TIME = 5 * 60;  // 5분

let mode = 'focus'; // 'focus' | 'break'
let remaining = FOCUS_TIME;
let running = false;
let interval = null;
let sessionCount = 0;

const SAVE_KEY = 'tomato_pomodoro';

function pad(n) {
    return String(n).padStart(2, '0');
}

function formatTime(sec) {
    return pad(Math.floor(sec / 60)) + ':' + pad(sec % 60);
}

function playAlarm() {
    try {
        const ctx = getAudioCtx();
        const t = ctx.currentTime;

        // 알람: 두 톤 반복
        for (let i = 0; i < 3; i++) {
            const tt = t + i * 0.25;
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(880, tt);
            osc.frequency.setValueAtTime(660, tt + 0.12);
            g.gain.setValueAtTime(0.08, tt);
            g.gain.exponentialRampToValueAtTime(0.001, tt + 0.2);
            osc.connect(g);
            g.connect(ctx.destination);
            osc.start(tt);
            osc.stop(tt + 0.2);
        }
    } catch {}
}

function onComplete() {
    running = false;
    if (interval) { clearInterval(interval); interval = null; }

    if (mode === 'focus') {
        sessionCount++;
        updateContext({ sessions: sessionCount });
        // 집중 완료 → 휴식 모드
        mode = 'break';
        remaining = BREAK_TIME;
        playAlarm();
        // BGM 연동: 재생 중이면 라디오로 전환 (가볍게)
        if (isBgmPlaying()) {
            setTrack(1); // Lofi Cafe
        }
    } else {
        // 휴식 완료 → 집중 모드
        mode = 'focus';
        remaining = FOCUS_TIME;
        playAlarm();
        // BGM 연동: Chill Day (Seq)로 전환
        if (isBgmPlaying()) {
            setTrack(0); // Chill Day (Seq)
        }
    }

    save();
    render();
}

function tick() {
    remaining--;
    if (remaining <= 0) {
        remaining = 0;
        render();
        onComplete();
        return;
    }
    render();
}

function render() {
    const display = document.getElementById('pomodoroDisplay');
    const modeEl = document.getElementById('pomodoroMode');
    const startBtn = document.getElementById('pomodoroStart');
    const resetBtn = document.getElementById('pomodoroReset');
    const sessionsEl = document.getElementById('pomodoroSessions');

    if (display) display.textContent = formatTime(remaining);
    if (modeEl) {
        modeEl.textContent = mode === 'focus' ? 'FOCUS' : 'BREAK';
        modeEl.className = 'pomodoro-mode ' + mode;
    }
    if (startBtn) startBtn.textContent = running ? '⏸' : '▶';
    if (resetBtn) resetBtn.style.display = running ? 'none' : 'inline-block';
    if (sessionsEl) sessionsEl.textContent = 'SESSIONS: ' + sessionCount;

    // 헤더 🍅 버튼에 남은 시간 표시
    const headerBtn = document.getElementById('pomodoroBtn');
    if (headerBtn) {
        headerBtn.textContent = running ? '🍅 ' + formatTime(remaining) : '🍅';
    }
}

function save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
        mode,
        remaining,
        running: false,
        sessionCount
    }));
}

function load() {
    try {
        const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
        if (saved) {
            mode = saved.mode || 'focus';
            remaining = saved.remaining ?? (mode === 'focus' ? FOCUS_TIME : BREAK_TIME);
            sessionCount = saved.sessionCount || 0;
            running = false;
        }
    } catch {}
}

export function initPomodoro() {
    load();
    render();

    const startBtn = document.getElementById('pomodoroStart');
    const resetBtn = document.getElementById('pomodoroReset');
    const pomodoroBtn = document.getElementById('pomodoroBtn');
    const player = document.getElementById('pomodoro-player');
    let playerOpen = false;

    // ── 헤더 버튼: 패널 토글 ──
    if (pomodoroBtn && player) {
        pomodoroBtn.onclick = e => {
            e.preventDefault();
            playerOpen = !playerOpen;
            player.classList.toggle('open', playerOpen);
            playTick('click');
        };

        document.addEventListener('click', e => {
            if (!playerOpen) return;
            if (!player.contains(e.target) && e.target !== pomodoroBtn && !pomodoroBtn.contains(e.target)) {
                playerOpen = false;
                player.classList.remove('open');
            }
        });
    }

    startBtn.onclick = () => {
        playTick('click');
        if (running) {
            // 일시정지
            running = false;
            if (interval) { clearInterval(interval); interval = null; }
            save();
            render();
            return;
        }
        // 시작
        running = true;
        render();
        interval = setInterval(tick, 1000);
    };

    resetBtn.onclick = () => {
        playTick('close');
        running = false;
        if (interval) { clearInterval(interval); interval = null; }
        mode = 'focus';
        remaining = FOCUS_TIME;
        save();
        render();
    };
}
