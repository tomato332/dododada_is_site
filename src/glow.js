// glow.js — 커서 글로우 효과
import { isDark } from './theme.js';

export function initGlow() {
    const glow = document.getElementById('cursor-glow');
    document.addEventListener('mousemove', e => {
        glow.style.left = e.clientX + 'px';
        glow.style.top = e.clientY + 'px';
    });
    subtleGlow();
}

function subtleGlow() {
    const glow = document.getElementById('cursor-glow');
    const base = isDark() ? '255,255,255' : '100,100,140';
    glow.style.background = `radial-gradient(circle, rgba(${base},0.06) 0%, rgba(${base},0.02) 50%, transparent 70%)`;
    requestAnimationFrame(subtleGlow);
}