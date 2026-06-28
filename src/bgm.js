// bgm.js — 하이브리드: 공개 lofi 라디오 스트림 + WebAudio 신디사이저
import { playTick } from './sound.js';
import { getAudioCtx } from './sound.js';
import { updateContext } from './achievements.js';

let isPlaying = false;
let isMuted = false;
let gainNode = null;
let currentBeat = 0;
let displayBeat = 0;
let beatInterval = null;
let displayTimeout = null;
let currentTrack = 0;
let audioEl = null;
let synthGain = null;
let audioGain = null;

// ── 비트 콜백 시스템 ──
const beatCallbacks = [];
// ── 트랙 변경 콜백 ──
const trackChangeCallbacks = [];

export function onBeat(fn) {
    if (!beatCallbacks.includes(fn)) beatCallbacks.push(fn);
}

export function offBeat(fn) {
    const i = beatCallbacks.indexOf(fn);
    if (i !== -1) beatCallbacks.splice(i, 1);
}

export function onTrackChange(fn) {
    if (!trackChangeCallbacks.includes(fn)) trackChangeCallbacks.push(fn);
}

export function offTrackChange(fn) {
    const i = trackChangeCallbacks.indexOf(fn);
    if (i !== -1) trackChangeCallbacks.splice(i, 1);
}

function notifyTrackChange() {
    for (const fn of trackChangeCallbacks) fn();
}

function notifyBeat() {
    for (const fn of beatCallbacks) fn();
}

// ════════════════════════════════════════
// 유저 시퀀스 패턴 (셀 클릭으로 편집)
// ════════════════════════════════════════
const ROW_IDS = ['kick', 'snare', 'hihat', 'chord', 'melody'];
// userPattern[rowIdx][step] = true/false
let userPattern = Array.from({ length: ROW_IDS.length }, () => Array(16).fill(false));

const PATTERN_SAVE_KEY = 'tomato_seq_pattern';
const SLOTS_SAVE_KEY = 'tomato_seq_slots';

// ── 패턴 인코딩/디코딩 (공유용) ──
export function encodePattern(pattern) {
    return pattern.map(row => {
        let bits = 0;
        for (let s = 0; s < 16; s++) {
            if (row[s]) bits |= (1 << (15 - s));
        }
        return bits.toString(36).padStart(4, '0');
    }).join('-');
}

export function decodePattern(str) {
    try {
        const rows = str.split('-');
        if (rows.length !== 5) return null;
        return rows.map(hexStr => {
            const bits = parseInt(hexStr, 36);
            if (isNaN(bits)) return null;
            const row = Array(16).fill(false);
            for (let s = 0; s < 16; s++) {
                if (bits & (1 << (15 - s))) row[s] = true;
            }
            return row;
        });
    } catch { return null; }
}

// ── 자동 저장 ──
function autosavePattern() {
    try {
        localStorage.setItem(PATTERN_SAVE_KEY, JSON.stringify(userPattern));
    } catch {}
}

// ── 슬롯 시스템 ──
export function getSlots() {
    try {
        const raw = localStorage.getItem(SLOTS_SAVE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function saveSlots(slots) {
    localStorage.setItem(SLOTS_SAVE_KEY, JSON.stringify(slots));
}

export function saveSlot(name) {
    const slots = getSlots();
    slots[name] = userPattern.map(row => [...row]);
    saveSlots(slots);
}

export function loadSlot(name) {
    const slots = getSlots();
    const data = slots[name];
    if (!data) return false;
    userPattern = data.map(row => [...row]);
    autosavePattern();
    return true;
}

export function deleteSlot(name) {
    const slots = getSlots();
    delete slots[name];
    saveSlots(slots);
}

// ── 공유: 클립보드 export/import ──
export function copyPatternToClipboard() {
    const code = encodePattern(userPattern);
    navigator.clipboard.writeText('SEQ:' + code).catch(() => {});
    return 'SEQ:' + code;
}

export function loadPatternFromCode(code) {
    const str = code.replace(/^SEQ:/, '').trim();
    const decoded = decodePattern(str);
    if (!decoded) return false;
    userPattern = decoded;
    autosavePattern();
    return true;
}

// 초기 기본 패턴 로드
function initDefaultPattern() {
    for (let s = 0; s < 16; s++) {
        if (s % 4 === 0) userPattern[0][s] = true; // kick
        if (s % 8 === 2 || s % 8 === 6) userPattern[1][s] = true; // snare
        if (s % 2 === 1) userPattern[2][s] = true; // hihat
        if (s % 4 === 0) userPattern[3][s] = true; // chord
        if ([0, 2, 4, 5, 8, 10, 12, 13].includes(s)) userPattern[4][s] = true;
    }
}

function loadSavedPattern() {
    try {
        const saved = localStorage.getItem(PATTERN_SAVE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length === 5) {
                userPattern = parsed;
                return true;
            }
        }
    } catch {}
    return false;
}

// 저장된 패턴 복원, 없으면 default
if (!loadSavedPattern()) {
    initDefaultPattern();
    autosavePattern();
}

export function getUserPattern() {
    return userPattern;
}

export function togglePatternCell(rowIdx, step) {
    if (rowIdx < 0 || rowIdx >= ROW_IDS.length || step < 0 || step >= 16) return;
    userPattern[rowIdx][step] = !userPattern[rowIdx][step];
    autosavePattern();
}

export function resetPattern() {
    userPattern = Array.from({ length: ROW_IDS.length }, () => Array(16).fill(false));
    initDefaultPattern();
    autosavePattern();
}

const SAVE_KEY = 'tomato_bgm';
const TRACK_KEY = 'tomato_bgm_track';

// ════════════════════════════════════════
// 트랙 정의
// ════════════════════════════════════════
const TRACKS = [
    { id: 'chill-synth',    name: '🌤 Chill Day (Seq)',  type: 'synth', bpm: 80 },
    { id: 'chill-original', name: '🌤 Chill Day (Orig)', type: 'synth', bpm: 80 },
    { id: 'lofi-radio-1',   name: '📻 Lofi Cafe',       type: 'radio', bpm: 85, url: 'https://lofi.stream.laut.fm/lofi' },
    { id: 'lofi-radio-2',   name: '📻 Chillhop',        type: 'radio', bpm: 88, url: 'https://streams.fluxfm.de/lofi/mp3-128' },
    { id: 'lofi-radio-3',   name: '📻 Lo-Fi Radio',     type: 'radio', bpm: 82, url: 'https://stream.lofiradio.eu/stream/1/' },
    { id: 'lofi-radio-4',   name: '📻 Night Rider',     type: 'radio', bpm: 90, url: 'https://streams.fluxfm.de/Chillhop/mp3-128' },
];

// ════════════════════════════════════════
// 드럼 + 신스 유틸 (Chill Day 전용)
// ════════════════════════════════════════
function createSynthGain() {
    const ctx = getCtx();
    synthGain = ctx.createGain();
    synthGain.gain.value = 0.5;
    synthGain.connect(ctx.destination);
}

function kick(ctx, time, vol = .35) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.08);
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    osc.connect(g); g.connect(synthGain);
    osc.start(time); osc.stop(time + 0.12);
}

function snare(ctx, time, vol = .25) {
    const bufSize = ctx.sampleRate * 0.08;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.08));
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1000;
    noise.connect(f); f.connect(g); g.connect(synthGain);
    noise.start(time); noise.stop(time + 0.08);
}

function hihat(ctx, time, vol = .08) {
    const bufSize = ctx.sampleRate * 0.04;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.03));
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 5000;
    noise.connect(f); f.connect(g); g.connect(synthGain);
    noise.start(time); noise.stop(time + 0.04);
}

const CHORDS = [
    [261.63, 329.63, 392.00], [220.00, 277.18, 329.63],
    [196.00, 246.94, 293.66], [174.61, 220.00, 261.63],
];
const MELODY = [523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 440.00, 493.88, 523.25, 587.33, 659.25];
// 16스텝 멜로디 리듬 패턴 (true = 이 스텝에 멜로디 연주)
const MELODY_PATTERN = [true, false, true, false, true, true, false, false, true, false, true, false, true, true, false, false];
// 각 스텝별 멜로디 음정 인덱스 (MELODY 배열 참조)
const MELODY_NOTE_MAP = [0, 0, 2, 0, 3, 5, 0, 0, 7, 0, 9, 0, 11, 4, 0, 0];

function chord(ctx, time, notes, vol = .08, dur = 1.8) {
    for (const freq of notes) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(vol, time);
        g.gain.linearRampToValueAtTime(vol, time + 0.3);
        g.gain.linearRampToValueAtTime(0.001, time + dur);
        osc.connect(g); g.connect(synthGain);
        osc.start(time); osc.stop(time + dur);
    }
}

function bass(ctx, time, freq, vol = .12) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq / 2;
    g.gain.setValueAtTime(vol, time);
    g.gain.linearRampToValueAtTime(vol * 0.5, time + 0.4);
    g.gain.linearRampToValueAtTime(0.001, time + 1.0);
    osc.connect(g); g.connect(synthGain);
    osc.start(time); osc.stop(time + 1.0);
}

function playNote(ctx, time, freq, vol = .06, dur = 0.6) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.05);
    g.gain.linearRampToValueAtTime(0.001, time + dur);
    osc.connect(g); g.connect(synthGain);
    osc.start(time); osc.stop(time + dur);
}

const BEAT_PATTERNS = {
    'chill-synth': {
        totalBeats: 16,
        getNotes(beat) {
            const hits = [];
            const rowMap = ['kick', 'snare', 'hihat', 'chord', 'melody'];
            rowMap.forEach((id, ri) => {
                if (userPattern[ri]?.[beat]) {
                    hits.push({ id, label: '' });
                }
            });
            return hits;
        }
    }
};

export function getCurrentPattern() {
    const track = TRACKS[currentTrack];
    if (track?.type === 'synth') {
        return BEAT_PATTERNS[track.id] || null;
    }
    return null;
}

export function isSequencerTrack() {
    return TRACKS[currentTrack]?.id === 'chill-synth';
}

export function getDisplayBeat() {
    return displayBeat;
}

function scheduleSynthBeat() {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const beatDur = 60 / 80; // BPM 80
    const trackId = TRACKS[currentTrack]?.id;
    const isSequenced = trackId === 'chill-synth';

    for (let i = 0; i < 8; i++) {
        const t = now + i * beatDur;
        const beat = (currentBeat + i) % 16;

        const kickOn = isSequenced ? userPattern[0][beat] : (beat % 4 === 0);
        const snareOn = isSequenced ? userPattern[1][beat] : (beat % 8 === 2 || beat % 8 === 6);
        const hihatOn = isSequenced ? userPattern[2][beat] : (beat % 2 === 1);
        const chordOn = isSequenced ? userPattern[3][beat] : (beat % 4 === 0);

        if (kickOn) kick(ctx, t, .3);
        if (snareOn) snare(ctx, t, .2);
        if (hihatOn) hihat(ctx, t, .06);
        if (beat % 2 === 0) hihat(ctx, t + beatDur / 2, .03);

        const ci = Math.floor(beat / 4) % CHORDS.length;
        if (chordOn) { chord(ctx, t, CHORDS[ci], .07); bass(ctx, t, CHORDS[ci][0], .1); }

        if (isSequenced) {
            if (userPattern[4][beat]) {
                playNote(ctx, t, MELODY[MELODY_NOTE_MAP[beat]], .05, .6);
            }
        } else {
            if (Math.random() > 0.4) continue;
            playNote(ctx, t, MELODY[Math.floor(Math.random() * MELODY.length)], .05, .6);
        }

        // 오디오와 동일한 타이밍에 display 업데이트 (WebAudio 타임라인 기준)
        const delayMs = Math.max(0, (t - ctx.currentTime) * 1000);
        setTimeout(() => {
            displayBeat = beat;
            notifyBeat();
        }, delayMs);
    }

    currentBeat = (currentBeat + 8) % 16;
}

// ════════════════════════════════════════
// 엔진
// ════════════════════════════════════════
function getCtx() {
    return getAudioCtx();
}

function stopAll() {
    // 신스 정리
    if (beatInterval) { clearInterval(beatInterval); beatInterval = null; }
    if (synthGain) { try { synthGain.disconnect(); } catch {} synthGain = null; }
    // 라디오 정리
    if (audioEl) {
        audioEl.pause();
        audioEl.src = '';
        audioEl.load();
        audioEl = null;
    }
    if (audioGain) { try { audioGain.disconnect(); } catch {} audioGain = null; }
    if (gainNode) { try { gainNode.disconnect(); } catch {} gainNode = null; }
    isPlaying = false;
    displayBeat = 0;
}

function startSynth() {
    const ctx = getCtx();
    createSynthGain();
    // 페이드인 — 급격한 볼륨 튐 방지
    synthGain.gain.setValueAtTime(0, ctx.currentTime);
    synthGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.0);
    isPlaying = true;
    currentBeat = 0;
    displayBeat = 0;
    scheduleSynthBeat();
    beatInterval = setInterval(() => {
        scheduleSynthBeat();
    }, 6000);
    updateContext({ bgmPlayed: true });
}

function startRadio(url) {
    const ctx = getCtx();
    // Audio 요소 생성
    audioEl = new Audio();
    audioEl.crossOrigin = 'anonymous';
    audioEl.src = url;
    audioEl.loop = false;

    // WebAudio로 라우팅 (볼륨 제어용)
    const source = ctx.createMediaElementSource(audioEl);
    audioGain = ctx.createGain();
    // 페이드인
    audioGain.gain.setValueAtTime(0, ctx.currentTime);
    audioGain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 1.5);
    source.connect(audioGain);
    audioGain.connect(ctx.destination);

    audioEl.play().catch(() => {});
    isPlaying = true;

    // 라디오는 실제 비트를 못 얻으니 BPM 기반 시뮬레이션
    const track = TRACKS[currentTrack];
    if (track?.bpm) {
        const beatMs = (60 / track.bpm) * 1000;
        const intervalMs = beatMs / 2;
        if (beatInterval) clearInterval(beatInterval);
        beatInterval = setInterval(notifyBeat, intervalMs);
    }
}

function playTrack(index) {
    stopAll();
    currentTrack = index;
    localStorage.setItem(TRACK_KEY, String(index));

    const track = TRACKS[index];
    if (track.type === 'synth') {
        startSynth();
    } else if (track.type === 'radio') {
        startRadio(track.url);
    }
    updateUI();
    notifyTrackChange();
}

// ════════════════════════════════════════
// 볼륨
// ════════════════════════════════════════
let volume = 0.7; // 0-1

function applyVolume() {
    const v = isMuted ? 0 : volume;
    if (synthGain) {
        const ctx = getAudioCtx();
        synthGain.gain.cancelScheduledValues(ctx.currentTime);
        synthGain.gain.setValueAtTime(v * 0.7, ctx.currentTime);
    }
    if (audioGain) {
        const ctx = getAudioCtx();
        audioGain.gain.cancelScheduledValues(ctx.currentTime);
        audioGain.gain.setValueAtTime(v * 0.5, ctx.currentTime);
    }
    if (audioEl) audioEl.volume = v;
}

function applyVolumeFadeIn(duration = 0.3) {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const target = isMuted ? 0 : volume;
    if (synthGain) {
        synthGain.gain.cancelScheduledValues(now);
        synthGain.gain.setValueAtTime(synthGain.gain.value || 0, now);
        synthGain.gain.linearRampToValueAtTime(target * 0.7, now + duration);
    }
    if (audioGain) {
        audioGain.gain.cancelScheduledValues(now);
        audioGain.gain.setValueAtTime(audioGain.gain.value || 0, now);
        audioGain.gain.linearRampToValueAtTime(target * 0.5, now + duration);
    }
}

function setVolume(val) {
    volume = Math.max(0, Math.min(1, val));
    localStorage.setItem('tomato_bgm_volume', String(volume));
    applyVolume();
    updateUI();
}

// ════════════════════════════════════════
// Public API
// ════════════════════════════════════════
export function toggleBgm() {
    if (isPlaying && !isMuted) {
        isMuted = true;
        applyVolume();
        updateUI();
        localStorage.setItem(SAVE_KEY, 'muted');
        return;
    }
    if (isPlaying && isMuted) {
        isMuted = false;
        applyVolumeFadeIn(0.3);
        updateUI();
        localStorage.setItem(SAVE_KEY, 'playing');
        return;
    }
    // 처음 시작
    isMuted = false;
    localStorage.setItem(SAVE_KEY, 'playing');
    playTrack(currentTrack);
    updateUI();
}

export function stopBgm() {
    localStorage.setItem(SAVE_KEY, 'stopped');
    stopAll();
    updateUI();
}

export function isBgmPlaying() {
    return isPlaying && !isMuted;
}

export function getTracks() {
    return TRACKS;
}

export function getCurrentTrack() {
    return currentTrack;
}

export function setTrack(index) {
    if (index < 0 || index >= TRACKS.length) return;
    if (isPlaying) {
        isMuted = false;
        playTrack(index);
        localStorage.setItem(SAVE_KEY, 'playing');
    } else {
        currentTrack = index;
        localStorage.setItem(TRACK_KEY, String(index));
    }
    updateUI();
    notifyTrackChange();
    playTick('open');
}

function updateUI() {
    const btn = document.getElementById('bgmBtn');
    if (btn) {
        if (!isPlaying) btn.textContent = '🎵';
        else if (isMuted) btn.textContent = '🔇';
        else btn.textContent = '🎶';
        btn.title = TRACKS[currentTrack].name;
    }
    const sel = document.getElementById('bgmSelect');
    if (sel) sel.value = currentTrack;

    // mute btn in player
    const muteBtn = document.getElementById('bgmMuteBtn');
    if (muteBtn) {
        muteBtn.textContent = isMuted ? '🔇' : '🔊';
        muteBtn.title = isMuted ? 'Unmute' : 'Mute';
    }

    // volume slider
    const volSlider = document.getElementById('bgmVolume');
    if (volSlider) volSlider.value = Math.round(volume * 100);

    // track name
    const trackName = document.getElementById('bgmTrackName');
    if (trackName) trackName.textContent = TRACKS[currentTrack].name;

    // AD 표시 토글
    const notice = document.getElementById('bgmNotice');
    if (notice) {
        const track = TRACKS[currentTrack];
        notice.classList.toggle('show', track?.type === 'radio');
    }
}

export function initBgm() {
    const savedTrack = localStorage.getItem(TRACK_KEY);
    if (savedTrack !== null) {
        currentTrack = Math.min(Math.max(0, parseInt(savedTrack)), TRACKS.length - 1);
    }

    // 볼륨 복원
    const savedVol = localStorage.getItem('tomato_bgm_volume');
    if (savedVol !== null) volume = Math.max(0, Math.min(1, parseFloat(savedVol)));

    updateUI();

    // ── 헤더 BGM 버튼: 플레이어 패널 토글 ──
    const bgmBtn = document.getElementById('bgmBtn');
    const player = document.getElementById('bgm-player');
    let playerOpen = false;

    bgmBtn.onclick = e => {
        e.preventDefault();
        playerOpen = !playerOpen;
        player.classList.toggle('open', playerOpen);
        playTick('click');
    };

    // 패널 밖 클릭 시 닫기
    document.addEventListener('click', e => {
        if (!playerOpen) return;
        if (!player.contains(e.target) && e.target !== bgmBtn && !bgmBtn.contains(e.target)) {
            playerOpen = false;
            player.classList.remove('open');
        }
    });

    // ── 뮤트 버튼 ──
    document.getElementById('bgmMuteBtn').onclick = () => {
        toggleBgm();
        playTick('click');
    };

    // ── 볼륨 슬라이더 ──
    const volSlider = document.getElementById('bgmVolume');
    volSlider.addEventListener('input', () => {
        setVolume(parseInt(volSlider.value) / 100);
    });

    // ── 채널 선택 ──
    const sel = document.getElementById('bgmSelect');
    if (sel) {
        sel.innerHTML = TRACKS.map((t, i) => `<option value="${i}">${t.name}</option>`).join('');
        sel.value = currentTrack;
        sel.onchange = () => setTrack(parseInt(sel.value));
    }

    const saved = localStorage.getItem(SAVE_KEY);
    if (saved === 'muted') { isMuted = true; updateUI(); }
    else if (saved === 'playing') { toggleBgm(); }
}