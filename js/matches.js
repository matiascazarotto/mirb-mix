// ╔══════════════════════════════════╗
// ║   MATCH CREATION (Admin)        ║
// ╚══════════════════════════════════╝
let selectedForMatch = [];

function renderPlayerSelectionForMatch() {
    const el = document.getElementById('adminPlayerSelection');
    if (!el) return;
    selectedForMatch = [];
    updateMatchSelectionCount();
    const filterInput = document.getElementById('playerFilterInput');
    if (filterInput) filterInput.value = '';

    el.innerHTML = players.map(p => `
        <div class="player-selector" id="sel-${p.id}" onclick="toggleMatchPlayer('${p.id}')" data-name="${p.name.toLowerCase()}">
            <input type="checkbox" id="chk-${p.id}">
            <div class="player-name">${p.name}</div>
            <div class="player-meta">
                <span class="badge badge-role">${p.role}</span>
                <span class="badge badge-style-${p.playstyle || 'Normal'}">${(p.playstyle || 'Normal') === 'Agressivo' ? '⚡' : (p.playstyle || 'Normal') === 'Lento' ? '🐢' : '🎯'} ${p.playstyle || 'Normal'}</span>
            </div>
        </div>
    `).join('');
}

function filterPlayerSelection() {
    const query = (document.getElementById('playerFilterInput')?.value || '').toLowerCase();
    document.querySelectorAll('#adminPlayerSelection .player-selector').forEach(el => {
        const name = el.dataset.name || '';
        el.style.display = name.includes(query) ? '' : 'none';
    });
}

function toggleMatchPlayer(id) {
    const idx = selectedForMatch.indexOf(id);
    if (idx === -1) {
        if (selectedForMatch.length >= 10) {
            toast('Máximo 10 jogadores!', 'error');
            return;
        }
        selectedForMatch.push(id);
    } else {
        selectedForMatch.splice(idx, 1);
    }

    const el = document.getElementById(`sel-${id}`);
    const chk = document.getElementById(`chk-${id}`);
    if (el) el.classList.toggle('selected', selectedForMatch.includes(id));
    if (chk) chk.checked = selectedForMatch.includes(id);
    updateMatchSelectionCount();
}

function updateMatchSelectionCount() {
    const countEl = document.getElementById('adminSelectedCount');
    const btn = document.getElementById('createMatchBtn');
    if (countEl) countEl.textContent = selectedForMatch.length;
    if (btn) btn.disabled = selectedForMatch.length < 1;
}

async function createMatch() {
    if (selectedForMatch.length < 1) return;

    const matchPlayers = selectedForMatch.map(id => {
        const p = players.find(pl => pl.id === id);
        return { id: p.id, name: p.name, role: p.role, duo: p.duo || '', playstyle: p.playstyle || 'Normal' };
    });

    const name = document.getElementById('matchName').value.trim() || `Mix ${new Date().toLocaleDateString('pt-BR')}`;

    try {
        await db.collection('matches').add({
            name,
            players: matchPlayers,
            status: 'open',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        toast('Partida criada! Edite os jogadores ou inicie a votação.', 'success');
        selectedForMatch = [];
        renderPlayerSelectionForMatch();
        document.getElementById('matchName').value = '';
        loadAdminMatches();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

// ╔══════════════════════════════════╗
// ║   ADMIN MATCHES MANAGEMENT      ║
// ╚══════════════════════════════════╝
async function loadAdminMatches() {
    const el = document.getElementById('adminMatchesList');
    if (!el) return;

    try {
        const snap = await db.collection('matches').orderBy('createdAt', 'desc').get();
        if (snap.empty) {
            el.innerHTML = '<div class="empty-state"><p>Nenhuma partida criada.</p></div>';
            return;
        }

        // Assign display names for duplicate match names
        const allMatches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        assignDisplayNames(allMatches);
        const displayNameMap = {};
        allMatches.forEach(m => { displayNameMap[m.id] = m.displayName; });

        let html = '';
        for (const doc of snap.docs) {
            const m = doc.data();
            m.displayName = displayNameMap[doc.id];
            const matchId = doc.id;

            // Count votes
            const votesSnap = await db.collection('matches').doc(matchId).collection('votes').get();
            const voteCount = votesSnap.size;

            const statusLabel = m.status === 'open' ? '⚪ Aguardando Jogadores' : m.status === 'voting' ? '🟢 Votação Aberta' : m.status === 'team_vote' ? '🔵 Votação de Times' : m.status === 'finished' ? '✅ Finalizada' : '🟡 Em Andamento';
            const isOpen = m.status === 'open';
            const isFinished = m.status === 'finished';
            const isClosed = m.status === 'closed';
            const isTeamVote = m.status === 'team_vote';
            const date = m.createdAt ? m.createdAt.toDate().toLocaleDateString('pt-BR') : '';
            const vods = m.vodUrls || (m.vodUrl ? [m.vodUrl] : []);
            const hasGC = !!m.gcStats;
            const gcCount = m.gcMatchCount || 0;

            // ── Build GC score summary ──
            let gcScoreHtml = '';
            if (hasGC && m.gcStats.length > 0) {
                const byIdx = {};
                m.gcStats.forEach(s => {
                    const idx = s.gcMatchIdx || 1;
                    if (!byIdx[idx]) byIdx[idx] = { teamA: null, teamB: null, scoreA: null, scoreB: null };
                    if (s.teamName && !byIdx[idx].teamA) { byIdx[idx].teamA = s.teamName; byIdx[idx].scoreA = s.teamScore; }
                    else if (s.teamName && s.teamName !== byIdx[idx].teamA && !byIdx[idx].teamB) { byIdx[idx].teamB = s.teamName; byIdx[idx].scoreB = s.teamScore; }
                });
                const idxKeys = Object.keys(byIdx).sort((a,b)=>a-b);
                gcScoreHtml = idxKeys.map(idx => {
                    const g = byIdx[idx];
                    if (!g.teamA || !g.teamB || g.scoreA == null || g.scoreB == null) return '';
                    const aWin = g.scoreA > g.scoreB;
                    const prefix = idxKeys.length > 1 ? '<span style="color:var(--ct-blue);font-weight:600;font-size:11px;">GC#' + idx + '</span> ' : '';
                    const removeBtn = '<span onclick="unlinkGCMatch(\'' + matchId + '\',' + idx + ')" style="color:var(--red);cursor:pointer;opacity:0.5;margin-left:4px;font-size:10px;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.5" title="Remover GC#' + idx + '">✕</span>';
                    return '<span style="font-size:12px;">' + prefix +
                        '<span style="color:' + (aWin ? 'var(--green)' : 'var(--text-dim)') + ';font-weight:600;">' + g.teamA + ' ' + g.scoreA + '</span>' +
                        '<span style="color:var(--text-dim);"> x </span>' +
                        '<span style="color:' + (!aWin ? 'var(--green)' : 'var(--text-dim)') + ';font-weight:600;">' + g.scoreB + ' ' + g.teamB + '</span>' + removeBtn + '</span>';
                }).filter(Boolean).join('<span style="color:var(--text-dim);margin:0 6px;">|</span>');
            }

            html += `
                <div class="match-card ${m.status}">
                    <!-- Header -->
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;">
                        <div>
                            <div class="match-title">${m.displayName || m.name}</div>
                            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:3px;font-size:12px;color:var(--text-dim);align-items:center;">
                                ${date ? `<span>📅 ${date}</span>` : ''}
                                <span>👥 ${m.players.length}</span>
                                <span>📊 ${voteCount} votos</span>
                                ${gcCount > 1 ? `<span>🎮 MD${gcCount}</span>` : ''}
                                ${vods.length > 0 ? vods.map((url, i) => `<a href="${url}" target="_blank" style="color:var(--green);text-decoration:none;font-weight:600;">📹 VOD${vods.length > 1 ? ' '+(i+1) : ''}</a>`).join('') : ''}
                            </div>
                            ${gcScoreHtml ? `<div style="margin-top:6px;">${gcScoreHtml}</div>` : ''}
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                            <span class="match-status ${m.status}" style="white-space:nowrap;">${statusLabel}</span>
                            ${isClosed ? `<button class="btn btn-small" onclick="finishMatch('${matchId}')" style="background:rgba(76,175,80,0.15);color:var(--green);border:1px solid rgba(76,175,80,0.4);padding:6px 14px;font-size:12px;border-radius:6px;cursor:pointer;font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:1px;text-transform:uppercase;box-shadow:none;">✅ Finalizar</button>` : ''}
                            ${m.wasFinished && !isStaff ? '' : `<button class="btn btn-danger btn-small" onclick="deleteMatch('${matchId}')" style="padding:5px 8px;font-size:11px;min-width:0;" title="Excluir">🗑️</button>`}
                        </div>
                    </div>

                    <!-- Actions -->
                    ${isOpen ? `
                    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                        <button class="btn btn-primary btn-small" onclick="startVoting('${matchId}')" ${m.players.length !== 10 ? 'disabled title="Precisa de 10 jogadores"' : ''}>🗳️ Iniciar Votação</button>
                        <button class="btn btn-secondary btn-small" onclick="editMatchPlayers('${matchId}')">✏️ Editar Jogadores</button>
                    </div>
                    <div style="margin-top:8px;font-size:12px;color:var(--text-dim);">
                        👥 <strong>${m.players.length}/10</strong> — ${m.players.map(p => p.name).join(', ')}
                    </div>
                    ` : m.status === 'voting' ? `
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <button class="btn btn-primary btn-small" onclick="closeVotingAndBalance('${matchId}')">🏆 Encerrar & Balancear</button>
                        <button class="btn btn-secondary btn-small" onclick="viewVoteDetails('${matchId}')">👁️ Ver Votos</button>
                        ${isStaff ? `<button class="btn btn-secondary btn-small" onclick="viewVoteLog('${matchId}')">📜 Log</button>` : ''}
                        <button class="btn btn-secondary btn-small" onclick="editMatchPlayers('${matchId}')">✏️ Jogadores</button>
                    </div>
                    ` : isTeamVote ? `
                    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                        <button class="btn btn-secondary btn-small" onclick="viewMatchResult('${matchId}')">📋 Equipes</button>
                        ${isStaff ? `<button class="btn btn-secondary btn-small" onclick="viewVoteLog('${matchId}')">📜 Log</button>` : ''}
                        <span style="width:1px;height:20px;background:rgba(255,255,255,0.1);margin:0 2px;"></span>
                        <button class="btn btn-primary btn-small" onclick="forceConfirmTeams('${matchId}')">✅ Confirmar</button>
                        <button class="btn btn-secondary btn-small" onclick="forceResortTeams('${matchId}')">🔄 Re-sort</button>
                        <button class="btn btn-secondary btn-small" onclick="reopenVoting('${matchId}')">↩️ Reabrir</button>
                    </div>
                    <div id="teamVoteProgress-${matchId}" style="margin-top:8px;font-size:12px;color:var(--text-dim);"></div>
                    ` : isClosed ? `
                    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                        <button class="btn btn-secondary btn-small" onclick="viewMatchResult('${matchId}')">📋 Equipes</button>
                        ${hasGC ? `<button class="btn btn-secondary btn-small" onclick="viewGCStats('${matchId}')">📊 Resultado</button>` : ''}
                        ${isStaff ? `<button class="btn btn-secondary btn-small" onclick="viewVoteLog('${matchId}')">📜 Log</button>` : ''}
                        <span style="width:1px;height:20px;background:rgba(255,255,255,0.1);margin:0 2px;"></span>
                        <button class="btn btn-secondary btn-small" id="vodBtn-${matchId}" onclick="addVodRow('${matchId}')">📹 VOD</button>
                        <button class="btn btn-secondary btn-small" onclick="reopenVoting('${matchId}')">🔄 Reabrir Votação</button>
                        <button class="btn btn-secondary btn-small" onclick="openGCImport('${matchId}')">📊 Add Partida GC${hasGC && m.gcStats && m.gcStats.length > 0 && m.gcStats[0].teamScore == null ? ' ⚠️' : ''}</button>
                    </div>
                    <div id="vodNewInputs-${matchId}" style="margin-top:6px;"></div>
                    ` : `
                    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                        <button class="btn btn-secondary btn-small" onclick="viewMatchResult('${matchId}')">📋 Equipes</button>
                        ${hasGC ? `<button class="btn btn-secondary btn-small" onclick="viewGCStats('${matchId}')">📊 Resultado</button>` : ''}
                        <span style="width:1px;height:20px;background:rgba(255,255,255,0.1);margin:0 2px;"></span>
                        <button class="btn btn-secondary btn-small" onclick="reopenMatch('${matchId}')">🔓 Editar Confronto</button>
                    </div>
                    `}
                </div>
            `;
        }
        el.innerHTML = html;

        // Load team vote progress for team_vote matches
        snap.docs.forEach(doc => {
            const m = doc.data();
            if (m.status === 'team_vote') {
                const mid = doc.id;
                db.collection('matches').doc(mid).collection('teamVotes').get().then(tvSnap => {
                    const progressEl = document.getElementById(`teamVoteProgress-${mid}`);
                    if (!progressEl) return;
                    let keepCount = 0, resortCount = 0;
                    tvSnap.docs.forEach(d => { if (d.data().vote === 'keep') keepCount++; else resortCount++; });
                    progressEl.innerHTML = `👍 ${keepCount} manter | 👎 ${resortCount} re-sort | Total: ${keepCount + resortCount} votos`;
                });
            }
        });
    } catch (e) {
        el.innerHTML = `<p style="color:var(--red)">Erro: ${e.message}</p>`;
    }
}

async function deleteMatch(matchId) {
    // Block non-staff from deleting matches that were finished
    if (!isStaff) {
        const mDoc = await db.collection('matches').doc(matchId).get();
        if (mDoc.exists && mDoc.data().wasFinished) {
            toast('Apenas staff pode excluir partidas finalizadas!', 'error');
            return;
        }
    }
    if (!confirm('Excluir esta partida e todos os votos?')) return;
    try {
        // Delete votes and teamVotes subcollections
        const votesSnap = await db.collection('matches').doc(matchId).collection('votes').get();
        const teamVotesSnap = await db.collection('matches').doc(matchId).collection('teamVotes').get();
        const batch = db.batch();
        votesSnap.docs.forEach(d => batch.delete(d.ref));
        teamVotesSnap.docs.forEach(d => batch.delete(d.ref));
        batch.delete(db.collection('matches').doc(matchId));
        await batch.commit();
        toast('Partida excluída!', 'success');
        loadAdminMatches();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

async function reopenVoting(matchId) {
    if (!confirm('Tem certeza que quer reabrir a votação? Os times serão refeitos ao encerrar novamente.')) return;
    try {
        // Clear teamVotes subcollection
        const tvSnap = await db.collection('matches').doc(matchId).collection('teamVotes').get();
        if (!tvSnap.empty) {
            const batch = db.batch();
            tvSnap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
        localStorage.removeItem(`teamVoted_${matchId}`);

        await db.collection('matches').doc(matchId).update({
            status: 'voting',
            teamVoteRound: firebase.firestore.FieldValue.delete(),
            playersWithLevels: firebase.firestore.FieldValue.delete()
        });
        toast('Votação reaberta!', 'success');
        loadAdminMatches();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

async function finishMatch(matchId) {
    if (!confirm('Finalizar esta partida? Ela ficará travada (pode reabrir depois se precisar).')) return;
    try {
        await db.collection('matches').doc(matchId).update({ status: 'finished', wasFinished: true });
        toast('✅ Partida finalizada!', 'success');
        loadAdminMatches();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

async function reopenMatch(matchId) {
    if (!confirm('Reabrir esta partida para edição?')) return;
    try {
        await db.collection('matches').doc(matchId).update({ status: 'closed' });
        toast('🔓 Partida reaberta para edição.', 'success');
        loadAdminMatches();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

// ── Start Voting (open → voting) ──
async function startVoting(matchId) {
    try {
        const doc = await db.collection('matches').doc(matchId).get();
        const m = doc.data();
        if (m.players.length !== 10) {
            toast('Precisa de exatamente 10 jogadores para iniciar a votação!', 'error');
            return;
        }
        await db.collection('matches').doc(matchId).update({ status: 'voting' });
        toast('🗳️ Votação iniciada!', 'success');
        loadAdminMatches();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

// ── Edit Match Players ──
async function editMatchPlayers(matchId) {
    try {
        const matchDoc = await db.collection('matches').doc(matchId).get();
        const match = matchDoc.data();
        const currentPlayerIds = match.players.map(p => p.id);

        if (match.status === 'voting') {
            const votesSnap = await db.collection('matches').doc(matchId).collection('votes').get();
            if (votesSnap.size > 0 && !confirm(`Existem ${votesSnap.size} votos. Editar jogadores limpará todos os votos. Continuar?`)) return;
        }

        const overlay = document.getElementById('editModal');
        editModalOriginalHTML = overlay.querySelector('.modal-box').innerHTML;
        overlay.querySelector('.modal-box').innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <div class="card-title" style="margin:0;">✏️ Editar Jogadores — ${match.name}</div>
                <button class="modal-close" onclick="closeEditModal()">&times;</button>
            </div>
            <div class="selection-counter" style="margin-bottom:12px;"><span class="count" id="editMatchCount">${currentPlayerIds.length}</span> / 10 jogadores</div>
            <div style="position:relative;margin-bottom:12px;">
                <input type="text" id="editMatchFilter" placeholder="🔍 Filtrar jogador..." oninput="filterEditMatchPlayers()" style="width:100%;padding:10px 12px;background:var(--dark);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:var(--text);font-size:13px;">
            </div>
            <div id="editMatchPlayerGrid" class="player-selection-grid" style="max-height:400px;overflow-y:auto;"></div>
            <button class="btn btn-primary" id="saveEditMatchBtn" onclick="saveEditMatchPlayers('${matchId}')" style="margin-top:16px;width:100%;" ${currentPlayerIds.length < 1 ? 'disabled' : ''}>💾 Salvar Jogadores</button>
        `;

        document.getElementById('editMatchPlayerGrid').innerHTML = players.map(p => `
            <div class="player-selector ${currentPlayerIds.includes(p.id) ? 'selected' : ''}" id="editSel-${p.id}" onclick="toggleEditMatchPlayer('${p.id}')" data-name="${p.name.toLowerCase()}">
                <input type="checkbox" id="editChk-${p.id}" ${currentPlayerIds.includes(p.id) ? 'checked' : ''}>
                <div class="player-name">${p.name}</div>
                <div class="player-meta">
                    <span class="badge badge-role">${p.role}</span>
                </div>
            </div>
        `).join('');

        window._editMatchSelected = [...currentPlayerIds];
        window._editMatchStatus = match.status;
        overlay.classList.add('active');
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

function toggleEditMatchPlayer(id) {
    const sel = window._editMatchSelected;
    const idx = sel.indexOf(id);
    if (idx === -1) {
        if (sel.length >= 10) { toast('Máximo 10 jogadores!', 'error'); return; }
        sel.push(id);
    } else {
        sel.splice(idx, 1);
    }
    const el = document.getElementById(`editSel-${id}`);
    const chk = document.getElementById(`editChk-${id}`);
    if (el) el.classList.toggle('selected', sel.includes(id));
    if (chk) chk.checked = sel.includes(id);
    const countEl = document.getElementById('editMatchCount');
    if (countEl) countEl.textContent = sel.length;
    const btn = document.getElementById('saveEditMatchBtn');
    if (btn) btn.disabled = sel.length < 1;
}

function filterEditMatchPlayers() {
    const q = (document.getElementById('editMatchFilter')?.value || '').toLowerCase();
    document.querySelectorAll('#editMatchPlayerGrid .player-selector').forEach(el => {
        el.style.display = (el.dataset.name || '').includes(q) ? '' : 'none';
    });
}

async function saveEditMatchPlayers(matchId) {
    const selected = window._editMatchSelected;
    if (selected.length < 1) return;
    const matchPlayers = selected.map(id => {
        const p = players.find(pl => pl.id === id);
        return { id: p.id, name: p.name, role: p.role, duo: p.duo || '', playstyle: p.playstyle || 'Normal' };
    });
    try {
        if (window._editMatchStatus === 'voting') {
            const votesSnap = await db.collection('matches').doc(matchId).collection('votes').get();
            if (!votesSnap.empty) {
                const batch = db.batch();
                votesSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
        }
        await db.collection('matches').doc(matchId).update({ players: matchPlayers });
        toast('✅ Jogadores atualizados!', 'success');
        closeEditModal();
        loadAdminMatches();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

async function addVodRow(matchId) {
    const inputsContainer = document.getElementById(`vodNewInputs-${matchId}`);
    const vodBtn = document.getElementById(`vodBtn-${matchId}`);
    // Toggle: if already open, close it
    if (inputsContainer.children.length > 0) {
        inputsContainer.innerHTML = '';
        if (vodBtn) { vodBtn.style.cssText = ''; vodBtn.textContent = '📹 VOD'; }
        return;
    }
    // Mark button as active
    if (vodBtn) {
        vodBtn.style.cssText = 'background:rgba(76,175,80,0.15);color:var(--green);border:1px solid rgba(76,175,80,0.4);';
        vodBtn.textContent = '📹 VOD ▲';
    }
    // Fetch existing VODs
    const doc = await db.collection('matches').doc(matchId).get();
    const m = doc.data();
    const existing = m.vodUrls || (m.vodUrl ? [m.vodUrl] : []);

    let html = '';
    // Show existing VODs
    existing.forEach((url, i) => {
        html += `<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
            <a href="${url}" target="_blank" style="flex:1;color:var(--green);font-size:12px;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📹 VOD ${existing.length > 1 ? (i+1) : ''} — ${url}</a>
            <button class="btn btn-danger btn-small" onclick="removeVod('${matchId}', ${i})" style="padding:4px 8px;font-size:11px;min-width:0;" title="Remover">✕</button>
        </div>`;
    });
    // Add new VOD input
    html += `<div data-vod-new style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
        <input type="text" value="" placeholder="Cole o link da VOD (YouTube)" style="flex:1;min-width:180px;padding:6px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:var(--text);font-size:16px;" class="vod-new-input">
        <button class="btn btn-primary btn-small" onclick="saveNewVod('${matchId}', this.parentElement)" style="padding:4px 10px;font-size:11px;white-space:nowrap;">Salvar</button>
    </div>`;
    inputsContainer.innerHTML = html;
    inputsContainer.querySelector('.vod-new-input').focus();
}

async function saveNewVod(matchId, rowEl) {
    const input = rowEl.querySelector('input');
    const url = input.value.trim();
    if (!url) { toast('Cole um link de VOD.', 'error'); return; }
    try {
        const doc = await db.collection('matches').doc(matchId).get();
        const m = doc.data();
        const existing = m.vodUrls || (m.vodUrl ? [m.vodUrl] : []);
        const urls = [...existing, url];
        await db.collection('matches').doc(matchId).update({
            vodUrls: urls,
            vodUrl: urls[0]
        });
        toast('📹 VOD salva!', 'success');
        loadAdminMatches();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

async function removeVod(matchId, vodIndex) {
    if (!confirm('Remover esta VOD?')) return;
    try {
        const doc = await db.collection('matches').doc(matchId).get();
        const m = doc.data();
        const existing = m.vodUrls || (m.vodUrl ? [m.vodUrl] : []);
        existing.splice(vodIndex, 1);
        await db.collection('matches').doc(matchId).update({
            vodUrls: existing,
            vodUrl: existing.length > 0 ? existing[0] : firebase.firestore.FieldValue.delete()
        });
        toast('📹 VOD removida.', 'success');
        loadAdminMatches();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

async function showOutdatedMatches() {
    try {
        const snap = await db.collection('matches').orderBy('createdAt', 'desc').get();
        const outdated = [];
        snap.docs.forEach(doc => {
            const m = doc.data();
            if (m.gcStats && m.gcStats.length > 0 && m.gcStats[0].teamScore == null) {
                outdated.push({ id: doc.id, name: m.name, playerCount: m.gcStats.length, matchCount: m.gcMatchCount || 1 });
            }
        });

        const overlay = document.getElementById('editModal');
        if (outdated.length === 0) {
            overlay.querySelector('.modal-box').innerHTML = `
                <div class="card-title">
                    <span>Stats Desatualizadas</span>
                    <button class="modal-close" onclick="closeEditModal()">&times;</button>
                </div>
                <p style="color:var(--green);font-size:14px;">Todas as partidas estão com dados atualizados (v4).</p>
            `;
            overlay.classList.add('active');
            return;
        }

        let html = `
            <div class="card-title">
                <span>⚠️ ${outdated.length} partida(s) com stats v3</span>
                <button class="modal-close" onclick="closeEditModal()">&times;</button>
            </div>
            <p style="color:var(--text-dim);font-size:13px;margin-bottom:14px;">
                Essas partidas foram importadas com o snippet antigo (sem placar/time).<br>
                Para cada uma: abra a partida na GC → rode o snippet v4 → reimporte.
            </p>
            <div style="display:flex;flex-direction:column;gap:8px;">
        `;
        outdated.forEach(m => {
            html += `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(255,214,0,0.06);border:1px solid rgba(255,214,0,0.15);border-radius:8px;gap:8px;flex-wrap:wrap;">
                    <div>
                        <span style="font-family:'Rajdhani',sans-serif;font-weight:700;color:var(--yellow);font-size:14px;">${m.name}</span>
                        <span style="color:var(--text-dim);font-size:11px;margin-left:6px;">(${m.playerCount} jogadores, ${m.matchCount} GC match${m.matchCount > 1 ? 'es' : ''})</span>
                    </div>
                    <div style="display:flex;gap:6px;">
                        <button class="btn btn-primary btn-small" onclick="closeEditModal();openGCImport('${m.id}')" style="font-size:11px;">📊 Reimportar</button>
                        <button class="btn btn-danger btn-small" onclick="clearGCStatsForMatch('${m.id}','${m.name}')" style="font-size:11px;">🗑️ Limpar Stats</button>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        overlay.querySelector('.modal-box').innerHTML = html;
        overlay.classList.add('active');
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

async function clearGCStatsForMatch(matchId, matchName) {
    if (!confirm(`Limpar stats GC de "${matchName}"? Você precisará reimportar depois.`)) return;
    try {
        await db.collection('matches').doc(matchId).update({
            gcStats: firebase.firestore.FieldValue.delete(),
            gcRawJsons: firebase.firestore.FieldValue.delete(),
            gcMatchCount: firebase.firestore.FieldValue.delete(),
            gcMatchIds: firebase.firestore.FieldValue.delete()
        });
        toast(`Stats GC de "${matchName}" removidas!`, 'success');
        showOutdatedMatches();
        loadAdminMatches();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

async function viewVoteDetails(matchId) {
    try {
        const matchDoc = await db.collection('matches').doc(matchId).get();
        const match = matchDoc.data();
        const votesSnap = await db.collection('matches').doc(matchId).collection('votes').get();

        if (votesSnap.empty) {
            toast('Nenhum voto ainda.', 'error');
            return;
        }

        const averages = computeAverages(match.players, votesSnap.docs);

        let html = '<div class="card-title">Médias Atuais</div><div class="avg-grid">';
        match.players.forEach(p => {
            const info = averages[p.id] || { avg: 0, count: 0, total: 0, discarded: 0 };
            const discardedHtml = info.discarded > 0
                ? `<span style="color:var(--red);font-size:11px;margin-left:4px;">⚠️ ${info.discarded} ignorado${info.discarded > 1 ? 's' : ''}</span>`
                : '';
            html += `
                <div class="avg-row">
                    <div>
                        <span class="name">${p.name}</span>
                        <span class="vote-count-small">(${info.count}/${info.total} votos)</span>
                        ${discardedHtml}
                    </div>
                    <span class="avg-val">${info.avg.toFixed(1)}</span>
                </div>
            `;
        });
        html += '</div>';

        // Show in a simple modal
        const overlay = document.getElementById('editModal');
        overlay.querySelector('.modal-box').innerHTML = `
            <div class="card-title">
                <span>Detalhes dos Votos — ${match.name}</span>
                <button class="modal-close" onclick="closeEditModal()">&times;</button>
            </div>
            ${html}
        `;
        overlay.classList.add('active');
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

async function viewVoteLog(matchId) {
    try {
        const matchDoc = await db.collection('matches').doc(matchId).get();
        const match = matchDoc.data();
        const votesSnap = await db.collection('matches').doc(matchId).collection('votes').get();

        if (votesSnap.empty) {
            toast('Nenhum voto ainda.', 'error');
            return;
        }

        const playerMap = {};
        match.players.forEach(p => { playerMap[p.id] = p.name; });

        let html = `<div style="max-height:70vh;overflow-y:auto;">`;

        votesSnap.docs.forEach((doc, idx) => {
            const data = doc.data();
            const meta = data._meta || {};
            const ip = meta.ip || 'sem registro';
            const time = meta.timestamp ? new Date(meta.timestamp).toLocaleString('pt-BR') : 'sem registro';
            const votedOn = meta.votedOn || '?';
            const skipped = meta.skipped || 0;

            // Build vote list for this voter
            let votesHtml = '';
            match.players.forEach(p => {
                if (data[p.id] !== undefined) {
                    votesHtml += `
                        <div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(255,255,255,0.03);border-radius:4px;margin-bottom:2px;">
                            <span style="color:var(--yellow);font-size:13px;">${p.name}</span>
                            <span style="color:var(--green);font-weight:700;font-family:'Rajdhani',sans-serif;font-size:15px;">${data[p.id]}</span>
                        </div>`;
                } else {
                    votesHtml += `
                        <div style="display:flex;justify-content:space-between;padding:4px 8px;background:rgba(255,255,255,0.02);border-radius:4px;margin-bottom:2px;">
                            <span style="color:var(--text-dim);font-size:13px;">${p.name}</span>
                            <span style="color:var(--text-dim);font-size:12px;font-style:italic;">não votou</span>
                        </div>`;
                }
            });

            html += `
                <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:14px;margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px;">
                        <span style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:16px;color:var(--text);">Voto #${idx + 1}</span>
                        <span style="font-size:11px;color:var(--text-dim);">${skipped > 0 ? `${votedOn} votado${votedOn > 1 ? 's' : ''}, ${skipped} pulado${skipped > 1 ? 's' : ''}` : `${votedOn} votos`}</span>
                    </div>
                    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;font-size:12px;">
                        <span style="color:var(--text-dim);">🌐 <span style="color:var(--text);font-family:monospace;">${ip}</span></span>
                        <span style="color:var(--text-dim);">🕐 ${time}</span>
                    </div>
                    ${votesHtml}
                </div>
            `;
        });

        html += '</div>';

        const overlay = document.getElementById('editModal');
        overlay.querySelector('.modal-box').innerHTML = `
            <div class="card-title">
                <span>📜 Log de Votos — ${match.name} (${votesSnap.size} voto${votesSnap.size > 1 ? 's' : ''})</span>
                <button class="modal-close" onclick="closeEditModal()">&times;</button>
            </div>
            ${html}
        `;
        overlay.classList.add('active');
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

// ╔══════════════════════════════════╗
// ║    CLOSE VOTING & BALANCE       ║
// ╚══════════════════════════════════╝
async function resortTeams(matchId) {
    const matchDoc = await db.collection('matches').doc(matchId).get();
    const match = matchDoc.data();

    // Get players with levels (stored or reconstruct from result)
    let playersWithLevels = match.playersWithLevels;
    if (!playersWithLevels) {
        playersWithLevels = [...match.result.teamA, ...match.result.teamB];
    }

    // Re-run balance
    const newTeams = balanceTeams(playersWithLevels);

    // Clear teamVotes subcollection
    const tvSnap = await db.collection('matches').doc(matchId).collection('teamVotes').get();
    if (!tvSnap.empty) {
        const batch = db.batch();
        tvSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
    }

    // Update match with new teams and increment round
    const currentRound = match.teamVoteRound || 1;
    await db.collection('matches').doc(matchId).update({
        result: newTeams,
        teamVoteRound: currentRound + 1,
        status: 'team_vote'
    });

    localStorage.removeItem(`teamVoted_${matchId}`);
}

async function forceConfirmTeams(matchId) {
    if (!confirm('Forçar confirmação dos times atuais?')) return;
    try {
        await db.collection('matches').doc(matchId).update({ status: 'closed' });
        toast('Times confirmados pelo admin!', 'success');
        loadAdminMatches();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

async function forceResortTeams(matchId) {
    if (!confirm('Forçar novo sorteio de times?')) return;
    try {
        await resortTeams(matchId);
        toast('Times re-sorteados pelo admin!', 'success');
        loadAdminMatches();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

async function closeVotingAndBalance(matchId) {
    try {
        const matchDoc = await db.collection('matches').doc(matchId).get();
        const match = matchDoc.data();
        const votesSnap = await db.collection('matches').doc(matchId).collection('votes').get();

        if (votesSnap.empty) {
            toast('Nenhum voto recebido ainda!', 'error');
            return;
        }

        const averages = computeAverages(match.players, votesSnap.docs);

        // Build players with averaged levels
        const playersWithLevels = match.players.map(p => ({
            ...p,
            currentLevel: averages[p.id] ? Math.round(averages[p.id].avg) : 10
        }));

        // Balance teams
        const teams = balanceTeams(playersWithLevels);

        // Save result and open team confirmation vote
        await db.collection('matches').doc(matchId).update({
            status: 'team_vote',
            result: teams,
            playersWithLevels: playersWithLevels,
            teamVoteRound: 1
        });

        toast('Times sorteados! Votação de confirmação aberta.', 'success');
        loadAdminMatches();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

function computeAverages(matchPlayers, voteDocs) {
    const TOLERANCE = 4;

    // Collect all votes per player
    const allVotes = {};
    matchPlayers.forEach(p => { allVotes[p.id] = []; });

    voteDocs.forEach(voteDoc => {
        const votes = voteDoc.data();
        matchPlayers.forEach(p => {
            if (votes[p.id] !== undefined && p.id !== '_meta') {
                allVotes[p.id].push(votes[p.id]);
            }
        });
    });

    const result = {};
    matchPlayers.forEach(p => {
        const votes = allVotes[p.id];
        if (votes.length === 0) {
            result[p.id] = { avg: 0, count: 0, total: 0, discarded: 0 };
            return;
        }

        // Pass 1: raw average
        const rawAvg = votes.reduce((s, v) => s + v, 0) / votes.length;

        // Pass 2: keep only votes within tolerance
        const valid = votes.filter(v => Math.abs(v - rawAvg) <= TOLERANCE);

        // If all votes got discarded (edge case), use all of them
        const finalVotes = valid.length > 0 ? valid : votes;
        const avg = finalVotes.reduce((s, v) => s + v, 0) / finalVotes.length;

        result[p.id] = {
            avg: avg,
            count: finalVotes.length,
            total: votes.length,
            discarded: votes.length - finalVotes.length
        };
    });
    return result;
}

function balanceTeams(players) {
    let bestTeams = null;
    let bestDiff = Infinity;

    for (let attempt = 0; attempt < 2000; attempt++) {
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        const teamA = shuffled.slice(0, 5);
        const teamB = shuffled.slice(5);

        const sumA = teamA.reduce((s, p) => s + p.currentLevel, 0);
        const sumB = teamB.reduce((s, p) => s + p.currentLevel, 0);
        const diff = Math.abs(sumA - sumB);

        // Duo bonus (keeps duos together)
        let bonus = 0;
        teamA.forEach(p => {
            if (p.duo && teamA.some(t => t.id === p.duo)) bonus -= 1;
        });
        teamB.forEach(p => {
            if (p.duo && teamB.some(t => t.id === p.duo)) bonus -= 1;
        });

        // Playstyle penalty (espelhar estilos entre os times)
        const stylesA = { Agressivo: 0, Normal: 0, Lento: 0 };
        const stylesB = { Agressivo: 0, Normal: 0, Lento: 0 };
        teamA.forEach(p => { stylesA[p.playstyle || 'Normal']++; });
        teamB.forEach(p => { stylesB[p.playstyle || 'Normal']++; });
        const stylePenalty = (
            Math.abs(stylesA.Agressivo - stylesB.Agressivo) +
            Math.abs(stylesA.Normal - stylesB.Normal) +
            Math.abs(stylesA.Lento - stylesB.Lento)
        ) * 1.5;

        const score = diff + bonus + stylePenalty;

        if (score < bestDiff) {
            bestDiff = score;
            bestTeams = { teamA, teamB, sumA, sumB };
        }
    }

    return bestTeams || {
        teamA: players.slice(0, 5),
        teamB: players.slice(5),
        sumA: players.slice(0, 5).reduce((s, p) => s + p.currentLevel, 0),
        sumB: players.slice(5).reduce((s, p) => s + p.currentLevel, 0)
    };
}

// ╔══════════════════════════════════╗
// ║        VIEW MATCH RESULT        ║
// ╚══════════════════════════════════╝
async function viewMatchResult(matchId) {
    try {
        const doc = await db.collection('matches').doc(matchId).get();
        const match = doc.data();
        if (!match.result) {
            toast('Resultado não disponível.', 'error');
            return;
        }
        showResultModal(match.name, match.result);
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

function showResultModal(title, teams) {
    const diff = Math.abs(teams.sumA - teams.sumB);
    const overlay = document.getElementById('editModal');
    overlay.querySelector('.modal-box').innerHTML = `
        <div class="card-title">
            <span>🏆 ${title}</span>
            <button class="modal-close" onclick="closeEditModal()">&times;</button>
        </div>
        <div class="diff-display ${diff <= 2 ? 'balanced' : 'unbalanced'}">
            Diferença: <span class="diff-value">${diff}</span> ponto(s)
            ${diff <= 2 ? '<br><span style="color:var(--green);font-size:14px;">✅ Times Balanceados!</span>' : ''}
        </div>
        <div class="teams-grid">
            <div class="team-card ct">
                <div class="team-label">Time A</div>
                ${teams.teamA.map(p => `
                    <div class="team-player">
                        <span class="team-player-name">${p.name}</span>
                        <div class="team-player-info">
                            <span class="badge badge-role">${p.role}</span>
                            <span class="badge badge-level">Nv.${p.currentLevel != null ? p.currentLevel : '?'}</span>
                        </div>
                    </div>
                `).join('')}
                <div class="team-total" style="color:var(--ct-blue)">Total: ${teams.sumA}</div>
            </div>
            <div class="team-card tr">
                <div class="team-label">Time B</div>
                ${teams.teamB.map(p => `
                    <div class="team-player">
                        <span class="team-player-name">${p.name}</span>
                        <div class="team-player-info">
                            <span class="badge badge-role">${p.role}</span>
                            <span class="badge badge-level">Nv.${p.currentLevel != null ? p.currentLevel : '?'}</span>
                        </div>
                    </div>
                `).join('')}
                <div class="team-total" style="color:var(--tr-gold)">Total: ${teams.sumB}</div>
            </div>
        </div>
        <div style="text-align:center;margin-top:16px;">
            <button class="btn btn-primary btn-small" onclick="copyResultWhatsApp('${encodeURIComponent(JSON.stringify({name:title,teams}))}')">📱 Copiar p/ WhatsApp</button>
        </div>
    `;
    overlay.classList.add('active');
}

function copyResultWhatsApp(encoded) {
    const { name, teams } = JSON.parse(decodeURIComponent(encoded));
    let text = `🎮 *${name}* 🎮\n\n`;
    text += `💙 *TIME A* (${teams.sumA} pts)\n`;
    teams.teamA.forEach(p => text += `• ${p.name} (${p.role} - Nv.${p.currentLevel})\n`);
    text += `\n🧡 *TIME B* (${teams.sumB} pts)\n`;
    teams.teamB.forEach(p => text += `• ${p.name} (${p.role} - Nv.${p.currentLevel})\n`);
    text += `\n📊 Diferença: ${Math.abs(teams.sumA - teams.sumB)} pts`;
    text += `\n\n_Bom jogo! GLHF!_ 🎯`;

    navigator.clipboard.writeText(text).then(() => toast('Copiado!', 'success'));
}

