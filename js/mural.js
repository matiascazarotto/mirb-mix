// ╔══════════════════════════════════╗
// ║   OUVIDORIA MIRB                ║
// ╚══════════════════════════════════╝
async function initMural() {
    // Populate player dropdown
    const dropdown = document.getElementById('muralDropdown');
    if (dropdown) {
        const snap = await db.collection('players').orderBy('name').get();
        const sortedPlayers = snap.docs.map(d => d.data()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
        const otherOption = `<div onclick="event.stopPropagation();selectMuralTargetCustom()" style="padding:8px 12px;cursor:pointer;border-radius:6px;font-size:13px;color:var(--ct-blue);transition:background 0.15s;font-weight:600;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='transparent'">✏️ Outro...</div><div style="border-top:1px solid rgba(255,255,255,0.08);margin:4px 0;"></div>`;
        const playerOptions = sortedPlayers.map(p => {
            return `<div onclick="selectMuralTarget('${escapeHtml(p.name)}')" style="padding:8px 12px;cursor:pointer;border-radius:6px;font-size:13px;color:var(--text);transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='transparent'">${p.name}</div>`;
        }).join('');
        dropdown.innerHTML = otherOption + playerOptions;
    }
    // Show author line
    updateMuralAuthorLine();
    // Listen for posts in real-time (last 24 hours only)
    const ttlMinAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    muralUnsubscribe = db.collection('mural')
        .where('createdAt', '>=', ttlMinAgo)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .onSnapshot(snap => {
            const postsEl = document.getElementById('muralPosts');
            if (!postsEl) return;

            // Filter out expired posts client-side (in case listener started before expiry)
            const now = Date.now();
            const validDocs = [];
            snap.docs.forEach(doc => {
                const d = doc.data();
                if (!d.createdAt) { validDocs.push(doc); return; }
                const age = now - d.createdAt.toDate().getTime();
                if (age > 24 * 60 * 60 * 1000) {
                    // Cleanup: delete expired post
                    db.collection('mural').doc(doc.id).delete().catch(() => {});
                } else {
                    validDocs.push(doc);
                }
            });

            if (validDocs.length === 0) {
                postsEl.innerHTML = '<p style="text-align:center;color:var(--text-dim);padding:20px;font-size:13px;">Nenhuma reclamação recente... Seja o primeiro! 😈</p>';
                return;
            }

            // Sort by most recent first
            validDocs.sort((a, b) => (b.data().createdAt?.toDate() || 0) - (a.data().createdAt?.toDate() || 0));

            postsEl.innerHTML = validDocs.map(doc => {
                const d = doc.data();
                const id = doc.id;
                const hasLaughed = localStorage.getItem(`laughed_${id}`);
                const timeAgo = d.createdAt ? getTimeAgo(d.createdAt.toDate()) : '';
                return `
                    <div class="mural-post">
                        <div class="mural-post-text">"${escapeHtml(d.text)}" — sobre <span class="mural-target">${escapeHtml(d.targetPlayer)}</span></div>
                        <div class="mural-post-meta">
                            <span>por ${escapeHtml(d.authorName || 'Anônimo')} ${timeAgo ? '· ' + timeAgo : ''}</span>
                            <button class="mural-laugh-btn ${hasLaughed ? 'voted' : ''}" onclick="laughMural('${id}')">
                                😂 ${d.laughs || 0}
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        });
}

function destroyMural() {
    if (muralUnsubscribe) {
        muralUnsubscribe();
        muralUnsubscribe = null;
    }
}

function toggleMuralDropdown() {
    const dd = document.getElementById('muralDropdown');
    if (!dd) return;
    // Restore original options if was in custom input mode
    if (dd._prevHtml) {
        dd.innerHTML = dd._prevHtml;
        dd._prevHtml = null;
    }
    const opening = dd.style.display === 'none';
    dd.style.display = opening ? 'block' : 'none';
    if (opening) {
        setTimeout(() => {
            document.addEventListener('click', closeMuralDropdownOutside);
        }, 0);
    }
}

function closeMuralDropdownOutside(e) {
    const dd = document.getElementById('muralDropdown');
    const btn = document.getElementById('muralTargetBtn');
    if (!dd || !btn) return;
    if (!dd.contains(e.target) && !btn.contains(e.target)) {
        dd.style.display = 'none';
        if (dd._prevHtml) { dd.innerHTML = dd._prevHtml; dd._prevHtml = null; }
        document.removeEventListener('click', closeMuralDropdownOutside);
    }
}

function selectMuralTarget(name) {
    document.getElementById('muralTarget').value = name;
    document.getElementById('muralTargetBtn').textContent = name + ' ▾';
    document.getElementById('muralTargetBtn').style.color = 'var(--yellow)';
    document.getElementById('muralDropdown').style.display = 'none';
}

function selectMuralTargetCustom() {
    const dropdown = document.getElementById('muralDropdown');
    // Replace dropdown content with input
    const prev = dropdown.innerHTML;
    dropdown.innerHTML = `
        <div style="padding:8px;">
            <div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;">Sobre quem/o quê?</div>
            <div style="display:flex;gap:6px;">
                <input type="text" id="muralCustomTarget" placeholder="Ex: O Lag, O Mapa, Eu mesmo..." maxlength="50" style="flex:1;padding:8px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:var(--text);font-size:13px;font-family:inherit;" onkeydown="if(event.key==='Enter'){confirmMuralCustomTarget();}" autofocus>
                <button class="btn btn-primary btn-small" onclick="confirmMuralCustomTarget()" style="padding:6px 12px;font-size:12px;">OK</button>
            </div>
        </div>
    `;
    dropdown._prevHtml = prev;
    setTimeout(() => document.getElementById('muralCustomTarget')?.focus(), 50);
}

function confirmMuralCustomTarget() {
    const input = document.getElementById('muralCustomTarget');
    const val = input ? input.value.trim() : '';
    if (!val) return;
    selectMuralTarget(val);
    // Restore dropdown for next time
    const dropdown = document.getElementById('muralDropdown');
    if (dropdown._prevHtml) dropdown.innerHTML = dropdown._prevHtml;
}

function updateMuralAuthorLine() {
    const el = document.getElementById('muralAuthorLine');
    if (!el) return;
    const name = localStorage.getItem('muralAuthor');
    if (name) {
        el.innerHTML = `por <strong style="color:var(--yellow);">${escapeHtml(name)}</strong> · <a href="#" onclick="changeMuralAuthor();return false;" style="color:var(--text-dim);text-decoration:underline;">alterar</a> · <a href="#" onclick="clearMuralAuthor();return false;" style="color:var(--text-dim);text-decoration:underline;">anônimo</a>`;
    } else {
        el.innerHTML = `como <strong style="color:var(--text-dim);">Anônimo</strong> · <a href="#" onclick="changeMuralAuthor();return false;" style="color:var(--text-dim);text-decoration:underline;">me identificar</a>`;
    }
}

function changeMuralAuthor() {
    const el = document.getElementById('muralAuthorLine');
    if (!el) return;
    const current = localStorage.getItem('muralAuthor') || '';
    el.innerHTML = `
        <div style="display:inline-flex;gap:6px;align-items:center;">
            <input type="text" id="muralAuthorInput" value="${escapeHtml(current)}" placeholder="Seu nome" maxlength="30" style="padding:4px 8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:var(--text);font-size:12px;font-family:inherit;width:120px;" onkeydown="if(event.key==='Enter'){confirmMuralAuthor();}">
            <button class="btn btn-primary btn-small" onclick="confirmMuralAuthor()" style="padding:3px 10px;font-size:11px;">OK</button>
            <a href="#" onclick="updateMuralAuthorLine();return false;" style="color:var(--text-dim);font-size:11px;">cancelar</a>
        </div>
    `;
    setTimeout(() => { const i = document.getElementById('muralAuthorInput'); if (i) { i.focus(); i.select(); } }, 50);
}

function confirmMuralAuthor() {
    const input = document.getElementById('muralAuthorInput');
    const val = input ? input.value.trim() : '';
    if (val) {
        localStorage.setItem('muralAuthor', val);
    } else {
        localStorage.removeItem('muralAuthor');
    }
    updateMuralAuthorLine();
}

function clearMuralAuthor() {
    localStorage.removeItem('muralAuthor');
    updateMuralAuthorLine();
}

// ── Filtro de ofensas pessoais ──
const MURAL_BLOCKED_WORDS = [
    // Palavrões pesados
    'puta', 'puto', 'arrombado', 'arrombada', 'cuzao', 'vagabundo', 'vagabunda',
    'desgraca', 'desgraçado', 'desgraçada', 'infeliz', 'maldito', 'maldita',
    'filho da puta', 'filha da puta', 'fdp', 'vsf', 'tnc', 'pnc', 'vtnc',
    'vai se foder', 'vai tomar no cu', 'foda-se', 'fodase',
    'caralho', 'cacete', 'porra', 'merda', 'bosta',
    // Ofensas raciais e homofóbicas
    'macaco', 'macaca', 'crioulo', 'crioula', 'neguinho', 'neguinha',
    'preto imundo', 'preta imunda', 'negro imundo', 'negra imunda',
    'viado', 'viada', 'bicha', 'bichona', 'traveco', 'sapatao',
    'gay' , 'lesbica', 'transexual',
    // Xingamentos a família
    'sua mae', 'tua mae', 'sua irma', 'tua irma',
    'mae solteira', 'filho de chocadeira', 'orfao', 'orfa',
    // Julgamento físico/pessoal
    'gordao', 'gordinho', 'gordinha', 'magricelo', 'magrela',
    'careca', 'calvo', 'cabelo', 'banguela', 'feio', 'feia',
    'orelhudo', 'narigudo', 'dentuco', 'barrigudo',
    // Outros pessoais
    'retardado', 'retardada', 'mongol', 'mongoloide', 'autista',
    'deficiente', 'aleijado', 'aleijada', 'doente mental',
    'cancer', 'morre', 'morrer', 'se mata', 'suicida',
    // Ofensas de caráter/personalidade
    'falso', 'falsa', 'duas caras', 'pelas costas', 'fofoqueiro', 'fofoqueira',
    'cobra', 'traidor', 'traidora', 'mentiroso', 'mentirosa', 'covarde',
    'parasita', 'inutil', 'incompetente', 'lixo', 'lixo humano',
    'nojo', 'nojento', 'nojenta', 'ridiculo', 'ridicula', 'patetico', 'patetica',
    'otario', 'otaria', 'trouxa', 'babaca', 'idiota', 'imbecil', 'burro', 'burra',
    'toxico', 'toxica', 'chato', 'chata', 'mala', 'sem nocao',
    'folgado', 'folgada', 'aproveitador', 'aproveitadora', 'interesseiro', 'interesseira',
    'arrogante', 'metido', 'metida', 'convencido', 'convencida',
    'chorao', 'mimado', 'mimada', 'fresco', 'fresca',
    'piranha', 'galinha', 'corno', 'chifrudo'
];

function normalizeForFilter(text) {
    let t = text.toLowerCase();
    t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    t = t.replace(/4/g, 'a').replace(/3/g, 'e').replace(/1/g, 'i')
         .replace(/0/g, 'o').replace(/5/g, 's').replace(/7/g, 't');
    t = t.replace(/[^a-z0-9\s]/g, ' ');
    t = t.replace(/\b(\w)\s+(?=\w\b)/g, '$1');
    t = t.replace(/(.)\1{2,}/g, '$1$1');
    t = t.replace(/\s+/g, ' ').trim();
    return t;
}

function containsBlockedWord(text) {
    const normalized = normalizeForFilter(text);
    return MURAL_BLOCKED_WORDS.some(word => {
        const nw = normalizeForFilter(word);
        return normalized.includes(nw);
    });
}

async function postMural() {
    const textInput = document.getElementById('muralText');
    const targetSelect = document.getElementById('muralTarget');
    const text = textInput.value.trim();
    const target = targetSelect.value;

    if (!text) { toast('Escreva sua reclamação!', 'error'); return; }
    if (!target) { toast('Selecione sobre quem é a reclamação!', 'error'); return; }
    if (containsBlockedWord(text)) { toast('Reclamação sobre jogabilidade, não pessoal! Reformule sua mensagem.', 'error'); return; }

    const author = localStorage.getItem('muralAuthor') || 'Anônimo';
    let _ip = 'unknown';
    let _fp = 'unknown';
    try { const r = await fetch('https://api.ipify.org?format=json'); _ip = (await r.json()).ip || 'unknown'; } catch(_){}
    try { _fp = await getDeviceFingerprint(); } catch(_){}
    if (await isIPBlocked(_ip, 'mural', _fp)) { toast('Não foi possível postar. Tente novamente mais tarde.', 'error'); return; }

    try {
        await db.collection('mural').add({
            text,
            targetPlayer: target,
            authorName: author,
            laughs: 0,
            _ip,
            _fingerprint: _fp,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        textInput.value = '';
        targetSelect.value = '';
        const btn = document.getElementById('muralTargetBtn');
        if (btn) { btn.textContent = 'Sobre quem? ▾'; btn.style.color = 'var(--text-dim)'; }
    } catch (e) {
        toast('Erro ao postar: ' + e.message, 'error');
    }
}

async function laughMural(docId) {
    const key = `laughed_${docId}`;
    const hasLaughed = localStorage.getItem(key);
    try {
        if (hasLaughed) {
            localStorage.removeItem(key);
            await db.collection('mural').doc(docId).update({ laughs: firebase.firestore.FieldValue.increment(-1) });
        } else {
            localStorage.setItem(key, '1');
            await db.collection('mural').doc(docId).update({ laughs: firebase.firestore.FieldValue.increment(1) });
        }
    } catch (e) {
        if (hasLaughed) localStorage.setItem(key, '1');
        else localStorage.removeItem(key);
        toast('Erro: ' + e.message, 'error');
    }
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'agora';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `há ${minutes}min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    return `há ${days}d`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function assignDisplayNames(matches) {
    const nameCounts = {};
    matches.forEach(m => { nameCounts[m.name] = (nameCounts[m.name] || 0) + 1; });
    const nameIdx = {};
    const sorted = [...matches].sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return ta - tb;
    });
    sorted.forEach(m => {
        if (nameCounts[m.name] > 1) {
            nameIdx[m.name] = (nameIdx[m.name] || 0) + 1;
            m.displayName = `${m.name} (${nameIdx[m.name]})`;
        } else {
            m.displayName = m.name;
        }
    });
}

function toggleVoteSkip(matchId, playerId) {
    const checkbox = document.getElementById(`skip-${matchId}-${playerId}`);
    const row = document.getElementById(`voteRow-${matchId}-${playerId}`);
    const display = document.getElementById(`disp-${matchId}-${playerId}`);
    const slider = document.getElementById(`vote-${matchId}-${playerId}`);
    const label = checkbox.closest('.vote-skip-toggle');

    if (checkbox.checked) {
        row.classList.add('skipped');
        label.classList.add('active');
        display.textContent = '—';
    } else {
        row.classList.remove('skipped');
        label.classList.remove('active');
        display.textContent = slider.value;
    }
}

// Generate device fingerprint from hardware/system properties (same across browsers on same PC)
async function getDeviceFingerprint() {
    const raw = [
        screen.width, screen.height, screen.colorDepth,
        navigator.hardwareConcurrency || 'x',
        navigator.language,
        navigator.platform,
        Intl.DateTimeFormat().resolvedOptions().timeZone
    ].join('|');
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(raw));
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

// Get voter unique ID: IP + device fingerprint
async function getVoterDeviceId() {
    let ip = 'unknown';
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        ip = (await res.json()).ip || 'unknown';
    } catch (_) {}
    const fp = await getDeviceFingerprint();
    return { ip, fingerprint: fp, deviceId: ip + '_' + fp };
}

async function submitVote(matchId) {
    // Check if already voted (localStorage — fast client-side check)
    if (localStorage.getItem(`voted_${matchId}`)) {
        toast('Você já votou nesta partida!', 'error');
        return;
    }

    try {
        const matchDoc = await db.collection('matches').doc(matchId).get();
        const match = matchDoc.data();

        if (match.status !== 'voting') {
            toast('Votação já encerrada!', 'error');
            return;
        }

        // Get voter device ID (IP + fingerprint)
        const voter = await getVoterDeviceId();
        if (await isIPBlocked(voter.ip, 'vote', voter.fingerprint)) { toast('Não foi possível votar. Tente novamente mais tarde.', 'error'); return; }

        // Check if this device already voted (server-side dedup by deviceId)
        if (voter.deviceId !== 'unknown_') {
            const existingVotes = await db.collection('matches').doc(matchId)
                .collection('votes').where('_meta.deviceId', '==', voter.deviceId).limit(1).get();
            if (!existingVotes.empty) {
                localStorage.setItem(`voted_${matchId}`, 'true');
                toast('Você já votou nesta partida!', 'error');
                loadVotePage();
                return;
            }
        }

        // Collect votes (only for non-skipped players)
        const voteData = {};
        match.players.forEach(p => {
            const skipCheckbox = document.getElementById(`skip-${matchId}-${p.id}`);
            if (skipCheckbox && skipCheckbox.checked) return; // "Não sei" — skip
            const input = document.getElementById(`vote-${matchId}-${p.id}`);
            if (input) {
                voteData[p.id] = parseInt(input.value);
            }
        });

        if (Object.keys(voteData).length === 0) {
            toast('Vote em pelo menos 1 jogador!', 'error');
            return;
        }

        // Save vote with a unique random ID
        const voterId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

        const voteRecord = {
            ...voteData,
            _meta: {
                ip: voter.ip,
                fingerprint: voter.fingerprint,
                deviceId: voter.deviceId,
                timestamp: new Date().toISOString(),
                votedOn: Object.keys(voteData).length,
                skipped: match.players.length - Object.keys(voteData).length
            }
        };

        await db.collection('matches').doc(matchId).collection('votes').doc(voterId).set(voteRecord);

        // Mark as voted in localStorage
        localStorage.setItem(`voted_${matchId}`, 'true');

        toast('Voto registrado com sucesso!', 'success');
        loadVotePage();
    } catch (e) {
        toast('Erro ao votar: ' + e.message, 'error');
    }
}

