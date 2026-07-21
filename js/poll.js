// ╔══════════════════════════════════╗
// ║       ENQUETE (POLLS)           ║
// ╚══════════════════════════════════╝
// ── Opções da enquete (dinâmicas; fallback p/ Sim/Não em enquetes antigas) ──
function getPollOptions(poll) {
    if (poll && Array.isArray(poll.options) && poll.options.length >= 2) return poll.options;
    return [{ id: 'sim', label: 'Sim' }, { id: 'nao', label: 'Não' }];
}

function tallyPollResponses(docs, options) {
    const tally = {};
    options.forEach(o => { tally[o.id] = { count: 0, names: [] }; });
    docs.forEach(doc => {
        const d = doc.data();
        const t = tally[d.vote];
        if (t) { t.count++; if (d.playerName) t.names.push(d.playerName); }
    });
    return tally;
}

async function loadAdminPollTab() {
    const el = document.getElementById('pollAdminContent');
    if (!el) return;
    el.innerHTML = '<div class="loading-spinner">Carregando</div>';
    try {
        // Check if polls are enabled by staff
        const _s = await Store.getSettings();
        const pollEnabled = _s.pollEnabled !== false;
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
            const options = getPollOptions(poll);
            const tally = tallyPollResponses(respSnap.docs, options);
            const requireId = poll.requireIdentification !== false;
            el.innerHTML = `
                <div class="card">
                    <div class="card-title">🗳️ Enquete Ativa</div>
                    <div style="background:rgba(0,200,83,0.08);border:1px solid rgba(0,200,83,0.2);border-radius:10px;padding:14px;margin-bottom:12px;">
                        <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px;">"${poll.question}"</div>
                        <div style="font-size:12px;color:var(--text-dim);margin-bottom:10px;">Início: ${fmtBR(start)} — Fim: ${fmtBR(end)}</div>
                        <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px;">${requireId ? '👤 Identificada' : '🕶️ Anônima'}</div>
                        <div style="margin-bottom:12px;">
                            ${options.map(o => { const t = tally[o.id]; return `<div style="font-size:13px;color:var(--text);margin-bottom:4px;">${o.label}: <strong>${t.count}</strong>${t.names.length ? ' — ' + t.names.join(', ') : ''}</div>`; }).join('')}
                        </div>
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
                    <div style="margin-bottom:8px;">
                        <label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px;">Opções (2 a 6)</label>
                        <div id="pollOptionsList">${pollOptRowHtml('Sim')}${pollOptRowHtml('Não')}</div>
                        <button type="button" class="btn btn-small" id="pollAddOptBtn" onclick="addPollOption()" style="width:100%;background:rgba(255,255,255,0.05);border:1px dashed rgba(255,255,255,0.2);color:var(--text-dim);margin-top:2px;">+ Adicionar opção</button>
                    </div>
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
                    <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text);margin:4px 0 12px;cursor:pointer;">
                        <input type="checkbox" id="pollRequireId" checked style="width:16px;height:16px;accent-color:var(--accent);flex-shrink:0;">
                        <span>Exigir identificação <span style="color:var(--text-dim);font-size:11px;">(nome obrigatório ao votar — desmarque p/ enquete anônima)</span></span>
                    </label>
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
            const options = getPollOptions(p);
            const tally = tallyPollResponses(respSnap.docs, options);
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
                        ${options.map(o => { const t = tally[o.id]; return `${o.label}: ${t.count}${t.names.length ? ' (' + t.names.join(', ') + ')' : ''}`; }).join(' · ')}
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

function pollOptRowHtml(value = '') {
    const safe = String(value).replace(/"/g, '&quot;');
    return `<div class="poll-opt-row" style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
        <input type="text" class="poll-opt-input" maxlength="40" placeholder="Opção" value="${safe}" style="flex:1;padding:8px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);font-size:13px;font-family:inherit;box-sizing:border-box;">
        <button type="button" class="btn btn-small poll-opt-remove" onclick="removePollOption(this)" style="padding:8px 11px;background:rgba(255,61,61,0.12);color:var(--red);border:1px solid rgba(255,61,61,0.25);flex-shrink:0;">✕</button>
    </div>`;
}

function updatePollOptControls() {
    const list = document.getElementById('pollOptionsList');
    if (!list) return;
    const n = list.querySelectorAll('.poll-opt-row').length;
    const addBtn = document.getElementById('pollAddOptBtn');
    if (addBtn) addBtn.style.display = n >= 6 ? 'none' : '';
}

function addPollOption() {
    const list = document.getElementById('pollOptionsList');
    if (!list) return;
    if (list.querySelectorAll('.poll-opt-row').length >= 6) { toast('Máximo de 6 opções.', 'error'); return; }
    list.insertAdjacentHTML('beforeend', pollOptRowHtml(''));
    updatePollOptControls();
}

function removePollOption(btn) {
    const list = document.getElementById('pollOptionsList');
    const row = btn.closest('.poll-opt-row');
    if (!list || !row) return;
    if (list.querySelectorAll('.poll-opt-row').length <= 2) { toast('Mínimo de 2 opções.', 'error'); return; }
    row.remove();
    updatePollOptControls();
}

async function adminCreatePoll() {
    const question = document.getElementById('pollQuestion').value.trim();
    const startVal = document.getElementById('pollStartDate').value.trim();
    const endVal = document.getElementById('pollEndDate').value.trim();
    const requireIdentification = document.getElementById('pollRequireId')?.checked !== false;
    const optLabels = Array.from(document.querySelectorAll('#pollOptionsList .poll-opt-input')).map(i => i.value.trim()).filter(Boolean);
    if (!question) { toast('Informe a pergunta!', 'error'); return; }
    if (optLabels.length < 2) { toast('Informe pelo menos 2 opções!', 'error'); return; }
    if (optLabels.length > 6) { toast('Máximo de 6 opções!', 'error'); return; }
    if (new Set(optLabels.map(l => l.toLowerCase())).size !== optLabels.length) { toast('Há opções repetidas!', 'error'); return; }
    const options = optLabels.map((label, i) => ({ id: 'opt' + i, label }));
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
            options,
            requireIdentification,
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
    const requireId = poll.requireIdentification !== false;

    // Load players for the dropdown (only in identified mode)
    let playerOptions = '';
    if (requireId) {
        try {
            const pSnap = await db.collection('players').orderBy('name').get();
            playerOptions = pSnap.docs.map(d => `<option value="${d.data().name}" style="background:#1a1a2e;color:#e8eaf0;">${d.data().name}</option>`).join('');
        } catch (e) {}
    }

    // Load current responses
    const options = getPollOptions(poll);
    const respSnap = await db.collection('polls').doc(pollId).collection('responses').get();
    const tally = tallyPollResponses(respSnap.docs, options);

    const idSelector = requireId ? `
        <div style="margin-bottom:14px;">
            <select id="pollPlayerSelect" style="width:100%;padding:10px 12px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8eaf0;font-size:14px;font-family:inherit;">
                <option value="" style="background:#1a1a2e;color:#e8eaf0;">Selecione seu nome (obrigatório)</option>
                ${playerOptions}
            </select>
        </div>` : '';
    const voteBtns = alreadyVoted ? `
        <div style="text-align:center;padding:10px;background:rgba(255,255,255,0.04);border-radius:8px;color:var(--text-dim);font-size:13px;">
            ✔️ Você já votou nesta enquete!
        </div>` : `
        ${idSelector}
        <div style="display:flex;flex-wrap:wrap;gap:10px;">
            ${options.map(o => `<button class="btn" onclick="submitPollVote('${pollId}','${o.id}')" style="flex:1 1 42%;min-width:120px;padding:12px;font-size:15px;font-weight:700;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.16);color:var(--text);">${o.label}</button>`).join('')}
        </div>`;

    return `
        <div class="card" data-poll-id="${pollId}" data-require-id="${requireId ? 1 : 0}" style="max-width:480px;margin:0 auto 16px;border:1px solid rgba(255,255,255,0.08);">
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
                    ${options.map(o => { const t = tally[o.id]; return `
                    <div style="font-size:14px;color:var(--text);margin-bottom:2px;">${o.label}: <strong id="pollOptCount_${o.id}">${t.count}</strong></div>
                    ${requireId ? `<div id="pollOptNames_${o.id}" style="font-size:12px;color:var(--text-dim);margin-bottom:8px;padding-left:8px;">${t.names.length ? '• ' + t.names.join(', ') : ''}</div>` : ''}`; }).join('')}
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
    const card = document.querySelector(`[data-poll-id="${pollId}"]`);
    const requireId = card ? card.dataset.requireId === '1' : false;
    const sel = document.getElementById('pollPlayerSelect');
    if (requireId && (!sel || !sel.value)) {
        toast('Selecione seu nome para votar!', 'error');
        return;
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
        const playerName = (requireId && sel) ? sel.value : null;
        await db.collection('polls').doc(pollId).collection('responses').add({
            vote,
            playerName,
            deviceId: voter.deviceId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        localStorage.setItem(`pollVoted_${pollId}`, 'true');
        toast('✅ Voto registrado!', 'success');
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
            const tally = {};
            snap.docs.forEach(doc => {
                const d = doc.data();
                if (!d.vote) return;
                if (!tally[d.vote]) tally[d.vote] = { count: 0, names: [] };
                tally[d.vote].count++;
                if (d.playerName) tally[d.vote].names.push(d.playerName);
            });
            document.querySelectorAll('[id^="pollOptCount_"]').forEach(el => {
                const id = el.id.slice('pollOptCount_'.length);
                el.textContent = tally[id] ? tally[id].count : 0;
            });
            document.querySelectorAll('[id^="pollOptNames_"]').forEach(el => {
                const id = el.id.slice('pollOptNames_'.length);
                const names = tally[id] ? tally[id].names : [];
                el.textContent = names.length ? '• ' + names.join(', ') : '';
            });
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

