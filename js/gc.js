// ╔══════════════════════════════════╗
// ║     GC IMPORT INTO MATCH        ║
// ╚══════════════════════════════════╝
let gcImportMatchId = null;
let gcImportSlotCount = 0;

function openGCImport(matchId) {
    gcImportMatchId = matchId;
    gcImportSlotCount = 0;
    const overlay = document.getElementById('editModal');
    overlay.querySelector('.modal-box').innerHTML = `
        <div class="card-title">
            <span>📊 Importar Stats Gamers Club</span>
            <button class="modal-close" onclick="closeEditModal()">&times;</button>
        </div>
        <div id="gcImportExtensionSlots" style="margin-bottom:12px;"></div>
        <p style="color:var(--text-dim);font-size:13px;margin:10px 0;">
            Ou cole o JSON manualmente (snippet → F12 → Console).
        </p>
        <div style="display:flex;gap:8px;margin-bottom:12px;">
            <button class="btn btn-secondary btn-small" onclick="copySnippet()" style="white-space:nowrap;">📋 Copiar Snippet</button>
            <button class="btn btn-secondary btn-small" onclick="addGCImportSlot()">＋ Adicionar Partida GC</button>
        </div>
        <div id="gcImportSlots"></div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="processAllGCImports()">📊 Processar Todas</button>
        </div>
        <div id="gcImportResult" style="margin-top:16px;"></div>
    `;
    overlay.classList.add('active');

    // Load extension imports
    loadGCExtensionImportsForModal();

    // Load existing raw JSONs if any
    db.collection('matches').doc(matchId).get().then(doc => {
        const m = doc.data();
        if (m.gcRawJsons && m.gcRawJsons.length > 0) {
            const existingIds = m.gcMatchIds || [];
            m.gcRawJsons.forEach((rawJson, i) => {
                addGCImportSlot(rawJson, existingIds[i] || '');
            });
            // Add one empty slot for the new match
            addGCImportSlot();
        } else {
            addGCImportSlot();
        }
    }).catch(() => {
        addGCImportSlot();
    });
}

function addGCImportSlot(prefillJson, gcMatchId) {
    gcImportSlotCount++;
    const idx = gcImportSlotCount;
    const container = document.getElementById('gcImportSlots');
    const slot = document.createElement('div');
    slot.id = `gcImpSlot-${idx}`;
    slot.style.cssText = 'position:relative;margin-bottom:10px;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:10px;background:rgba(255,255,255,0.02);transition:border-color 0.2s;';

    const isPrefilled = !!prefillJson;

    slot.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:13px;color:var(--ct-blue);letter-spacing:1px;">🎮 PARTIDA GC ${idx}</span>
            <div style="display:flex;align-items:center;gap:6px;">
                <span id="gcImpStatus-${idx}" style="font-size:11px;color:var(--text-dim);"></span>
                <button onclick="removeGCImportSlot(${idx})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:0 4px;opacity:0.6;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'" title="Remover">✕</button>
            </div>
        </div>
        <textarea id="gcImpJson-${idx}" rows="2" placeholder='Cole o JSON da partida GC ${idx}...'
            oninput="validateGCImportSlot(${idx})"
            data-gc-match-id="${gcMatchId || ''}"
            style="width:100%;padding:8px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:var(--text);font-family:monospace;font-size:11px;resize:vertical;"></textarea>
    `;
    container.appendChild(slot);

    if (isPrefilled) {
        const textarea = document.getElementById(`gcImpJson-${idx}`);
        textarea.value = prefillJson;
        validateGCImportSlot(idx);
    } else {
        slot.querySelector('textarea').focus();
    }
}

function removeGCImportSlot(idx) {
    const slot = document.getElementById(`gcImpSlot-${idx}`);
    if (slot) {
        slot.style.opacity = '0';
        slot.style.transform = 'translateX(20px)';
        slot.style.transition = 'opacity 0.2s, transform 0.2s';
        setTimeout(() => slot.remove(), 200);
    }
}

function validateGCImportSlot(idx) {
    const textarea = document.getElementById(`gcImpJson-${idx}`);
    const status = document.getElementById(`gcImpStatus-${idx}`);
    const slot = document.getElementById(`gcImpSlot-${idx}`);
    const raw = textarea.value.trim();
    if (!raw) {
        status.textContent = '';
        slot.style.borderColor = 'rgba(255,255,255,0.06)';
        return;
    }
    try {
        const data = JSON.parse(raw);
        if (!Array.isArray(data) || data.length === 0) throw new Error();

        const isV2 = data[0]._v === 2;
        const warnings = [];
        data.forEach(p => {
            if (p.k < 0 || p.d < 0 || p.a < 0) warnings.push(`${p.name}: kills/deaths/assists negativos`);
            if (p.kdr > 10) warnings.push(`${p.name}: KDR=${p.kdr} (muito alto)`);
            if (p.adr > 500) warnings.push(`${p.name}: ADR=${p.adr} (muito alto)`);
            if (p.k === 0 && p.d === 0 && p.a === 0) warnings.push(`${p.name}: todas stats zeradas`);
        });

        if (warnings.length > 0) {
            status.innerHTML = `⚠️ ${data.length} jogadores - <span style="color:var(--yellow);cursor:pointer;" title="${warnings.join('\n')}">${warnings.length} aviso(s)</span>`;
            status.style.color = 'var(--yellow)';
            slot.style.borderColor = 'rgba(255,214,0,0.3)';
        } else {
            status.textContent = `✅ ${data.length} jogadores${isV2 ? ' (v2)' : ''}`;
            status.style.color = 'var(--green)';
            slot.style.borderColor = 'rgba(0,200,83,0.3)';
        }
    } catch {
        status.textContent = '❌ JSON inválido';
        status.style.color = 'var(--red)';
        slot.style.borderColor = 'rgba(255,61,61,0.3)';
    }
}

async function processAllGCImports() {
    const slots = document.querySelectorAll('[id^="gcImpJson-"]');
    const allParsed = [];
    let errors = [];

    slots.forEach(textarea => {
        const raw = textarea.value.trim();
        const slotId = textarea.id.replace('gcImpJson-', '');
        if (!raw) return;
        try {
            const data = JSON.parse(raw);
            if (!Array.isArray(data) || !data.length) throw new Error();
            allParsed.push({ slotId, data, gcMatchId: textarea.dataset.gcMatchId || '' });
        } catch {
            errors.push(`Partida GC ${slotId}`);
        }
    });

    if (allParsed.length === 0) {
        toast(errors.length ? `JSON inválido em: ${errors.join(', ')}` : 'Cole pelo menos um JSON!', 'error');
        return;
    }

    if (errors.length) {
        toast(`⚠️ Erro em: ${errors.join(', ')} — essas serão ignoradas.`, 'error');
    }

    // Refresh players
    const snap = await db.collection('players').orderBy('name').get();
    players = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Collect unique GC players across all matches (by gcId or name)
    const uniqueGC = {};
    allParsed.forEach(({ data }) => {
        data.forEach(gc => {
            const key = gc.gcId || gc.name.toLowerCase();
            if (!uniqueGC[key]) {
                uniqueGC[key] = { gcId: gc.gcId || '', name: gc.name, avatar: gc.avatar || '' };
            }
        });
    });

    // Match unique players to system players
    const matchedUnique = [];
    const unmatchedUnique = [];

    Object.values(uniqueGC).forEach(gc => {
        const byGcId = gc.gcId ? players.find(p => p.gcId === gc.gcId) : null;
        if (byGcId) {
            matchedUnique.push({ gc, player: byGcId });
        } else {
            const byName = players.find(p => p.name.toLowerCase() === gc.name.toLowerCase());
            if (byName) {
                matchedUnique.push({ gc, player: byName, needsLink: true });
            } else {
                unmatchedUnique.push(gc);
            }
        }
    });

    renderGCImportResult(matchedUnique, unmatchedUnique, allParsed);
}

function renderGCImportResult(matched, unmatched, allParsed) {
    const el = document.getElementById('gcImportResult');
    const totalGCMatches = allParsed.length;
    const totalUniquePlayers = matched.length + unmatched.length;

    let html = `
        <div style="margin-bottom:10px;padding:10px 14px;background:rgba(0,200,83,0.08);border-radius:6px;font-size:13px;">
            <span style="color:var(--green);font-weight:600;">📊 ${totalGCMatches} partida(s) GC</span>
            <span style="color:var(--text-dim);margin:0 6px;">•</span>
            <span style="color:var(--text);">${totalUniquePlayers} jogador(es) único(s)</span>
        </div>`;

    if (matched.length) {
        html += `<div style="margin-bottom:8px;color:var(--green);font-size:13px;font-weight:600;">✅ ${matched.length} vinculado(s) automaticamente</div>`;
        html += matched.map(m => `
            <div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13px;">
                ${m.gc.avatar ? `<img src="${m.gc.avatar}" style="width:22px;height:22px;border-radius:50%;">` : ''}
                <span style="color:var(--yellow);">${m.gc.name}</span>
                <span style="color:var(--text-dim);">→</span>
                <span style="color:var(--green);">${m.player.name}</span>
                ${m.needsLink ? `<span style="color:var(--blue);font-size:11px;">(vincular GC ID)</span>` : ''}
            </div>
        `).join('');
    }

    if (unmatched.length) {
        html += `<div style="margin:14px 0 8px;color:var(--yellow);font-size:13px;font-weight:600;">⚠️ ${unmatched.length} jogador(es) sem vínculo — associe abaixo:</div>`;
        unmatched.forEach((gc, idx) => {
            html += `
                <div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;flex-wrap:wrap;">
                    ${gc.avatar ? `<img src="${gc.avatar}" style="width:22px;height:22px;border-radius:50%;">` : ''}
                    <span style="color:var(--yellow);min-width:90px;">${gc.name}</span>
                    <span style="color:var(--text-dim);">→</span>
                    <select id="gcLink-${idx}" style="flex:1;min-width:130px;padding:5px 8px;background:#0a0e17;border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#e8eaf0;font-size:13px;">
                        <option value="">— Selecionar jogador —</option>
                        ${players.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                </div>
            `;
        });
    }

    // Store data for saving
    window._gcImportMatchedUnique = matched;
    window._gcImportUnmatchedUnique = unmatched;
    window._gcImportParsed = allParsed;

    html += `<button class="btn btn-primary" style="margin-top:16px;" onclick="saveGCImport()">💾 Salvar Stats na Partida</button>`;
    el.innerHTML = html;
}

async function saveGCImport() {
    const snap = await db.collection('players').orderBy('name').get();
    players = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const matchedUnique = window._gcImportMatchedUnique || [];
    const unmatchedUnique = window._gcImportUnmatchedUnique || [];
    const allParsed = window._gcImportParsed || [];

    // Resolve unmatched from selects
    const allUniqueLinked = [...matchedUnique];
    for (let i = 0; i < unmatchedUnique.length; i++) {
        const sel = document.getElementById(`gcLink-${i}`);
        if (!sel || !sel.value) {
            toast(`Associe o jogador "${unmatchedUnique[i].name}" antes de salvar!`, 'error');
            return;
        }
        const player = players.find(p => p.id === sel.value);
        if (player) {
            allUniqueLinked.push({ gc: unmatchedUnique[i], player, needsLink: true });
        }
    }

    // Build a lookup: gcKey -> player info
    const gcToPlayer = {};
    for (const entry of allUniqueLinked) {
        const key = entry.gc.gcId || entry.gc.name.toLowerCase();
        gcToPlayer[key] = entry;
    }

    try {
        // ── Duplicate check: verify gcMatchIds aren't already linked anywhere ──
        const gcMatchIdsFromSlots = allParsed.map(p => p.gcMatchId || '');
        const nonEmptyIds = gcMatchIdsFromSlots.filter(Boolean);
        for (const gId of nonEmptyIds) {
            // Check 1: matches with gcMatchIds field (new format)
            const dupSnap = await db.collection('matches')
                .where('gcMatchIds', 'array-contains', gId)
                .get();
            const dupDoc = dupSnap.docs.find(d => d.id !== gcImportMatchId);
            if (dupDoc) {
                toast(`⚠️ Partida GC #${gId} já está vinculada ao confronto "${dupDoc.data().name || dupDoc.id}"!`, 'error');
                return;
            }
            // Check 2: gc-imports already linked (backward compat for old data)
            const impSnap = await db.collection('gc-imports')
                .where('gcMatchId', '==', gId)
                .where('status', '==', 'used')
                .get();
            const linkedImp = impSnap.docs.find(d => d.data().linkedMatchId && d.data().linkedMatchId !== gcImportMatchId);
            if (linkedImp) {
                const linkedMatchId = linkedImp.data().linkedMatchId;
                const linkedDoc = await db.collection('matches').doc(linkedMatchId).get();
                if (linkedDoc.exists) {
                    const ld = linkedDoc.data();
                    // Verify match still has this GC match linked (not stale)
                    const hasInIds = (ld.gcMatchIds || []).includes(gId);
                    const hasGcData = !ld.gcMatchIds && (ld.gcStats || []).length > 0;
                    if (hasInIds || hasGcData) {
                        toast(`⚠️ Partida GC #${gId} já está vinculada ao confronto "${ld.name || linkedMatchId}"!`, 'error');
                        return;
                    }
                }
            }
        }

        const batch = db.batch();

        // Link gcIds on players that need it
        for (const entry of allUniqueLinked) {
            if (entry.needsLink && entry.gc.gcId) {
                batch.update(db.collection('players').doc(entry.player.id), { gcId: entry.gc.gcId });
            }
        }

        // Build gcStats array — one entry per player per GC match (for granularity)
        const gcStats = [];
        const gcRawJsons = [];
        allParsed.forEach(({ slotId, data }) => {
            // Save raw JSON string for this GC match
            gcRawJsons.push(JSON.stringify(data));
            data.forEach(gc => {
                const key = gc.gcId || gc.name.toLowerCase();
                const linked = gcToPlayer[key];
                if (!linked) return;
                gcStats.push({
                    playerId: linked.player.id,
                    playerName: linked.player.name,
                    gcName: gc.name,
                    gcId: gc.gcId || '',
                    avatar: gc.avatar || '',
                    k: gc.k,
                    a: gc.a,
                    d: gc.d,
                    diff: gc.diff,
                    adr: gc.adr,
                    kdr: gc.kdr,
                    kast: gc.kast,
                    fk: gc.fk,
                    rp: gc.rp,
                    win: gc.win != null ? gc.win : (gc.rp >= 0),
                    teamName: gc.teamName || '',
                    teamScore: gc.teamScore != null ? gc.teamScore : null,
                    gcMatchIdx: parseInt(slotId) || 1
                });
            });
        });

        // Sync result teams with GC teams
        const matchData = (await db.collection('matches').doc(gcImportMatchId).get()).data();
        const updateData = { gcStats, gcMatchCount: allParsed.length, gcRawJsons, gcMatchIds: gcMatchIdsFromSlots };

        if (matchData.result && matchData.result.teamA && matchData.result.teamB) {
            const teamNames = [...new Set(gcStats.map(s => s.teamName).filter(Boolean))];
            if (teamNames.length === 2) {
                const playersInA = new Set(gcStats.filter(s => s.teamName === teamNames[0]).map(s => s.playerId));
                const playersInB = new Set(gcStats.filter(s => s.teamName === teamNames[1]).map(s => s.playerId));
                // Merge players from both teams, preserving currentLevel from original result
                const allPlayers = [...matchData.result.teamA, ...matchData.result.teamB];
                // If currentLevel is missing, recalculate from votes
                let levelMap = {};
                const hasLevels = allPlayers.some(p => p.currentLevel != null);
                if (!hasLevels && matchData.players) {
                    const votesSnap = await db.collection('matches').doc(gcImportMatchId).collection('votes').get();
                    if (!votesSnap.empty) {
                        const averages = computeAverages(matchData.players, votesSnap.docs);
                        matchData.players.forEach(p => {
                            levelMap[p.id] = averages[p.id] ? Math.round(averages[p.id].avg) : 10;
                        });
                    }
                }
                const enrichedPlayers = allPlayers.map(p => ({
                    ...p,
                    currentLevel: p.currentLevel != null ? p.currentLevel : (levelMap[p.id] || 10)
                }));
                const newTeamA = enrichedPlayers.filter(p => playersInA.has(p.id));
                const newTeamB = enrichedPlayers.filter(p => playersInB.has(p.id));
                if (newTeamA.length > 0 && newTeamB.length > 0 && newTeamA.length + newTeamB.length === enrichedPlayers.length) {
                    const sumA = newTeamA.reduce((s, p) => s + (p.currentLevel || 10), 0);
                    const sumB = newTeamB.reduce((s, p) => s + (p.currentLevel || 10), 0);
                    updateData.result = { teamA: newTeamA, teamB: newTeamB, sumA, sumB };
                }
            }
        }

        // Save on match
        batch.update(db.collection('matches').doc(gcImportMatchId), updateData);
        await batch.commit();

        _fightCardCache = null;
        _avatarB64Cache = null;

        // Convert avatars to base64 and save on player docs (solves CORS in production)
        (async () => {
            for (const entry of allUniqueLinked) {
                const avatarUrl = entry.gc.avatar;
                if (!avatarUrl) continue;
                try {
                    const r = await fetch(avatarUrl, { mode: 'cors' });
                    if (!r.ok) continue;
                    const b = await r.blob();
                    if (b.size < 100) continue;
                    const b64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
                    if (b64) await db.collection('players').doc(entry.player.id).update({ avatarB64: b64 });
                } catch {}
            }
        })();

        toast(`✅ Stats de ${allParsed.length} partida(s) GC salvas! (${allUniqueLinked.length} jogadores)`, 'success');
        closeEditModal();
        await loadAdminPlayers();
        loadAdminMatches();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

function buildGCTeamScoreboard(stats) {
    // Group by team
    const teamsMap = {};
    stats.forEach(s => {
        const team = s.teamName || 'Sem Time';
        if (!teamsMap[team]) teamsMap[team] = { players: [], score: s.teamScore };
        teamsMap[team].players.push(s);
    });
    const teamKeys = Object.keys(teamsMap);
    const hasTeams = teamKeys.length >= 2 && teamKeys[0] !== 'Sem Time';

    if (!hasTeams) return buildGCStatsTable(stats, false);

    const [teamAKey, teamBKey] = teamKeys;
    const teamA = teamsMap[teamAKey];
    const teamB = teamsMap[teamBKey];
    const scoreA = teamA.score != null ? teamA.score : '?';
    const scoreB = teamB.score != null ? teamB.score : '?';
    const aWon = teamA.score != null && teamB.score != null && teamA.score > teamB.score;
    const bWon = teamA.score != null && teamB.score != null && teamB.score > teamA.score;

    const buildTeamRows = (players) => {
        return [...players].sort((a, b) => b.adr - a.adr).map(p => {
            const diffColor = p.diff > 0 ? 'var(--green)' : p.diff < 0 ? 'var(--red)' : 'var(--text-dim)';
            const kdrColor = p.kdr >= 1 ? 'var(--green)' : 'var(--yellow)';
            const rpColor = p.rp >= 0 ? 'var(--blue)' : 'var(--red)';
            return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                <td style="padding:6px 4px;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        ${p.avatar ? `<img src="${p.avatar}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">` : ''}
                        <span style="font-weight:600;font-size:13px;">${p.playerName}</span>
                        ${p.gcName !== p.playerName ? `<span style="color:var(--text-dim);font-size:10px;">(${p.gcName})</span>` : ''}
                    </div>
                </td>
                <td style="padding:6px 3px;text-align:center;color:var(--green);font-weight:700;">${p.k}</td>
                <td style="padding:6px 3px;text-align:center;">${p.a}</td>
                <td style="padding:6px 3px;text-align:center;color:var(--red);">${p.d}</td>
                <td style="padding:6px 3px;text-align:center;color:${diffColor};font-weight:600;">${p.diff > 0 ? '+' : ''}${p.diff}</td>
                <td style="padding:6px 3px;text-align:center;">${p.adr}</td>
                <td style="padding:6px 3px;text-align:center;color:${kdrColor};font-weight:600;">${p.kdr}</td>
                <td style="padding:6px 3px;text-align:center;">${p.kast}%</td>
                <td style="padding:6px 3px;text-align:center;">${p.fk}</td>
                <td style="padding:6px 3px;text-align:center;color:${rpColor};font-weight:700;">${p.rp > 0 ? '+' : ''}${p.rp}</td>
            </tr>`;
        }).join('');
    };

    const teamHeader = `<tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:var(--text-dim);font-size:11px;text-transform:uppercase;">
        <th style="padding:6px 4px;text-align:left;">Jogador</th>
        <th style="padding:6px 3px;text-align:center;">K</th>
        <th style="padding:6px 3px;text-align:center;">A</th>
        <th style="padding:6px 3px;text-align:center;">D</th>
        <th style="padding:6px 3px;text-align:center;">+/-</th>
        <th style="padding:6px 3px;text-align:center;">ADR</th>
        <th style="padding:6px 3px;text-align:center;">KDR</th>
        <th style="padding:6px 3px;text-align:center;">KAST</th>
        <th style="padding:6px 3px;text-align:center;">FK</th>
        <th style="padding:6px 3px;text-align:center;">RP</th>
    </tr>`;

    return `
        <div style="display:flex;align-items:center;justify-content:center;gap:20px;margin:16px 0;">
            <div style="text-align:center;">
                <div style="font-size:12px;color:var(--ct-blue);font-weight:600;text-transform:uppercase;letter-spacing:1px;">${teamAKey}</div>
                <div style="font-family:'Rajdhani',sans-serif;font-size:40px;font-weight:700;color:${aWon ? 'var(--green)' : 'var(--red)'};">${scoreA}</div>
            </div>
            <div style="font-size:16px;color:var(--text-dim);font-weight:600;">VS</div>
            <div style="text-align:center;">
                <div style="font-size:12px;color:var(--tr-gold);font-weight:600;text-transform:uppercase;letter-spacing:1px;">${teamBKey}</div>
                <div style="font-family:'Rajdhani',sans-serif;font-size:40px;font-weight:700;color:${bWon ? 'var(--green)' : 'var(--red)'};">${scoreB}</div>
            </div>
        </div>
        <div style="margin-bottom:16px;">
            <div style="font-size:12px;color:var(--ct-blue);font-weight:600;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">${teamAKey} ${aWon ? '🏆' : ''}</div>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                ${teamHeader}
                ${buildTeamRows(teamA.players)}
            </table>
        </div>
        <div>
            <div style="font-size:12px;color:var(--tr-gold);font-weight:600;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">${teamBKey} ${bWon ? '🏆' : ''}</div>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                ${teamHeader}
                ${buildTeamRows(teamB.players)}
            </table>
        </div>`;
}

function viewGCStats(matchId) {
    db.collection('matches').doc(matchId).get().then(doc => {
        const m = doc.data();
        if (!m.gcStats) { toast('Sem stats GC.', 'error'); return; }

        const overlay = document.getElementById('editModal');
        const gcMatchCount = m.gcMatchCount || 1;

        // Group stats by gcMatchIdx
        const byMatch = {};
        m.gcStats.forEach(s => {
            const idx = s.gcMatchIdx || 1;
            if (!byMatch[idx]) byMatch[idx] = [];
            byMatch[idx].push(s);
        });

        const matchKeys = Object.keys(byMatch).sort((a, b) => a - b);
        const hasMultiple = matchKeys.length > 1;

        let html = `
            <div class="card-title">
                <span>📊 Resultado — ${m.name} ${hasMultiple ? `(${matchKeys.length} partidas)` : ''}</span>
                <button class="modal-close" onclick="closeEditModal()">&times;</button>
            </div>
        `;

        // Tabs if multiple matches
        if (hasMultiple) {
            html += `<div style="display:flex;gap:6px;margin:12px 0;flex-wrap:wrap;">
                <button class="btn btn-secondary btn-small" style="font-size:11px;" onclick="gcViewShowTab('all', this)">📊 Agregado</button>`;
            matchKeys.forEach(k => {
                html += `<button class="btn btn-secondary btn-small" style="font-size:11px;" onclick="gcViewShowTab('${k}', this)">GC #${k}</button>`;
            });
            html += `</div>`;
        }

        // Aggregated view
        if (hasMultiple) {
            const aggregated = {};
            m.gcStats.forEach(s => {
                const key = s.playerId || s.gcName;
                if (!aggregated[key]) {
                    aggregated[key] = { ...s, matches: 1 };
                } else {
                    aggregated[key].k += s.k;
                    aggregated[key].a += s.a;
                    aggregated[key].d += s.d;
                    aggregated[key].diff += s.diff;
                    aggregated[key].adr += s.adr;
                    aggregated[key].kdr += s.kdr;
                    aggregated[key].kast += s.kast;
                    aggregated[key].fk += s.fk;
                    aggregated[key].rp += s.rp;
                    aggregated[key].matches += 1;
                    if (!aggregated[key].avatar && s.avatar) aggregated[key].avatar = s.avatar;
                }
            });
            const aggEntries = Object.values(aggregated).sort((a, b) => (b.adr / b.matches) - (a.adr / a.matches));
            html += `<div id="gcViewTab-all">${buildGCStatsTable(aggEntries, true)}</div>`;
        }

        // Individual match views — use team scoreboard
        matchKeys.forEach(k => {
            const stats = byMatch[k];
            const display = hasMultiple ? 'none' : 'block';
            html += `<div id="gcViewTab-${k}" style="display:${display};">${buildGCTeamScoreboard(stats)}</div>`;
        });

        overlay.querySelector('.modal-box').innerHTML = html;
        overlay.classList.add('active');
    });
}

function gcViewShowTab(tabKey, btn) {
    // Hide all tabs
    document.querySelectorAll('[id^="gcViewTab-"]').forEach(el => el.style.display = 'none');
    // Show selected
    const tab = document.getElementById(`gcViewTab-${tabKey}`);
    if (tab) tab.style.display = 'block';
    // Highlight active button
    if (btn) {
        btn.parentElement.querySelectorAll('button').forEach(b => {
            b.style.background = 'rgba(255,255,255,0.08)';
            b.style.color = 'var(--text)';
            b.style.borderColor = 'rgba(255,255,255,0.1)';
        });
        btn.style.background = 'rgba(0,200,83,0.12)';
        btn.style.color = 'var(--green)';
        btn.style.borderColor = 'var(--green)';
    }
}

function buildGCStatsTable(stats, isAggregated) {
    let html = `
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px;">
            <thead>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:var(--text-dim);font-size:11px;text-transform:uppercase;">
                    <th style="padding:8px 6px;text-align:left;">#</th>
                    <th style="padding:8px 6px;text-align:left;">Jogador</th>
                    <th style="padding:8px 6px;text-align:center;">K</th>
                    <th style="padding:8px 6px;text-align:center;">A</th>
                    <th style="padding:8px 6px;text-align:center;">D</th>
                    <th style="padding:8px 6px;text-align:center;">Diff</th>
                    <th style="padding:8px 6px;text-align:center;">ADR</th>
                    <th style="padding:8px 6px;text-align:center;">KDR</th>
                    <th style="padding:8px 6px;text-align:center;">KAST</th>
                    <th style="padding:8px 6px;text-align:center;">FK</th>
                    <th style="padding:8px 6px;text-align:center;">RP</th>
                    ${isAggregated ? '<th style="padding:8px 6px;text-align:center;">P</th>' : ''}
                </tr>
            </thead>
            <tbody>`;

    stats.forEach((p, idx) => {
        const m = p.matches || 1;
        const adr = isAggregated ? (p.adr / m).toFixed(1) : p.adr;
        const kdr = isAggregated ? (p.kdr / m).toFixed(2) : p.kdr;
        const kast = isAggregated ? Math.round(p.kast / m) : p.kast;
        const diffColor = p.diff > 0 ? 'var(--green)' : p.diff < 0 ? 'var(--red)' : 'var(--text-dim)';
        const rpColor = p.rp >= 0 ? 'var(--blue)' : 'var(--red)';
        const kdrVal = isAggregated ? parseFloat(kdr) : p.kdr;
        const kdrColor = kdrVal >= 1 ? 'var(--green)' : 'var(--yellow)';
        html += `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.04);${idx < 3 ? 'background:rgba(255,255,255,0.03);' : ''}">
                <td style="padding:8px 6px;color:var(--text-dim);">${idx < 3 ? ['🥇','🥈','🥉'][idx] : idx+1}</td>
                <td style="padding:8px 6px;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        ${p.avatar ? `<img src="${p.avatar}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">` : ''}
                        <div>
                            <span style="font-weight:600;color:var(--yellow);font-size:14px;">${p.playerName}</span>
                            ${p.gcName !== p.playerName ? `<span style="color:var(--text-dim);font-size:11px;margin-left:4px;">(${p.gcName})</span>` : ''}
                        </div>
                    </div>
                </td>
                <td style="padding:8px 6px;text-align:center;color:var(--green);font-weight:700;">${p.k}</td>
                <td style="padding:8px 6px;text-align:center;">${p.a}</td>
                <td style="padding:8px 6px;text-align:center;color:var(--red);">${p.d}</td>
                <td style="padding:8px 6px;text-align:center;color:${diffColor};font-weight:600;">${p.diff > 0 ? '+' : ''}${p.diff}</td>
                <td style="padding:8px 6px;text-align:center;">${adr}</td>
                <td style="padding:8px 6px;text-align:center;color:${kdrColor};font-weight:600;">${kdr}</td>
                <td style="padding:8px 6px;text-align:center;">${kast}%</td>
                <td style="padding:8px 6px;text-align:center;">${p.fk}</td>
                <td style="padding:8px 6px;text-align:center;color:${rpColor};font-weight:700;">${p.rp > 0 ? '+' : ''}${p.rp}</td>
                ${isAggregated ? `<td style="padding:8px 6px;text-align:center;color:var(--text-dim);">${m}</td>` : ''}
            </tr>`;
    });

    html += '</tbody></table>';
    return html;
}

// ╔══════════════════════════════════╗
// ║     GAMERS CLUB STATS PARSER    ║
// ╚══════════════════════════════════╝
let gcAggregated = {};
let gcMatchCount = 0;
let gcSlotCount = 0;

const GC_SNIPPET = `javascript:void((async()=>{const u=window.location.href;const m=u.match(/(?:partida|match)\\/(\\d+)/);if(!m){alert('\\u274c Abra uma partida da GC primeiro!');return}const id=m[1];try{const r=await fetch('/lobby/match/'+id+'/1',{credentials:'include'});if(!r.ok)throw new Error('Status '+r.status);const data=await r.json();if(!data.success)throw new Error('API error');const j=data.jogos;const sA=parseInt(j.score_a)||0,sB=parseInt(j.score_b)||0;const d=[];const proc=(pl,tn,ts,w)=>{if(!pl)return;pl.forEach(p=>{d.push({name:p.player?.nick||'',gcId:String(p.idplayer||p.player?.id||''),avatar:p.player?.avatar?'https://static.gamersclub.com.br/'+p.player.avatar+'_medium.jpg':'',k:parseInt(p.nb_kill)||0,a:parseInt(p.assist)||0,d:parseInt(p.death)||0,diff:parseInt(p.diff)||0,adr:parseFloat(p.adr)||0,kdr:parseFloat(p.kdr)||0,kast:parseInt(p.pkast)||0,fk:parseInt(p.firstkill)||0,rp:parseInt(p.rating_points)||0,win:w,teamName:tn,teamScore:ts,_v:4})})};proc(j.players.team_a,data.time_a||'Time A',sA,sA>sB);proc(j.players.team_b,data.time_b||'Time B',sB,sB>sA);const txt=JSON.stringify(d);const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.focus();ta.select();document.execCommand('copy');ta.remove();alert('\\u2705 '+d.length+' jogadores copiados via API!\\\\n'+(data.time_a||'A')+' '+sA+' x '+sB+' '+(data.time_b||'B')+'\\\\nMapa: '+(j.map_name||'?'))}catch(e){alert('\\u274c Erro: '+e.message+'\\\\nVerifique se est\\u00e1 logado na GC.')}})())`;

function copySnippet() {
    navigator.clipboard.writeText(GC_SNIPPET).then(() => toast('Snippet copiado! Cole no Console (F12) da partida.', 'success'));
}

// ╔══════════════════════════════════════╗
// ║  GC EXTENSION IMPORTS (Firestore)   ║
// ╚══════════════════════════════════════╝
let gcExtensionListener = null;

function loadGCExtensionImports() {
    const el = document.getElementById('gcExtensionImports');
    if (!el) return;

    // Stop previous listener
    if (gcExtensionListener) gcExtensionListener();

    // Listen for pending imports in real-time
    gcExtensionListener = db.collection('gc-imports')
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snap => {
            if (snap.empty) {
                el.innerHTML = '';
                return;
            }

            let html = `
                <div style="background:rgba(0,200,83,0.06);border:1px solid rgba(0,200,83,0.2);border-radius:8px;padding:16px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <span style="color:var(--green);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:15px;letter-spacing:1px;">
                            ⚡ ${snap.size} partida(s) via extensão
                        </span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:8px;">
            `;

            snap.docs.forEach(doc => {
                const d = doc.data();
                const teamA = d.teamA || 'Time A';
                const teamB = d.teamB || 'Time B';
                const scoreA = d.scoreA || 0;
                const scoreB = d.scoreB || 0;
                const map = d.map || '';
                const gcMatchId = d.gcMatchId || '';
                const players = d.playersJson ? JSON.parse(d.playersJson) : [];

                html += `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,0.04);border-radius:8px;gap:8px;flex-wrap:wrap;">
                        <div>
                            <span style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:15px;">
                                <span style="color:${scoreA > scoreB ? 'var(--green)' : 'var(--red)'}">${teamA} ${scoreA}</span>
                                <span style="color:var(--text-dim);"> x </span>
                                <span style="color:${scoreB > scoreA ? 'var(--green)' : 'var(--red)'}">${scoreB} ${teamB}</span>
                            </span>
                            <span style="color:var(--text-dim);font-size:11px;margin-left:8px;">${map} | ${players.length} jogadores | GC #${gcMatchId}</span>
                        </div>
                        <div style="display:flex;gap:6px;">
                            <button class="btn btn-primary btn-small" onclick="useExtensionImport('${doc.id}')" style="font-size:11px;">📊 Usar</button>
                            <button class="btn btn-danger btn-small" onclick="dismissExtensionImport('${doc.id}')" style="font-size:11px;">✕</button>
                        </div>
                    </div>
                `;
            });

            html += '</div></div>';
            el.innerHTML = html;
        }, err => {
            console.error('Extension imports listener error:', err);
            el.innerHTML = '';
        });
}

function useExtensionImport(docId) {
    db.collection('gc-imports').doc(docId).get().then(doc => {
        if (!doc.exists) { toast('Import não encontrado', 'error'); return; }
        const d = doc.data();
        const playersJson = d.playersJson || '[]';

        // Add a new slot with the data pre-filled
        addGCMatchSlot();
        const textarea = document.querySelector('[id^="gcJsonInput-"]:last-of-type') ||
                         document.getElementById(`gcJsonInput-${gcSlotCount}`);
        if (textarea) {
            textarea.value = playersJson;
            // Trigger validation
            const evt = new Event('input', { bubbles: true });
            textarea.dispatchEvent(evt);
        }

        // Mark as used
        db.collection('gc-imports').doc(docId).update({ status: 'used' });
        toast(`Partida GC #${d.gcMatchId} carregada!`, 'success');
    });
}

async function dismissExtensionImport(docId) {
    await db.collection('gc-imports').doc(docId).update({ status: 'dismissed' });
    toast('Import descartado.', 'success');
}

// Also add extension imports inside the GC Import modal for matches
async function loadGCExtensionImportsForModal() {
    const el = document.getElementById('gcImportExtensionSlots');
    if (!el) return;

    try {
        const importsSnap = await db.collection('gc-imports')
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .get();

        if (importsSnap.empty) {
            el.innerHTML = '<p style="color:var(--text-dim);font-size:12px;">Nenhuma partida pendente da extensão.</p>';
            return;
        }

        let html = '';
        importsSnap.docs.forEach(doc => {
            const d = doc.data();
            const teamA = d.teamA || '?';
            const teamB = d.teamB || '?';
            const scoreA = d.scoreA || 0;
            const scoreB = d.scoreB || 0;
            const map = d.map || '';
            html += `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:rgba(0,200,83,0.06);border:1px solid rgba(0,200,83,0.15);border-radius:6px;margin-bottom:6px;font-size:12px;gap:8px;">
                    <span>
                        <b>${teamA} ${scoreA} x ${scoreB} ${teamB}</b>
                        <span style="color:var(--text-dim);margin-left:6px;">${map} | GC #${d.gcMatchId}</span>
                    </span>
                    <div style="display:flex;gap:4px;flex-shrink:0;">
                        <button class="btn btn-primary btn-small" onclick="useExtensionImportInModal('${doc.id}')" style="font-size:11px;">Usar</button>
                        <button class="btn btn-danger btn-small" onclick="dismissExtensionImportInModal('${doc.id}')" style="font-size:11px;padding:4px 8px;min-width:0;">✕</button>
                    </div>
                </div>
            `;
        });

        el.innerHTML = html;
    } catch (e) {
        console.error('loadGCExtensionImportsForModal error:', e);
        el.innerHTML = '';
    }
}

function useExtensionImportInModal(docId) {
    db.collection('gc-imports').doc(docId).get().then(doc => {
        if (!doc.exists) return;
        const d = doc.data();
        // Find first empty slot
        const container = document.getElementById('gcImportSlots');
        const textareas = container ? container.querySelectorAll('textarea') : [];
        let filled = false;
        for (const ta of textareas) {
            if (!ta.value.trim()) {
                ta.value = d.playersJson;
                ta.dataset.gcMatchId = d.gcMatchId || '';
                const idx = parseInt(ta.id.replace('gcImpJson-', ''));
                validateGCImportSlot(idx);
                filled = true;
                break;
            }
        }
        if (!filled) {
            addGCImportSlot(d.playersJson, d.gcMatchId || '');
        }
        db.collection('gc-imports').doc(docId).update({ status: 'used' });
        toast(`Partida GC #${d.gcMatchId} carregada!`, 'success');
        loadGCExtensionImportsForModal();
    });
}

async function dismissExtensionImportInModal(docId) {
    if (!confirm('Descartar esta importação?')) return;
    await db.collection('gc-imports').doc(docId).delete();
    toast('Import descartado.', 'success');
    loadGCExtensionImportsForModal();
}

// ╔════════════════════════════════════════╗
// ║  ADMIN TAB: Partidas a Vincular       ║
// ╚════════════════════════════════════════╝
async function loadPendingGCImports() {
    const el = document.getElementById('gcPendingImports');
    if (!el) return;

    try {
        // Load pending imports and closed matches in parallel
        const [importsSnap, matchesSnap] = await Promise.all([
            db.collection('gc-imports').where('status', '==', 'pending').orderBy('createdAt', 'desc').get(),
            db.collection('matches').where('status', 'in', ['closed', 'finished']).orderBy('createdAt', 'desc').get()
        ]);

        if (importsSnap.empty) {
            el.innerHTML = `
                <div style="text-align:center;padding:30px;color:var(--text-dim);">
                    <div style="font-size:32px;margin-bottom:10px;">⚡</div>
                    <p>Nenhuma partida pendente.</p>
                    <p style="font-size:12px;">Use a extensão Chrome na página da partida na Gamers Club.</p>
                </div>
            `;
            return;
        }

        // Build match list and load system players for matching
        const closedMatches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        assignDisplayNames(closedMatches);
        const playersSnap = await db.collection('players').orderBy('name').get();
        const systemPlayers = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        let html = '';
        importsSnap.docs.forEach(doc => {
            const d = doc.data();
            const teamA = d.teamA || 'Time A';
            const teamB = d.teamB || 'Time B';
            const scoreA = d.scoreA || 0;
            const scoreB = d.scoreB || 0;
            const map = d.map || '';
            const gcMatchId = d.gcMatchId || '';
            const gcPlayers = d.playersJson ? JSON.parse(d.playersJson) : [];
            const createdAt = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleString('pt-BR') : '';

            // Build GC team sets (map gcPlayer → systemPlayerId, grouped by teamName)
            const gcDate = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString('pt-BR') : '';
            const gcTeamNames = [...new Set(gcPlayers.map(p => p.teamName).filter(Boolean))];
            const gcTeamSets = {};
            gcPlayers.forEach(gcp => {
                if (!gcp.teamName) return;
                const sysP = gcp.gcId
                    ? systemPlayers.find(sp => sp.gcId === gcp.gcId)
                    : systemPlayers.find(sp => sp.name.toLowerCase() === gcp.name.toLowerCase());
                if (sysP) {
                    if (!gcTeamSets[gcp.teamName]) gcTeamSets[gcp.teamName] = new Set();
                    gcTeamSets[gcp.teamName].add(sysP.id);
                }
            });

            const scored = closedMatches.map(m => {
                let matchCount = 0;
                gcPlayers.forEach(gcp => {
                    const sysPlayer = gcp.gcId
                        ? systemPlayers.find(sp => sp.gcId === gcp.gcId)
                        : systemPlayers.find(sp => sp.name.toLowerCase() === gcp.name.toLowerCase());
                    if (sysPlayer && m.players.some(mp => mp.id === sysPlayer.id)) {
                        matchCount++;
                    }
                });
                const mDate = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleDateString('pt-BR') : '';
                const sameDate = gcDate && mDate && gcDate === mDate;

                // Check if GC teams match MiRB result teams
                let teamsMatch = false;
                if (m.result && m.result.teamA && m.result.teamB && gcTeamNames.length === 2) {
                    const mirbA = new Set(m.result.teamA.map(p => p.id));
                    const mirbB = new Set(m.result.teamB.map(p => p.id));
                    const gcSets = Object.values(gcTeamSets);
                    if (gcSets.length === 2) {
                        const [gcA, gcB] = gcSets;
                        const setsEqual = (a, b) => a.size === b.size && [...a].every(id => b.has(id));
                        teamsMatch = (setsEqual(gcA, mirbA) && setsEqual(gcB, mirbB)) ||
                                     (setsEqual(gcA, mirbB) && setsEqual(gcB, mirbA));
                    }
                }

                return { ...m, matchCount, sameDate, teamsMatch };
            });

            // Sort: teams match first, then exact players + same date, then match count, then date
            scored.sort((a, b) => {
                if (b.teamsMatch !== a.teamsMatch) return b.teamsMatch ? 1 : -1;
                const aExact = a.matchCount === gcPlayers.length && a.sameDate ? 1 : 0;
                const bExact = b.matchCount === gcPlayers.length && b.sameDate ? 1 : 0;
                if (bExact !== aExact) return bExact - aExact;
                if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
                const ta = a.createdAt?.toDate ? a.createdAt.toDate() : 0;
                const tb = b.createdAt?.toDate ? b.createdAt.toDate() : 0;
                return tb - ta;
            });

            // Only recommend if ALL players match AND same date AND teams match
            const bestMatch = scored[0]?.matchCount === gcPlayers.length && scored[0]?.sameDate && scored[0]?.teamsMatch ? scored[0] : null;

            html += `
                <div style="border:1px solid rgba(0,200,83,0.2);border-radius:10px;padding:16px;margin-bottom:12px;background:rgba(0,200,83,0.03);">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
                        <div>
                            <span style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:18px;">
                                <span style="color:${scoreA > scoreB ? 'var(--green)' : 'var(--red)'}">${teamA} ${scoreA}</span>
                                <span style="color:var(--text-dim);"> x </span>
                                <span style="color:${scoreB > scoreA ? 'var(--green)' : 'var(--red)'}">${scoreB} ${teamB}</span>
                            </span>
                            <span style="color:var(--text-dim);font-size:12px;margin-left:8px;">${map}</span>
                        </div>
                        <span style="color:var(--text-dim);font-size:11px;">GC #${gcMatchId}${createdAt ? ' | ' + createdAt : ''}</span>
                    </div>

                    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">
                        ${gcPlayers.map(p => `
                            <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:rgba(255,255,255,0.06);border-radius:4px;font-size:11px;">
                                ${p.avatar ? `<img src="${p.avatar}" style="width:16px;height:16px;border-radius:50%;">` : ''}
                                <span style="color:${p.win ? 'var(--green)' : 'var(--red)'}">${p.name}</span>
                                <span style="color:var(--text-dim)">${p.k}/${p.d}</span>
                            </span>
                        `).join('')}
                    </div>

                    ${bestMatch ? `
                    <div style="padding:8px 12px;background:rgba(0,200,83,0.08);border:1px solid rgba(0,200,83,0.2);border-radius:6px;margin-bottom:10px;font-size:12px;">
                        <span style="color:var(--green);font-weight:600;">⭐ Recomendada:</span>
                        <span style="color:var(--text);">${bestMatch.displayName || bestMatch.name}</span>
                        <span style="color:var(--green);margin-left:4px;">(times iguais)</span>
                    </div>
                    ` : ''}

                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <select id="linkMatch-${doc.id}" style="flex:1;min-width:200px;padding:8px 10px;background:#0a0e17;border:1px solid rgba(255,255,255,0.2);border-radius:6px;color:#e8eaf0;font-size:13px;">
                            <option value="">— Selecionar partida do MiRB —</option>
                            ${scored.map(m => {
                                const existingGC = m.gcMatchCount || 0;
                                const gcLabel = existingGC > 0 ? ` [${existingGC} GC]` : '';
                                const teamTag = m.teamsMatch ? ' ✅ times iguais' : '';
                                const playerTag = m.matchCount > 0 ? ` (${m.matchCount}/${gcPlayers.length})` : '';
                                const label = `${m.displayName || m.name}${playerTag}${teamTag}${gcLabel}`;
                                const isRecommended = m === bestMatch;
                                return `<option value="${m.id}" ${isRecommended ? 'selected' : ''}>${isRecommended ? '⭐ ' : ''}${label}</option>`;
                            }).join('')}
                        </select>
                        <button class="btn btn-primary btn-small" onclick="linkGCImportToMatch('${doc.id}')" style="white-space:nowrap;">Vincular</button>
                        <button class="btn btn-danger btn-small" onclick="deleteGCImport('${doc.id}')" style="white-space:nowrap;">Descartar</button>
                    </div>
                </div>
            `;
        });

        el.innerHTML = html;
    } catch (e) {
        el.innerHTML = `<p style="color:var(--red);">Erro: ${e.message}</p>`;
    }
}

async function linkGCImportToMatch(importDocId) {
    const select = document.getElementById(`linkMatch-${importDocId}`);
    if (!select || !select.value) {
        toast('Selecione uma partida do MiRB para vincular!', 'error');
        return;
    }
    const matchId = select.value;

    try {
        // Get the import data
        const importDoc = await db.collection('gc-imports').doc(importDocId).get();
        if (!importDoc.exists) { toast('Import não encontrado.', 'error'); return; }
        const importData = importDoc.data();
        const gcPlayers = JSON.parse(importData.playersJson || '[]');

        if (gcPlayers.length === 0) { toast('Nenhum jogador no import.', 'error'); return; }

        // Refresh players list
        const playersSnap = await db.collection('players').orderBy('name').get();
        players = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Match GC players to system players
        const matched = [];
        const unmatched = [];

        gcPlayers.forEach(gc => {
            const byGcId = gc.gcId ? players.find(p => p.gcId === gc.gcId) : null;
            if (byGcId) {
                matched.push({ gc, player: byGcId });
            } else {
                const byName = players.find(p => p.name.toLowerCase() === gc.name.toLowerCase());
                if (byName) {
                    matched.push({ gc, player: byName, needsLink: true });
                } else {
                    unmatched.push(gc);
                }
            }
        });

        if (unmatched.length > 0) {
            // Show modal to resolve unmatched players
            showLinkResolutionModal(importDocId, matchId, matched, unmatched, gcPlayers, importData);
            return;
        }

        // All matched — save directly
        await saveLinkToMatch(importDocId, matchId, matched, gcPlayers, importData);

    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

function showLinkResolutionModal(importDocId, matchId, matched, unmatched, gcPlayers, importData) {
    const overlay = document.getElementById('editModal');
    let html = `
        <div class="card-title">
            <span>Vincular jogadores — ${importData.teamA} ${importData.scoreA} x ${importData.scoreB} ${importData.teamB}</span>
            <button class="modal-close" onclick="closeEditModal()">&times;</button>
        </div>
    `;

    if (matched.length) {
        html += `<div style="margin-bottom:12px;color:var(--green);font-size:13px;font-weight:600;">✅ ${matched.length} vinculado(s) automaticamente</div>`;
        matched.forEach(m => {
            html += `<div style="font-size:12px;color:var(--text-dim);padding:2px 0;">${m.gc.name} → ${m.player.name}</div>`;
        });
    }

    if (unmatched.length) {
        html += `<div style="margin:14px 0 8px;color:var(--yellow);font-size:13px;font-weight:600;">⚠️ ${unmatched.length} jogador(es) sem vínculo:</div>`;
        unmatched.forEach((gc, idx) => {
            html += `
                <div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;">
                    ${gc.avatar ? `<img src="${gc.avatar}" style="width:22px;height:22px;border-radius:50%;">` : ''}
                    <span style="color:var(--yellow);min-width:90px;">${gc.name}</span>
                    <span style="color:var(--text-dim);">→</span>
                    <select id="gcLinkResolve-${idx}" style="flex:1;min-width:130px;padding:5px 8px;background:#0a0e17;border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#e8eaf0;font-size:13px;">
                        <option value="">— Selecionar —</option>
                        ${players.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                </div>
            `;
        });
    }

    // Store data for save
    window._linkResolution = { importDocId, matchId, matched, unmatched, gcPlayers, importData };

    html += `<button class="btn btn-primary" style="margin-top:16px;" onclick="confirmLinkResolution()">Vincular</button>`;
    overlay.querySelector('.modal-box').innerHTML = html;
    overlay.classList.add('active');
}

async function confirmLinkResolution() {
    const { importDocId, matchId, matched, unmatched, gcPlayers, importData } = window._linkResolution;

    // Resolve unmatched
    const allMatched = [...matched];
    for (let i = 0; i < unmatched.length; i++) {
        const sel = document.getElementById(`gcLinkResolve-${i}`);
        if (!sel || !sel.value) {
            toast(`Associe o jogador "${unmatched[i].name}" antes de vincular!`, 'error');
            return;
        }
        const player = players.find(p => p.id === sel.value);
        if (player) {
            allMatched.push({ gc: unmatched[i], player, needsLink: true });
        }
    }

    await saveLinkToMatch(importDocId, matchId, allMatched, gcPlayers, importData);
    closeEditModal();
}

async function saveLinkToMatch(importDocId, matchId, allMatched, gcPlayers, importData) {
    try {
        // Read existing match data to check for existing gcStats
        const matchDoc = await db.collection('matches').doc(matchId).get();
        const matchData = matchDoc.data();
        const existingStats = matchData.gcStats || [];
        const existingRawJsons = matchData.gcRawJsons || [];
        const existingCount = matchData.gcMatchCount || 0;
        const existingGcMatchIds = matchData.gcMatchIds || [];

        // ── Duplicate check: verify gcMatchId isn't already linked anywhere ──
        const gcMatchId = importData.gcMatchId || '';
        if (gcMatchId) {
            // Check 1: matches with gcMatchIds field (new format)
            const dupSnap = await db.collection('matches')
                .where('gcMatchIds', 'array-contains', gcMatchId)
                .get();
            if (dupSnap.size > 0) {
                const dupDoc = dupSnap.docs[0];
                toast(`⚠️ Partida GC #${gcMatchId} já está vinculada ao confronto "${dupDoc.data().name || dupDoc.id}"!`, 'error');
                return;
            }
            // Check 2: gc-imports already linked (backward compat for old data)
            const impSnap = await db.collection('gc-imports')
                .where('gcMatchId', '==', gcMatchId)
                .where('status', '==', 'used')
                .get();
            const linkedImp = impSnap.docs.find(d => d.data().linkedMatchId && d.data().linkedMatchId !== matchId);
            if (linkedImp) {
                const linkedMatchId = linkedImp.data().linkedMatchId;
                const linkedDoc = await db.collection('matches').doc(linkedMatchId).get();
                if (linkedDoc.exists) {
                    const ld = linkedDoc.data();
                    // Verify match still has this GC match linked (not stale)
                    const hasInIds = (ld.gcMatchIds || []).includes(gcMatchId);
                    const hasGcData = !ld.gcMatchIds && (ld.gcStats || []).length > 0;
                    if (hasInIds || hasGcData) {
                        toast(`⚠️ Partida GC #${gcMatchId} já está vinculada ao confronto "${ld.name || linkedMatchId}"!`, 'error');
                        return;
                    }
                }
            }
        }

        // Determine next gcMatchIdx
        const nextIdx = existingCount > 0 ? existingCount + 1 : 1;

        const batch = db.batch();

        // Link gcIds on players that need it
        for (const entry of allMatched) {
            if (entry.needsLink && entry.gc.gcId) {
                batch.update(db.collection('players').doc(entry.player.id), { gcId: entry.gc.gcId });
            }
        }

        // Build lookup
        const gcToPlayer = {};
        allMatched.forEach(entry => {
            const key = entry.gc.gcId || entry.gc.name.toLowerCase();
            gcToPlayer[key] = entry;
        });

        // Build new gcStats entries
        const newStats = [];
        gcPlayers.forEach(gc => {
            const key = gc.gcId || gc.name.toLowerCase();
            const linked = gcToPlayer[key];
            if (!linked) return;
            newStats.push({
                playerId: linked.player.id,
                playerName: linked.player.name,
                gcName: gc.name,
                gcId: gc.gcId || '',
                avatar: gc.avatar || '',
                k: gc.k, a: gc.a, d: gc.d, diff: gc.diff,
                adr: gc.adr, kdr: gc.kdr, kast: gc.kast,
                fk: gc.fk, rp: gc.rp,
                win: gc.win != null ? gc.win : (gc.rp >= 0),
                teamName: gc.teamName || '',
                teamScore: gc.teamScore != null ? gc.teamScore : null,
                gcMatchIdx: nextIdx
            });
        });

        // Merge with existing stats
        const mergedStats = [...existingStats, ...newStats];
        const mergedRawJsons = [...existingRawJsons, JSON.stringify(gcPlayers)];
        const mergedGcMatchIds = [...existingGcMatchIds, gcMatchId || ''];
        const newCount = existingCount > 0 ? existingCount + 1 : 1;

        // ── Sync result teams with GC teams ──
        const updateData = {
            gcStats: mergedStats,
            gcMatchCount: newCount,
            gcRawJsons: mergedRawJsons,
            gcMatchIds: mergedGcMatchIds
        };

        if (matchData.result && matchData.result.teamA && matchData.result.teamB) {
            const teamNames = [...new Set(newStats.map(s => s.teamName).filter(Boolean))];
            if (teamNames.length === 2) {
                const gcTeamA = teamNames[0];
                const gcTeamB = teamNames[1];
                const playersInA = new Set(newStats.filter(s => s.teamName === gcTeamA).map(s => s.playerId));
                const playersInB = new Set(newStats.filter(s => s.teamName === gcTeamB).map(s => s.playerId));

                const allPlayers = [...matchData.result.teamA, ...matchData.result.teamB];
                // If currentLevel is missing, recalculate from votes
                let levelMap = {};
                const hasLevels = allPlayers.some(p => p.currentLevel != null);
                if (!hasLevels && matchData.players) {
                    const votesSnap = await db.collection('matches').doc(matchId).collection('votes').get();
                    if (!votesSnap.empty) {
                        const averages = computeAverages(matchData.players, votesSnap.docs);
                        matchData.players.forEach(p => {
                            levelMap[p.id] = averages[p.id] ? Math.round(averages[p.id].avg) : 10;
                        });
                    }
                }
                const enrichedPlayers = allPlayers.map(p => ({
                    ...p,
                    currentLevel: p.currentLevel != null ? p.currentLevel : (levelMap[p.id] || 10)
                }));
                const newTeamA = enrichedPlayers.filter(p => playersInA.has(p.id));
                const newTeamB = enrichedPlayers.filter(p => playersInB.has(p.id));

                // Only override if all players were matched to a GC team
                if (newTeamA.length > 0 && newTeamB.length > 0 && newTeamA.length + newTeamB.length === enrichedPlayers.length) {
                    const sumA = newTeamA.reduce((s, p) => s + (p.currentLevel || 10), 0);
                    const sumB = newTeamB.reduce((s, p) => s + (p.currentLevel || 10), 0);
                    updateData.result = { teamA: newTeamA, teamB: newTeamB, sumA, sumB };
                }
            }
        }

        // Save on match
        batch.update(db.collection('matches').doc(matchId), updateData);

        // Mark import as used
        batch.update(db.collection('gc-imports').doc(importDocId), { status: 'used', linkedMatchId: matchId });

        await batch.commit();
        const label = newCount > 1 ? ` (partida GC #${nextIdx})` : '';
        toast(`✅ Stats vinculadas com sucesso! (${newStats.length} jogadores)${label}`, 'success');
        loadPendingGCImports();
        loadAdminMatches();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

async function deleteGCImport(docId) {
    if (!confirm('Descartar esta importação?')) return;
    await db.collection('gc-imports').doc(docId).delete();
    toast('Import descartado.', 'success');
    loadPendingGCImports();
}

async function unlinkGCMatch(matchId, gcMatchIdx) {
    if (!confirm(`Desvincular partida GC #${gcMatchIdx} deste confronto?`)) return;
    try {
        const doc = await db.collection('matches').doc(matchId).get();
        const m = doc.data();
        const remaining = (m.gcStats || []).filter(s => (s.gcMatchIdx || 1) !== gcMatchIdx);
        const remainingRaw = (m.gcRawJsons || []).filter((_, i) => (i + 1) !== gcMatchIdx);
        const remainingIds = (m.gcMatchIds || []).filter((_, i) => (i + 1) !== gcMatchIdx);

        // Reindex gcMatchIdx sequentially
        let currentIdx = 0;
        let lastIdx = 0;
        remaining.forEach(s => {
            if ((s.gcMatchIdx || 1) !== lastIdx) {
                currentIdx++;
                lastIdx = s.gcMatchIdx || 1;
            }
            s.gcMatchIdx = currentIdx;
        });

        const newCount = currentIdx;

        if (remaining.length === 0) {
            await db.collection('matches').doc(matchId).update({
                gcStats: firebase.firestore.FieldValue.delete(),
                gcMatchCount: firebase.firestore.FieldValue.delete(),
                gcRawJsons: firebase.firestore.FieldValue.delete(),
                gcMatchIds: firebase.firestore.FieldValue.delete()
            });
        } else {
            await db.collection('matches').doc(matchId).update({
                gcStats: remaining,
                gcMatchCount: newCount,
                gcRawJsons: remainingRaw,
                gcMatchIds: remainingIds
            });
        }

        toast('✅ Partida GC desvinculada!', 'success');
        loadAdminMatches();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

function addGCMatchSlot() {
    gcSlotCount++;
    const idx = gcSlotCount;
    const container = document.getElementById('gcMatchSlots');
    const slot = document.createElement('div');
    slot.id = `gcSlot-${idx}`;
    slot.style.cssText = 'position:relative;margin-bottom:10px;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:12px;background:rgba(255,255,255,0.02);transition:border-color 0.2s;';
    slot.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:14px;color:var(--ct-blue);letter-spacing:1px;">🎮 PARTIDA ${idx}</span>
            <div style="display:flex;align-items:center;gap:8px;">
                <span id="gcSlotStatus-${idx}" style="font-size:11px;color:var(--text-dim);"></span>
                ${idx > 1 ? `<button onclick="removeGCMatchSlot(${idx})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:18px;padding:0 4px;line-height:1;opacity:0.6;transition:opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'" title="Remover partida">✕</button>` : ''}
            </div>
        </div>
        <textarea id="gcJsonInput-${idx}" rows="2" placeholder='Cole aqui o JSON da partida ${idx} (Ctrl+V)...'
            oninput="validateGCSlot(${idx})"
            style="width:100%;padding:10px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:var(--text);font-family:monospace;font-size:12px;resize:vertical;"></textarea>
    `;
    container.appendChild(slot);
    slot.querySelector('textarea').focus();
}

function removeGCMatchSlot(idx) {
    const slot = document.getElementById(`gcSlot-${idx}`);
    if (slot) {
        slot.style.opacity = '0';
        slot.style.transform = 'translateX(20px)';
        slot.style.transition = 'opacity 0.2s, transform 0.2s';
        setTimeout(() => slot.remove(), 200);
    }
}

function validateGCSlot(idx) {
    const textarea = document.getElementById(`gcJsonInput-${idx}`);
    const status = document.getElementById(`gcSlotStatus-${idx}`);
    const slot = document.getElementById(`gcSlot-${idx}`);
    const raw = textarea.value.trim();
    if (!raw) {
        status.textContent = '';
        slot.style.borderColor = 'rgba(255,255,255,0.06)';
        return;
    }
    try {
        const data = JSON.parse(raw);
        if (!Array.isArray(data) || data.length === 0) throw new Error();

        // Check snippet version
        const isV2 = data[0]._v === 2;

        // Sanity checks on data
        const warnings = [];
        data.forEach(p => {
            if (p.k < 0 || p.d < 0 || p.a < 0) warnings.push(`${p.name}: kills/deaths/assists negativos`);
            if (p.kdr > 10) warnings.push(`${p.name}: KDR=${p.kdr} (muito alto)`);
            if (p.adr > 500) warnings.push(`${p.name}: ADR=${p.adr} (muito alto)`);
            if (p.k === 0 && p.d === 0 && p.a === 0) warnings.push(`${p.name}: todas stats zeradas`);
            const requiredFields = ['k', 'a', 'd', 'kdr'];
            const missingFields = requiredFields.filter(f => !(f in p));
            if (missingFields.length > 0) warnings.push(`${p.name}: campos faltando (${missingFields.join(',')})`);
        });

        if (warnings.length > 0) {
            status.innerHTML = `⚠️ ${data.length} jogadores - <span style="color:var(--yellow);cursor:pointer;" title="${warnings.join('\n')}">${warnings.length} aviso(s)</span>`;
            status.style.color = 'var(--yellow)';
            slot.style.borderColor = 'rgba(255,214,0,0.3)';
        } else {
            status.textContent = `✅ ${data.length} jogadores${isV2 ? ' (v2)' : ''}`;
            status.style.color = 'var(--green)';
            slot.style.borderColor = 'rgba(0,200,83,0.3)';
        }
    } catch {
        status.textContent = '❌ JSON inválido';
        status.style.color = 'var(--red)';
        slot.style.borderColor = 'rgba(255,61,61,0.3)';
    }
}

function processAllGCMatches() {
    const slots = document.querySelectorAll('[id^="gcJsonInput-"]');
    if (slots.length === 0) {
        toast('Adicione pelo menos uma partida primeiro!', 'error');
        return;
    }

    gcAggregated = {};
    gcMatchCount = 0;
    let totalPlayers = 0;
    let errors = [];

    slots.forEach(textarea => {
        const raw = textarea.value.trim();
        const slotId = textarea.id.replace('gcJsonInput-', '');
        if (!raw) return;

        let players;
        try {
            players = JSON.parse(raw);
            if (!Array.isArray(players) || players.length === 0) throw new Error();
        } catch {
            errors.push(`Partida ${slotId}`);
            return;
        }

        gcMatchCount++;
        totalPlayers += players.length;

        players.forEach(p => {
            const key = p.name;
            if (gcAggregated[key]) {
                const e = gcAggregated[key];
                e.kills += (p.k || 0);
                e.assists += (p.a || 0);
                e.deaths += (p.d || 0);
                e.diff += (p.diff || 0);
                e.adrSum += (p.adr || 0);
                e.kdrSum += (p.kdr || 0);
                e.kastSum += (p.kast || 0);
                e.fk += (p.fk || 0);
                e.rp += (p.rp || 0);
                e.matches += 1;
                const isWin = p.win != null ? p.win : ((p.rp || 0) >= 0);
                e.wins += (isWin ? 1 : 0);
                e.losses += (isWin ? 0 : 1);
                if (!e.avatar && p.avatar) e.avatar = p.avatar;
            } else {
                gcAggregated[key] = {
                    name: p.name,
                    avatar: p.avatar || '',
                    kills: p.k || 0,
                    assists: p.a || 0,
                    deaths: p.d || 0,
                    diff: p.diff || 0,
                    adrSum: p.adr || 0,
                    kdrSum: p.kdr || 0,
                    kastSum: p.kast || 0,
                    fk: p.fk || 0,
                    rp: p.rp || 0,
                    matches: 1,
                    wins: (p.win != null ? p.win : ((p.rp || 0) >= 0)) ? 1 : 0,
                    losses: (p.win != null ? p.win : ((p.rp || 0) >= 0)) ? 0 : 1,
                };
            }
        });
    });

    if (gcMatchCount === 0) {
        toast(errors.length ? `JSON inválido em: ${errors.join(', ')}` : 'Nenhum dado para processar!', 'error');
        return;
    }

    let msg = `✅ ${gcMatchCount} partida${gcMatchCount > 1 ? 's' : ''} processada${gcMatchCount > 1 ? 's' : ''}!`;
    if (errors.length) msg += ` ⚠️ Erro em: ${errors.join(', ')}`;
    toast(msg, errors.length ? 'error' : 'success');
    renderGCStats();
}

function renderGCStats() {
    const el = document.getElementById('gcStatsResult');
    const entries = Object.values(gcAggregated);
    if (!entries.length) { el.innerHTML = ''; return; }

    // ── Rating MiRB 1.1 ──
    // Pesos: ADR 25%, KAST 25%, K/D 20%, FK 10%, WIN 5%, Partidas 15%
    const W_ADR = 0.25, W_KAST = 0.25, W_KD = 0.20, W_FK = 0.10, W_WIN = 0.05, W_MATCHES = 0.15;

    // Calcular stats médias de cada jogador (FK média por partida)
    entries.forEach(p => {
        p.avgAdr  = p.adrSum / p.matches;
        p.avgKast = p.kastSum / p.matches;
        p.avgKdr  = p.deaths > 0 ? p.kills / p.deaths : p.kills;
        p.avgFk   = p.matches > 0 ? p.fk / p.matches : 0;
        p.winPct  = p.matches > 0 ? (p.wins / p.matches) * 100 : 0;
    });

    // Encontrar máximos para normalização
    const maxAdr     = Math.max(...entries.map(p => p.avgAdr));
    const maxKast    = Math.max(...entries.map(p => p.avgKast));
    const maxKd      = Math.max(...entries.map(p => p.avgKdr));
    const maxFk      = Math.max(...entries.map(p => p.avgFk));
    const maxWin     = Math.max(...entries.map(p => p.winPct));
    const maxMatches = Math.max(...entries.map(p => p.matches));

    entries.forEach(p => {
        const nAdr     = maxAdr     > 0 ? (p.avgAdr  / maxAdr)     * 100 : 0;
        const nKast    = maxKast    > 0 ? (p.avgKast / maxKast)    * 100 : 0;
        const nKd      = maxKd      > 0 ? (p.avgKdr  / maxKd)      * 100 : 0;
        const nFk      = maxFk      > 0 ? (p.avgFk   / maxFk)      * 100 : 0;
        const nWin     = maxWin     > 0 ? (p.winPct  / maxWin)     * 100 : 0;
        const nMatches = maxMatches > 0 ? Math.max(0.1, p.matches / maxMatches) * 100 : 0;

        p.rawScore = nAdr * W_ADR + nKast * W_KAST + nKd * W_KD + nFk * W_FK + nWin * W_WIN + nMatches * W_MATCHES;
    });

    // Regressão à média
    const avgRating    = entries.reduce((s, p) => s + p.rawScore, 0) / entries.length;
    const regThreshold = Math.ceil(maxMatches * 0.7);

    entries.forEach(p => {
        const confidence = Math.min(1, p.matches / regThreshold);
        p.ratingMiRB = confidence * p.rawScore + (1 - confidence) * avgRating;
    });

    // Ordenar por Rating MiRB
    entries.sort((a, b) => b.ratingMiRB - a.ratingMiRB);

    let html = `
        <div class="card" style="overflow-x:auto;">
            <div class="card-title">🏆 Ranking MiRB 1.0 — ${gcMatchCount} partida${gcMatchCount > 1 ? 's' : ''}</div>

            ${entries.length >= 3 ? `
            <div style="display:flex;justify-content:center;align-items:flex-end;gap:16px;margin:20px 0 30px;padding:20px 10px;">
                ${gcPodiumSlot(entries[1], 2, '🥈', 'var(--text-dim)', '90px')}
                ${gcPodiumSlot(entries[0], 1, '🥇', 'var(--yellow)', '120px')}
                ${gcPodiumSlot(entries[2], 3, '🥉', '#cd7f32', '70px')}
            </div>` : ''}

            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:var(--text-dim);font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">
                        <th style="padding:10px 6px;text-align:left;">#</th>
                        <th style="padding:10px 6px;text-align:left;">Jogador</th>
                        <th style="padding:10px 6px;text-align:center;">Rating</th>
                        <th style="padding:10px 6px;text-align:center;">K</th>
                        <th style="padding:10px 6px;text-align:center;">A</th>
                        <th style="padding:10px 6px;text-align:center;">D</th>
                        <th style="padding:10px 6px;text-align:center;">Diff</th>
                        <th style="padding:10px 6px;text-align:center;">ADR</th>
                        <th style="padding:10px 6px;text-align:center;">KDR</th>
                        <th style="padding:10px 6px;text-align:center;">KAST</th>
                        <th style="padding:10px 6px;text-align:center;">FK</th>
                        <th style="padding:10px 6px;text-align:center;">RP</th>
                        <th style="padding:10px 6px;text-align:center;">W/L</th>
                    </tr>
                </thead>
                <tbody>`;

    entries.forEach((p, idx) => {
        const avgAdr = p.avgAdr.toFixed(1);
        const avgKdr = p.avgKdr.toFixed(2);
        const avgKast = p.avgKast.toFixed(0);
        const diffColor = p.diff > 0 ? 'var(--green)' : p.diff < 0 ? 'var(--red)' : 'var(--text-dim)';
        const rpColor = p.rp >= 0 ? 'var(--blue)' : 'var(--red)';
        const kdrColor = avgKdr >= 1 ? 'var(--green)' : 'var(--yellow)';
        const ratingColor = p.ratingMiRB >= 70 ? 'var(--green)' : p.ratingMiRB >= 50 ? 'var(--yellow)' : 'var(--red)';
        const multLabel = '';

        html += `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.04);${idx < 3 ? 'background:rgba(255,255,255,0.03);' : ''}">
                <td style="padding:10px 6px;color:var(--text-dim);font-family:'Rajdhani',sans-serif;font-weight:700;">
                    ${idx < 3 ? ['🥇','🥈','🥉'][idx] : idx + 1}
                </td>
                <td style="padding:10px 6px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        ${p.avatar ? `<img src="${p.avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;background:#222;">` : `<div style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.08);"></div>`}
                        <div>
                            <span style="font-family:'Rajdhani',sans-serif;font-weight:600;font-size:15px;color:var(--yellow);">${p.name}</span>
                            ${p.matches > 1 ? `<span style="color:var(--text-dim);font-size:11px;margin-left:4px;">(${p.matches}p)</span>` : ''}
                        </div>
                    </div>
                </td>
                <td style="padding:10px 6px;text-align:center;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:16px;color:${ratingColor};">
                    ${p.ratingMiRB.toFixed(1)}${multLabel}
                </td>
                <td style="padding:10px 6px;text-align:center;color:var(--green);font-weight:700;font-family:'Rajdhani',sans-serif;font-size:16px;">${p.kills}</td>
                <td style="padding:10px 6px;text-align:center;color:var(--text);">${p.assists}</td>
                <td style="padding:10px 6px;text-align:center;color:var(--red);">${p.deaths}</td>
                <td style="padding:10px 6px;text-align:center;color:${diffColor};font-weight:600;">${p.diff > 0 ? '+' : ''}${p.diff}</td>
                <td style="padding:10px 6px;text-align:center;">${avgAdr}</td>
                <td style="padding:10px 6px;text-align:center;color:${kdrColor};font-weight:600;">${avgKdr}</td>
                <td style="padding:10px 6px;text-align:center;">${avgKast}%</td>
                <td style="padding:10px 6px;text-align:center;">${p.fk}</td>
                <td style="padding:10px 6px;text-align:center;color:${rpColor};font-weight:700;font-family:'Rajdhani',sans-serif;font-size:15px;">${p.rp > 0 ? '+' : ''}${p.rp}</td>
                <td style="padding:10px 6px;text-align:center;">
                    <span style="color:var(--green);">${p.wins}W</span> <span style="color:var(--red);">${p.losses}L</span>
                </td>
            </tr>`;
    });

    html += `</tbody></table></div>`;
    el.innerHTML = html;
}

function gcPodiumSlot(player, pos, medal, color, height) {
    const avgAdr = (player.avgAdr || (player.adrSum / player.matches)).toFixed(1);
    const avgKdr = (player.avgKdr || (player.deaths > 0 ? player.kills / player.deaths : player.kills)).toFixed(2);
    const rating = player.ratingMiRB != null ? player.ratingMiRB.toFixed(1) : '—';
    return `
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;${pos === 1 ? 'margin-bottom:20px;' : ''}">
            <span style="font-size:28px;">${medal}</span>
            ${player.avatar ? `<img src="${player.avatar}" style="width:${pos===1?'64px':'48px'};height:${pos===1?'64px':'48px'};border-radius:50%;object-fit:cover;border:3px solid ${color};box-shadow:0 0 15px ${color}33;">` : ''}
            <span style="font-family:'Rajdhani',sans-serif;font-size:${pos === 1 ? '18px' : '15px'};font-weight:700;color:${color};">${player.name}</span>
            <span style="font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700;color:var(--green);">${rating}</span>
            <span style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;">Rating MiRB</span>
            <div style="display:flex;gap:8px;font-size:11px;color:var(--text-dim);">
                <span>ADR ${avgAdr}</span>
                <span>KDR ${avgKdr}</span>
                <span>${player.wins}W ${player.losses}L</span>
            </div>
            <div style="width:70px;height:${height};background:linear-gradient(180deg,${color}22,transparent);border-radius:6px 6px 0 0;margin-top:4px;"></div>
        </div>`;
}

function clearGCStats() {
    gcAggregated = {};
    gcMatchCount = 0;
    gcSlotCount = 0;
    document.getElementById('gcMatchSlots').innerHTML = '';
    document.getElementById('gcStatsResult').innerHTML = '';
    addGCMatchSlot();
    toast('Dados limpos!', 'success');
}

function dashDateMask(input) {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
    if (v.length > 5) v = v.slice(0, 5) + '/' + v.slice(5, 9);
    input.value = v;
    if (v.length === 10) document.getElementById('dashFilterWeek').value = '';
}

