const AudioCtx = new (window.AudioContext || window.webkitAudioContext)();

function makeDistortionCurve(amount) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        curve[i] = ((3 + k) * x) / (Math.PI + k * Math.abs(x));
    }
    return curve;
}

function playSynth({
    freq = 440,
    type = 'sine',
    volume = 0.1,
    duration = 0.5,
    slide = 0,
    filterFreq = 0,
    filterSlide = 0,
    resonance = 1,
    distortion = 0,
    detune = 0,
    harmonics = []
}) {
    const now = AudioCtx.currentTime;
    const masterGain = AudioCtx.createGain();
    masterGain.gain.setValueAtTime(volume, now);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    let lastNode = masterGain;

    // 디스토션 노드 연동
    if (distortion > 0) {
        const shaper = AudioCtx.createWaveShaper();
        shaper.curve = makeDistortionCurve(distortion);
        shaper.oversample = '4x';
        shaper.connect(lastNode);
        lastNode = shaper;
    }

    // 로우패스/하이패스 필터 연동
    if (filterFreq > 0) {
        const filter = AudioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterFreq, now);
        if (filterSlide > 0) {
            filter.frequency.exponentialRampToValueAtTime(filterSlide, now + duration);
        }
        filter.Q.setValueAtTime(resonance, now);
        filter.connect(lastNode);
        lastNode = filter;
    }

    // 메인 오실레이터
    const osc = AudioCtx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (detune !== 0) osc.detune.setValueAtTime(detune, now);
    if (slide > 0) {
        osc.frequency.exponentialRampToValueAtTime(slide, now + duration);
    }
    osc.connect(lastNode);
    osc.start(now);
    osc.stop(now + duration);

    // 추가 배음 오실레이터 (풍성한 화성 연출)
    harmonics.forEach((ratio, index) => {
        const hOsc = AudioCtx.createOscillator();
        hOsc.type = type;
        hOsc.frequency.setValueAtTime(freq * ratio, now);
        if (slide > 0) {
            hOsc.frequency.exponentialRampToValueAtTime(slide * ratio, now + duration);
        }
        const hGain = AudioCtx.createGain();
        hGain.gain.setValueAtTime(volume * (0.4 / (index + 1)), now);
        hGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        hGain.connect(lastNode);
        hOsc.connect(hGain);
        hOsc.start(now);
        hOsc.stop(now + duration);
    });

    masterGain.connect(AudioCtx.destination);
}

function playNoise(duration, volume, filterFreq = 1000, isHighPass = false) {
    const now = AudioCtx.currentTime;
    const bufferSize = AudioCtx.sampleRate * duration;
    const buffer = AudioCtx.createBuffer(1, bufferSize, AudioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // 백색소음 생성
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = AudioCtx.createBufferSource();
    noiseSource.buffer = buffer;

    const filter = AudioCtx.createBiquadFilter();
    filter.type = isHighPass ? 'highpass' : 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + duration);

    const gain = AudioCtx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(AudioCtx.destination);

    noiseSource.start(now);
    noiseSource.stop(now + duration);
}

export const Sounds = {
    resume: () => {
        if (AudioCtx.state === 'suspended') AudioCtx.resume();
    },
    
    charge: (tier) => {
        if (tier < 10) {
            playSynth({
                freq: 120 + tier * 25,
                type: 'sine',
                volume: 0.08,
                duration: 0.12,
                slide: 150 + tier * 30
            });
        } else if (tier < 15) {
            playSynth({
                freq: 180,
                type: 'sawtooth',
                volume: 0.04,
                duration: 0.15,
                slide: 300,
                filterFreq: 300,
                filterSlide: 2000,
                resonance: 5
            });
        } else {
            playSynth({
                freq: 80,
                type: 'square',
                volume: 0.03,
                duration: 0.15,
                slide: 50,
                filterFreq: 150,
                filterSlide: 800,
                distortion: 20
            });
        }
    },

    evolve: (level) => {
        const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
        
        if (level <= 10) {
            const baseFreq = notes[level % notes.length];
            playSynth({
                freq: baseFreq,
                type: 'sine',
                volume: 0.15,
                duration: 0.5,
                slide: baseFreq * 1.05,
                harmonics: [2, 3, 4]
            });
            setTimeout(() => {
                playSynth({
                    freq: baseFreq * 1.5,
                    type: 'sine',
                    volume: 0.08,
                    duration: 0.3
                });
            }, 60);
        } else if (level < 15) {
            playSynth({
                freq: 500,
                type: 'sawtooth',
                volume: 0.12,
                duration: 0.3,
                slide: 2500,
                filterFreq: 3000,
                filterSlide: 8000,
                distortion: 50
            });
            playSynth({
                freq: 800,
                type: 'square',
                volume: 0.08,
                duration: 0.2,
                slide: 4000,
                detune: 15
            });
        } else if (level === 15) {
            playSynth({
                freq: 120,
                type: 'sine',
                volume: 0.5,
                duration: 1.2,
                slide: 20,
                filterFreq: 800,
                filterSlide: 50,
                distortion: 40
            });
            playSynth({
                freq: 3000,
                type: 'sawtooth',
                volume: 0.15,
                duration: 0.4,
                slide: 200,
                filterFreq: 5000,
                filterSlide: 1000
            });
        } else if (level < 20) {
            playSynth({
                freq: 400,
                type: 'square',
                volume: 0.15,
                duration: 0.5,
                slide: 200,
                detune: 30,
                harmonics: [1.414, 2.718]
            });
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    playSynth({
                        freq: 600 - i * 100,
                        type: 'sawtooth',
                        volume: 0.1,
                        duration: 0.1
                    });
                }, i * 100);
            }
        } else {
            const root = 130.81;
            const chord = [1.0, 1.25, 1.5, 1.875, 2.25];
            chord.forEach((ratio, i) => {
                setTimeout(() => {
                    playSynth({
                        freq: root * ratio,
                        type: 'sine',
                        volume: 0.15 - (i * 0.02),
                        duration: 1.8,
                        harmonics: [2, 3]
                    });
                }, i * 80);
            });
            playNoise(1.2, 0.05, 2000);
        }
    },

    fire: (tier) => {
        playNoise(0.08, 0.08, 3000, true);
        if (tier < 10) {
            playSynth({
                freq: 350 + tier * 30,
                type: 'triangle',
                volume: 0.12,
                duration: 0.25,
                slide: 80
            });
        } else {
            playSynth({
                freq: 800,
                type: 'sawtooth',
                volume: 0.15,
                duration: 0.35,
                slide: 100,
                filterFreq: 4000,
                filterSlide: 300,
                distortion: 30,
                harmonics: [1.5, 2.0]
            });
        }
    },

    hit: (stars) => {
        if (stars === 0) {
            playNoise(0.12, 0.25, 800);
            playSynth({
                freq: 150,
                type: 'triangle',
                volume: 0.3,
                duration: 0.15,
                slide: 30
            });
        } else if (stars <= 10) {
            playNoise(0.15, 0.2, 4000, true);
            playSynth({
                freq: 600 + stars * 40,
                type: 'sine',
                volume: 0.25,
                duration: 0.3,
                slide: 200,
                harmonics: [2.5, 4.0]
            });
            playSynth({
                freq: 120,
                type: 'triangle',
                volume: 0.2,
                duration: 0.15,
                slide: 40
            });
        } else if (stars < 15) {
            playNoise(0.25, 0.35, 1500);
            playSynth({
                freq: 900,
                type: 'sawtooth',
                volume: 0.3,
                duration: 0.4,
                slide: 150,
                filterFreq: 4000,
                filterSlide: 800,
                distortion: 60,
                harmonics: [1.5, 2.0]
            });
        } else if (stars === 15) {
            playNoise(0.8, 0.5, 300);
            playSynth({
                freq: 90,
                type: 'sine',
                volume: 0.8,
                duration: 1.0,
                slide: 10,
                distortion: 70
            });
            for (let i = 0; i < 4; i++) {
                setTimeout(() => {
                    playSynth({
                        freq: 1500 - i * 300,
                        type: 'square',
                        volume: 0.12,
                        duration: 0.05,
                        distortion: 30
                    });
                }, i * 40);
            }
        } else if (stars < 20) {
            playNoise(0.5, 0.45, 1000);
            playSynth({
                freq: 180,
                type: 'sawtooth',
                volume: 0.5,
                duration: 0.8,
                slide: 30,
                distortion: 80,
                harmonics: [1.4, 2.8]
            });
        } else {
            playNoise(1.5, 0.5, 3000);
            const root = 196.00;
            const chords = [1.0, 1.25, 1.5, 1.875];
            chords.forEach(ratio => {
                playSynth({
                    freq: root * ratio,
                    type: 'sawtooth',
                    volume: 0.25,
                    duration: 1.2,
                    slide: root * ratio * 0.2,
                    filterFreq: 3000,
                    filterSlide: 200,
                    distortion: 40
                });
            });
        }
    },

    overload: () => {
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                playSynth({
                    freq: 100 + i * 80,
                    type: 'sawtooth',
                    volume: 0.15,
                    duration: 0.15,
                    slide: 800,
                    distortion: 80
                });
                playNoise(0.12, 0.1, 8000, true);
            }, i * 45);
        }
    }
};
