// sound.js — WebAudio 딸각 사운드
let audioCtx;

export function playTick(style = 'click') {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const t = audioCtx.currentTime;

        if (style === 'hover') {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = 'sine';
            o.frequency.value = 2000;
            g.gain.setValueAtTime(0.02, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
            o.connect(g); g.connect(audioCtx.destination);
            o.start(t); o.stop(t + 0.02);
            return;
        }

        const bufSize = audioCtx.sampleRate * 0.035;
        const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) {
            const env = Math.exp(-i / (bufSize * 0.15));
            data[i] = (Math.random() * 2 - 1) * env * 0.25;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buf;

        const band = audioCtx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = style === 'open' ? 3000 : style === 'close' ? 1500 : 2500;
        band.Q.value = 1.2;

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

        noise.connect(band); band.connect(gain); gain.connect(audioCtx.destination);
        noise.start(t); noise.stop(t + 0.035);

        if (style === 'open') {
            const o2 = audioCtx.createOscillator();
            const g2 = audioCtx.createGain();
            o2.type = 'sine';
            o2.frequency.value = 600;
            g2.gain.setValueAtTime(0.05, t + 0.01);
            g2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            o2.connect(g2); g2.connect(audioCtx.destination);
            o2.start(t + 0.01); o2.stop(t + 0.06);
        }
    } catch {}
}