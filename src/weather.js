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
let lightningBolts = []; // 하늘에서 지상으로 꽂히는 낙뢰 줄기들
let groundStrikes = []; // 낙뢰가 바닥에 부딪혔을 때 일어나는 스파크/충격파
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

function createLightningBolt(startX, startY, endX, endY) {
    const segments = [];
    const points = [];
    const steps = 18 + Math.floor(Math.random() * 8);

    points.push({ x: startX, y: startY });
    for (let i = 1; i < steps; i++) {
        const progress = i / steps;
        const curX = startX + (endX - startX) * progress + (Math.random() * 60 - 30);
        const curY = startY + (endY - startY) * progress + (Math.random() * 20 - 10);
        points.push({ x: curX, y: curY });
    }
    points.push({ x: endX, y: endY });

    // 지선(branch) 생성
    const branches = [];
    for (let i = 2; i < points.length - 3; i++) {
        if (Math.random() < 0.25) {
            const bPoints = [{ x: points[i].x, y: points[i].y }];
            const branchLen = 4 + Math.floor(Math.random() * 5);
            let bX = points[i].x;
            let bY = points[i].y;
            const dir = Math.random() < 0.5 ? -1 : 1;
            for (let j = 0; j < branchLen; j++) {
                bX += (Math.random() * 20 + 10) * dir;
                bY += Math.random() * 25 + 10;
                bPoints.push({ x: bX, y: bY });
            }
            branches.push(bPoints);
        }
    }

    return {
        main: points,
        branches,
        alpha: 0.6,
        decay: 0.05 + Math.random() * 0.03
    };
}

function spawnGroundImpact(x, y) {
    groundStrikes.push({
        x,
        y,
        radius: 0,
        maxRadius: 25 + Math.random() * 15,
        alpha: 0.5
    });
    // 스파크 파편 튀김
    for (let i = 0; i < 8; i++) {
        splashes.push({
            x,
            y,
            vx: (Math.random() * 6 - 3),
            vy: -(3 + Math.random() * 4),
            life: 0.6,
            decay: 0.06 + Math.random() * 0.04,
            isSpark: true
        });
    }
}

function flashLightning() {
    if (weatherMode !== 'rain' || !thunderEnabled || !canvas) return;
    lightningAlpha = 0.35;

    // 낙뢰(번개 줄기) 지점 계산: 하늘 상단 -> 바닥/화면 하단
    const startX = Math.random() * canvas.width;
    const endX = startX + (Math.random() * 200 - 100);
    const endY = canvas.height - Math.random() * 20;

    lightningBolts.push(createLightningBolt(startX, 0, endX, endY));
    spawnGroundImpact(endX, endY);

    const audioCtx = getAudioCtx();
    setTimeout(() => {
        if (weatherMode === 'rain' && thunderEnabled) triggerThunderSound(audioCtx);
    }, 120 + Math.random() * 250);
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

function drawBoltPath(c, pts) {
    if (!pts || pts.length < 2) return;
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        c.lineTo(pts[i].x, pts[i].y);
    }
    c.stroke();
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

    // 1-1. 낙뢰(번개 줄기 및 가지) 렌더링
    for (let i = lightningBolts.length - 1; i >= 0; i--) {
        const bolt = lightningBolts[i];
        ctx.save();
        ctx.lineJoin = 'miter';

        // 외곽 푸른빛 글로우
        ctx.strokeStyle = `rgba(140, 190, 255, ${bolt.alpha * 0.3})`;
        ctx.lineWidth = 4;
        drawBoltPath(ctx, bolt.main);
        for (const b of bolt.branches) drawBoltPath(ctx, b);

        // 중심 흰색 광선
        ctx.strokeStyle = `rgba(255, 255, 255, ${bolt.alpha * 0.7})`;
        ctx.lineWidth = 1.8;
        drawBoltPath(ctx, bolt.main);
        ctx.lineWidth = 1.0;
        for (const b of bolt.branches) drawBoltPath(ctx, b);

        ctx.restore();

        bolt.alpha -= bolt.decay;
        if (bolt.alpha <= 0) {
            lightningBolts.splice(i, 1);
        }
    }

    // 1-2. 지면 충격파 링
    for (let i = groundStrikes.length - 1; i >= 0; i--) {
        const gs = groundStrikes[i];
        ctx.strokeStyle = `rgba(200, 230, 255, ${gs.alpha * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(gs.x, gs.y, gs.radius, gs.radius * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();

        gs.radius += 2.0;
        gs.alpha -= 0.04;
        if (gs.alpha <= 0) {
            groundStrikes.splice(i, 1);
        }
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

        // 바닥 물방울 및 낙뢰 스파크 튀김
        for (let i = splashes.length - 1; i >= 0; i--) {
            const s = splashes[i];
            if (s.isSpark) {
                ctx.fillStyle = `rgba(255, 255, 255, ${s.life})`;
                ctx.beginPath();
                ctx.arc(s.x, s.y, 1.8, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = `rgba(180, 215, 255, ${s.life * 0.6})`;
                ctx.beginPath();
                ctx.arc(s.x, s.y, 1.2, 0, Math.PI * 2);
                ctx.fill();
            }

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
    const weatherClearBtn = document.getElementById('weatherClearBtn');
    const weatherRainBtn = document.getElementById('weatherRainBtn');
    const weatherSnowBtn = document.getElementById('weatherSnowBtn');
    const weatherThunderToggleBtn = document.getElementById('weatherThunderToggleBtn');

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

    if (weatherClearBtn) weatherClearBtn.classList.toggle('active', weatherMode === 'none');
    if (weatherRainBtn) weatherRainBtn.classList.toggle('active', weatherMode === 'rain');
    if (weatherSnowBtn) weatherSnowBtn.classList.toggle('active', weatherMode === 'snow');
    if (weatherThunderToggleBtn) {
        weatherThunderToggleBtn.classList.toggle('active', thunderEnabled);
        weatherThunderToggleBtn.textContent = thunderEnabled ? '⚡ ON' : '⚡ OFF';
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

    document.getElementById('weatherClearBtn')?.addEventListener('click', () => {
        setWeather('none');
        playTick('click');
    });
    document.getElementById('weatherRainBtn')?.addEventListener('click', () => {
        setWeather('rain');
        playTick('click');
    });
    document.getElementById('weatherSnowBtn')?.addEventListener('click', () => {
        setWeather('snow');
        playTick('click');
    });
    document.getElementById('weatherThunderToggleBtn')?.addEventListener('click', () => {
        toggleThunder();
        playTick('click');
    });

    updateUI();
}
