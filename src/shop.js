// shop.js — 🛒 데코레이션 상점
import { playTick } from './sound.js';
import { getState } from './clicker.js';

const SHOP_SAVE = 'tomato_shop';

const ITEMS = [
{ id: 'border-glow', icon: '✨', name: 'BORDER GLOW', desc: 'Adds a subtle glow around the site border', cost: 50 },
        { id: 'avatar-hat', icon: '🎩', name: 'AVATAR HAT', desc: 'Puts a hat on your profile avatar', cost: 100 },
        { id: 'big-tomato', icon: '🍅', name: 'BIG TOMATO', desc: 'Makes the clicker tomato bigger', cost: 150 },
        { id: 'rainbow-name', icon: '🌈', name: 'RAINBOW NAME', desc: 'Your name glows in rainbow colors', cost: 300 },
        { id: 'snowfall', icon: '❄️', name: 'SNOWFALL', desc: 'Snow falls across the site', cost: 500 },
        { id: 'scroll-glow', icon: '🖱️', name: 'SCROLL GLOW', desc: 'Scrollbar glows in neon color', cost: 800 },
        { id: 'starfield', icon: '🌌', name: 'STARFIELD BG', desc: 'Stars twinkle in the background', cost: 1500 },
        { id: 'tomato-rain', icon: '🍅', name: 'TOMATO RAIN', desc: 'Tomatoes rain down the screen', cost: 3000 },
        { id: 'matrix-rain', icon: '💚', name: 'MATRIX RAIN', desc: 'Matrix code rains down', cost: 5000 },
];

let owned = []; // [{ id: 'border-glow', active: true }, ...]
const decorIntervals = {};
let decorCanvas = null;

function loadOwned() {
    try {
        const saved = localStorage.getItem(SHOP_SAVE);
        if (saved) {
            const parsed = JSON.parse(saved);
            // 마이그레이션: 예전 방식(flat string[]) 처리
            if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
                owned = parsed.map(id => ({ id, active: true }));
                save();
            } else {
                owned = parsed;
            }
        }
    } catch {}
}

function save() {
    localStorage.setItem(SHOP_SAVE, JSON.stringify(owned));
}

function getBalance() {
    return getState()?.score || 0;
}

function isActive(id) {
    return owned.some(o => o.id === id && o.active);
}

function isBought(id) {
    return owned.some(o => o.id === id);
}

function clearDecorations() {
    Object.values(decorIntervals).forEach(id => clearInterval(id));
    Object.keys(decorIntervals).forEach(k => delete decorIntervals[k]);
    if (decorCanvas) { decorCanvas.remove(); decorCanvas = null; }
    document.querySelectorAll('.decoration-particle').forEach(el => el.remove());
}

function applyDecorations() {
    clearDecorations();

    document.body.classList.toggle('has-border-glow', isActive('border-glow'));
    document.body.classList.toggle('has-avatar-hat', isActive('avatar-hat'));
    document.body.classList.toggle('has-rainbow-name', isActive('rainbow-name'));
    document.body.classList.toggle('has-snowfall', isActive('snowfall'));
    document.body.classList.toggle('has-scroll-glow', isActive('scroll-glow'));
    document.body.classList.toggle('has-starfield', isActive('starfield'));

    const t = document.getElementById('clicker-tomato');
    if (t) t.style.fontSize = isActive('big-tomato') ? '140px' : '96px';

    // ❄️ Snowfall
    if (isActive('snowfall')) {
        decorIntervals.snowfall = setInterval(() => {
            const s = document.createElement('div');
            s.className = 'decoration-particle';
            s.textContent = '❄';
            s.style.cssText = `position:fixed;pointer-events:none;z-index:9996;left:${Math.random()*100}vw;top:-10px;font-size:${Math.random()*10+8}px;opacity:${Math.random()*.5+.2};animation:snowFall ${Math.random()*3+4}s linear forwards;`;
            document.body.appendChild(s);
            setTimeout(() => s.remove(), 8000);
        }, 250);
    }

    // 🍅 Tomato Rain
    if (isActive('tomato-rain')) {
        decorIntervals.tomatoRain = setInterval(() => {
            const r = document.createElement('div');
            r.className = 'decoration-particle';
            r.textContent = '🍅';
            r.style.cssText = `position:fixed;pointer-events:none;z-index:9996;left:${Math.random()*100}vw;top:-20px;font-size:${Math.random()*12+14}px;animation:tomatoFall ${Math.random()*2+3}s linear forwards;`;
            document.body.appendChild(r);
            setTimeout(() => r.remove(), 6000);
        }, 350);
    }

    // 💚 Matrix Rain
    if (isActive('matrix-rain')) {
        const canvas = document.createElement('canvas');
        canvas.id = 'matrix-canvas';
        canvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:.5;';
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        document.body.appendChild(canvas);
        decorCanvas = canvas;

        const chars = 'ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ0123456789ABCDEF';
        const cols = Math.floor(canvas.width / 14);
        const drops = Array(cols).fill(0).map(() => Math.random() * -50);

        decorIntervals.matrixRain = setInterval(() => {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(10,10,18,.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#0f0';
            ctx.font = '14px monospace';
            for (let i = 0; i < drops.length; i++) {
                const text = chars[Math.floor(Math.random() * chars.length)];
                ctx.fillText(text, i * 14, drops[i] * 14);
                if (drops[i] * 14 > canvas.height && Math.random() > 0.975) drops[i] = 0;
                drops[i]++;
            }
        }, 50);
    }

    // 🌌 Starfield BG
    if (isActive('starfield')) {
        decorIntervals.starfield = setInterval(() => {
            const star = document.createElement('div');
            star.className = 'decoration-particle';
            star.textContent = '✦';
            const size = Math.random() * 8 + 4;
            star.style.cssText = `position:fixed;pointer-events:none;z-index:0;left:${Math.random()*100}vw;top:${Math.random()*100}vh;font-size:${size}px;opacity:${Math.random()*.4+.1};animation:starTwinkle ${Math.random()*2+1}s ease-in-out infinite alternate;color:#fff;`;
            document.body.prepend(star);
            setTimeout(() => star.remove(), 6000);
        }, 500);
    }
}

function renderShop() {
    const balance = getBalance();
    document.getElementById('shop-balance').textContent = `🍅 ${balance.toLocaleString()}`;

    const container = document.getElementById('shop-items');
    container.innerHTML = '';

    for (const item of ITEMS) {
        const div = document.createElement('div');
        div.className = 'shop-item';

        const icon = document.createElement('div');
        icon.className = 'shop-item-icon';
        icon.textContent = item.icon;

        const info = document.createElement('div');
        info.className = 'shop-item-info';
        const name = document.createElement('div');
        name.className = 'shop-item-name';
        name.textContent = item.name;
        const desc = document.createElement('div');
        desc.className = 'shop-item-desc';
        desc.textContent = item.desc;
        info.appendChild(name);
        info.appendChild(desc);

        const btn = document.createElement('button');
        btn.className = 'shop-item-btn';
        const bought = isBought(item.id);
        const active = isActive(item.id);

        if (bought) {
            btn.textContent = active ? '✅ ON' : '⏹️ OFF';
            btn.onclick = () => {
                const entry = owned.find(o => o.id === item.id);
                if (entry) entry.active = !entry.active;
                save();
                applyDecorations();
                renderShop();
                playTick('click');
            };
        } else {
            btn.textContent = `BUY (${item.cost} 🍅)`;
            btn.disabled = balance < item.cost;
            btn.onclick = () => {
                if (getBalance() < item.cost) return;
                const st = getState();
                st.score -= item.cost;
                owned.push({ id: item.id, active: true });
                save();
                applyDecorations();
                if (window.clickerRender) window.clickerRender();
                renderShop();
                playTick('open');
            };
        }

        div.appendChild(icon);
        div.appendChild(info);
        div.appendChild(btn);
        container.appendChild(div);
    }
}

export function initShop() {
    loadOwned();
    const panel = document.getElementById('shop-panel');
    const overlay = document.getElementById('shop-overlay');

    function show() { panel.classList.add('show'); overlay.classList.add('show'); renderShop(); }
    function hide() { panel.classList.remove('show'); overlay.classList.remove('show'); }

    document.getElementById('headerShopBtn').onclick = e => { e.preventDefault(); show(); };
    document.getElementById('heroShopBtn').onclick = e => { e.preventDefault(); show(); };
    document.getElementById('closeShopBtn').onclick = hide;
    overlay.onclick = hide;

    applyDecorations();
    renderShop();

    // shopRender를 외부에 노출 (clicker render에서 호출)
    window.shopRender = renderShop;
}

// resize 이벤트 핸들러 (matrix canvas)
window.addEventListener('resize', () => {
    const c = document.getElementById('matrix-canvas');
    if (c) { c.width = window.innerWidth; c.height = window.innerHeight; }
});