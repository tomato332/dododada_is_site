// repos.js — GitHub 레포지토리 조회 및 CodeMirror 코드 뷰어
import { isDark } from './theme.js';

const langColors = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
    HTML: '#e34c26', CSS: '#563d7c', Batchfile: '#C1F12E', null: '#888'
};

const extMap = {
    js: 'javascript', ts: 'javascript', jsx: 'javascript', tsx: 'javascript',
    py: 'python', rb: 'python',
    html: 'htmlmixed', htm: 'htmlmixed',
    css: 'css', scss: 'css', less: 'css',
    xml: 'xml', svg: 'xml',
    json: 'javascript',
    md: 'markdown',
    java: 'text/x-java', c: 'text/x-csrc', cpp: 'text/x-c++src', h: 'text/x-csrc',
    go: 'go', rs: 'rust',
    sh: 'shell', bash: 'shell', zsh: 'shell',
    yml: 'yaml', yaml: 'yaml',
    sql: 'sql',
    php: 'php',
    swift: 'swift', kt: 'kotlin',
};

export function initRepos() {
    const panel = document.getElementById('repos-panel');
    const overlay = document.getElementById('repos-overlay');
    document.getElementById('toggleReposBtn').onclick = () => { panel.classList.add('show'); overlay.classList.add('show'); };
    document.getElementById('closeReposBtn').onclick = () => { panel.classList.remove('show'); overlay.classList.remove('show'); };
    overlay.onclick = () => { panel.classList.remove('show'); overlay.classList.remove('show'); };
    loadRepos();
}

async function loadRepos() {
    const el = document.getElementById('loading');
    const cached = localStorage.getItem('repos_cache');
    const cachedTime = localStorage.getItem('repos_cache_time');
    if (cached && cachedTime && Date.now() - Number(cachedTime) < 3600000) {
        renderRepos(JSON.parse(cached));
        return;
    }
    try {
        const res = await fetch('https://api.github.com/users/tomato332/repos?sort=updated&per_page=20');
        if (!res.ok) throw new Error('API error ' + res.status);
        const repos = await res.json();
        localStorage.setItem('repos_cache', JSON.stringify(repos));
        localStorage.setItem('repos_cache_time', String(Date.now()));
        renderRepos(repos);
    } catch (e) {
        const backup = localStorage.getItem('repos_cache');
        if (backup) { renderRepos(JSON.parse(backup)); return; }
        el.innerHTML = '불러오기 실패 (새로고침 해보세요)';
    }
}

function renderRepos(repos) {
    document.getElementById('loading').style.display = 'none';
    const container = document.getElementById('content');
    for (const repo of repos) {
        const div = document.createElement('div');
        div.className = 'repo';
        div.appendChild(createRepoTop(repo));
        if (repo.description) {
            const desc = document.createElement('div');
            desc.className = 'repo-desc';
            desc.textContent = repo.description;
            div.appendChild(desc);
        }
        div.appendChild(createRepoMeta(repo));
        const { codeBtn, filesDiv, codeDiv } = createCodeViewer(repo);
        div.appendChild(codeBtn);
        div.appendChild(filesDiv);
        div.appendChild(codeDiv);
        addReadmeButton(div, repo);
        container.appendChild(div);
    }
}

function createRepoTop(repo) {
    const top = document.createElement('div');
    top.className = 'repo-top';
    const name = document.createElement('a');
    name.className = 'repo-name';
    name.href = repo.html_url; name.target = '_blank';
    name.textContent = repo.name;
    top.appendChild(name);
    return top;
}

function createRepoMeta(repo) {
    const meta = document.createElement('div');
    meta.className = 'repo-meta';
    if (repo.language) {
        const lang = document.createElement('span');
        lang.className = 'repo-lang';
        const dot = document.createElement('span');
        dot.className = 'lang-dot';
        dot.style.background = langColors[repo.language] || '#888';
        lang.appendChild(dot);
        lang.append(' ' + repo.language);
        meta.appendChild(lang);
    }
    if (repo.stargazers_count > 0) {
        const star = document.createElement('span');
        star.textContent = `★ ${repo.stargazers_count}`;
        meta.appendChild(star);
    }
    if (repo.fork) {
        const fork = document.createElement('span');
        fork.textContent = 'forked';
        meta.appendChild(fork);
    }
    return meta;
}

function createCodeViewer(repo) {
    const codeBtn = document.createElement('button');
    codeBtn.className = 'code-toggle';
    codeBtn.textContent = '📂 코드 보기';
    const filesDiv = document.createElement('div');
    filesDiv.className = 'repo-files';
    filesDiv.id = `files-${repo.id}`;
    filesDiv.style.display = 'none';
    const codeDiv = document.createElement('div');
    codeDiv.className = 'repo-code';
    codeDiv.id = `code-${repo.id}`;
    codeDiv.style.display = 'none';
    let filesLoaded = false;
    const navStack = [];

    async function loadDir(url, title) {
        filesDiv.innerHTML = '불러오는 중...';
        try {
            const dRes = await fetch(url);
            if (dRes.ok) {
                const items = await dRes.json();
                filesDiv.innerHTML = '';
                if (navStack.length > 0) {
                    const backBtn = document.createElement('a');
                    backBtn.href = '#';
                    backBtn.className = 'folder';
                    backBtn.textContent = '⬆  ..';
                    backBtn.onclick = (e) => { e.preventDefault(); const prev = navStack.pop(); if (prev) loadDir(prev.url, prev.title); };
                    filesDiv.appendChild(backBtn);
                }
                for (const item of items) {
                    const a = document.createElement('a');
                    a.href = '#';
                    a.className = item.type === 'dir' ? 'folder' : 'file';
                    a.textContent = (item.type === 'dir' ? '📁 ' : '📄 ') + item.name;
                    if (item.type === 'file') {
                        a.onclick = (ev) => { ev.preventDefault(); loadFileContent(ev, item, repo); };
                    } else {
                        a.onclick = (ev) => {
                            ev.preventDefault();
                            navStack.push({ url, title });
                            loadDir(item.url, item.name);
                        };
                    }
                    filesDiv.appendChild(a);
                }
            } else {
                filesDiv.innerHTML = '<span style="color:var(--muted)">⚠ API 제한으로 불러올 수 없습니다</span>';
            }
        } catch (_) {
            filesDiv.innerHTML = '<span style="color:var(--muted)">⚠ 불러오기 실패</span>';
        }
    }

    codeBtn.onclick = async () => {
        if (filesDiv.style.display === 'none') {
            filesDiv.style.display = 'block';
            codeBtn.textContent = '📁 코드 닫기';
            if (!filesLoaded) {
                filesLoaded = true;
                filesDiv.innerHTML = `<a href="${repo.html_url}" target="_blank" style="color:var(--muted);display:block;padding:4px 0;">📂 GitHub 저장소 열기 →</a>`;
                filesDiv.innerHTML += '<div style="margin-top:8px;font-size:.8rem;color:var(--muted)">GitHub 페이지에서 파일을 찾아서 선택하세요</div>';
            }
        } else {
            filesDiv.style.display = 'none';
            codeDiv.style.display = 'none';
            codeBtn.textContent = '📂 코드 보기';
        }
    };

    return { codeBtn, filesDiv, codeDiv };
}

async function loadFileContent(e, item, repo) {
    e.preventDefault();
    const codeDiv = document.getElementById(`code-${repo.id}`);
    codeDiv.style.display = 'block';
    codeDiv.innerHTML = '';
    try {
        const fRes = await fetch(item.url);
        if (fRes.ok) {
            const fData = await fRes.json();
            const content = atob(fData.content.replace(/\n/g, ''));
            const ext = item.name.split('.').pop();
            const mode = extMap[ext] || 'text/plain';
            CodeMirror(codeDiv, {
                value: content, mode,
                theme: isDark() ? 'darcula' : 'default',
                lineNumbers: false, readOnly: true, viewportMargin: Infinity,
            });
        } else {
            codeDiv.textContent = '파일을 불러올 수 없습니다 (크면 GitHub에서 확인)';
        }
    } catch (_) {
        codeDiv.textContent = '불러오기 실패';
    }
}

function addReadmeButton(div, repo) {
    const cached = localStorage.getItem(`readme_${repo.id}`);
    const re = document.createElement('div');
    re.className = 'repo-readme';
    re.id = `rm-${repo.id}`;
    re.style.display = 'none';
    if (cached) {
        try { re.innerHTML = marked.parse(cached); } catch { re.textContent = cached; }
    }
    const tg = document.createElement('button');
    tg.className = 'readme-toggle';
    tg.textContent = '📖 README 보기';
    let readmeFetched = !!cached;
    tg.onclick = async () => {
        if (!readmeFetched) {
            const cached2 = localStorage.getItem(`readme_${repo.id}`);
            if (cached2) {
                try { re.innerHTML = marked.parse(cached2); } catch { re.textContent = cached2; }
                readmeFetched = true;
            } else {
                try {
                    const rr = await fetch(`https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}/README.md`);
                    if (rr.ok) {
                        const txt = await rr.text();
                        localStorage.setItem(`readme_${repo.id}`, txt);
                        try { re.innerHTML = marked.parse(txt); } catch { re.textContent = txt; }
                        readmeFetched = true;
                    }
                } catch (_) {}
            }
        }
        const h = re.style.display === 'none';
        re.style.display = h ? 'block' : 'none';
        tg.textContent = h ? '📕 접기' : '📖 README 보기';
    };
    div.appendChild(tg);
    div.appendChild(re);
}

// fallback: 로딩 메시지 숨김
setTimeout(() => {
    document.querySelectorAll('.loading').forEach(el => {
        if (el.style.display !== 'none') el.style.display = 'none';
    });
}, 8000);