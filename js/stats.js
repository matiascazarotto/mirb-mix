// ╔══════════════════════════════════╗
// ║       MATCHES PAGE (Public)     ║
// ╚══════════════════════════════════╝
async function loadMatchesPage() {
    const el = document.getElementById('matchesList');
    el.innerHTML = '<div class="loading-spinner">Carregando</div>';

    try {
        const snap = await db.collection('matches').orderBy('createdAt', 'desc').get();
        if (snap.empty) {
            el.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>Nenhuma partida encontrada.</p></div>';
            return;
        }

        // Assign display names for duplicate match names
        const allMatchesPage = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        assignDisplayNames(allMatchesPage);
        const pageNameMap = {};
        allMatchesPage.forEach(m => { pageNameMap[m.id] = m.displayName; });

        let html = '';
        for (const doc of snap.docs) {
            const m = doc.data();
            m.displayName = pageNameMap[doc.id];
            const matchId = doc.id;
            const date = m.createdAt ? m.createdAt.toDate().toLocaleDateString('pt-BR') : '';
            const hasGC = !!m.gcStats;
            const gcCount = m.gcMatchCount || 0;
            const playerCount = m.players ? m.players.length : 0;

            // ── Extract score from gcStats (team names + scores) ──
            let scoreHtml = '';
            if (m.gcStats && m.gcStats.length > 0) {
                const byIdx = {};
                m.gcStats.forEach(s => {
                    const idx = s.gcMatchIdx || 1;
                    if (!byIdx[idx]) byIdx[idx] = { teamA: null, teamB: null, scoreA: null, scoreB: null };
                    if (s.teamName && !byIdx[idx].teamA) {
                        byIdx[idx].teamA = s.teamName;
                        byIdx[idx].scoreA = s.teamScore;
                    } else if (s.teamName && s.teamName !== byIdx[idx].teamA && !byIdx[idx].teamB) {
                        byIdx[idx].teamB = s.teamName;
                        byIdx[idx].scoreB = s.teamScore;
                    }
                });
                const idxKeys = Object.keys(byIdx).sort((a, b) => a - b);
                const scoreItems = idxKeys.map(idx => {
                    const g = byIdx[idx];
                    if (g.teamA && g.teamB && g.scoreA != null && g.scoreB != null) {
                        const aWin = g.scoreA > g.scoreB;
                        return `<div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;flex-wrap:wrap;">
                            ${idxKeys.length > 1 ? `<span style="font-size:10px;color:var(--ct-blue);font-weight:700;margin-right:4px;">GC#${idx}</span>` : ''}
                            <span style="font-family:'Rajdhani',sans-serif;font-weight:600;font-size:14px;color:${aWin ? 'var(--green)' : 'var(--text-dim)'};">${g.teamA}</span>
                            <span style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:20px;color:${aWin ? 'var(--green)' : 'var(--red)'};">${g.scoreA}</span>
                            <span style="font-size:12px;color:var(--text-dim);">x</span>
                            <span style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:20px;color:${!aWin ? 'var(--green)' : 'var(--red)'};">${g.scoreB}</span>
                            <span style="font-family:'Rajdhani',sans-serif;font-weight:600;font-size:14px;color:${!aWin ? 'var(--green)' : 'var(--text-dim)'};">${g.teamB}</span>
                        </div>`;
                    }
                    return '';
                }).filter(Boolean);

                if (scoreItems.length > 0) {
                    scoreHtml = `<div style="display:flex;flex-direction:column;gap:6px;margin:10px 0;">${scoreItems.join('')}</div>`;
                }
            }

            // ── Compute MVP and worst player from gcStats ──
            let mvpHtml = '';
            if (m.gcStats && m.gcStats.length > 0) {
                const agg = {};
                m.gcStats.forEach(s => {
                    const key = s.playerId || s.gcName;
                    if (!agg[key]) {
                        agg[key] = { name: s.playerName, avatar: s.avatar || '', kills: 0, deaths: 0, adrSum: 0, matches: 0 };
                    }
                    agg[key].kills += s.k;
                    agg[key].deaths += s.d;
                    agg[key].adrSum += s.adr;
                    agg[key].matches++;
                });
                const entries = Object.values(agg);
                const byAdr = [...entries].sort((a, b) => (b.adrSum / b.matches) - (a.adrSum / a.matches));
                const mvp = byAdr[0];
                const worst = byAdr.length > 1 ? byAdr[byAdr.length - 1] : null;
                const mvpAdr = (mvp.adrSum / mvp.matches).toFixed(1);
                const mvpKdr = (mvp.deaths > 0 ? mvp.kills / mvp.deaths : mvp.kills).toFixed(2);

                mvpHtml = `<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;font-size:12px;">
                    <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:rgba(0,200,83,0.06);border:1px solid rgba(0,200,83,0.15);border-radius:6px;flex:1;min-width:160px;">
                        ${mvp.avatar ? `<img src="${mvp.avatar}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">` : '<span style="font-size:16px;">⭐</span>'}
                        <div>
                            <span style="color:var(--green);font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">MVP</span>
                            <div style="font-family:'Rajdhani',sans-serif;font-weight:700;color:var(--yellow);font-size:14px;line-height:1;">${mvp.name}</div>
                            <div style="color:var(--text-dim);font-size:11px;">${mvp.kills}K • ADR ${mvpAdr}</div>
                        </div>
                    </div>`;

                if (worst && worst.name !== mvp.name) {
                    const worstAdr = (worst.adrSum / worst.matches).toFixed(1);
                    mvpHtml += `
                    <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:rgba(255,61,61,0.06);border:1px solid rgba(255,61,61,0.15);border-radius:6px;flex:1;min-width:160px;">
                        ${worst.avatar ? `<img src="${worst.avatar}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">` : '<span style="font-size:16px;">🗑️</span>'}
                        <div>
                            <span style="color:var(--red);font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">Pior</span>
                            <div style="font-family:'Rajdhani',sans-serif;font-weight:700;color:var(--yellow);font-size:14px;line-height:1;">${worst.name}</div>
                            <div style="color:var(--text-dim);font-size:11px;">${worst.kills}K • ADR ${worstAdr}</div>
                        </div>
                    </div>`;
                }
                mvpHtml += '</div>';
            }

            html += `
                <div class="match-card ${m.status}">
                    <div class="match-header">
                        <div>
                            <div class="match-title">${m.displayName || m.name}</div>
                            <div style="display:flex;align-items:center;gap:8px;margin-top:2px;font-size:12px;color:var(--text-dim);">
                                ${date ? `<span>📅 ${date}</span>` : ''}
                                <span>👥 ${playerCount} jogadores</span>
                                ${gcCount > 1 ? `<span>🎮 MD${gcCount}</span>` : ''}
                            </div>
                        </div>
                        <span class="match-status ${m.status}">${m.status === 'voting' ? '🟢 Aberta' : m.status === 'team_vote' ? '🔵 Confirmação' : m.status === 'finished' ? '✅ Finalizada' : '🟡 Em Andamento'}</span>
                    </div>
                    ${scoreHtml}
                    ${mvpHtml}
                    <div class="btn-group" style="margin-top:10px;">
                        ${(m.status === 'closed' || m.status === 'finished' || m.status === 'team_vote') && m.result && !hasGC ? `
                            <button class="btn btn-secondary btn-small" onclick="viewMatchResult('${matchId}')">🏆 Ver Equipes</button>
                        ` : ''}
                        ${hasGC ? `<button class="btn btn-secondary btn-small" onclick="viewGCStats('${matchId}')">📊 Ver Resultado${gcCount > 1 ? ' (' + gcCount + ')' : ''}</button>` : ''}
                        ${(function() {
                            const vods = m.vodUrls || (m.vodUrl ? [m.vodUrl] : []);
                            return vods.map((url, i) => `<a href="${url}" target="_blank" class="btn btn-secondary btn-small" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;">📹 VOD${vods.length > 1 ? ' ' + (i + 1) : ''}</a>`).join('');
                        })()}
                    </div>
                </div>
            `;
        }
        el.innerHTML = html;
    } catch (e) {
        el.innerHTML = `<p style="color:var(--red);text-align:center;">Erro: ${e.message}</p>`;
    }
}

// ╔══════════════════════════════════╗
// ║         DASHBOARD               ║
// ╚══════════════════════════════════╝
let dashData = { matches: [], playerStats: {}, matchCount: 0 };
let dashSortCol = 'rating';
let dashSortDir = 'desc';

function dashSort(col) {
    if (dashSortCol === col) {
        dashSortDir = dashSortDir === 'desc' ? 'asc' : 'desc';
    } else {
        dashSortCol = col;
        dashSortDir = 'desc';
    }
    renderDashModules();
}

function clearDashFilters() {
    document.getElementById('dashFilterDate').value = '';
    document.getElementById('dashFilterMonth').value = '';
    document.getElementById('dashFilterWeek').value = '';
    document.getElementById('dashFilterMatch').value = '';
    document.getElementById('dashFilterPlayer').value = '';
    dashData._initialMonthSet = false;
    dashData._initialWeekSet = false;
    loadDashboard();
}

async function loadDashboard() {
    const el = document.getElementById('dashContent');
    el.innerHTML = '<div class="loading-spinner">Carregando</div>';

    try {
        const snap = await db.collection('matches').where('status', 'in', ['closed', 'finished']).orderBy('createdAt', 'desc').get();
        let allMatches = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.gcStats && m.gcStats.length > 0);

        // ── Populate month dropdown ──
        const monthSet = new Map();
        allMatches.forEach(m => {
            if (!m.createdAt) return;
            const d = m.createdAt.toDate();
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
            const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
            if (!monthSet.has(key)) monthSet.set(key, label);
        });
        const monthSel = document.getElementById('dashFilterMonth');
        const currentMonth = monthSel.value;
        const monthKeys = [...monthSet.keys()].sort().reverse(); // sorted desc (most recent first)
        monthSel.innerHTML = '<option value="">Todos os meses</option>' +
            [...monthSet.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([k, v]) => `<option value="${k}" ${k === currentMonth ? 'selected' : ''}>${v}</option>`).join('');

        // Don't auto-select month; week is the default filter now
        if (!currentMonth && !dashData._initialMonthSet) {
            dashData._initialMonthSet = true;
        }

        // ── Populate week dropdown ──
        const weekSet = new Map();
        allMatches.forEach(m => {
            if (!m.createdAt) return;
            const d = m.createdAt.toDate();
            const day = d.getDay();
            const sun = new Date(d);
            sun.setDate(sun.getDate() - day);
            sun.setHours(0, 0, 0, 0);
            const sat = new Date(sun);
            sat.setDate(sat.getDate() + 6);
            sat.setHours(23, 59, 59, 999);
            const key = `${sun.getFullYear()}-${String(sun.getMonth()+1).padStart(2,'0')}-${String(sun.getDate()).padStart(2,'0')}`;
            if (!weekSet.has(key)) weekSet.set(key, { sun: new Date(sun), sat: new Date(sat) });
        });

        const weekSel = document.getElementById('dashFilterWeek');
        const currentWeekVal = weekSel.value;
        const weekEntries = [...weekSet.entries()].sort((a, b) => b[0].localeCompare(a[0]));
        const fmtD = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
        weekSel.innerHTML = '<option value="">Todas</option>' +
            weekEntries.map(([k, v]) => `<option value="${k}" ${k === currentWeekVal ? 'selected' : ''}>${fmtD(v.sun)} — ${fmtD(v.sat)}</option>`).join('');

        // Auto-select current jornal week on first load
        if (!currentWeekVal && !dashData._initialWeekSet) {
            const now = new Date();
            const day = now.getDay();
            const sun = new Date(now);
            sun.setDate(sun.getDate() - day);
            sun.setHours(0, 0, 0, 0);
            const wk = `${sun.getFullYear()}-${String(sun.getMonth()+1).padStart(2,'0')}-${String(sun.getDate()).padStart(2,'0')}`;
            if (weekSet.has(wk)) {
                weekSel.value = wk;
            } else if (weekEntries.length > 0) {
                weekSel.value = weekEntries[0][0];
            }
            dashData._initialWeekSet = true;
        }

        // ── Populate match/confronto dropdown (most recent first) ──
        const matchSel = document.getElementById('dashFilterMatch');
        const currentMatchFilter = matchSel.value;
        matchSel.innerHTML = '<option value="">Todos os confrontos</option>' +
            allMatches.map(m => {
                const date = m.createdAt ? m.createdAt.toDate().toLocaleDateString('pt-BR') : '';
                const gcCount = m.gcMatchCount || 1;
                const label = `${m.name}${gcCount > 1 ? ' (MD' + gcCount + ')' : ''} — ${date}`;
                return `<option value="${m.id}" ${m.id === currentMatchFilter ? 'selected' : ''}>${label}</option>`;
            }).join('');

        // ── Apply filters ──
        let matches = [...allMatches];

        // Week filter (mutually exclusive with month and date)
        const weekFilter = document.getElementById('dashFilterWeek').value;
        if (weekFilter && weekSet.has(weekFilter)) {
            const wData = weekSet.get(weekFilter);
            matches = matches.filter(m => {
                if (!m.createdAt) return false;
                const d = m.createdAt.toDate();
                return d >= wData.sun && d <= wData.sat;
            });
        } else {
            // Month filter
            const monthFilter = document.getElementById('dashFilterMonth').value;
            if (monthFilter) {
                const [fy, fm] = monthFilter.split('-').map(Number);
                matches = matches.filter(m => {
                    if (!m.createdAt) return false;
                    const d = m.createdAt.toDate();
                    return d.getFullYear() === fy && d.getMonth() + 1 === fm;
                });
            }

            // Date filter (exact day)
            const dateFilter = document.getElementById('dashFilterDate').value.trim();
            if (dateFilter && dateFilter.length === 10) {
                const [dd, mm, yyyy] = dateFilter.split('/');
                const fd = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), 0, 0, 0);
                const fdEnd = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), 23, 59, 59);
                matches = matches.filter(m => {
                    if (!m.createdAt) return false;
                    const d = m.createdAt.toDate();
                    return d >= fd && d <= fdEnd;
                });
            }
        }

        // Match/confronto filter
        const matchFilter = document.getElementById('dashFilterMatch').value;
        if (matchFilter) {
            matches = matches.filter(m => m.id === matchFilter);
        }

        // Player filter
        const playerFilter = document.getElementById('dashFilterPlayer').value;

        if (matches.length === 0) {
            el.innerHTML = '<div class="empty-state"><div class="icon">📊</div><p>Nenhuma partida com stats GC importadas encontrada.</p><p style="font-size:13px;margin-top:4px;">Importe as stats do Gamers Club nas partidas encerradas (Admin).</p></div>';
            return;
        }

        // Build player stats
        const ps = {};
        const records = { bestKills: null, bestAdr: null, bestKdr: null, bestRp: null, worstRp: null, bestDiff: null, worstDiff: null, bestFk: null, worstKills: null, worstAdr: null, worstKdr: null, worstKast: null, worstFk: null };

        matches.forEach(m => {
            const date = m.createdAt ? m.createdAt.toDate().toLocaleDateString('pt-BR') : '?';
            m.gcStats.forEach(g => {
                const key = g.playerId || g.gcName || g.playerName;
                if (!ps[key]) {
                    ps[key] = { name: g.playerName, avatar: g.avatar || '', gcId: g.gcId || '', matches: 0, kills: 0, deaths: 0, assists: 0, diff: 0, adrSum: 0, kdrSum: 0, kastSum: 0, fk: 0, rpTotal: 0, rpPositive: 0, rpNegative: 0, wins: 0, losses: 0, bestKills: 0, worstDeaths: 0, matchList: [] };
                }
                const p = ps[key];
                p.matches++;
                p.kills += g.k;
                p.deaths += g.d;
                p.assists += g.a;
                p.diff += g.diff;
                p.adrSum += g.adr;
                p.kdrSum += g.kdr;
                p.kastSum += g.kast;
                p.fk += g.fk;
                p.rpTotal += g.rp;
                const isWin = g.win != null ? g.win : (g.rp >= 0);
                if (isWin) { p.wins++; p.rpPositive += g.rp; }
                else { p.losses++; p.rpNegative += g.rp; }
                if (g.k > p.bestKills) p.bestKills = g.k;
                if (g.d > p.worstDeaths) p.worstDeaths = g.d;
                p.matchList.push({ matchName: m.name, date, ...g });

                // Records
                if (!records.bestKills || g.k > records.bestKills.val) records.bestKills = { val: g.k, name: g.playerName, match: m.name, date };
                if (!records.bestAdr || g.adr > records.bestAdr.val) records.bestAdr = { val: g.adr, name: g.playerName, match: m.name, date };
                if (!records.bestKdr || g.kdr > records.bestKdr.val) records.bestKdr = { val: g.kdr, name: g.playerName, match: m.name, date };
                if (!records.bestRp || g.rp > records.bestRp.val) records.bestRp = { val: g.rp, name: g.playerName, match: m.name, date };
                if (!records.worstRp || g.rp < records.worstRp.val) records.worstRp = { val: g.rp, name: g.playerName, match: m.name, date };
                if (!records.bestDiff || g.diff > records.bestDiff.val) records.bestDiff = { val: g.diff, name: g.playerName, match: m.name, date };
                if (!records.worstDiff || g.diff < records.worstDiff.val) records.worstDiff = { val: g.diff, name: g.playerName, match: m.name, date };
                if (!records.bestFk || g.fk > records.bestFk.val) records.bestFk = { val: g.fk, name: g.playerName, match: m.name, date };
                if (!records.worstKills || g.k < records.worstKills.val) records.worstKills = { val: g.k, name: g.playerName, match: m.name, date };
                if (!records.worstAdr || g.adr < records.worstAdr.val) records.worstAdr = { val: g.adr, name: g.playerName, match: m.name, date };
                if (!records.worstKdr || g.kdr < records.worstKdr.val) records.worstKdr = { val: g.kdr, name: g.playerName, match: m.name, date };
                if (!records.worstKast || g.kast < records.worstKast.val) records.worstKast = { val: g.kast, name: g.playerName, match: m.name, date };
                if (g.fk === 0 && (!records.worstFk || true)) records.worstFk = { val: 0, name: g.playerName, match: m.name, date };
            });
        });

        // Populate player filter dropdown
        const sel = document.getElementById('dashFilterPlayer');
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">Todos</option>' + Object.values(ps).sort((a,b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.name}" ${p.name === currentVal ? 'selected' : ''}>${p.name}</option>`).join('');

        // ── Buscar badges do jornal mais recente ──
        const _badgeMap = {};
        let _jornalEdition = null;
        try {
            const jornalSnap = await db.collection('jornal').orderBy('weekStart','desc').get();
            if (!jornalSnap.empty) {
                const latestDoc = jornalSnap.docs[0].data();
                const totalEditions = jornalSnap.size;
                (latestDoc.badges || []).forEach(b => {
                    if (!_badgeMap[b.player]) _badgeMap[b.player] = [];
                    _badgeMap[b.player].push({ emoji: b.emoji, label: b.label });
                });
                if (latestDoc.weekStart && latestDoc.weekEnd) {
                    const ws = latestDoc.weekStart.split('-');
                    const we = latestDoc.weekEnd.split('-');
                    _jornalEdition = { num: totalEditions, weekLabel: `${ws[2]}/${ws[1]} a ${we[2]}/${we[1]}` };
                }
            }
        } catch(e) {}

        dashData = { matches, playerStats: ps, matchCount: matches.length, records, playerFilter, _initialMonthSet: dashData._initialMonthSet, _initialWeekSet: dashData._initialWeekSet, _badgeMap, _jornalEdition };
        renderDashModules();
        populateH2HDropdowns();
    } catch (e) {
        el.innerHTML = `<p style="color:var(--red);text-align:center;">Erro: ${e.message}</p>`;
    }
}

function renderDashModules() {
    const el = document.getElementById('dashContent');
    const { matches, playerStats: ps, matchCount, records, playerFilter } = dashData;
    if (!matchCount) return;

    const modules = [...document.querySelectorAll('.dashModule')].filter(c => c.checked).map(c => c.value);
    let entries = Object.values(ps);

    // Apply player filter
    if (playerFilter) {
        entries = entries.filter(p => p.name === playerFilter);
    }

    const isSinglePlayer = !!playerFilter && entries.length === 1;
    let html = '';

    // ═══ OVERVIEW / PLAYER PROFILE ═══
    if (modules.includes('overview')) {
      if (isSinglePlayer) {
        // ── Single player profile card ──
        const p = entries[0];
        const avgAdr = (p.adrSum / p.matches).toFixed(1);
        const avgKdr = (p.deaths > 0 ? p.kills / p.deaths : p.kills).toFixed(2);
        const avgKast = (p.kastSum / p.matches).toFixed(0);
        const wr = p.matches > 0 ? ((p.wins / p.matches) * 100).toFixed(0) : 0;
        const wrColor = wr >= 60 ? 'var(--green)' : wr >= 40 ? 'var(--yellow)' : 'var(--red)';
        const kdrColor = avgKdr >= 1 ? 'var(--green)' : 'var(--yellow)';
        const rpColor = p.rpTotal >= 0 ? 'var(--green)' : 'var(--red)';
        const avgFk = (p.fk / p.matches).toFixed(1);
        const diffPerMatch = (p.diff / p.matches).toFixed(1);

        html += `
        <div class="card" style="border:1px solid rgba(255,193,7,0.15);background:linear-gradient(135deg,rgba(255,193,7,0.04),transparent);">
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;flex-wrap:wrap;">
                ${p.avatar ? `<img src="${p.avatar}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid var(--yellow);box-shadow:0 0 20px rgba(255,193,7,0.2);">` : ''}
                <div>
                    <div style="font-family:'Rajdhani',sans-serif;font-size:28px;font-weight:700;color:var(--yellow);line-height:1;">${p.name}</div>
                    <div style="color:var(--text-dim);font-size:13px;margin-top:4px;">Perfil individual • ${p.matches} partida(s) GC</div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;">
                ${dashStatBox('🎮', 'Partidas', p.matches, '')}
                ${dashStatBox('🏆', 'Vitórias', p.wins, 'var(--green)')}
                ${dashStatBox('💔', 'Derrotas', p.losses, 'var(--red)')}
                ${dashStatBox('📊', 'Win Rate', wr + '%', wrColor)}
                ${dashStatBox('🔫', 'Kills', p.kills, 'var(--green)')}
                ${dashStatBox('💀', 'Deaths', p.deaths, 'var(--red)')}
                ${dashStatBox('🎯', 'K/D', avgKdr, kdrColor)}
                ${dashStatBox('💥', 'ADR Média', avgAdr, 'var(--yellow)')}
                ${dashStatBox('🛡️', 'KAST Médio', avgKast + '%', 'var(--blue)')}
                ${dashStatBox('⚡', 'First Kills', p.fk, 'var(--yellow)')}
                ${dashStatBox('➕', 'Diff Total', (p.diff > 0 ? '+' : '') + p.diff, p.diff >= 0 ? 'var(--green)' : 'var(--red)')}
                ${dashStatBox('📈', 'RP Total', (p.rpTotal > 0 ? '+' : '') + p.rpTotal, rpColor)}
            </div>
        </div>`;
      } else {
        // ── Global overview (multiple players) ──
        const totalKills = entries.reduce((s, p) => s + p.kills, 0);
        const uniquePlayers = entries.length;
        const totalGCMatches = matches.reduce((s, m) => s + (m.gcMatchCount || 1), 0);
        const totalConfrontos = matchCount;

        const totalAdrWeighted = entries.reduce((s, p) => s + p.adrSum, 0);
        const totalMatchesPlayed = entries.reduce((s, p) => s + p.matches, 0);
        const avgAdrGeral = totalMatchesPlayed > 0 ? (totalAdrWeighted / totalMatchesPlayed).toFixed(1) : '0';

        const totalKastWeighted = entries.reduce((s, p) => s + p.kastSum, 0);
        const avgKastGeral = totalMatchesPlayed > 0 ? (totalKastWeighted / totalMatchesPlayed).toFixed(0) : '0';

        html += `
        <div class="card">
            <div class="card-title">📈 Resumo Geral</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;">
                ${dashStatBox('⚔️', 'Confrontos', totalConfrontos, '')}
                ${dashStatBox('🎮', 'Partidas GC', totalGCMatches, 'var(--ct-blue)')}
                ${dashStatBox('👥', 'Jogadores', uniquePlayers, '')}
                ${dashStatBox('🔫', 'Total Kills', totalKills, 'var(--green)')}
                ${dashStatBox('💥', 'ADR Média', avgAdrGeral, 'var(--yellow)')}
                ${dashStatBox('🎯', 'KAST Médio', avgKastGeral + '%', 'var(--blue)')}
            </div>
        </div>`;
      }
    }

    // ═══ RANKING ═══ (hidden for single player)
    if (modules.includes('ranking') && !isSinglePlayer) {
        // ── Rating MiRB 1.1 ──
        // Pesos: ADR 25%, KAST 25%, K/D 20%, FK 10%, WIN 5%, Partidas 15%
        const W_ADR = 0.25, W_KAST = 0.25, W_KD = 0.20, W_FK = 0.10, W_WIN = 0.05, W_MATCHES = 0.15;

        // Calcular stats médias (FK agora é média por partida)
        entries.forEach(p => {
            p._avgAdr  = p.adrSum / p.matches;
            p._avgKast = p.kastSum / p.matches;
            p._avgKdr  = p.deaths > 0 ? p.kills / p.deaths : p.kills;
            p._avgFk   = p.matches > 0 ? p.fk / p.matches : 0;
            p._winPct  = p.matches > 0 ? (p.wins / p.matches) * 100 : 0;
        });

        // Máximos para normalização
        const _maxAdr     = Math.max(...entries.map(p => p._avgAdr));
        const _maxKast    = Math.max(...entries.map(p => p._avgKast));
        const _maxKd      = Math.max(...entries.map(p => p._avgKdr));
        const _maxFk      = Math.max(...entries.map(p => p._avgFk));
        const _maxWin     = Math.max(...entries.map(p => p._winPct));
        const _maxMatches = Math.max(...entries.map(p => p.matches));

        // Calcular rating bruto de cada jogador
        entries.forEach(p => {
            const nAdr     = _maxAdr     > 0 ? (p._avgAdr  / _maxAdr)     * 100 : 0;
            const nKast    = _maxKast    > 0 ? (p._avgKast / _maxKast)    * 100 : 0;
            const nKd      = _maxKd      > 0 ? (p._avgKdr  / _maxKd)      * 100 : 0;
            const nFk      = _maxFk      > 0 ? (p._avgFk   / _maxFk)      * 100 : 0;
            const nWin     = _maxWin     > 0 ? (p._winPct  / _maxWin)     * 100 : 0;
            const nMatches = _maxMatches > 0 ? Math.max(0.1, p.matches / _maxMatches) * 100 : 0;

            p._rawRating = nAdr * W_ADR + nKast * W_KAST + nKd * W_KD + nFk * W_FK + nWin * W_WIN + nMatches * W_MATCHES;
        });

        // Regressão à média: puxa rating de quem jogou pouco em direção à média geral
        const _avgRating = entries.reduce((s, p) => s + p._rawRating, 0) / entries.length;
        const _regThreshold = Math.ceil(_maxMatches * 0.7); // 70% das partidas = confiança total

        entries.forEach(p => {
            const confidence = Math.min(1, p.matches / _regThreshold);
            p._ratingMiRB = confidence * p._rawRating + (1 - confidence) * _avgRating;
        });

        const col = dashSortCol || 'rating';
        const dir = dashSortDir || 'desc';
        const sorted = [...entries].sort((a, b) => {
            let va, vb;
            switch(col) {
                case 'rating': va = a._ratingMiRB; vb = b._ratingMiRB; break;
                case 'p': va = a.matches; vb = b.matches; break;
                case 'v': va = a.wins; vb = b.wins; break;
                case 'd': va = a.losses; vb = b.losses; break;
                case 'wr': va = a.matches ? a.wins/a.matches : 0; vb = b.matches ? b.wins/b.matches : 0; break;
                case 'k': va = a.kills; vb = b.kills; break;
                case 'deaths': va = a.deaths; vb = b.deaths; break;
                case 'kd': va = a.deaths ? a.kills/a.deaths : a.kills; vb = b.deaths ? b.kills/b.deaths : b.kills; break;
                case 'adr': va = a.adrSum/a.matches; vb = b.adrSum/b.matches; break;
                case 'fk': va = a.fk; vb = b.fk; break;
                case 'kast': va = a.kastSum/a.matches; vb = b.kastSum/b.matches; break;
                case 'rp': va = a.rpTotal; vb = b.rpTotal; break;
                default: va = a._ratingMiRB; vb = b._ratingMiRB;
            }
            return dir === 'desc' ? vb - va : va - vb;
        });

        // ── Badges do jornal ──
        const badgeMap = dashData._badgeMap || {};
        const getDashBadgeHtml = (name) => {
            if (!badgeMap[name]) return '';
            return ' ' + badgeMap[name].map(b => `<span title="${b.label}" style="cursor:help;font-size:13px;">${b.emoji}</span>`).join('');
        };

        const arrow = (c) => col === c ? (dir === 'desc' ? ' ▼' : ' ▲') : '';
        const thStyle = 'padding:10px 6px;text-align:center;cursor:pointer;user-select:none;white-space:nowrap;';
        const activeStyle = (c) => col === c ? 'color:var(--yellow);' : '';

        html += `
        <div class="card" style="overflow-x:auto;">
            <div class="card-title" style="display:flex;align-items:center;gap:10px;">🏆 Ranking Geral
                <span onclick="document.getElementById('ratingInfoModal').style.display='flex'" style="cursor:pointer;font-size:14px;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:var(--text-dim);font-family:'Rajdhani',sans-serif;font-weight:700;" title="Como o Rating é calculado?">?</span>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:var(--text-dim);font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">
                        <th style="padding:10px 6px;text-align:left;">#</th>
                        <th style="padding:10px 6px;text-align:left;">Jogador</th>
                        <th style="${thStyle}${activeStyle('rating')}" onclick="dashSort('rating')">Rating${arrow('rating')}</th>
                        <th style="${thStyle}${activeStyle('p')}" onclick="dashSort('p')">P${arrow('p')}</th>
                        <th style="${thStyle}${activeStyle('v')}" onclick="dashSort('v')">V${arrow('v')}</th>
                        <th style="${thStyle}${activeStyle('d')}" onclick="dashSort('d')">D${arrow('d')}</th>
                        <th style="${thStyle}${activeStyle('wr')}" onclick="dashSort('wr')">Win%${arrow('wr')}</th>
                        <th style="${thStyle}${activeStyle('k')}" onclick="dashSort('k')">K${arrow('k')}</th>
                        <th style="${thStyle}${activeStyle('deaths')}" onclick="dashSort('deaths')">Deaths${arrow('deaths')}</th>
                        <th style="${thStyle}${activeStyle('kd')}" onclick="dashSort('kd')">K/D${arrow('kd')}</th>
                        <th style="${thStyle}${activeStyle('adr')}" onclick="dashSort('adr')">ADR${arrow('adr')}</th>
                        <th style="${thStyle}${activeStyle('fk')}" onclick="dashSort('fk')">FK${arrow('fk')}</th>
                        <th style="${thStyle}${activeStyle('kast')}" onclick="dashSort('kast')">KAST${arrow('kast')}</th>
                        <th style="${thStyle}${activeStyle('rp')}" onclick="dashSort('rp')">RP${arrow('rp')}</th>
                    </tr>
                </thead>
                <tbody>`;

        sorted.forEach((p, i) => {
            const wr = p.matches > 0 ? ((p.wins / p.matches) * 100).toFixed(0) : 0;
            const wrColor = wr >= 60 ? 'var(--green)' : wr >= 40 ? 'var(--yellow)' : 'var(--red)';
            const avgAdr = (p.adrSum / p.matches).toFixed(1);
            const avgKdr = (p.deaths > 0 ? p.kills / p.deaths : p.kills).toFixed(2);
            const kdrColor = avgKdr >= 1 ? 'var(--green)' : 'var(--yellow)';
            const rpColor = p.rpTotal >= 0 ? 'var(--green)' : 'var(--red)';
            const avgKast = p.matches > 0 ? (p.kastSum / p.matches).toFixed(0) : 0;
            const ratingVal = p._ratingMiRB.toFixed(1);
            const ratingColor = p._ratingMiRB >= 70 ? 'var(--green)' : p._ratingMiRB >= 50 ? 'var(--yellow)' : 'var(--red)';

            html += `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.04);${i < 3 ? 'background:rgba(255,255,255,0.03);' : ''}">
                    <td style="padding:10px 6px;font-family:'Rajdhani',sans-serif;font-weight:700;color:var(--text-dim);">${i < 3 ? ['🥇','🥈','🥉'][i] : i+1}</td>
                    <td style="padding:10px 6px;">
                        <div style="display:flex;align-items:center;gap:6px;">
                            ${p.avatar ? `<img src="${p.avatar}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">` : ''}
                            <span style="font-family:'Rajdhani',sans-serif;font-weight:600;font-size:15px;color:var(--yellow);">${p.name}</span>${getDashBadgeHtml(p.name)}
                        </div>
                    </td>
                    <td style="padding:10px 6px;text-align:center;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:15px;color:${ratingColor};">${ratingVal}</td>
                    <td style="padding:10px 6px;text-align:center;color:var(--text-dim);">${p.matches}</td>
                    <td style="padding:10px 6px;text-align:center;color:var(--green);">${p.wins}</td>
                    <td style="padding:10px 6px;text-align:center;color:var(--red);">${p.losses}</td>
                    <td style="padding:10px 6px;text-align:center;font-weight:700;color:${wrColor};">${wr}%</td>
                    <td style="padding:10px 6px;text-align:center;color:var(--green);font-weight:700;">${p.kills}</td>
                    <td style="padding:10px 6px;text-align:center;color:var(--red);">${p.deaths}</td>
                    <td style="padding:10px 6px;text-align:center;color:${kdrColor};font-weight:600;">${avgKdr}</td>
                    <td style="padding:10px 6px;text-align:center;">${avgAdr}</td>
                    <td style="padding:10px 6px;text-align:center;">${p.fk}</td>
                    <td style="padding:10px 6px;text-align:center;">${avgKast}%</td>
                    <td style="padding:10px 6px;text-align:center;color:${rpColor};font-weight:700;font-family:'Rajdhani',sans-serif;font-size:15px;">${p.rpTotal > 0 ? '+' : ''}${p.rpTotal}</td>
                </tr>`;
        });
        html += '</tbody></table>';
        // Legenda das badges do jornal
        const badgeEntries = Object.values(badgeMap);
        if (badgeEntries.length > 0) {
            const uniqueBadges = [];
            const seen = new Set();
            Object.values(badgeMap).flat().forEach(b => {
                if (!seen.has(b.emoji)) { seen.add(b.emoji); uniqueBadges.push(b); }
            });
            const ed = dashData._jornalEdition;
            const edLabel = ed ? `Edição Nº ${ed.num} (${ed.weekLabel})` : 'Último Jornal';
            html += `<div style="font-size:11px;color:var(--text-dim);text-align:center;padding:10px 8px 4px;border-top:1px solid rgba(255,255,255,0.05);">📰 ${edLabel}: ${uniqueBadges.map(b => `${b.emoji} ${b.label}`).join(' · ')}</div>`;
        }
        html += '</div>';
    }

    // ═══ HIGHLIGHTS ═══ (hidden for single player)
    if (modules.includes('highlights') && entries.length > 1 && !isSinglePlayer) {
        const byWins = [...entries].sort((a, b) => b.wins - a.wins);
        const byKills = [...entries].sort((a, b) => b.kills - a.kills);
        const byRp = [...entries].sort((a, b) => b.rpTotal - a.rpTotal);
        const byAdr = [...entries].sort((a, b) => (b.adrSum/b.matches) - (a.adrSum/a.matches));
        const byKdr = [...entries].sort((a, b) => (b.deaths ? b.kills/b.deaths : b.kills) - (a.deaths ? a.kills/a.deaths : a.kills));
        const byFk = [...entries].sort((a, b) => b.fk - a.fk);
        const byWr = [...entries].filter(p => p.matches >= 2).sort((a, b) => (b.wins/b.matches) - (a.wins/a.matches));

        html += `
        <div class="card">
            <div class="card-title">⭐ Destaques</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
                ${dashHighlight('🏆 Mais Vitórias', byWins[0], byWins[0].wins + ' vitória(s)', 'var(--green)')}
                ${dashHighlight('🔫 Mais Kills', byKills[0], byKills[0].kills + ' kills', 'var(--green)')}
                ${dashHighlight('📈 Mais RP Ganhos', byRp[0], '+' + byRp[0].rpTotal + ' RP', 'var(--blue)')}
                ${dashHighlight('💥 Maior ADR Média', byAdr[0], (byAdr[0].adrSum/byAdr[0].matches).toFixed(1) + ' ADR', 'var(--yellow)')}
                ${dashHighlight('🎯 Melhor K/D', byKdr[0], (byKdr[0].deaths ? byKdr[0].kills/byKdr[0].deaths : byKdr[0].kills).toFixed(2) + ' KDR', 'var(--green)')}
                ${dashHighlight('⚡ Mais First Kills', byFk[0], byFk[0].fk + ' FK', 'var(--yellow)')}
                ${byWr.length ? dashHighlight('📊 Maior Win Rate', byWr[0], ((byWr[0].wins/byWr[0].matches)*100).toFixed(0) + '% (' + byWr[0].matches + 'p)', 'var(--green)') : ''}
            </div>
        </div>`;
    }

    // ═══ SHAME WALL ═══ (hidden for single player)
    if (modules.includes('shame') && entries.length > 1 && !isSinglePlayer) {
        const worstAdrPlayer = [...entries].sort((a, b) => (a.adrSum/a.matches) - (b.adrSum/b.matches))[0];
        const wp = worstAdrPlayer;
        const avgAdr = (wp.adrSum / wp.matches).toFixed(1);
        const avgKdr = (wp.deaths > 0 ? wp.kills / wp.deaths : wp.kills).toFixed(2);
        const avgKast = (wp.kastSum / wp.matches).toFixed(0);
        const wr = wp.matches > 0 ? ((wp.wins / wp.matches) * 100).toFixed(0) : 0;

        html += `
        <div class="card" style="border:1px solid rgba(255,61,61,0.2);background:linear-gradient(135deg,rgba(255,61,61,0.05),transparent);">
            <div class="card-title">💀 Mural da Vergonha</div>
            <div style="display:flex;align-items:center;gap:20px;padding:16px 0;flex-wrap:wrap;justify-content:center;">
                <div style="text-align:center;">
                    ${wp.avatar ? `<img src="${wp.avatar}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid var(--red);box-shadow:0 0 20px rgba(255,61,61,0.3);">` : ''}
                    <div style="font-size:40px;margin:8px 0;">🗑️</div>
                    <div style="font-family:'Rajdhani',sans-serif;font-size:24px;font-weight:700;color:var(--red);">${wp.name}</div>
                    <div style="color:var(--text-dim);font-size:13px;margin-top:2px;">Pior ADR média do grupo</div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;flex:1;min-width:200px;">
                    <div style="padding:10px;background:rgba(255,61,61,0.08);border-radius:8px;text-align:center;">
                        <div style="font-size:11px;color:var(--text-dim);">ADR Média</div>
                        <div style="font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700;color:var(--red);">${avgAdr}</div>
                    </div>
                    <div style="padding:10px;background:rgba(255,61,61,0.08);border-radius:8px;text-align:center;">
                        <div style="font-size:11px;color:var(--text-dim);">K/D</div>
                        <div style="font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700;color:var(--red);">${avgKdr}</div>
                    </div>
                    <div style="padding:10px;background:rgba(255,61,61,0.08);border-radius:8px;text-align:center;">
                        <div style="font-size:11px;color:var(--text-dim);">Win Rate</div>
                        <div style="font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700;color:var(--red);">${wr}%</div>
                    </div>
                    <div style="padding:10px;background:rgba(255,61,61,0.08);border-radius:8px;text-align:center;">
                        <div style="font-size:11px;color:var(--text-dim);">RP Total</div>
                        <div style="font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700;color:var(--red);">${wp.rpTotal}</div>
                    </div>
                    <div style="padding:10px;background:rgba(255,61,61,0.08);border-radius:8px;text-align:center;">
                        <div style="font-size:11px;color:var(--text-dim);">KAST</div>
                        <div style="font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700;color:var(--red);">${avgKast}%</div>
                    </div>
                    <div style="padding:10px;background:rgba(255,61,61,0.08);border-radius:8px;text-align:center;">
                        <div style="font-size:11px;color:var(--text-dim);">Partidas</div>
                        <div style="font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700;color:var(--text);">${wp.matches} (${wp.wins}V ${wp.losses}D)</div>
                    </div>
                </div>
            </div>
        </div>`;
    }

    // ═══ WORST STATS ═══ (hidden for single player)
    if (modules.includes('worstStats') && entries.length > 1 && !isSinglePlayer) {
        const byLosses = [...entries].sort((a, b) => b.losses - a.losses);
        const byDeaths = [...entries].sort((a, b) => b.deaths - a.deaths);
        const byRpLoss = [...entries].sort((a, b) => a.rpTotal - b.rpTotal);
        const byWorstKdr = [...entries].sort((a, b) => (a.deaths ? a.kills/a.deaths : a.kills) - (b.deaths ? b.kills/b.deaths : b.kills));
        const byWorstDiff = [...entries].sort((a, b) => a.diff - b.diff);
        const byWorstWr = [...entries].filter(p => p.matches >= 2).sort((a, b) => (a.wins/a.matches) - (b.wins/b.matches));

        html += `
        <div class="card">
            <div class="card-title">📉 Piores Stats</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
                ${dashHighlight('😭 Mais Derrotas', byLosses[0], byLosses[0].losses + ' derrota(s)', 'var(--red)')}
                ${dashHighlight('💀 Mais Mortes', byDeaths[0], byDeaths[0].deaths + ' deaths', 'var(--red)')}
                ${dashHighlight('📉 Mais RP Perdidos', byRpLoss[0], byRpLoss[0].rpTotal + ' RP', 'var(--red)')}
                ${dashHighlight('🐌 Pior K/D', byWorstKdr[0], (byWorstKdr[0].deaths ? byWorstKdr[0].kills/byWorstKdr[0].deaths : byWorstKdr[0].kills).toFixed(2) + ' KDR', 'var(--red)')}
                ${dashHighlight('🪦 Pior Diff', byWorstDiff[0], (byWorstDiff[0].diff > 0 ? '+' : '') + byWorstDiff[0].diff + ' diff', 'var(--red)')}
                ${byWorstWr.length ? dashHighlight('📊 Menor Win Rate', byWorstWr[0], ((byWorstWr[0].wins/byWorstWr[0].matches)*100).toFixed(0) + '% (' + byWorstWr[0].matches + 'p)', 'var(--red)') : ''}
            </div>
        </div>`;
    }

    // ═══ RECORDS ═══
    if (modules.includes('records') && records.bestKills) {
      if (isSinglePlayer) {
        // Only show records held by this player
        const pName = entries[0].name;
        const myRecs = [
            ['🔫 Mais Kills', records.bestKills],
            ['💥 Maior ADR', records.bestAdr],
            ['🎯 Maior KDR', records.bestKdr],
            ['📈 Mais RP Ganhos', records.bestRp],
            ['➕ Melhor Diff', records.bestDiff],
            ['⚡ Mais First Kills', records.bestFk]
        ].filter(([, r]) => r && r.name === pName);

        if (myRecs.length > 0) {
            html += `
            <div class="card" style="border:1px solid rgba(255,193,7,0.15);">
                <div class="card-title">🎖️ Recordes que ${pName} detém</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
                    ${myRecs.map(([t, r]) => dashRecord(t, r)).join('')}
                </div>
            </div>`;
        }
      } else {
        html += `
        <div class="card">
            <div class="card-title">🎖️ Recordes (melhor partida individual)</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
                ${dashRecord('🔫 Mais Kills', records.bestKills)}
                ${dashRecord('💥 Maior ADR', records.bestAdr)}
                ${dashRecord('🎯 Maior KDR', records.bestKdr)}
                ${dashRecord('📈 Mais RP Ganhos', records.bestRp)}
                ${dashRecord('➕ Melhor Diff', records.bestDiff)}
                ${dashRecord('⚡ Mais First Kills', records.bestFk)}
            </div>
        </div>`;
      }
    }

    // ═══ WORST RECORDS ═══
    if (modules.includes('worstRecords') && records.worstKills) {
      if (isSinglePlayer) {
        const pName = entries[0].name;
        const myWorst = [
            ['😴 Menos Kills', records.worstKills],
            ['🐌 Menor ADR', records.worstAdr],
            ['📉 Menor KDR', records.worstKdr],
            ['🧊 Menor KAST', records.worstKast],
            ['📉 Mais RP Perdidos', records.worstRp],
            ['➖ Pior Diff', records.worstDiff]
        ].filter(([, r]) => r && r.name === pName);

        if (myWorst.length > 0) {
            html += `
            <div class="card" style="border:1px solid rgba(255,61,61,0.15);">
                <div class="card-title">🗑️ Piores Recordes de ${pName}</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
                    ${myWorst.map(([t, r]) => dashRecord(t, r)).join('')}
                </div>
            </div>`;
        }
      } else {
        html += `
        <div class="card">
            <div class="card-title">🗑️ Piores Recordes (pior partida individual)</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
                ${dashRecord('😴 Menos Kills', records.worstKills)}
                ${dashRecord('🐌 Menor ADR', records.worstAdr)}
                ${dashRecord('📉 Menor KDR', records.worstKdr)}
                ${dashRecord('🧊 Menor KAST', records.worstKast)}
                ${dashRecord('📉 Mais RP Perdidos', records.worstRp)}
                ${dashRecord('➖ Pior Diff', records.worstDiff)}
            </div>
        </div>`;
      }
    }

    // ═══ HISTORY ═══
    if (modules.includes('history')) {
      if (isSinglePlayer) {
        // ── Single player match history with individual stats ──
        const p = entries[0];
        const matchHistory = p.matchList.sort((a, b) => {
            // Sort by date descending (most recent first)
            const da = a.date.split('/').reverse().join('');
            const db = b.date.split('/').reverse().join('');
            return db.localeCompare(da);
        });

        html += `
        <div class="card">
            <div class="card-title">📋 Histórico de Partidas de ${p.name}</div>
            <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.1);color:var(--text-dim);font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">
                        <th style="padding:8px 6px;text-align:left;">Partida</th>
                        <th style="padding:8px 6px;text-align:center;">Data</th>
                        <th style="padding:8px 6px;text-align:center;">Resultado</th>
                        <th style="padding:8px 6px;text-align:center;">K</th>
                        <th style="padding:8px 6px;text-align:center;">D</th>
                        <th style="padding:8px 6px;text-align:center;">+/-</th>
                        <th style="padding:8px 6px;text-align:center;">ADR</th>
                        <th style="padding:8px 6px;text-align:center;">KDR</th>
                        <th style="padding:8px 6px;text-align:center;">KAST</th>
                        <th style="padding:8px 6px;text-align:center;">FK</th>
                        <th style="padding:8px 6px;text-align:center;">RP</th>
                    </tr>
                </thead>
                <tbody>`;

        matchHistory.forEach(g => {
            const isWin = g.win != null ? g.win : (g.rp >= 0);
            const resultText = isWin ? 'V' : 'D';
            const resultColor = isWin ? 'var(--green)' : 'var(--red)';
            const kdrColor = g.kdr >= 1 ? 'var(--green)' : 'var(--yellow)';
            const rpColor = g.rp >= 0 ? 'var(--green)' : 'var(--red)';
            const diffColor = g.diff >= 0 ? 'var(--green)' : 'var(--red)';
            const score = g.teamScore != null && g.enemyScore != null ? `${g.teamScore}-${g.enemyScore}` : '';

            html += `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.04);${isWin ? 'background:rgba(0,200,83,0.03);' : 'background:rgba(255,61,61,0.03);'}">
                    <td style="padding:8px 6px;font-size:13px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${g.matchName}</td>
                    <td style="padding:8px 6px;text-align:center;color:var(--text-dim);font-size:12px;">${g.date}</td>
                    <td style="padding:8px 6px;text-align:center;font-weight:700;color:${resultColor};">${resultText} ${score ? `<span style="font-weight:400;font-size:11px;color:var(--text-dim);">(${score})</span>` : ''}</td>
                    <td style="padding:8px 6px;text-align:center;color:var(--green);font-weight:600;">${g.k}</td>
                    <td style="padding:8px 6px;text-align:center;color:var(--red);">${g.d}</td>
                    <td style="padding:8px 6px;text-align:center;color:${diffColor};font-weight:600;">${g.diff > 0 ? '+' : ''}${g.diff}</td>
                    <td style="padding:8px 6px;text-align:center;">${g.adr.toFixed(1)}</td>
                    <td style="padding:8px 6px;text-align:center;color:${kdrColor};font-weight:600;">${g.kdr.toFixed(2)}</td>
                    <td style="padding:8px 6px;text-align:center;">${g.kast.toFixed(0)}%</td>
                    <td style="padding:8px 6px;text-align:center;">${g.fk}</td>
                    <td style="padding:8px 6px;text-align:center;color:${rpColor};font-weight:700;font-family:'Rajdhani',sans-serif;">${g.rp > 0 ? '+' : ''}${g.rp}</td>
                </tr>`;
        });
        html += '</tbody></table></div></div>';
      } else {
        // ── Global history ──
        html += `
        <div class="card">
            <div class="card-title">📋 Histórico de Partidas</div>
            <div style="display:grid;gap:8px;">`;

        matches.forEach(m => {
            const date = m.createdAt ? m.createdAt.toDate().toLocaleDateString('pt-BR') : '?';
            const top = [...m.gcStats].sort((a, b) => b.k - a.k)[0];
            html += `
                <div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <span style="font-weight:600;font-size:14px;">${m.name} ${m.map ? `<span style="color:var(--text-dim);font-size:12px;">— ${m.map}</span>` : ''}</span>
                        <span style="color:var(--text-dim);font-size:12px;">${date}</span>
                    </div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;font-size:12px;">
                        <span style="color:var(--green);">MVP: ${top.playerName} (${top.k}K)</span>
                        <span style="color:var(--text-dim);">•</span>
                        <span style="color:var(--text-dim);">${m.gcStats.length} jogadores</span>
                    </div>
                </div>`;
        });
        html += '</div></div>';
      }
    }

    if (!html) {
        html = '<div class="empty-state"><p>Selecione pelo menos um módulo acima.</p></div>';
    }

    el.innerHTML = html;
}

function dashStatBox(icon, label, value, color) {
    return `
        <div style="padding:16px;background:rgba(255,255,255,0.03);border-radius:10px;text-align:center;">
            <div style="font-size:20px;margin-bottom:4px;">${icon}</div>
            <div style="font-family:'Rajdhani',sans-serif;font-size:26px;font-weight:700;color:${color || 'var(--text)'};line-height:1;">${value}</div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
        </div>`;
}

function dashHighlight(title, player, stat, color) {
    if (!player) return '';
    return `
        <div style="padding:14px;background:rgba(255,255,255,0.03);border-radius:10px;border-left:3px solid ${color};">
            <div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;">${title}</div>
            <div style="display:flex;align-items:center;gap:8px;">
                ${player.avatar ? `<img src="${player.avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">` : ''}
                <div>
                    <div style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:16px;color:var(--yellow);">${player.name}</div>
                    <div style="font-family:'Rajdhani',sans-serif;font-size:18px;font-weight:700;color:${color};">${stat}</div>
                </div>
            </div>
        </div>`;
}

function dashRecord(title, rec) {
    if (!rec) return '';
    return `
        <div style="padding:12px;background:rgba(255,255,255,0.02);border-radius:8px;">
            <div style="font-size:11px;color:var(--text-dim);margin-bottom:4px;">${title}</div>
            <div style="font-family:'Rajdhani',sans-serif;font-size:20px;font-weight:700;color:var(--yellow);">${rec.val}</div>
            <div style="font-size:12px;color:var(--text);">${rec.name}</div>
            <div style="font-size:11px;color:var(--text-dim);">${rec.match} • ${rec.date}</div>
        </div>`;
}

// ╔══════════════════════════════════╗
// ║       HEAD-TO-HEAD              ║
// ╚══════════════════════════════════╝
async function loadH2HPage() {
    // If dashData already has player stats, just populate dropdowns
    if (dashData && dashData.playerStats && Object.keys(dashData.playerStats).length >= 2) {
        populateH2HDropdowns();
        return;
    }
    // Otherwise load dashboard data first (silently)
    try {
        const el = document.getElementById('h2hResult');
        el.innerHTML = '<div class="loading-spinner">Carregando jogadores...</div>';
        // Trigger dashboard data load
        await loadDashboard();
        populateH2HDropdowns();
    } catch (e) {
        console.error('Error loading h2h data:', e);
    }
}

function populateH2HDropdowns() {
    const ps = dashData.playerStats || {};
    const entries = Object.entries(ps).sort((a, b) => a[1].name.localeCompare(b[1].name));

    if (entries.length < 2) {
        document.getElementById('h2hResult').innerHTML = '<div class="empty-state"><div class="icon">⚔️</div><p>É necessário ter pelo menos 2 jogadores com estatísticas para comparar.</p></div>';
        return;
    }

    ['h2hPlayer1', 'h2hPlayer2'].forEach(id => {
        const sel = document.getElementById(id);
        const cur = sel.value;
        sel.innerHTML = '<option value="">Selecionar</option>' +
            entries.map(([k, p]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${p.name}</option>`).join('');
    });

    document.getElementById('h2hResult').innerHTML = '';
}

function renderH2H() {
    const k1 = document.getElementById('h2hPlayer1').value;
    const k2 = document.getElementById('h2hPlayer2').value;
    const el = document.getElementById('h2hResult');

    if (!k1 || !k2) { toast('Selecione os 2 jogadores!', 'error'); return; }
    if (k1 === k2) { toast('Selecione jogadores diferentes!', 'error'); return; }

    const ps = dashData.playerStats;
    const p1 = ps[k1];
    const p2 = ps[k2];
    if (!p1 || !p2) { toast('Jogador não encontrado.', 'error'); return; }

    const stats = [
        { label: 'Vitórias', v1: p1.wins, v2: p2.wins, fmt: v => v, higher: true },
        { label: 'Derrotas', v1: p1.losses, v2: p2.losses, fmt: v => v, higher: false },
        { label: 'Win Rate', v1: p1.matches ? p1.wins/p1.matches*100 : 0, v2: p2.matches ? p2.wins/p2.matches*100 : 0, fmt: v => v.toFixed(0) + '%', higher: true },
        { label: 'Kills', v1: p1.kills, v2: p2.kills, fmt: v => v, higher: true },
        { label: 'Deaths', v1: p1.deaths, v2: p2.deaths, fmt: v => v, higher: false },
        { label: 'K/D', v1: p1.deaths ? p1.kills/p1.deaths : p1.kills, v2: p2.deaths ? p2.kills/p2.deaths : p2.kills, fmt: v => v.toFixed(2), higher: true },
        { label: 'ADR', v1: p1.matches ? p1.adrSum/p1.matches : 0, v2: p2.matches ? p2.adrSum/p2.matches : 0, fmt: v => v.toFixed(1), higher: true },
        { label: 'KAST', v1: p1.matches ? p1.kastSum/p1.matches : 0, v2: p2.matches ? p2.kastSum/p2.matches : 0, fmt: v => v.toFixed(0) + '%', higher: true },
        { label: 'First Kills', v1: p1.fk, v2: p2.fk, fmt: v => v, higher: true },
        { label: 'Diff', v1: p1.diff, v2: p2.diff, fmt: v => (v > 0 ? '+' : '') + v, higher: true },
    ];

    // Count who wins more categories
    let p1Wins = 0, p2Wins = 0;
    stats.forEach(s => {
        if (s.higher) {
            if (s.v1 > s.v2) p1Wins++;
            else if (s.v2 > s.v1) p2Wins++;
        } else {
            if (s.v1 < s.v2) p1Wins++;
            else if (s.v2 < s.v1) p2Wins++;
        }
    });

    let html = `
        <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;padding:16px 0;">
            <div style="text-align:center;">
                ${p1.avatar ? `<img src="${p1.avatar}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:3px solid ${p1Wins >= p2Wins ? 'var(--green)' : 'rgba(255,255,255,0.1)'};">` : ''}
                <div style="font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:var(--yellow);margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p1.name}</div>
            </div>
            <div style="text-align:center;">
                <div style="font-family:'Rajdhani',sans-serif;font-size:28px;font-weight:700;letter-spacing:2px;white-space:nowrap;">
                    <span style="color:${p1Wins > p2Wins ? 'var(--green)' : p1Wins < p2Wins ? 'var(--red)' : 'var(--text-dim)'};">${p1Wins}</span>
                    <span style="color:var(--text-dim);margin:0 2px;">×</span>
                    <span style="color:${p2Wins > p1Wins ? 'var(--green)' : p2Wins < p1Wins ? 'var(--red)' : 'var(--text-dim)'};">${p2Wins}</span>
                </div>
                <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;">categorias</div>
            </div>
            <div style="text-align:center;">
                ${p2.avatar ? `<img src="${p2.avatar}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:3px solid ${p2Wins >= p1Wins ? 'var(--green)' : 'rgba(255,255,255,0.1)'};">` : ''}
                <div style="font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:var(--yellow);margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p2.name}</div>
            </div>
        </div>
        <div style="display:grid;gap:6px;">`;

    stats.forEach(s => {
        const better1 = s.higher ? s.v1 > s.v2 : s.v1 < s.v2;
        const better2 = s.higher ? s.v2 > s.v1 : s.v2 < s.v1;
        const tied = s.v1 === s.v2;
        const c1 = tied ? 'var(--text-dim)' : better1 ? 'var(--green)' : 'var(--red)';
        const c2 = tied ? 'var(--text-dim)' : better2 ? 'var(--green)' : 'var(--red)';

        // Bar widths
        const max = Math.max(Math.abs(s.v1), Math.abs(s.v2)) || 1;
        const w1 = Math.round((Math.abs(s.v1) / max) * 100);
        const w2 = Math.round((Math.abs(s.v2) / max) * 100);

        html += `
            <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:center;padding:6px 0;">
                <div style="text-align:right;">
                    <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;">
                        <div style="height:6px;border-radius:3px;background:${c1};width:${w1}%;min-width:4px;opacity:0.6;"></div>
                        <span style="font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:700;color:${c1};min-width:36px;text-align:right;">${s.fmt(s.v1)}</span>
                    </div>
                </div>
                <div style="font-size:10px;color:var(--text-dim);text-align:center;min-width:55px;text-transform:uppercase;letter-spacing:0.5px;">${s.label}</div>
                <div style="text-align:left;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span style="font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:700;color:${c2};min-width:36px;">${s.fmt(s.v2)}</span>
                        <div style="height:6px;border-radius:3px;background:${c2};width:${w2}%;min-width:4px;opacity:0.6;"></div>
                    </div>
                </div>
            </div>`;
    });

    html += '</div>';
    el.innerHTML = html;
}

