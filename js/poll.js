// ╔══════════════════════════════════╗
// ║       ENQUETE (POLLS)           ║
// ╚══════════════════════════════════╝
async function loadAdminPollTab() {
    const el = document.getElementById('pollAdminContent');
    if (!el) return;
    el.innerHTML = '<div class="loading-spinner">Carregando</div>';
    try {
        // Check if polls are enabled by staff
        const settingsDoc = await db.collection('config').doc('settings').get();
        const pollEnabled = settingsDoc.exists ? (settingsDoc.data().pollEnabled !== false) : true;
        if (!pollEnabled) {
            el.innerHTML = `<div class="card"><div class="empty-state"><div class="icon">🗳️</div><p>Enquetes desabilitadas pelo Staff.</p></div></div>`;
            return;
        }
        // Check for active poll
        const snap = await db.collection('polls').where('status', '==', 'active').limit(1).get();
        if (!snap.empty) {
            const poll = snap.docs[0].data();
            const pollId = snap.docs[0].id;
            const start = poll.startDate.toDate();
            const end = poll.endDate.toDate();
            const fmtBR = (d) => String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
            const respSnap = await db.collection('polls').doc(pollId).collection('responses').get();
            const simCount = respSnap.docs.filter(d => d.data().vote === 'sim').length;
            const naoCount = respSnap.docs.filter(d => d.data().vote === 'nao').length;
            const simNames = respSnap.docs.filter(d => d.data().vote === 'sim').map(d => d.data().playerName).filter(Boolean);
            el.innerHTML = `
                <div class="card">
                    <div class="card-title">🗳️ Enquete Ativa</div>
                    <div style="background:rgba(0,200,83,0.08);border:1px solid rgba(0,200,83,0.2);border-radius:10px;padding:14px;margin-bottom:12px;">
                        <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px;">"${poll.question}"</div>
                        <div style="font-size:12px;color:var(--text-dim);margin-bottom:10px;">Início: ${fmtBR(start)} — Fim: ${fmtBR(end)}</div>
                        <div style="font-size:13px;color:var(--text);margin-bottom:4px;">✅ Sim: ${simCount}${simNames.length ? ' — ' + simNames.join(', ') : ''}</div>
                        <div style="font-size:13px;color:var(--text);margin-bottom:12px;">❌ Não: ${naoCount}</div>
                        <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;margin-bottom:8px;">
                            <div style="font-size:11px;font-weight:600;color:var(--text-dim);margin-bottom:8px;text-transform:uppercase;">Editar Datas</div>
                            <div style="display:flex;gap:8px;margin-bottom:8px;">
                                <div style="flex:1;">
                                    <label style="font-size:11px;color:var(--text-dim);">Início</label>
                                    <input type="text" id="pollEditStart" value="${fmtBR(start)}" placeholder="DD/MM/YYYY HH:MM" style="width:100%;padding:6px 8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:var(--text);font-size:12px;font-family:inherit;box-sizing:border-box;">
                                </div>
                                <div style="flex:1;">
                                    <label style="font-size:11px;color:var(--text-dim);">Fim</label>
                                    <input type="text" id="pollEditEnd" value="${fmtBR(end)}" placeholder="DD/MM/YYYY HH:MM" style="width:100%;padding:6px 8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:var(--text);font-size:12px;font-family:inherit;box-sizing:border-box;">
                                </div>
                            </div>
                            <button class="btn btn-small" onclick="adminUpdatePollDates('${pollId}')" style="width:100%;background:rgba(255,165,0,0.15);color:var(--yellow);border:1px solid rgba(255,165,0,0.3);margin-bottom:8px;">📝 Salvar Datas</button>
                        </div>
                        <div style="display:flex;gap:8px;">
                            <button class="btn btn-small" onclick="adminClosePoll('${pollId}')" style="flex:1;background:rgba(255,61,61,0.15);color:var(--red);border:1px solid rgba(255,61,61,0.3);">🛑 Encerrar</button>
                            <button class="btn btn-small" onclick="adminDeletePoll('${pollId}')" style="flex:1;background:rgba(255,61,61,0.15);color:var(--red);border:1px solid rgba(255,61,61,0.3);">🗑️ Excluir</button>
                        </div>
                    </div>
                </div>`;
        } else {
            el.innerHTML = `
                <div class="card">
                    <div class="card-title">🗳️ Criar Enquete</div>
                    <div style="font-size:12px;color:var(--text-dim);margin-bottom:12px;">Nenhuma enquete ativa. Crie uma nova abaixo.</div>
                    <input type="text" id="pollQuestion" placeholder="Pergunta (ex: X5 HOJE?)" style="width:100%;padding:10px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);font-size:14px;font-family:inherit;margin-bottom:8px;box-sizing:border-box;">
                    <div style="display:flex;gap:8px;margin-bottom:8px;">
                        <div style="flex:1;">
                            <label style="font-size:11px;color:var(--text-dim);">Início</label>
                            <input type="text" id="pollStartDate" placeholder="DD/MM/YYYY HH:MM" value="${(() => { const n=new Date(); return String(n.getDate()).padStart(2,'0')+'/'+String(n.getMonth()+1).padStart(2,'0')+'/'+n.getFullYear()+' '+String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0'); })()}" style="width:100%;padding:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);font-size:13px;font-family:inherit;box-sizing:border-box;">
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:11px;color:var(--text-dim);">Fim</label>
                            <input type="text" id="pollEndDate" placeholder="DD/MM/YYYY HH:MM" value="${(() => { const n=new Date(); return String(n.getDate()).padStart(2,'0')+'/'+String(n.getMonth()+1).padStart(2,'0')+'/'+n.getFullYear()+' 21:00'; })()}" style="width:100%;padding:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);font-size:13px;font-family:inherit;box-sizing:border-box;">
                        </div>
                    </div>
                    <button class="btn btn-primary btn-small" onclick="adminCreatePoll()" style="width:100%;">🗳️ Criar Enquete</button>
                </div>
                ${await renderPollHistory()}`;
        }
    } catch (e) {
        el.innerHTML = `<div class="card"><span style="color:var(--red);font-size:12px;">Erro ao carregar enquetes: ${e.message}</span></div>`;
    }
}

async function renderPollHistory() {
    try {
        const closedSnap = await db.collection('polls').where('status', '==', 'closed').get();
        if (closedSnap.empty) return '';
        const sorted = closedSnap.docs.sort((a, b) => (b.data().createdAt?.toMillis() || 0) - (a.data().createdAt?.toMillis() || 0)).slice(0, 10);
        let items = '';
        for (const doc of sorted) {
            const p = doc.data();
            const pollId = doc.id;
            const end = p.endDate.toDate();
            const fmtBR = (d) => String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
            const respSnap = await db.collection('polls').doc(pollId).collection('responses').get();
            const simNames = respSnap.docs.filter(d => d.data().vote === 'sim').map(d => d.data().playerName).filter(Boolean);
            const naoCount = respSnap.docs.filter(d => d.data().vote === 'nao').length;
            items += `
                <div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <span style="font-weight:600;color:var(--text);font-size:13px;">"${p.question}"</span>
                            <span style="font-size:11px;color:var(--text-dim);margin-left:6px;">${fmtBR(end)}</span>
                        </div>
                        <button class="btn btn-small" onclick="adminDeletePoll('${pollId}')" style="font-size:10px;padding:3px 8px;background:rgba(255,61,61,0.1);color:var(--red);border:1px solid rgba(255,61,61,0.2);">🗑️</button>
                    </div>
                    <div style="font-size:12px;color:var(--text-dim);margin-top:4px;">
                        ✅ ${simNames.length}${simNames.length ? ' (' + simNames.join(', ') + ')' : ''} · ❌ ${naoCount}
                    </div>
                </div>`;
        }
        return `
            <div class="card" style="margin-top:12px;">
                <div class="card-title" style="font-size:13px;">📋 Histórico de Enquetes</div>
                ${items}
            </div>`;
    } catch (e) {
        return '';
    }
}

async function adminCreatePoll() {
    const question = document.getElementById('pollQuestion').value.trim();
    const startVal = document.getElementById('pollStartDate').value.trim();
    const endVal = document.getElementById('pollEndDate').value.trim();
    if (!question) { toast('Informe a pergunta!', 'error'); return; }
    if (!startVal || !endVal) { toast('Informe início e fim!', 'error'); return; }
    const parseBR = (s) => { const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/); return m ? new Date(+m[3], +m[2]-1, +m[1], +m[4], +m[5]) : null; };
    const startDate = parseBR(startVal);
    const endDate = parseBR(endVal);
    if (!startDate || !endDate) { toast('Formato inválido! Use DD/MM/YYYY HH:MM', 'error'); return; }
    if (endDate <= startDate) { toast('Data fim deve ser após o início!', 'error'); return; }
    try {
        const existing = await db.collection('polls').where('status', '==', 'active').limit(1).get();
        if (!existing.empty) { toast('Já existe uma enquete ativa! Encerre antes de criar outra.', 'error'); return; }
        await db.collection('polls').add({
            question,
            startDate: firebase.firestore.Timestamp.fromDate(startDate),
            endDate: firebase.firestore.Timestamp.fromDate(endDate),
            status: 'active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: 'admin'
        });
        toast('Enquete criada!', 'success');
        loadAdminPollTab();
    } catch (e) {
        toast('Erro ao criar enquete: ' + e.message, 'error');
    }
}

async function adminClosePoll(pollId) {
    try {
        await db.collection('polls').doc(pollId).update({ status: 'closed' });
        toast('Enquete encerrada!', 'success');
        loadAdminPollTab();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

async function adminUpdatePollDates(pollId) {
    const startVal = document.getElementById('pollEditStart').value.trim();
    const endVal = document.getElementById('pollEditEnd').value.trim();
    const parseBR = (s) => { const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/); return m ? new Date(+m[3], +m[2]-1, +m[1], +m[4], +m[5]) : null; };
    const startDate = parseBR(startVal);
    const endDate = parseBR(endVal);
    if (!startDate || !endDate) { toast('Formato inválido! Use DD/MM/YYYY HH:MM', 'error'); return; }
    if (endDate <= startDate) { toast('Data fim deve ser após o início!', 'error'); return; }
    try {
        await db.collection('polls').doc(pollId).update({
            startDate: firebase.firestore.Timestamp.fromDate(startDate),
            endDate: firebase.firestore.Timestamp.fromDate(endDate)
        });
        toast('Datas atualizadas!', 'success');
        loadAdminPollTab();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

async function adminDeletePoll(pollId) {
    if (!confirm('Excluir enquete e todas as respostas? Esta ação não pode ser desfeita.')) return;
    try {
        const respSnap = await db.collection('polls').doc(pollId).collection('responses').get();
        const batch = db.batch();
        respSnap.docs.forEach(d => batch.delete(d.ref));
        batch.delete(db.collection('polls').doc(pollId));
        await batch.commit();
        toast('Enquete excluída!', 'success');
        loadAdminPollTab();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

// ╔══════════════════════════════════╗
// ║      POLL (ENQUETE) VOTING      ║
// ╚══════════════════════════════════╝
let _pollListenerUnsub = null;
let _pollStatusUnsub = null;
let _pollCountdownInterval = null;

async function renderPollCard(pollId, poll) {
    const end = poll.endDate.toDate();
    const start = poll.startDate.toDate();
    const alreadyVoted = localStorage.getItem(`pollVoted_${pollId}`);

    // Load players for the dropdown
    let playerOptions = '';
    try {
        const pSnap = await db.collection('players').orderBy('name').get();
        playerOptions = pSnap.docs.map(d => `<option value="${d.data().name}" style="background:#1a1a2e;color:#e8eaf0;">${d.data().name}</option>`).join('');
    } catch (e) {}

    // Load current responses
    const respSnap = await db.collection('polls').doc(pollId).collection('responses').get();
    const simNames = respSnap.docs.filter(d => d.data().vote === 'sim').map(d => d.data().playerName).filter(Boolean);
    const naoCount = respSnap.docs.filter(d => d.data().vote === 'nao').length;

    const voteBtns = alreadyVoted ? `
        <div style="text-align:center;padding:10px;background:rgba(255,255,255,0.04);border-radius:8px;color:var(--text-dim);font-size:13px;">
            ✔️ Você já votou nesta enquete!
        </div>` : `
        <div style="margin-bottom:14px;">
            <select id="pollPlayerSelect" style="width:100%;padding:10px 12px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8eaf0;font-size:14px;font-family:inherit;">
                <option value="" style="background:#1a1a2e;color:#e8eaf0;">Selecione seu nome (obrigatório p/ Sim)</option>
                ${playerOptions}
            </select>
        </div>
        <div style="display:flex;gap:10px;">
            <button class="btn btn-primary" onclick="submitPollVote('${pollId}','sim')" style="flex:1;padding:12px;font-size:15px;font-weight:700;">✅ SIM</button>
            <button class="btn btn-secondary" onclick="submitPollVote('${pollId}','nao')" style="flex:1;padding:12px;font-size:15px;font-weight:700;">❌ NÃO</button>
        </div>`;

    return `
        <div class="card" data-poll-id="${pollId}" style="max-width:480px;margin:0 auto 16px;border:1px solid rgba(255,255,255,0.08);">
            <div style="text-align:center;margin-bottom:4px;">
                <span style="font-size:12px;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:1px;">🗳️ Enquete</span>
            </div>
            <div style="text-align:center;font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700;color:var(--text);margin-bottom:8px;">
                ${poll.question}
            </div>
            <div id="pollCountdown" data-end="${end.toISOString()}" style="text-align:center;font-size:12px;color:var(--text-dim);margin-bottom:14px;">
                ⏱️ Encerra em: calculando...
            </div>
            ${voteBtns}
            <div style="margin-top:16px;border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;">
                <div style="font-size:12px;font-weight:600;color:var(--text-dim);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Resultados</div>
                <div id="pollResults">
                    <div style="font-size:14px;color:var(--text);margin-bottom:4px;">✅ Sim: <strong id="pollSimCount">${simNames.length}</strong></div>
                    <div id="pollSimNames" style="font-size:12px;color:var(--green);margin-bottom:8px;padding-left:8px;">${simNames.length ? '• ' + simNames.join(', ') : ''}</div>
                    <div style="font-size:14px;color:var(--text);">❌ Não: <strong id="pollNaoCount">${naoCount}</strong></div>
                </div>
            </div>
            <div style="margin-top:10px;font-size:11px;color:var(--text-dim);text-align:center;">
                Válida: ${start.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})} ${start.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
                até ${end.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})} ${end.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
            </div>
        </div>`;
}

async function submitPollVote(pollId, vote) {
    if (localStorage.getItem(`pollVoted_${pollId}`)) {
        toast('Você já votou nesta enquete!', 'error');
        return;
    }
    if (vote === 'sim') {
        const sel = document.getElementById('pollPlayerSelect');
        if (!sel || !sel.value) {
            toast('Selecione seu nome para votar Sim!', 'error');
            return;
        }
    }
    try {
        const voter = await getVoterDeviceId();
        if (await isIPBlocked(voter.ip, 'poll', voter.fingerprint)) { toast('Não foi possível votar. Tente novamente mais tarde.', 'error'); return; }
        // Server-side dedup
        if (voter.deviceId !== 'unknown_') {
            const existing = await db.collection('polls').doc(pollId)
                .collection('responses').where('deviceId', '==', voter.deviceId).limit(1).get();
            if (!existing.empty) {
                localStorage.setItem(`pollVoted_${pollId}`, 'true');
                toast('Você já votou nesta enquete!', 'error');
                loadVotePage();
                return;
            }
        }
        const playerName = vote === 'sim' ? document.getElementById('pollPlayerSelect').value : null;
        await db.collection('polls').doc(pollId).collection('responses').add({
            vote,
            playerName,
            deviceId: voter.deviceId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        localStorage.setItem(`pollVoted_${pollId}`, 'true');
        toast(vote === 'sim' ? '✅ Voto SIM registrado!' : '❌ Voto NÃO registrado!', 'success');
        loadVotePage();
    } catch (e) {
        toast('Erro ao votar: ' + e.message, 'error');
    }
}

function initPollListener(pollId) {
    destroyPollListener();
    if (!pollId) return;
    _pollListenerUnsub = db.collection('polls').doc(pollId)
        .collection('responses').onSnapshot(snap => {
            const simNames = snap.docs.filter(d => d.data().vote === 'sim').map(d => d.data().playerName).filter(Boolean);
            const naoCount = snap.docs.filter(d => d.data().vote === 'nao').length;
            const simCountEl = document.getElementById('pollSimCount');
            const simNamesEl = document.getElementById('pollSimNames');
            const naoCountEl = document.getElementById('pollNaoCount');
            if (simCountEl) simCountEl.textContent = simNames.length;
            if (simNamesEl) simNamesEl.textContent = simNames.length ? '• ' + simNames.join(', ') : '';
            if (naoCountEl) naoCountEl.textContent = naoCount;
        });

    // Countdown
    startPollCountdown(pollId);

    // Also listen for poll status changes (admin closing it)
    _pollStatusUnsub = db.collection('polls').doc(pollId).onSnapshot(doc => {
        if (!doc.exists || doc.data().status !== 'active') {
            const el = document.getElementById('pollCountdown');
            if (el) el.textContent = '🔴 Enquete encerrada';
            if (_pollCountdownInterval) { clearInterval(_pollCountdownInterval); _pollCountdownInterval = null; }
        }
    });
}

function destroyPollListener() {
    if (_pollListenerUnsub) { _pollListenerUnsub(); _pollListenerUnsub = null; }
    if (_pollStatusUnsub) { _pollStatusUnsub(); _pollStatusUnsub = null; }
    if (_pollCountdownInterval) { clearInterval(_pollCountdownInterval); _pollCountdownInterval = null; }
}

function startPollCountdown(pollId) {
    if (_pollCountdownInterval) clearInterval(_pollCountdownInterval);
    const update = () => {
        const el = document.getElementById('pollCountdown');
        if (!el) { clearInterval(_pollCountdownInterval); _pollCountdownInterval = null; return; }
        const endAttr = el.dataset.end;
        if (!endAttr) return;
        const diff = new Date(endAttr) - new Date();
        if (diff <= 0) {
            el.textContent = '🔴 Enquete encerrada';
            clearInterval(_pollCountdownInterval); _pollCountdownInterval = null;
            return;
        }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        el.textContent = `⏱️ Encerra em: ${h}h ${m}min`;
    };
    update();
    _pollCountdownInterval = setInterval(update, 60000);
}

