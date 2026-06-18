// clock.js — 닉시관 스타일 시계 (비트 싱크 콜론)
import { onBeat, offBeat } from './bgm.js';

let interval = null;
let beatColon = true;

function pad(n) {
    return String(n).padStart(2, '0');
}

function buildDigits() {
    const el = document.getElementById('headerClock');
    if (!el) return;
    // 한 번만 초기 구조 생성
    if (!el.querySelector('.clock-digits')) {
        el.innerHTML = `
            <span class="clock-digits">
                <span class="cd-digit" data-i="0">0</span>
                <span class="cd-digit" data-i="1">0</span>
                <span class="cd-colon">:</span>
                <span class="cd-digit" data-i="2">0</span>
                <span class="cd-digit" data-i="3">0</span>
                <span class="cd-colon">:</span>
                <span class="cd-digit" data-i="4">0</span>
                <span class="cd-digit" data-i="5">0</span>
            </span>
        `;
    }
}

function render() {
    const el = document.getElementById('headerClock');
    if (!el) return;
    const now = new Date();
    const s = pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());

    const digits = el.querySelectorAll('.cd-digit');
    for (let i = 0; i < digits.length && i < s.length; i++) {
        digits[i].textContent = s[i];
    }

    // 콜론 비트 싱크
    const colons = el.querySelectorAll('.cd-colon');
    for (const c of colons) {
        c.classList.toggle('beat', beatColon);
    }
}

function beatHandler() {
    beatColon = !beatColon;
    const colons = document.querySelectorAll('.cd-colon');
    for (const c of colons) {
        c.classList.toggle('beat', beatColon);
    }
}

export function initClock() {
    buildDigits();
    render();
    interval = setInterval(render, 1000);
    onBeat(beatHandler);
}