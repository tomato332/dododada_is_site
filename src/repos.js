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

let currentUser = localStorage.getItem('repos_username') || 'tomato332';

function updateProfileUI(username) {
    // 헤더 & 히어로 아바타 업데이트
    document.querySelectorAll('.avatar').forEach(img => {
        img.src = `https://avatars.githubusercontent.com/${username}`;
        img.alt = username;
    });
    // 이름 업데이트
    document.querySelectorAll('.name').forEach(el => {
        el.textContent = username;
    });
    // 헤더/히어로 github 링크 업데이트
    document.querySelectorAll('.header-links a[href*="github.com"], .hero-links a[href*="github.com"]').forEach(a => {
        a.href = `https://github.com/${username}`;
    });
    // GitHub Stats 이미지 업데이트
    const statsImg = document.querySelector('.stats img');
    if (statsImg) {
        statsImg.src = `https://github-readme-stats.vercel.app/api?username=${username}&show_icons=true&theme=dark&bg_color=0d1117&border_color=30363d&text_color=c9d1d9&icon_color=58a6ff`;
    }
}

export function initRepos() {
    const panel = document.getElementById('repos-panel');
    const overlay = document.getElementById('repos-overlay');
    document.getElementById('toggleReposBtn').onclick = () => { panel.classList.add('show'); overlay.classList.add('show'); };
    document.getElementById('closeReposBtn').onclick = () => { panel.classList.remove('show'); overlay.classList.remove('show'); };
    overlay.onclick = () => { panel.classList.remove('show'); overlay.classList.remove('show'); };

    const input = document.getElementById('repos-username-input');
    const loadBtn = document.getElementById('repos-load-btn');
    if (input) input.value = currentUser;
    if (loadBtn) {
        loadBtn.onclick = () => {
            const val = input ? input.value.trim() : '';
            if (!val) return;
            currentUser = val;
            localStorage.setItem('repos_username', val);
            updateProfileUI(val);
            document.getElementById('loading').style.display = 'block';
            document.getElementById('content').innerHTML = '';
            loadRepos(currentUser);
        };
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') loadBtn.click();
        });
    }

    loadRepos(currentUser);
}

async function loadRepos(username) {
    const el = document.getElementById('loading');
    const cacheKey = `repos_cache_${username}`;
    const cacheTimeKey = `repos_cache_time_${username}`;
    const cached = localStorage.getItem(cacheKey);
    const cachedTime = localStorage.getItem(cacheTimeKey);
    if (cached && cachedTime && Date.now() - Number(cachedTime) < 3600000) {
        renderRepos(JSON.parse(cached));
        return;
    }
    try {
        const res = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=20`);
        if (!res.ok) throw new Error('API error ' + res.status);
        const repos = await res.json();
        localStorage.setItem(cacheKey, JSON.stringify(repos));
        localStorage.setItem(cacheTimeKey, String(Date.now()));
        renderRepos(repos);
    } catch (e) {
        const backup = localStorage.getItem(cacheKey);
        if (backup) { renderRepos(JSON.parse(backup)); return; }
        el.innerHTML = 'Failed to load. Try refreshing.';
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
    codeBtn.textContent = '📂 View code';
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
        filesDiv.innerHTML = 'Loading...';
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
                filesDiv.innerHTML = '<span style="color:var(--muted)">⚠ API rate limit reached</span>';
            }
        } catch (_) {
            filesDiv.innerHTML = '<span style="color:var(--muted)">⚠ Load failed</span>';
        }
    }

    codeBtn.onclick = () => {
        window.open(repo.html_url, '_blank');
    };

    return { codeBtn, filesDiv, codeDiv };
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
    tg.textContent = '📖 View README';
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
        tg.textContent = h ? '📕 Collapse' : '📖 View README';
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