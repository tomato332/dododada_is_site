// todo-calendar.js — 📋 Todo & 📅 Calendar 모듈
import { playTick } from './sound.js';

const STORAGE_KEY = 'tomato_todos';
const COUNTRY_KEY = 'tomato_cal_country';

let todos = {}; // { 'YYYY-MM-DD': [ { id, text, done } ] }
let holidays = {}; // { 'YYYY-MM-DD': '공휴일명' }
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-11
let selectedDateStr = getTodayStr();
let currentCountry = detectDefaultCountry();

function detectDefaultCountry() {
    const saved = localStorage.getItem(COUNTRY_KEY);
    if (saved) return saved;
    const lang = (navigator.language || 'ko-KR').toUpperCase();
    if (lang.includes('KR') || lang.includes('KO')) return 'KR';
    if (lang.includes('JP') || lang.includes('JA')) return 'JP';
    if (lang.includes('GB')) return 'GB';
    if (lang.includes('DE')) return 'DE';
    if (lang.includes('FR')) return 'FR';
    if (lang.includes('CA')) return 'CA';
    if (lang.includes('AU')) return 'AU';
    return 'US';
}

function getTodayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function loadTodos() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) todos = JSON.parse(data);
    } catch {
        todos = {};
    }
}

function saveTodos() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

// ── Nager.Date API 공휴일 비동기 조회 및 캐싱 ──
async function fetchHolidays(year, country) {
    const cacheKey = `holidays_${country}_${year}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            holidays = JSON.parse(cached);
            renderCalendar();
            renderTodoList();
            return;
        } catch {}
    }

    try {
        const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`);
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        const map = {};
        data.forEach(h => {
            map[h.date] = h.localName || h.name;
        });
        holidays = map;
        localStorage.setItem(cacheKey, JSON.stringify(map));
        renderCalendar();
        renderTodoList();
    } catch {
        holidays = {};
    }
}

export { renderCalendar, renderTodoList };

export function initTodoCalendar() {
    loadTodos();

    const overlay = document.getElementById('todo-overlay');
    const panel = document.getElementById('todo-panel');
    const closeBtn = document.getElementById('closeTodoBtn');
    const headerBtn = document.getElementById('headerTodoBtn');
    const heroBtn = document.getElementById('heroTodoBtn');
    const countrySelect = document.getElementById('calCountrySelect');

    if (countrySelect) {
        countrySelect.value = currentCountry;
        countrySelect.onchange = () => {
            currentCountry = countrySelect.value;
            localStorage.setItem(COUNTRY_KEY, currentCountry);
            fetchHolidays(currentYear, currentCountry);
            playTick('click');
        };
    }

    fetchHolidays(currentYear, currentCountry);

    function openPanel() {
        if (!panel || !overlay) return;
        panel.classList.add('show');
        overlay.classList.add('show');
        renderCalendar();
        renderTodoList();
    }

    function closePanel() {
        if (!panel || !overlay) return;
        panel.classList.remove('show');
        overlay.classList.remove('show');
    }

    if (headerBtn) headerBtn.onclick = (e) => { e.preventDefault(); openPanel(); };
    if (heroBtn) heroBtn.onclick = (e) => { e.preventDefault(); openPanel(); };
    if (closeBtn) closeBtn.onclick = () => closePanel();
    if (overlay) overlay.onclick = () => closePanel();

    // Calendar Navigation
    document.getElementById('calPrevBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const prevYear = currentYear;
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        if (currentYear !== prevYear) {
            fetchHolidays(currentYear, currentCountry);
        } else {
            renderCalendar();
        }
    });

    document.getElementById('calTodayBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const today = new Date();
        const prevYear = currentYear;
        currentYear = today.getFullYear();
        currentMonth = today.getMonth();
        selectedDateStr = getTodayStr();
        if (currentYear !== prevYear) {
            fetchHolidays(currentYear, currentCountry);
        } else {
            renderCalendar();
        }
        renderTodoList();
        playTick('click');
    });

    document.getElementById('calNextBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const prevYear = currentYear;
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        if (currentYear !== prevYear) {
            fetchHolidays(currentYear, currentCountry);
        } else {
            renderCalendar();
        }
    });

    // Todo Form Add
    const todoInput = document.getElementById('todoInput');
    const todoAddBtn = document.getElementById('todoAddBtn');

    function addTodo() {
        if (!todoInput) return;
        const text = todoInput.value.trim();
        if (!text) return;

        if (!todos[selectedDateStr]) {
            todos[selectedDateStr] = [];
        }
        todos[selectedDateStr].push({
            id: Date.now(),
            text,
            done: false
        });
        saveTodos();
        todoInput.value = '';
        renderTodoList();
        renderCalendar();
        playTick('click');
    }

    if (todoAddBtn) todoAddBtn.onclick = addTodo;
    if (todoInput) {
        todoInput.onkeydown = (e) => {
            if (e.key === 'Enter') addTodo();
        };
    }
}

function renderCalendar() {
    const titleEl = document.getElementById('calTitle');
    const gridEl = document.getElementById('calGridDays');
    if (!titleEl || !gridEl) return;

    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    titleEl.textContent = `${monthNames[currentMonth]} ${currentYear}`;

    gridEl.innerHTML = '';

    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const lastDate = new Date(currentYear, currentMonth + 1, 0).getDate();
    const todayStr = getTodayStr();

    // Empty cells for padding before day 1
    for (let i = 0; i < firstDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'cal-cell empty';
        gridEl.appendChild(emptyCell);
    }

    // Days of the month
    for (let day = 1; day <= lastDate; day++) {
        const mStr = String(currentMonth + 1).padStart(2, '0');
        const dStr = String(day).padStart(2, '0');
        const dateStr = `${currentYear}-${mStr}-${dStr}`;

        const cell = document.createElement('div');
        cell.className = 'cal-cell';
        cell.textContent = day;

        const isHoliday = !!holidays[dateStr];
        if (isHoliday) {
            cell.classList.add('holiday');
            cell.setAttribute('data-tip', holidays[dateStr]);
            const hDot = document.createElement('span');
            hDot.className = 'cal-holiday-dot';
            cell.appendChild(hDot);
        }

        if (dateStr === todayStr) cell.classList.add('today');
        if (dateStr === selectedDateStr) cell.classList.add('selected');

        // Dot indicator if todos exist for this date
        if (todos[dateStr] && todos[dateStr].length > 0) {
            const dot = document.createElement('span');
            dot.className = 'cal-dot';
            cell.appendChild(dot);
        }

        cell.onclick = (e) => {
            e.stopPropagation();
            selectedDateStr = dateStr;
            renderCalendar();
            renderTodoList();
            playTick('click');
        };

        gridEl.appendChild(cell);
    }
}

function renderTodoList() {
    const titleEl = document.getElementById('todoDateTitle');
    const badgeEl = document.getElementById('todoHolidayBadge');
    const listEl = document.getElementById('todoList');
    if (!titleEl || !listEl) return;

    titleEl.textContent = `TODO [${selectedDateStr}]`;

    // 공휴일 배지 표시
    if (badgeEl) {
        if (holidays[selectedDateStr]) {
            badgeEl.textContent = `🚩 ${holidays[selectedDateStr]}`;
            badgeEl.style.display = 'inline-block';
        } else {
            badgeEl.style.display = 'none';
        }
    }

    listEl.innerHTML = '';

    const items = todos[selectedDateStr] || [];

    if (items.length === 0) {
        listEl.innerHTML = '<div class="todo-empty">No tasks for this day</div>';
        return;
    }

    items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = `todo-item ${item.done ? 'done' : ''}`;

        const left = document.createElement('div');
        left.className = 'todo-item-left';

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'todo-check';
        chk.checked = item.done;
        chk.onchange = (e) => {
            e.stopPropagation();
            item.done = chk.checked;
            saveTodos();
            renderTodoList();
            renderCalendar();
            playTick('click');
        };

        const span = document.createElement('span');
        span.className = 'todo-text';
        span.textContent = item.text;

        left.appendChild(chk);
        left.appendChild(span);

        const delBtn = document.createElement('button');
        delBtn.className = 'todo-del-btn';
        delBtn.textContent = '✕';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            todos[selectedDateStr] = todos[selectedDateStr].filter(t => t.id !== item.id);
            if (todos[selectedDateStr].length === 0) {
                delete todos[selectedDateStr];
            }
            saveTodos();
            renderTodoList();
            renderCalendar();
            playTick('click');
        };

        itemEl.appendChild(left);
        itemEl.appendChild(delBtn);
        listEl.appendChild(itemEl);
    });
}
