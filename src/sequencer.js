// sequencer.js — 실시간 스텝 시퀀서 UI (편집 가능)
import { onBeat, onTrackChange, getUserPattern, togglePatternCell, resetPattern, getDisplayBeat, isSequencerTrack, saveSlot, loadSlot, deleteSlot, getSlots, copyPatternToClipboard, loadPatternFromCode } from './bgm.js';

const ROWS = [
    { id: 'kick',  label: 'KICK' },
    { id: 'snare', label: 'SNARE' },
    { id: 'hihat', label: 'HIHAT' },
    { id: 'chord', label: 'CHORD' },
    { id: 'melody', label: 'MELODY' },
];

let container = null;
let wrapper = null;
let cells = [];
let slotsListEl = null;

function refreshSlots() {
    if (!slotsListEl) return;
    const slots = getSlots();
    const names = Object.keys(slots);
    if (names.length === 0) {
        slotsListEl.innerHTML = '<div class="seq-slots-empty">No saved patterns</div>';
        return;
    }
    slotsListEl.innerHTML = names.map(name => `
        <div class="seq-slot-item">
            <span class="seq-slot-name">${name}</span>
            <button class="seq-slot-btn" data-action="load" data-name="${name}">▶</button>
            <button class="seq-slot-btn" data-action="delete" data-name="${name}">✕</button>
        </div>
    `).join('');

    slotsListEl.querySelectorAll('[data-action="load"]').forEach(btn => {
        btn.onclick = () => {
            if (loadSlot(btn.dataset.name)) {
                buildGrid();
                render();
            }
        };
    });
    slotsListEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.onclick = () => {
            deleteSlot(btn.dataset.name);
            refreshSlots();
        };
    });
}

function buildGrid() {
    if (!container) return;
    container.innerHTML = '';

    // 헤더 (비트 번호)
    const header = document.createElement('div');
    header.className = 'seq-row seq-header';
    // 빈 코너
    const corner = document.createElement('div');
    corner.className = 'seq-header-corner';
    header.appendChild(corner);
    for (let s = 0; s < 16; s++) {
        const h = document.createElement('div');
        h.className = 'seq-header-cell';
        h.textContent = s + 1;
        header.appendChild(h);
    }
    container.appendChild(header);

    cells = [];
    ROWS.forEach((row, ri) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'seq-row';

        // 행 레이블
        const label = document.createElement('div');
        label.className = 'seq-row-label';
        label.textContent = row.label;
        rowEl.appendChild(label);

        const rowCells = [];
        for (let s = 0; s < 16; s++) {
            const cell = document.createElement('div');
            cell.className = 'seq-cell';
            cell.dataset.row = row.id;
            cell.dataset.rowIdx = ri;
            cell.dataset.step = s;
            // 클릭 토글
            cell.addEventListener('click', () => {
                togglePatternCell(ri, s);
                render();
            });
            rowEl.appendChild(cell);
            rowCells.push(cell);
        }
        container.appendChild(rowEl);
        cells.push(rowCells);
    });
}

function render() {
    const isSeq = isSequencerTrack();
    if (wrapper) wrapper.classList.toggle('seq-hidden', !isSeq);
    if (!isSeq) return;

    const pattern = getUserPattern();
    const beat = getDisplayBeat();

    cells.forEach((rowCells, ri) => {
        rowCells.forEach((cell, s) => {
            const active = pattern[ri]?.[s] || false;
            const isCurrent = s === beat;

            cell.className = 'seq-cell';
            if (active) cell.classList.add('seq-active');
            if (isCurrent) cell.classList.add('seq-current');
            if (active && isCurrent) cell.classList.add('seq-hit');
        });
    });
}

function onBeatCb() {
    render();
}

export function initSequencer() {
    container = document.getElementById('seq-container');
    wrapper = document.getElementById('seq-wrapper');
    slotsListEl = document.getElementById('seqSlotsList');
    if (!container) return;

    buildGrid();
    render();
    refreshSlots();

    onBeat(onBeatCb);
    onTrackChange(() => {
        buildGrid();
        render();
        refreshSlots();
    });

    // 리셋 버튼
    const resetBtn = document.getElementById('seqResetBtn');
    if (resetBtn) {
        resetBtn.onclick = () => {
            resetPattern();
            buildGrid();
            render();
        };
    }

    // 저장 버튼
    const saveBtn = document.getElementById('seqSaveBtn');
    if (saveBtn) {
        saveBtn.onclick = () => {
            const name = prompt('Save pattern as:');
            if (name && name.trim()) {
                saveSlot(name.trim());
                refreshSlots();
            }
        };
    }

    // 공유: 복사
    const shareBtn = document.getElementById('seqShareBtn');
    if (shareBtn) {
        shareBtn.onclick = () => {
            const code = copyPatternToClipboard();
            const original = shareBtn.textContent;
            shareBtn.textContent = '✓ COPIED!';
            setTimeout(() => shareBtn.textContent = original, 2000);
        };
    }

    // 공유: 불러오기 (붙여넣기)
    const importBtn = document.getElementById('seqImportBtn');
    if (importBtn) {
        importBtn.onclick = () => {
            const code = prompt('Paste shared sequence code (SEQ:...):');
            if (code && code.trim()) {
                if (loadPatternFromCode(code.trim())) {
                    buildGrid();
                    render();
                } else {
                    alert('Invalid pattern code');
                }
            }
        };
    }
}