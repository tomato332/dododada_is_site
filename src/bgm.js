// bgm.js — 하이브리드: 공개 lofi 라디오 스트림 + WebAudio 신디사이저
import { playTick } from './sound.js';

let audioCtx;
let isPlaying = false;
let isMuted = false;
let gainNode = null;
let currentBeat = 0;
let beatInterval = null;
let currentTrack = 0;
let audioEl = null;
let synthGain = null;
let audioGain = null;

const SAVE_KEY = 'tomato_bgm';
const TRACK_KEY = 'tomato_bgm_track';

// ════════════════════════════════════════
// 트랙 정의
// ════════════════════════════════════════
const TRACKS = [
    { id: 'chill-synth',   name: '🌤 Chill Day',     type: 'synth', bpm: 80 },
    { id: 'lofi-radio-1',  name: '📻 Lofi Cafe',     type: 'radio', url: 'https://lofi.stream.laut.fm/lofi' },
    { id: 'lofi-radio-2',  name: '📻 Chillhop',      type: 'radio', url: 'https://streams.fluxfm.de/lofi/mp3-128' },
    { id: 'lofi-radio-3',  name: '📻 Lo-Fi Radio',   type: 'radio', url: 'https://stream.lofiradio.eu/stream/1/' },
    { id: 'lofi-radio-4',  name: '📻 Night Rider',   type: 'radio', url: 'https://streams.fluxfm.de/Chillhop/mp3-128' },
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

function scheduleSynthBeat() {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const beatDur = 60 / 80; // BPM 80

    for (let i = 0; i < 8; i++) {
        const t = now + i * beatDur;
        const beat = (currentBeat + i) % 16;
        if (beat % 4 === 0) kick(ctx, t, .3);
        if (beat % 8 === 2 || beat % 8 === 6) snare(ctx, t, .2);
        if (beat % 2 === 1) hihat(ctx, t, .06);
        if (beat % 2 === 0) hihat(ctx, t + beatDur / 2, .03);
        const ci = Math.floor(beat / 4) % CHORDS.length;
        if (beat % 4 === 0) { chord(ctx, t, CHORDS[ci], .07); bass(ctx, t, CHORDS[ci][0], .1); }
        if (Math.random() > 0.4) continue;
        playNote(ctx, t, MELODY[Math.floor(Math.random() * MELODY.length)], .05, .6);
    }

    currentBeat = (currentBeat + 8) % 16;
}

// ════════════════════════════════════════
// 엔진
// ════════════════════════════════════════
function getCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
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
}

function startSynth() {
    const ctx = getCtx();
    createSynthGain();
    isPlaying = true;
    currentBeat = 0;
    scheduleSynthBeat();
    beatInterval = setInterval(scheduleSynthBeat, 6000);
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
    audioGain.gain.value = 0.4;
    source.connect(audioGain);
    audioGain.connect(ctx.destination);

    audioEl.play().catch(() => {});
    isPlaying = true;
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
}

// ════════════════════════════════════════
// Public API
// ════════════════════════════════════════
export function toggleBgm() {
    if (isPlaying && !isMuted) {
        isMuted = true;
        if (synthGain) synthGain.gain.value = 0;
        if (audioGain) audioGain.gain.value = 0;
        if (audioEl) audioEl.volume = 0;
        updateUI();
        localStorage.setItem(SAVE_KEY, 'muted');
        return;
    }
    if (isPlaying && isMuted) {
        isMuted = false;
        if (synthGain) synthGain.gain.value = 0.5;
        if (audioGain) audioGain.gain.value = 0.4;
        if (audioEl) audioEl.volume = 1;
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

    updateUI();

    document.getElementById('bgmBtn').onclick = e => {
        e.preventDefault();
        toggleBgm();
        playTick('click');
    };

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