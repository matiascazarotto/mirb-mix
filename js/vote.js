// ╔══════════════════════════════════╗
// ║       VOTING PAGE (Public)      ║
// ╚══════════════════════════════════╝
async function loadVotePage() {
    destroyMural();
    destroyPollListener();
    const el = document.getElementById('voteContent');
    el.innerHTML = '<div class="loading-spinner">Carregando partidas</div>';

    // Check if ouvidoria / re-sort / escolha de mapa are enabled
    const _settings = await Store.getSettings();
    const ouvidoriaEnabled = _settings.ouvidoriaEnabled !== false;
    const resortEnabled = _settings.resortEnabled !== false;
    const mapSelectEnabled = _settings.mapSelectEnabled !== false;

    const muralHtml = ouvidoriaEnabled ? `
        <div class="mural-container" style="margin-top:24px;">
            <div style="border-top:1px solid rgba(255,255,255,0.06);margin-bottom:20px;"></div>
            <div class="mural-title">📢 Ouvidoria MiRB</div>
            <div style="text-align:center;font-size:11px;color:var(--text-dim);margin-top:-10px;margin-bottom:14px;opacity:0.6;">mensagens expiram em 24 horas</div>
            <div class="mural-form">
                <input type="text" id="muralText" placeholder="Registre sua reclamação..." maxlength="200">
                <div class="mural-form-actions">
                    <div style="position:relative;flex:1;">
                        <button type="button" id="muralTargetBtn" onclick="toggleMuralDropdown()" style="width:100%;padding:10px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text-dim);font-size:13px;font-family:inherit;cursor:pointer;white-space:nowrap;">Sobre quem? ▾</button>
                        <input type="hidden" id="muralTarget" value="">
                        <div id="muralDropdown" style="display:none;position:absolute;top:100%;left:0;right:0;margin-top:4px;background:var(--card);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:6px;z-index:100;max-height:200px;overflow-y:auto;min-width:160px;box-shadow:0 8px 24px rgba(0,0,0,0.4);"></div>
                    </div>
                    <button class="btn btn-primary btn-small" onclick="postMural()" style="white-space:nowrap;">📤 Postar</button>
                </div>
            </div>
            <div id="muralAuthorLine" style="font-size:12px;color:var(--text-dim);margin:-12px 0 16px;"></div>
            <div id="muralPosts"></div>
        </div>
    ` : '';

    try {
        // Partidas vêm do Store (cache em memória + tempo real) — zero queries aqui.
        // _snap adapta os objetos ao formato de QuerySnapshot pro código abaixo não mudar.
        const [allMatches, jornalSnap] = await Promise.all([
            Store.getMatches(),
            db.collection('jornal').orderBy('weekStart', 'desc').limit(1).get()
        ]);
        const _snap = arr => ({ docs: arr.map(m => ({ id: m.id, data: () => m })), empty: arr.length === 0 });
        const openSnap = _snap(allMatches.filter(m => m.status === 'open'));
        const votingSnap = _snap(allMatches.filter(m => m.status === 'voting'));
        const teamVoteSnap = _snap(allMatches.filter(m => m.status === 'team_vote'));
        const mapVoteSnap = _snap(mapSelectEnabled ? allMatches.filter(m => m.mapVote === 'open') : []);

        // Build badge map: playerName → array of emoji strings
        const badgeMap = {};
        if (!jornalSnap.empty) {
            const jornal = jornalSnap.docs[0].data();
            (jornal.badges || []).forEach(b => {
                if (!badgeMap[b.player]) badgeMap[b.player] = [];
                badgeMap[b.player].push({ emoji: b.emoji, label: b.label });
            });
        }
        const getBadgeHtml = (name) => {
            if (!badgeMap[name]) return '';
            return badgeMap[name].map(b => `<span title="${b.label}" style="cursor:help;font-size:14px;">${b.emoji}</span>`).join('');
        };

        // ── Build Escalação HTML for open/voting matches ──
        let escalacaoHtml = '';
        const escalacaoMatches = [...openSnap.docs, ...votingSnap.docs].filter(d => {
            const m = d.data();
            return m.players && m.players.length > 0 && !(m.result && m.result.teamA);
        });
        if (escalacaoMatches.length > 0) {
            // Avatar map from gcStats — direto do cache do Store, sem query
            let avatarMap = {};
            allMatches.slice(0, 20).forEach(m => {
                (m.gcStats || []).forEach(g => {
                    if (g.avatar && g.playerName && !avatarMap[g.playerName]) avatarMap[g.playerName] = g.avatar;
                });
            });

            for (const doc of escalacaoMatches) {
                const m = doc.data();
                const matchId = doc.id;
                const pCount = m.players.length;
                const statusTag = m.status === 'open' ? '⚪ Aguardando Jogadores' : '🟢 Votação';

                const avatarsHtml = m.players.map(p => {
                    const av = avatarMap[p.name];
                    return av
                        ? `<img src="${av}" title="${p.name}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.1);">`
                        : `<div title="${p.name}" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid rgba(255,255,255,0.1);">👤</div>`;
                }).join('');

                escalacaoHtml += `
                    <div style="background:var(--card);border-radius:12px;padding:16px;border:1px solid rgba(255,255,255,0.06);margin-bottom:12px;max-width:480px;margin-left:auto;margin-right:auto;">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                            <div>
                                <span style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:16px;color:#e8eaf0;">🎮 ${m.name || 'Mix da Noite'}</span>
                                <span style="font-size:11px;color:var(--text-dim);margin-left:8px;">${statusTag}</span>
                            </div>
                            <div style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:14px;color:${pCount >= 10 ? 'var(--green)' : 'var(--yellow)'};">${pCount}/10</div>
                        </div>
                        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;">
                            ${avatarsHtml}
                        </div>
                        <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                            <button class="btn btn-secondary btn-small" onclick="shareMatchImage('${matchId}')" style="font-size:11px;">📸 Compartilhar</button>
                            <span style="font-size:11px;color:var(--text-dim);line-height:1.3;">${m.players.map(p => p.name).join(', ')}</span>
                        </div>
                    </div>`;
            }
        }

        // Pre-generate images in background for instant sharing
        const _preGenIds = escalacaoMatches.map(d => d.id);
        const _triggerPreGen = () => _preGenIds.forEach(id => preGenerateMatchImage(id));

        if (votingSnap.empty && teamVoteSnap.empty && mapVoteSnap.empty) {
            // Check for active poll
            let pollHtml = '';
            try {
                const pollSnap = await db.collection('polls').where('status', '==', 'active').limit(1).get();
                if (!pollSnap.empty) {
                    const poll = pollSnap.docs[0].data();
                    const pollId = pollSnap.docs[0].id;
                    const now = new Date();
                    const start = poll.startDate.toDate();
                    const end = poll.endDate.toDate();
                    if (now >= start && now <= end) {
                        pollHtml = await renderPollCard(pollId, poll);
                    }
                }
            } catch (e) { console.warn('[Poll] Error loading poll:', e); }

            el.innerHTML = `
                ${escalacaoHtml}
                ${pollHtml || (!escalacaoHtml ? `<div class="empty-state">
                    <div class="icon">🗳️</div>
                    <p>Nenhuma partida aberta para votação.</p>
                </div>` : '')}
                ${muralHtml}
            `;
            if (ouvidoriaEnabled) initMural();
            if (pollHtml) initPollListener(document.querySelector('[data-poll-id]')?.dataset.pollId);
            _triggerPreGen();
            return;
        }

        // Get voter device ID once for both sections
        const _voter = await getVoterDeviceId();

        // ── Team Vote Cards ──
        let teamVoteHtml = '';
        const teamVoteMatchIds = [];

        // Elegibilidade/já-votou de todos os cards em paralelo (era sequencial)
        const _tvChecks = await Promise.all(teamVoteSnap.docs.map(async doc => {
            const m = doc.data();
            const matchId = doc.id;

            // Check eligibility: did this device vote in level votes?
            let isEligible = false;
            if (_voter.deviceId !== 'unknown_') {
                const existingLevelVote = await db.collection('matches').doc(matchId)
                    .collection('votes').where('_meta.deviceId', '==', _voter.deviceId).limit(1).get();
                isEligible = !existingLevelVote.empty;
            }

            const round = m.teamVoteRound || 1;

            // Check if already team-voted (localStorage by round + server)
            let alreadyVoted = localStorage.getItem(`teamVoted_${matchId}`) == round;
            if (!alreadyVoted && isEligible && _voter.deviceId !== 'unknown_') {
                const existingTeamVote = await db.collection('matches').doc(matchId)
                    .collection('teamVotes').where('_meta.deviceId', '==', _voter.deviceId).limit(1).get();
                if (!existingTeamVote.empty) {
                    alreadyVoted = true;
                    localStorage.setItem(`teamVoted_${matchId}`, String(round));
                }
            }
            return { isEligible, alreadyVoted, round };
        }));

        teamVoteSnap.docs.forEach((doc, _ti) => {
            const m = doc.data();
            const matchId = doc.id;
            const { isEligible, alreadyVoted, round } = _tvChecks[_ti];
            const diff = m.result ? Math.abs(m.result.sumA - m.result.sumB) : 0;

            teamVoteHtml += `
                <div class="match-card team_vote">
                    <div class="match-header">
                        <div class="match-title">${m.name}</div>
                        <span class="match-status team_vote">🔵 Confirmação${round > 1 ? ' #' + round : ''}</span>
                    </div>
                    ${m.chosenMap ? `<div style="text-align:center;margin:8px 0 -4px;font-size:13px;color:var(--text);">🗺️ Mapa: <strong style="color:var(--yellow);">${m.chosenMap.emoji || ''} ${m.chosenMap.name}</strong></div>` : ''}

                    <div style="text-align:center;margin:12px 0;padding:10px;border-radius:8px;background:rgba(0,0,0,0.3);">
                        <span style="color:var(--text-dim);font-size:13px;">Diferença: </span>
                        <span style="font-family:'Rajdhani',sans-serif;font-size:24px;font-weight:700;color:${diff <= 2 ? 'var(--green)' : 'var(--yellow)'};">${diff}</span>
                        <span style="color:var(--text-dim);font-size:13px;"> ponto(s)</span>
                        ${diff <= 2 ? '<br><span style="color:var(--green);font-size:12px;">✅ Times Balanceados!</span>' : ''}
                    </div>

                    <div class="teams-grid">
                        <div class="team-card ct">
                            <div class="team-label">Time A</div>
                            ${m.result.teamA.map(p => `
                                <div class="team-player">
                                    <span class="team-player-name">${p.name}</span>
                                    <div class="team-player-info">
                                        <span class="badge badge-role">${p.role}</span>
                                        <span class="badge badge-level">Nv.${p.currentLevel != null ? p.currentLevel : '?'}</span>
                                    </div>
                                </div>
                            `).join('')}
                            <div class="team-total" style="color:var(--ct-blue)">Total: ${m.result.sumA}</div>
                        </div>
                        <div class="team-card tr">
                            <div class="team-label">Time B</div>
                            ${m.result.teamB.map(p => `
                                <div class="team-player">
                                    <span class="team-player-name">${p.name}</span>
                                    <div class="team-player-info">
                                        <span class="badge badge-role">${p.role}</span>
                                        <span class="badge badge-level">Nv.${p.currentLevel != null ? p.currentLevel : '?'}</span>
                                    </div>
                                </div>
                            `).join('')}
                            <div class="team-total" style="color:var(--tr-gold)">Total: ${m.result.sumB}</div>
                        </div>
                    </div>

                    <!-- Vote progress (live via onSnapshot) -->
                    <div id="tvProgress-${matchId}" style="margin:16px 0;">
                        <div style="text-align:center;color:var(--text-dim);font-size:12px;">Carregando votos...</div>
                    </div>

                    ${!isEligible ? `
                        <div style="text-align:center;padding:16px;color:var(--text-dim);font-size:13px;">
                            ⚠️ Você não votou nos níveis desta partida.
                        </div>
                    ` : alreadyVoted ? `
                        <div style="text-align:center;padding:16px;color:var(--green);">
                            ✅ Você já votou nesta confirmação!
                        </div>
                    ` : `
                        <div class="team-vote-buttons">
                            <button class="team-vote-btn keep" onclick="submitTeamVote('${matchId}', 'keep')">
                                👍 Manter Times
                            </button>
                            ${resortEnabled ? `
                            <button class="team-vote-btn resort" onclick="submitTeamVote('${matchId}', 'resort')">
                                👎 Sortear Novamente
                            </button>
                            ` : ''}
                        </div>
                    `}
                </div>
            `;
            teamVoteMatchIds.push(matchId);
        });

        // ── Level Voting Cards ──
        // Assign display names for duplicate match names
        const votingMatches = votingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        assignDisplayNames(votingMatches);
        const voteNameMap = {};
        votingMatches.forEach(m => { voteNameMap[m.id] = m.displayName; });

        // Check deviceId against existing votes for each match
        const deviceVotedMap = {};
        if (_voter.deviceId !== 'unknown_') {
            await Promise.all(votingSnap.docs.map(async doc => {
                if (localStorage.getItem(`voted_${doc.id}`)) return;
                const existing = await db.collection('matches').doc(doc.id)
                    .collection('votes').where('_meta.deviceId', '==', _voter.deviceId).limit(1).get();
                if (!existing.empty) {
                    deviceVotedMap[doc.id] = true;
                    localStorage.setItem(`voted_${doc.id}`, 'true');
                }
            }));
        }

        // Níveis lembrados do último voto deste dispositivo (por jogador)
        const lastVotes = getLastVotes();

        let html = '';
        votingSnap.docs.forEach(doc => {
            const m = doc.data();
            m.displayName = voteNameMap[doc.id];
            const matchId = doc.id;
            const hasVoted = localStorage.getItem(`voted_${matchId}`) || deviceVotedMap[matchId];

            if (hasVoted) {
                html += `
                    <div class="match-card">
                        <div class="match-header">
                            <div class="match-title">${m.displayName || m.name}</div>
                            <span class="match-status voting">🟢 Aberta</span>
                        </div>
                        <div style="text-align:center;padding:20px;color:var(--green);">
                            ✅ Você já votou nesta partida!
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="match-card">
                        <div class="match-header">
                            <div class="match-title">${m.displayName || m.name}</div>
                            <span class="match-status voting">🟢 Aberta</span>
                        </div>
                        <p style="color:var(--text-dim);font-size:13px;margin-bottom:14px;">
                            Dê uma nota de 1 a 20 para cada jogador. Desmarque "Não sei" para votar. Você só pode votar 1 vez.
                        </p>
                        <div class="vote-grid" id="voteGrid-${matchId}">
                            ${m.players.map(p => {
                                const last = lastVotes[p.id];
                                const hasLast = last != null && last >= 1 && last <= 20;
                                const val = hasLast ? last : 10;
                                return `
                                <div class="vote-row ${hasLast ? '' : 'skipped'}" id="voteRow-${matchId}-${p.id}">
                                    <span class="player-label">${p.name} ${getBadgeHtml(p.name)}${hasLast ? `<span style="color:var(--text-dim);font-size:11px;margin-left:6px;opacity:0.7;">último: ${last}</span>` : ''}</span>
                                    <span class="role-label">${p.role}</span>
                                    <label class="vote-skip-toggle ${hasLast ? '' : 'active'}">
                                        <input type="checkbox" ${hasLast ? '' : 'checked'}
                                            id="skip-${matchId}-${p.id}"
                                            onchange="toggleVoteSkip('${matchId}','${p.id}')">
                                        Não sei
                                    </label>
                                    <div class="vote-slider-area" style="display:flex;align-items:center;gap:8px;flex:1;">
                                        <input type="range" min="1" max="20" value="${val}"
                                            id="vote-${matchId}-${p.id}"
                                            oninput="document.getElementById('disp-${matchId}-${p.id}').textContent=this.value">
                                        <span class="level-display" id="disp-${matchId}-${p.id}">${hasLast ? val : '—'}</span>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                        <button class="btn btn-primary" style="margin-top:16px;width:100%;" onclick="submitVote('${matchId}')">
                            ✅ Confirmar Voto
                        </button>
                    </div>
                `;
            }
        });

        // ── Map Vote Cards (votação de mapa — Top 3) ──
        let mapVoteHtml = '';
        let mapVoteIds = [];
        let mapPool = null;
        if (mapSelectEnabled && !mapVoteSnap.empty) {
            mapPool = await loadMapPool();
            const built = await buildMapVoteHtml(mapVoteSnap.docs, _voter, mapPool);
            mapVoteHtml = built.html;
            mapVoteIds = built.ids;
        }

        // Map vote + team vote cards first, then level voting, then ouvidoria
        el.innerHTML = escalacaoHtml + mapVoteHtml + teamVoteHtml + html + muralHtml;
        if (ouvidoriaEnabled) initMural();
        _triggerPreGen();

        // Start real-time listeners for team vote progress
        destroyTeamVoteListener();
        if (teamVoteMatchIds.length > 0) {
            const unsubscribers = [];
            teamVoteMatchIds.forEach(matchId => {
                const unsub = db.collection('matches').doc(matchId).collection('teamVotes')
                    .onSnapshot(tvSnap => {
                        const progressEl = document.getElementById(`tvProgress-${matchId}`);
                        if (!progressEl) return;

                        let keepCount = 0, resortCount = 0;
                        tvSnap.docs.forEach(d => {
                            if (d.data().vote === 'keep') keepCount++; else resortCount++;
                        });
                        const total = keepCount + resortCount;
                        const keepPct = total > 0 ? Math.round((keepCount / total) * 100) : 0;
                        const resortPct = total > 0 ? Math.round((resortCount / total) * 100) : 0;

                        progressEl.innerHTML = `
                            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
                                <span style="color:var(--green);">👍 Manter (${keepCount})</span>
                                <span style="color:var(--text-dim);">${total} voto${total !== 1 ? 's' : ''}</span>
                                <span style="color:var(--red);">👎 Re-sort (${resortCount})</span>
                            </div>
                            <div class="team-vote-bar">
                                <div class="team-vote-threshold"></div>
                                ${total > 0 ? `
                                    <div style="display:flex;height:100%;">
                                        <div class="team-vote-bar-fill keep" style="width:${keepPct}%;">${keepPct >= 15 ? keepPct + '%' : ''}</div>
                                        <div class="team-vote-bar-fill resort" style="width:${resortPct}%;">${resortPct >= 15 ? resortPct + '%' : ''}</div>
                                    </div>
                                ` : '<div style="text-align:center;line-height:28px;font-size:11px;color:var(--text-dim);">Nenhum voto ainda</div>'}
                            </div>
                            <div style="text-align:center;font-size:10px;color:var(--text-dim);margin-top:4px;">Maioria: 60%</div>
                        `;
                    });
                unsubscribers.push(unsub);
            });
            teamVoteUnsubscribe = () => unsubscribers.forEach(u => u());
        }

        // Start real-time listeners for map vote progress
        destroyMapVoteListener();
        if (mapVoteIds.length > 0 && mapPool) {
            const mapUnsubs = [];
            mapVoteIds.forEach(matchId => {
                const unsub = db.collection('matches').doc(matchId).collection('mapVotes')
                    .onSnapshot(mvSnap => renderMapVoteProgress(matchId, mvSnap.docs, mapPool));
                mapUnsubs.push(unsub);
            });
            mapVoteUnsubscribe = () => mapUnsubs.forEach(u => u());
        }
    } catch (e) {
        el.innerHTML = `<p style="color:var(--red);text-align:center;padding:30px;">Erro ao carregar: ${e.message}</p>`;
    }
}

// ╔══════════════════════════════════╗
// ║      TEAM VOTE SUBMISSION       ║
// ╚══════════════════════════════════╝
async function submitTeamVote(matchId, vote) {
    try {
        const matchDoc = await db.collection('matches').doc(matchId).get();
        const match = matchDoc.data();
        const round = match.teamVoteRound || 1;

        if (localStorage.getItem(`teamVoted_${matchId}`) == round) {
            toast('Você já votou nesta confirmação!', 'error');
            return;
        }

        if (match.status !== 'team_vote') {
            toast('Votação de times já encerrada!', 'error');
            loadVotePage();
            return;
        }

        const voter = await getVoterDeviceId();
        if (await isIPBlocked(voter.ip, 'teamVote', voter.fingerprint)) { toast('Não foi possível votar. Tente novamente mais tarde.', 'error'); return; }

        // Check eligibility: must have voted in level votes
        if (voter.deviceId !== 'unknown_') {
            const levelVote = await db.collection('matches').doc(matchId)
                .collection('votes').where('_meta.deviceId', '==', voter.deviceId).limit(1).get();
            if (levelVote.empty) {
                toast('Você não votou nos níveis e não pode participar!', 'error');
                return;
            }
        }

        // Server-side dedup
        if (voter.deviceId !== 'unknown_') {
            const existing = await db.collection('matches').doc(matchId)
                .collection('teamVotes').where('_meta.deviceId', '==', voter.deviceId).limit(1).get();
            if (!existing.empty) {
                localStorage.setItem(`teamVoted_${matchId}`, String(round));
                toast('Você já votou nesta confirmação!', 'error');
                loadVotePage();
                return;
            }
        }

        // Save vote
        const voterId = 'tv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        await db.collection('matches').doc(matchId).collection('teamVotes').doc(voterId).set({
            vote: vote,
            _meta: {
                ip: voter.ip,
                fingerprint: voter.fingerprint,
                deviceId: voter.deviceId,
                timestamp: new Date().toISOString()
            }
        });

        localStorage.setItem(`teamVoted_${matchId}`, String(round));
        toast(vote === 'keep' ? '👍 Voto para manter registrado!' : '👎 Voto para re-sort registrado!', 'success');

        // Check threshold
        await checkTeamVoteThreshold(matchId);

        loadVotePage();
    } catch (e) {
        toast('Erro ao votar: ' + e.message, 'error');
    }
}

async function checkTeamVoteThreshold(matchId) {
    const matchDoc = await db.collection('matches').doc(matchId).get();
    if (!matchDoc.exists || matchDoc.data().status !== 'team_vote') return;

    const tvSnap = await db.collection('matches').doc(matchId).collection('teamVotes').get();

    let keepCount = 0, resortCount = 0;
    tvSnap.docs.forEach(d => {
        if (d.data().vote === 'keep') keepCount++; else resortCount++;
    });

    const total = keepCount + resortCount;
    if (total === 0) return;

    // Buscar total de votantes elegíveis (quem votou nos níveis)
    const levelVotesSnap = await db.collection('matches').doc(matchId).collection('votes').get();
    const eligibleDevices = new Set();
    levelVotesSnap.docs.forEach(d => {
        const meta = d.data()._meta;
        if (meta && meta.deviceId) eligibleDevices.add(meta.deviceId);
    });
    const eligible = Math.max(eligibleDevices.size, 1);

    const THRESHOLD = 0.6;

    // Refazer times pode estar desligado pela staff — nesse caso só o "manter" fecha a partida
    let resortEnabled = true;
    try { const s = await Store.getSettings(); if (s.resortEnabled === false) resortEnabled = false; } catch (e) {}

    if (keepCount / eligible >= THRESHOLD) {
        // 60%+ dos elegíveis votaram manter → confirmar times
        await db.collection('matches').doc(matchId).update({ status: 'closed' });
        toast('✅ Times confirmados pela votação! (60%+ manter)', 'success');
    } else if (!resortEnabled) {
        // Refazer times desligado → nunca re-sorteia; aguarda mais votos de "manter"
        return;
    } else if (resortCount / eligible >= THRESHOLD) {
        // 60%+ dos elegíveis votaram re-sort → sortear novamente
        await resortTeams(matchId);
        toast('🔄 Maioria votou re-sort! Novos times sorteados.', 'success');
    } else if (total >= eligible) {
        // Todos votaram mas nenhum lado alcançou 60% → empate → re-sort
        await resortTeams(matchId);
        toast('🔄 Empate com todos os votos! Times re-sorteados.', 'success');
    }
}


// ╔══════════════════════════════════╗
// ║  TEMPO REAL — página Votar       ║
// ╚══════════════════════════════════╝
// Re-renderiza a página quando o ESTADO das partidas muda (abriu/encerrou votação,
// re-sort, mapa escolhido, escalação editada). A assinatura ignora de propósito
// mudanças que não são de estado (ex.: votos de outras pessoas chegando na
// subcoleção) pra não re-renderizar no meio do preenchimento dos sliders.
let _votePageSig = null;
let _votePageRefreshTimer = null;
Store.subscribe('matches', async () => {
    const all = await Store.getMatches();
    const sig = all
        .filter(m => ['open', 'voting', 'team_vote'].includes(m.status) || m.mapVote === 'open')
        .map(m => [
            m.id, m.status, m.teamVoteRound || 0, m.mapVote || '',
            (m.chosenMap && m.chosenMap.id) || '',
            (m.players || []).map(p => p.id).join(','),
            m.result ? m.result.sumA + '-' + m.result.sumB : ''
        ].join('|'))
        .join(';');
    const isFirst = _votePageSig === null;
    if (_votePageSig === sig) return;
    _votePageSig = sig;
    if (isFirst) return; // 1º snapshot: a carga inicial da página já usa esses dados
    if (!document.getElementById('page-vote')?.classList.contains('active')) return;
    clearTimeout(_votePageRefreshTimer);
    _votePageRefreshTimer = setTimeout(() => loadVotePage(), 400);
});
