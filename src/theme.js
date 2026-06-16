// theme.js — 다크/라이트 테마 관리

export function initTheme() {
    const html = document.documentElement;
    const btn = document.querySelector('.theme-btn');
    const saved = localStorage.getItem('theme');
    if (saved === 'light') { html.classList.remove('dark'); btn.textContent = '🌙'; }
    else { html.classList.add('dark'); btn.textContent = '☀️'; }
}

export function toggleTheme() {
    const html = document.documentElement;
    const btn = document.querySelector('.theme-btn');
    html.classList.toggle('dark');
    const isDark = html.classList.contains('dark');
    btn.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

export function isDark() {
    return document.documentElement.classList.contains('dark');
}