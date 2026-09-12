// weather.js — 🌧 비 / ❄️ 눈 / ⚡ 천둥 효과 모듈
import { getAudioCtx, playTick } from './sound.js';

// weatherMode: 'none' | 'rain' | 'snow'
let weatherMode = 'none';
let thunderEnabled = false; // 천둥은 기본 꺼짐 (토글로 켬)

let rainGainNode = null;
let rainSourceNode = null;
let thunderTimeout = null;

let canvas = null;
let ctx = null;
let animationFrameId = null;

let particles = [];
let splashes = [];
let snowAccum = []; // 바닥 눈 쌓임 높이 배열 (컬럼별)
const ACCUM_STEP = 6; // 눈 쌓임 해상도 (px)
let lightningAlpha = 0;

function createRainSound(audioCtx) {
    const bufferSize = audioCtx.sampleRate * 2;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
    }

    const whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    whiteNoise.start(0);
    return { source: whiteNoise, gain };
}

function stopRainSound() {
    if (rainSourceNode) {
        try { rainSourceNode.stop(); rainSourceNode.disconnect(); } catch {}
        rainSourceNode = null;
    }
}

function triggerThunderSound(audioCtx) {
    if (weatherMode !== 'rain' || !thunderEnabled) return;
    try {
        const t = audioCtx.currentTime;
        const dur = 2.5;
        const bufSize = audioCtx.sampleRate * dur;
        const buffer = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufSize; i++) {
            data[i] = (Math.random() * 2 - 1);
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, t);
        filter.frequency.exponentialRampToValueAtTime(80, t + dur);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.6, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        noise.start(t);
        noise.stop(t + dur);
    } catch {}
}

function flashLightning() {
    if (weatherMode !== 'rain' || !thunderEnabled) return;
    lightningAlpha = 0.85;
    const audioCtx = getAudioCtx();
    setTimeout(() => {
        if (weatherMode === 'rain' && thunderEnabled) triggerThunderSound(audioCtx);
    }, 200 + Math.random() * 400);
}

function scheduleNextThunder() {
    if (thunderTimeout) clearTimeout(thunderTimeout);
    if (weatherMode !== 'rain' || !thunderEnabled) return;

    const delay = 6000 + Math.random() * 10000;
    thunderTimeout = setTimeout(() => {
        if (weatherMode === 'rain' && thunderEnabled) {
            flashLightning();
            scheduleNextThunder();
        }
    }, delay);
}

// ── 캔버스 및 파티클 ──
function initCanvas() {
    canvas = document.getElementById('weather-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initAccumArray();
    initParticles();
}

function initAccumArray() {
    if (!canvas) return;
    const cols = Math.ceil(canvas.width / ACCUM_STEP);
    snowAccum = new Array(cols).fill(0);
}

function initParticles() {
    particles = [];
    splashes = [];
    if (!canvas || weatherMode === 'none') return;

    if (weatherMode === 'rain') {
        const count = Math.floor(canvas.width / 8);
        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * (canvas.width + 100),
                y: Math.random() * canvas.height,
                len: 12 + Math.random() * 16,
                speed: 16 + Math.random() * 10,
                opacity: 0.25 + Math.random() * 0.45
            });
        }
    } else if (weatherMode === 'snow') {
        const count = Math.floor(canvas.width / 10);
        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                radius: 1.5 + Math.random() * 2.5,
                speed: 1 + Math.random() * 2,
                wind: Math.random() * 1.5 - 0.75,
                opacity: 0.4 + Math.random() * 0.5,
                wobble: Math.random() * Math.PI * 2
            });
        }
    }
}

function createSplash(x, y) {
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
        splashes.push({
            x,
            y,
            vx: (Math.random() * 4 - 2),
            vy: -(2 + Math.random() * 3),
            life: 1,
            decay: 0.08 + Math.random() * 0.06
        });
    }
}

function drawLoop() {
    if (weatherMode === 'none') {
        if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. 번개 플래시 (비 + 천둥 활성 시)
    if (lightningAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${lightningAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        lightningAlpha -= 0.05;
        if (lightningAlpha < 0) lightningAlpha = 0;
    }

    if (weatherMode === 'rain') {
        // 비 그리기
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            ctx.strokeStyle = `rgba(180, 215, 255, ${p.opacity})`;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - 2, p.y + p.len);
            ctx.stroke();

            p.y += p.speed;
            p.x -= 2;

            if (p.y >= canvas.height - 4) {
                createSplash(p.x, canvas.height - 2);
                p.y = -p.len;
                p.x = Math.random() * (canvas.width + 100);
            }
        }

        // 바닥 물방울 튀김 (스플래시)
        for (let i = splashes.length - 1; i >= 0; i--) {
            const s = splashes[i];
            ctx.fillStyle = `rgba(180, 215, 255, ${s.life * 0.6})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, 1.2, 0, Math.PI * 2);
            ctx.fill();

            s.x += s.vx;
            s.y += s.vy;
            s.vy += 0.3; // 중력
            s.life -= s.decay;

            if (s.life <= 0) {
                splashes.splice(i, 1);
            }
        }
    } else if (weatherMode === 'snow') {
        // 눈 내리기
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            ctx.fillStyle = `rgba(240, 248, 255, ${p.opacity})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();

            p.wobble += 0.03;
            p.y += p.speed;
            p.x += p.wind + Math.sin(p.wobble) * 0.6;

            const colIdx = Math.floor(p.x / ACCUM_STEP);
            const groundH = (colIdx >= 0 && colIdx < snowAccum.length) ? snowAccum[colIdx] : 0;

            if (p.y >= canvas.height - groundH) {
                // 바닥 또는 쌓인 눈에 닿았을 때 눈 쌓기
                if (colIdx >= 0 && colIdx < snowAccum.length) {
                    if (snowAccum[colIdx] < 45) { // 최대 쌓임 높이 45px
                        snowAccum[colIdx] += 0.35;
                        // 양옆으로 부드럽게 분산
                        if (colIdx > 0 && snowAccum[colIdx - 1] < snowAccum[colIdx]) snowAccum[colIdx - 1] += 0.15;
                        if (colIdx < snowAccum.length - 1 && snowAccum[colIdx + 1] < snowAccum[colIdx]) snowAccum[colIdx + 1] += 0.15;
                    }
                }
                p.y = -p.radius * 2;
                p.x = Math.random() * canvas.width;
            }
        }

        // 바닥에 쌓인 눈 렌더링
        ctx.fillStyle = 'rgba(235, 245, 255, 0.85)';
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);
        for (let c = 0; c < snowAccum.length; c++) {
            const h = snowAccum[c];
            ctx.lineTo(c * ACCUM_STEP, canvas.height - h);
        }
        ctx.lineTo(canvas.width, canvas.height);
        ctx.closePath();
        ctx.fill();
    }

    animationFrameId = requestAnimationFrame(drawLoop);
}

function updateUI() {
    const weatherBtn = document.getElementById('weatherBtn');
    const thunderBtn = document.getElementById('thunderBtn');

    if (weatherBtn) {
        if (weatherMode === 'rain') {
            weatherBtn.textContent = '🌧';
            weatherBtn.classList.add('active');
            weatherBtn.setAttribute('data-tip', 'Rain (Click for Snow)');
        } else if (weatherMode === 'snow') {
            weatherBtn.textContent = '❄️';
            weatherBtn.classList.add('active');
            weatherBtn.setAttribute('data-tip', 'Snow (Click to Turn Off)');
        } else {
            weatherBtn.textContent = '☀️';
            weatherBtn.classList.remove('active');
            weatherBtn.setAttribute('data-tip', 'Weather (Click for Rain)');
        }
    }

    if (thunderBtn) {
        // 비 모드일 때만 천둥 버튼 노출
        thunderBtn.style.display = weatherMode === 'rain' ? 'inline-block' : 'none';
        thunderBtn.classList.toggle('active', thunderEnabled);
        thunderBtn.textContent = thunderEnabled ? '⚡' : '🌩';
        thunderBtn.setAttribute('data-tip', thunderEnabled ? 'Thunder: ON' : 'Thunder: OFF');
    }
}

export function setWeather(mode) {
    weatherMode = mode;
    const audioCtx = getAudioCtx();

    if (weatherMode === 'rain') {
        stopRainSound();
        const rain = createRainSound(audioCtx);
        rainSourceNode = rain.source;
        rainGainNode = rain.gain;
        initParticles();
        if (thunderEnabled) scheduleNextThunder();
    } else if (weatherMode === 'snow') {
        stopRainSound();
        if (thunderTimeout) clearTimeout(thunderTimeout);
        initAccumArray();
        initParticles();
    } else {
        stopRainSound();
        if (thunderTimeout) clearTimeout(thunderTimeout);
        particles = [];
        splashes = [];
    }

    updateUI();
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (weatherMode !== 'none') {
        drawLoop();
    } else if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

export function cycleWeather() {
    if (weatherMode === 'none') {
        setWeather('rain');
    } else if (weatherMode === 'rain') {
        setWeather('snow');
    } else {
        setWeather('none');
    }
}

export function toggleThunder() {
    thunderEnabled = !thunderEnabled;
    if (thunderEnabled && weatherMode === 'rain') {
        flashLightning();
        scheduleNextThunder();
    } else {
        if (thunderTimeout) clearTimeout(thunderTimeout);
    }
    updateUI();
}

export function initWeather() {
    initCanvas();
    const weatherBtn = document.getElementById('weatherBtn');
    const thunderBtn = document.getElementById('thunderBtn');

    if (weatherBtn) {
        weatherBtn.onclick = (e) => {
            e.preventDefault();
            cycleWeather();
            playTick('click');
        };
    }

    if (thunderBtn) {
        thunderBtn.onclick = (e) => {
            e.preventDefault();
            toggleThunder();
            playTick('click');
        };
    }

    updateUI();
}
