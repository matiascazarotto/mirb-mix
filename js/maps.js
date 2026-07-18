// ╔══════════════════════════════════════════════════════════╗
// ║   MAPAS — Votação (Top 3) + Rotação automática            ║
// ╚══════════════════════════════════════════════════════════╝
// Dois jeitos de decidir o mapa de uma partida, controlados pela staff:
//   1. Votação "Top 3" — quem votou nos níveis escolhe 3 favoritos (3/2/1 pts).
//   2. Rotação — sorteio sem repetir até esgotar o pool, aí reseta.
// Config em config/mapPool ({maps:[{id,name,emoji,active}]}) e config/mapRotation ({played:[]}).
// Campos na partida: chosenMap {id,name,emoji}, mapSource 'vote'|'rotation', mapVote 'open'.

// Pool padrão (usado se config/mapPool ainda não existir; staff edita em Admin › Outros)
const DEFAULT_MAP_POOL = [
    { id: 'anubis',      name: 'Anubis',      emoji: '🏺', active: true },
    { id: 'ancient',     name: 'Ancient',     emoji: '🗿', active: true },
    { id: 'dust2',       name: 'Dust II',     emoji: '🌵', active: true },
    { id: 'inferno',     name: 'Inferno',     emoji: '🔥', active: true },
    { id: 'mirage',      name: 'Mirage',      emoji: '🏜️', active: true },
    { id: 'nuke',        name: 'Nuke',        emoji: '☢️', active: true },
    { id: 'cache',       name: 'Cache',       emoji: '🏭', active: true },
    { id: 'train',       name: 'Train',       emoji: '🚂', active: false },
    { id: 'overpass',    name: 'Overpass',    emoji: '🌉', active: false },
    { id: 'cobblestone', name: 'Cobblestone', emoji: '🏰', active: false }
];

// Pool e rotação ficam em config/settings (doc que a staff já grava nos toggles) para
// reaproveitar as permissões existentes — evita depender de regras para docs novos.
async function loadMapPool() {
    try {
        const s = await Store.getSettings();
        if (Array.isArray(s.mapPool) && s.mapPool.length) return s.mapPool;
    } catch (e) {}
    return DEFAULT_MAP_POOL.map(m => ({ ...m }));
}

function getActiveMaps(maps) {
    return (maps || []).filter(m => m.active !== false);
}

async function isMapSelectEnabled() {
    try {
        const s = await Store.getSettings();
        if (s.mapSelectEnabled === false) return false;
    } catch (e) {}
    return true;
}

async function loadMapRotation() {
    try {
        const s = await Store.getSettings();
        if (Array.isArray(s.mapPlayed)) return s.mapPlayed;
    } catch (e) {}
    return [];
}

async function _clearMapVotes(matchId) {
    const snap = await db.collection('matches').doc(matchId).collection('mapVotes').get();
    if (!snap.empty) {
        const batch = db.batch();
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
}

// ── Rotação: sorteia o próximo mapa (sem repetir; reseta ao esgotar) ──
async function drawNextMap(matchId) {
    try {
        const maps = await loadMapPool();
        const active = getActiveMaps(maps);
        if (active.length === 0) { toast('Nenhum mapa ativo na lista!', 'error'); return; }

        const matchDoc = await db.collection('matches').doc(matchId).get();
        const md = matchDoc.exists ? matchDoc.data() : {};
        const currentChosen = md.chosenMap;

        // Não permite re-sortear: se o mapa atual já veio de sorteio, exige remover antes (🗑️)
        if (currentChosen && md.mapSource === 'rotation') {
            toast('Mapa já sorteado. Remova (🗑️) antes de sortear de novo.', 'error');
            return;
        }

        let played = (await loadMapRotation()).filter(id => active.some(m => m.id === id));
        let remaining = active.filter(m => !played.includes(m.id));
        if (remaining.length === 0) {
            // Ciclo completo → reseta e recomeça
            await db.collection('config').doc('settings').set({ mapPlayed: [] }, { merge: true });
            remaining = active.slice();
        }
        // Evita repetir o mapa atual num re-sorteio, se houver alternativa
        if (currentChosen && remaining.length > 1) {
            remaining = remaining.filter(m => m.id !== currentChosen.id);
        }
        const pick = remaining[Math.floor(Math.random() * remaining.length)];

        // Só limpa votos se havia uma votação aberta (evita ler a subcoleção à toa)
        if (md.mapVote === 'open') await _clearMapVotes(matchId);
        await db.collection('matches').doc(matchId).update({
            chosenMap: { id: pick.id, name: pick.name, emoji: pick.emoji || '🗺️' },
            mapSource: 'rotation',
            mapVote: firebase.firestore.FieldValue.delete()
        });
        toast(`🎲 Mapa sorteado: ${pick.emoji || ''} ${pick.name}`, 'success');
        loadAdminMatches();
    } catch (e) {
        toast('Erro ao sortear mapa: ' + e.message, 'error');
    }
}

// ── Rotação: marca "jogado" ao finalizar a partida (só mapas vindos de sorteio) ──
async function markMapPlayed(matchId) {
    try {
        const doc = await db.collection('matches').doc(matchId).get();
        if (!doc.exists) return;
        const m = doc.data();
        if (m.mapSource === 'rotation' && m.chosenMap && m.chosenMap.id) {
            await db.collection('config').doc('settings')
                .set({ mapPlayed: firebase.firestore.FieldValue.arrayUnion(m.chosenMap.id) }, { merge: true });
        }
    } catch (e) { /* silencioso — não bloqueia a finalização */ }
}

async function resetMapRotation() {
    if (!confirm('Resetar a rotação? Todos os mapas voltam a ficar disponíveis para sorteio.')) return;
    try {
        await db.collection('config').doc('settings').set({ mapPlayed: [] }, { merge: true });
        toast('🔄 Rotação de mapas resetada!', 'success');
        loadMapPoolEditor();
    } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

// ── Votação Top 3: staff abre/cancela/força encerramento ──
async function openMapVote(matchId) {
    try {
        await _clearMapVotes(matchId);
        await db.collection('matches').doc(matchId).update({
            mapVote: 'open',
            mapSource: firebase.firestore.FieldValue.delete()
        });
        toast('🗺️ Votação de mapa aberta!', 'success');
        loadAdminMatches();
    } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

async function cancelMapVote(matchId) {
    try {
        await db.collection('matches').doc(matchId).update({ mapVote: firebase.firestore.FieldValue.delete() });
        await _clearMapVotes(matchId);
        toast('Votação de mapa cancelada.', 'success');
        loadAdminMatches();
    } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

async function clearChosenMap(matchId) {
    try {
        await db.collection('matches').doc(matchId).update({
            chosenMap: firebase.firestore.FieldValue.delete(),
            mapSource: firebase.firestore.FieldValue.delete()
        });
        toast('Mapa removido.', 'success');
        loadAdminMatches();
    } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

// Pontuação: 1º=3, 2º=2, 3º=1
function tallyMapVotes(docs) {
    const points = {}, counts = {};
    docs.forEach(d => {
        const top3 = d.data().top3 || [];
        top3.forEach((id, i) => {
            const pts = 3 - i;
            if (pts <= 0) return;
            points[id] = (points[id] || 0) + pts;
            counts[id] = (counts[id] || 0) + 1;
        });
    });
    return { points, counts };
}

function rankMapVotes(docs, maps) {
    const { points, counts } = tallyMapVotes(docs);
    const rows = getActiveMaps(maps).map(m => ({ map: m, points: points[m.id] || 0, count: counts[m.id] || 0 }));
    rows.sort((a, b) => b.points - a.points || b.count - a.count);
    return rows;
}

// Encerra a votação e grava o mapa vencedor. silent=true evita toasts (fechamento automático).
async function closeMapVote(matchId, silent) {
    const snap = await db.collection('matches').doc(matchId).collection('mapVotes').get();
    const maps = await loadMapPool();
    const rows = rankMapVotes(snap.docs, maps).filter(r => r.points > 0);
    if (rows.length === 0) {
        await db.collection('matches').doc(matchId).update({ mapVote: firebase.firestore.FieldValue.delete() });
        if (!silent) toast('Votação encerrada sem votos.', 'error');
        return null;
    }
    // Desempate entre os de maior pontuação → aleatório
    const top = rows[0].points;
    const tied = rows.filter(r => r.points === top);
    const winner = tied[Math.floor(Math.random() * tied.length)].map;
    await db.collection('matches').doc(matchId).update({
        chosenMap: { id: winner.id, name: winner.name, emoji: winner.emoji || '🗺️' },
        mapSource: 'vote',
        mapVote: firebase.firestore.FieldValue.delete()
    });
    if (!silent) toast(`🗺️ Mapa escolhido: ${winner.emoji || ''} ${winner.name}${tied.length > 1 ? ' (desempate)' : ''}`, 'success');
    return winner;
}

async function forceCloseMapVote(matchId) {
    try {
        await closeMapVote(matchId, false);
        loadAdminMatches();
    } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

// Fecha automaticamente quando todos os elegíveis (quem votou nos níveis) já escolheram o mapa
async function checkMapVoteThreshold(matchId) {
    const matchDoc = await db.collection('matches').doc(matchId).get();
    if (!matchDoc.exists || matchDoc.data().mapVote !== 'open') return;

    const mvSnap = await db.collection('matches').doc(matchId).collection('mapVotes').get();
    const voters = new Set();
    mvSnap.docs.forEach(d => { const meta = d.data()._meta; if (meta && meta.deviceId) voters.add(meta.deviceId); });

    const lvSnap = await db.collection('matches').doc(matchId).collection('votes').get();
    const eligible = new Set();
    lvSnap.docs.forEach(d => { const meta = d.data()._meta; if (meta && meta.deviceId) eligible.add(meta.deviceId); });

    if (eligible.size > 0 && voters.size >= eligible.size) {
        await closeMapVote(matchId, true);
        toast('🗺️ Todos votaram! Mapa definido.', 'success');
    }
}

// ── Votação Top 3: seleção do jogador (client-side) ──
let _mapVoteSelection = {}; // matchId → [mapId,...] em ordem de preferência

function toggleMapPick(matchId, mapId) {
    if (!_mapVoteSelection[matchId]) _mapVoteSelection[matchId] = [];
    const sel = _mapVoteSelection[matchId];
    const idx = sel.indexOf(mapId);
    if (idx !== -1) {
        sel.splice(idx, 1);
    } else {
        if (sel.length >= 3) { toast('Escolha no máximo 3 mapas.', 'error'); return; }
        sel.push(mapId);
    }
    updateMapPickUI(matchId);
}

function updateMapPickUI(matchId) {
    const sel = _mapVoteSelection[matchId] || [];
    document.querySelectorAll(`[data-map-tile="${matchId}"]`).forEach(tile => {
        const id = tile.getAttribute('data-map-id');
        const rank = sel.indexOf(id);
        const badge = tile.querySelector('.map-rank');
        tile.classList.remove('selected', 'rank-1', 'rank-2', 'rank-3');
        if (rank !== -1) {
            tile.classList.add('selected', 'rank-' + (rank + 1));
            if (badge) badge.textContent = (rank + 1) + 'º';
        } else if (badge) {
            badge.textContent = '';
        }
    });
    const btn = document.getElementById(`mapVoteSubmit-${matchId}`);
    if (btn) {
        btn.disabled = sel.length < 1;
        btn.textContent = sel.length > 0 ? `✅ Confirmar (${sel.length}/3)` : '✅ Confirmar Voto';
    }
}

async function submitMapVote(matchId) {
    const sel = (_mapVoteSelection[matchId] || []).slice(0, 3);
    if (sel.length < 1) { toast('Escolha pelo menos 1 mapa!', 'error'); return; }
    if (localStorage.getItem(`mapVoted_${matchId}`)) { toast('Você já votou no mapa!', 'error'); return; }
    try {
        const matchDoc = await db.collection('matches').doc(matchId).get();
        const match = matchDoc.data();
        if (!match || match.mapVote !== 'open') { toast('Votação de mapa encerrada!', 'error'); loadVotePage(); return; }

        const voter = await getVoterDeviceId();
        if (await isIPBlocked(voter.ip, 'mapVote', voter.fingerprint)) { toast('Não foi possível votar. Tente novamente mais tarde.', 'error'); return; }

        // Elegibilidade: precisa ter votado nos níveis desta partida
        if (voter.deviceId !== 'unknown_') {
            const levelVote = await db.collection('matches').doc(matchId)
                .collection('votes').where('_meta.deviceId', '==', voter.deviceId).limit(1).get();
            if (levelVote.empty) { toast('Você não votou nos níveis e não pode escolher o mapa!', 'error'); return; }

            const existing = await db.collection('matches').doc(matchId)
                .collection('mapVotes').where('_meta.deviceId', '==', voter.deviceId).limit(1).get();
            if (!existing.empty) {
                localStorage.setItem(`mapVoted_${matchId}`, 'true');
                toast('Você já votou no mapa!', 'error');
                loadVotePage();
                return;
            }
        }

        const voterId = 'mv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        await db.collection('matches').doc(matchId).collection('mapVotes').doc(voterId).set({
            top3: sel,
            _meta: { ip: voter.ip, fingerprint: voter.fingerprint, deviceId: voter.deviceId, timestamp: new Date().toISOString() }
        });

        localStorage.setItem(`mapVoted_${matchId}`, 'true');
        delete _mapVoteSelection[matchId];
        toast('🗺️ Voto de mapa registrado!', 'success');

        // Fechar automático quando todos votam é best-effort: o update do mapa exige staff, então
        // se um votante anônimo completar o placar, a staff encerra no botão. Não falha o voto.
        try { await checkMapVoteThreshold(matchId); } catch (_) {}
        loadVotePage();
    } catch (e) {
        toast('Erro ao votar: ' + e.message, 'error');
    }
}

// ── Render do bloco público de votação de mapa (página Votar) ──
// Retorna { html, ids } — ids alimentam os listeners onSnapshot.
async function buildMapVoteHtml(mapVoteDocs, voter, maps) {
    const activeMaps = getActiveMaps(maps);
    let html = '';
    const ids = [];
    for (const doc of mapVoteDocs) {
        const m = doc.data();
        const matchId = doc.id;

        let isEligible = false;
        if (voter.deviceId !== 'unknown_') {
            const lv = await db.collection('matches').doc(matchId)
                .collection('votes').where('_meta.deviceId', '==', voter.deviceId).limit(1).get();
            isEligible = !lv.empty;
        }
        let alreadyVoted = !!localStorage.getItem(`mapVoted_${matchId}`);
        if (!alreadyVoted && isEligible && voter.deviceId !== 'unknown_') {
            const ex = await db.collection('matches').doc(matchId)
                .collection('mapVotes').where('_meta.deviceId', '==', voter.deviceId).limit(1).get();
            if (!ex.empty) { alreadyVoted = true; localStorage.setItem(`mapVoted_${matchId}`, 'true'); }
        }

        const tiles = activeMaps.map(mp => `
            <div class="map-tile" data-map-tile="${matchId}" data-map-id="${mp.id}" onclick="toggleMapPick('${matchId}','${mp.id}')">
                <span class="map-emoji">${mp.emoji || '🗺️'}</span>
                <span class="map-name">${mp.name}</span>
                <span class="map-rank"></span>
            </div>
        `).join('');

        let body;
        if (activeMaps.length === 0) {
            body = `<div style="text-align:center;padding:16px;color:var(--text-dim);font-size:13px;">Nenhum mapa ativo na lista.</div>`;
        } else if (!isEligible) {
            body = `<div style="text-align:center;padding:16px;color:var(--text-dim);font-size:13px;">⚠️ Você não votou nos níveis desta partida.</div>`;
        } else if (alreadyVoted) {
            body = `<div style="text-align:center;padding:16px;color:var(--green);">✅ Você já votou no mapa!</div>`;
        } else {
            body = `
                <p style="color:var(--text);font-size:13px;margin-bottom:4px;">👉 <strong>Toque nos mapas na ordem que você prefere jogar</strong> — o 1º que tocar é o seu favorito. Pode escolher até 3.</p>
                <p style="color:var(--text-dim);font-size:12px;margin-bottom:12px;">Seu 1º voto vale mais que o 2º, e o 2º mais que o 3º (3, 2 e 1 pontos). No fim, o mapa com mais pontos vence.</p>
                <div class="map-grid">${tiles}</div>
                <button class="btn btn-primary" id="mapVoteSubmit-${matchId}" style="margin-top:14px;width:100%;" disabled onclick="submitMapVote('${matchId}')">✅ Confirmar Voto</button>
            `;
        }

        html += `
            <div class="match-card map_vote">
                <div class="match-header">
                    <div class="match-title">🗺️ Mapa — ${m.name}</div>
                    <span class="match-status map_vote">Votação de Mapa</span>
                </div>
                <div id="mapVoteProgress-${matchId}" style="margin:12px 0;"><div style="text-align:center;color:var(--text-dim);font-size:12px;">Carregando votos...</div></div>
                ${body}
            </div>
        `;
        ids.push(matchId);
    }
    return { html, ids };
}

// Atualiza a apuração ao vivo (chamado pelo onSnapshot em vote.js)
function renderMapVoteProgress(matchId, docs, maps) {
    const el = document.getElementById(`mapVoteProgress-${matchId}`);
    if (!el) return;
    const rows = rankMapVotes(docs, maps).filter(r => r.points > 0);
    const totalVoters = docs.length;
    if (rows.length === 0) {
        el.innerHTML = `<div style="text-align:center;font-size:12px;color:var(--text-dim);">Nenhum voto ainda</div>`;
        return;
    }
    const max = rows[0].points || 1;
    el.innerHTML = `
        <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px;text-align:center;">${totalVoters} voto${totalVoters !== 1 ? 's' : ''} · pontos por mapa</div>
        ${rows.map((r, i) => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <span style="width:82px;font-size:12px;color:${i === 0 ? 'var(--green)' : 'var(--text)'};font-weight:${i === 0 ? 700 : 400};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.map.emoji || ''} ${r.map.name}</span>
                <div style="flex:1;height:14px;background:rgba(255,255,255,0.06);border-radius:7px;overflow:hidden;">
                    <div style="height:100%;width:${Math.round((r.points / max) * 100)}%;background:${i === 0 ? 'linear-gradient(90deg,rgba(0,200,83,0.6),var(--green))' : 'rgba(255,255,255,0.25)'};transition:width 0.4s ease;"></div>
                </div>
                <span style="width:26px;text-align:right;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:13px;color:${i === 0 ? 'var(--green)' : 'var(--text-dim)'};">${r.points}</span>
            </div>
        `).join('')}
    `;
}

// ── Controles de mapa no card do admin (Gerenciar Partidas) ──
function mapControlsHtml(m, matchId) {
    const chosen = m.chosenMap;
    const heading = `<span style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--yellow);">🗺️ Mapa</span>`;
    const sep = `<span style="width:1px;height:18px;background:rgba(255,255,255,0.12);margin:0 2px;"></span>`;

    if (m.mapVote === 'open') {
        return `<div class="map-admin-row">
            ${heading}
            <span style="font-size:12px;color:var(--ct-blue);font-weight:600;">Votação da galera em andamento…</span>
            ${sep}
            <button class="btn btn-primary btn-small" onclick="forceCloseMapVote('${matchId}')" title="Encerra a votação agora e define o mapa mais votado">⏹️ Encerrar &amp; Definir</button>
            <button class="btn btn-secondary btn-small" onclick="cancelMapVote('${matchId}')" title="Cancela a votação sem definir mapa">✖️ Cancelar</button>
        </div>`;
    }

    const isDrawn = chosen && m.mapSource === 'rotation';
    const status = chosen
        ? `<span style="font-size:13px;color:var(--text);font-weight:600;">${chosen.emoji || ''} ${chosen.name} <span style="font-size:10px;color:var(--text-dim);font-weight:400;">(${isDrawn ? 'sorteado' : 'votado'})</span></span>`
        : `<span style="font-size:12px;color:var(--text-dim);">nenhum definido</span>`;

    // Mapa já sorteado não pode ser re-sorteado (evita re-roll): esconde o 🎲, staff remove no 🗑️ antes
    const drawBtn = isDrawn
        ? ''
        : `<button class="btn btn-secondary btn-small" onclick="drawNextMap('${matchId}')" title="Sortear um mapa automaticamente (rotação sem repetir até todos serem jogados)">🎲 Sorteio automático</button>`;

    return `<div class="map-admin-row">
        ${heading}
        ${status}
        ${sep}
        <span style="font-size:11px;color:var(--text-dim);">${chosen ? 'Trocar por:' : 'Definir por:'}</span>
        <button class="btn btn-secondary btn-small" onclick="openMapVote('${matchId}')" title="Abrir votação de mapa: quem votou nos níveis escolhe seu Top 3 e o mais votado vence">🗳️ Votação da galera</button>
        ${drawBtn}
        ${chosen ? `<button class="btn btn-secondary btn-small" onclick="clearChosenMap('${matchId}')" title="${isDrawn ? 'Remover o mapa sorteado (libera novo sorteio)' : 'Remover o mapa definido'}">🗑️</button>` : ''}
    </div>`;
}

// ── Editor da lista de mapas (Admin › Outros) ──
async function loadMapPoolEditor() {
    const el = document.getElementById('mapPoolEditorList');
    if (!el) return;
    try {
        const maps = await loadMapPool();
        const played = await loadMapRotation();
        el.innerHTML = maps.map(m => {
            const isActive = m.active !== false;
            const isPlayed = played.includes(m.id);
            return `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
                <span style="font-size:18px;">${m.emoji || '🗺️'}</span>
                <span style="flex:1;font-size:14px;color:var(--text);">${m.name}${isPlayed ? ' <span style="font-size:10px;color:var(--text-dim);">· já jogado</span>' : ''}</span>
                <button class="btn btn-small" onclick="toggleMapActive('${m.id}')" style="font-size:11px;padding:4px 10px;background:${isActive ? 'rgba(0,200,83,0.15)' : 'rgba(255,61,61,0.15)'};color:${isActive ? 'var(--green)' : 'var(--red)'};border:1px solid ${isActive ? 'rgba(0,200,83,0.3)' : 'rgba(255,61,61,0.3)'};">${isActive ? '🟢 Ativo' : '🔴 Inativo'}</button>
                <button class="btn btn-danger btn-small" onclick="removeMapFromPool('${m.id}')" style="font-size:11px;padding:4px 8px;min-width:0;" title="Remover">🗑️</button>
            </div>`;
        }).join('') || '<div style="font-size:12px;color:var(--text-dim);">Nenhum mapa na lista.</div>';
    } catch (e) {
        el.innerHTML = `<span style="color:var(--red);font-size:12px;">Erro: ${e.message}</span>`;
    }
}

async function _saveMapPool(maps) {
    await db.collection('config').doc('settings').set({ mapPool: maps }, { merge: true });
}

async function toggleMapActive(mapId) {
    try {
        const maps = await loadMapPool();
        const m = maps.find(x => x.id === mapId);
        if (!m) return;
        m.active = (m.active === false); // inativo→ativo; ativo/indefinido→inativo
        await _saveMapPool(maps);
        loadMapPoolEditor();
    } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

async function removeMapFromPool(mapId) {
    if (!confirm('Remover este mapa da lista?')) return;
    try {
        const maps = (await loadMapPool()).filter(m => m.id !== mapId);
        await _saveMapPool(maps);
        loadMapPoolEditor();
    } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

async function addMapToPool() {
    const input = document.getElementById('newMapName');
    const emojiInput = document.getElementById('newMapEmoji');
    const name = (input && input.value || '').trim();
    if (!name) { toast('Digite o nome do mapa!', 'error'); return; }
    const emoji = (emojiInput && emojiInput.value || '').trim() || '🗺️';
    const id = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
    if (!id) { toast('Nome inválido!', 'error'); return; }
    try {
        const maps = await loadMapPool();
        if (maps.some(m => m.id === id)) { toast('Esse mapa já existe na lista!', 'error'); return; }
        maps.push({ id, name, emoji, active: true });
        await _saveMapPool(maps);
        if (input) input.value = '';
        if (emojiInput) emojiInput.value = '';
        toast('Mapa adicionado!', 'success');
        loadMapPoolEditor();
    } catch (e) { toast('Erro: ' + e.message, 'error'); }
}
