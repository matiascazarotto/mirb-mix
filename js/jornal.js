// ╔══════════════════════════════════╗
// ║       LIVE STREAM               ║
// ╚══════════════════════════════════╝
let liveUnsubscribe = null;

function initLiveListener() {
    if (liveUnsubscribe) liveUnsubscribe();
    liveUnsubscribe = db.collection('settings').doc('live').onSnapshot(doc => {
        const data = doc.exists ? doc.data() : {};
        const isLive = data.active === true;
        const navBtn = document.getElementById('navLive');

        if (isLive && data.url) {
            navBtn.style.display = '';
            // Update embed
            const videoId = extractYouTubeId(data.url);
            const embed = document.getElementById('liveEmbed');
            const newSrc = videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : '';
            if (embed.src !== newSrc && newSrc) embed.src = newSrc;
            const titleEl = document.getElementById('liveTitle');
            if (titleEl) titleEl.textContent = data.title || '';
        } else {
            navBtn.style.display = 'none';
            // If user is on live page, redirect to vote
            const livePage = document.getElementById('page-live');
            if (livePage && livePage.classList.contains('active')) {
                showPage('vote');
            }
            const embed = document.getElementById('liveEmbed');
            if (embed) embed.src = '';
        }

        // Update admin UI if visible
        updateAdminLiveUI(data);
    }, err => {
        console.error('Live listener error:', err);
    });
}

function updateAdminLiveUI(data) {
    const statusEl = document.getElementById('adminLiveStatus');
    const urlInput = document.getElementById('adminLiveUrl');
    const titleInput = document.getElementById('adminLiveTitle');
    const btnGo = document.getElementById('btnGoLive');
    const btnStop = document.getElementById('btnStopLive');
    if (!statusEl) return;

    const isLive = data && data.active === true;

    if (isLive) {
        statusEl.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(255,61,61,0.1);border:1px solid rgba(255,61,61,0.2);border-radius:6px;">
                <div style="width:10px;height:10px;border-radius:50%;background:var(--red);animation:livePulse 1.5s infinite;"></div>
                <span style="color:var(--red);font-weight:600;font-size:13px;">TRANSMISSÃO ATIVA</span>
                ${data.title ? `<span style="color:var(--text-dim);font-size:12px;">— ${data.title}</span>` : ''}
            </div>`;
        if (urlInput) urlInput.value = data.url || '';
        if (titleInput) titleInput.value = data.title || '';
        if (btnGo) btnGo.style.display = 'none';
        if (btnStop) btnStop.style.display = '';
    } else {
        statusEl.innerHTML = `
            <div style="padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:6px;font-size:13px;color:var(--text-dim);">
                ⬛ Nenhuma transmissão ativa
            </div>`;
        if (btnGo) btnGo.style.display = '';
        if (btnStop) btnStop.style.display = 'none';
    }
}

function extractYouTubeId(url) {
    if (!url) return null;
    // Formats: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/live/ID, youtube.com/embed/ID
    let match = url.match(/(?:youtube\.com\/(?:watch\?.*v=|live\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

async function toggleLive(activate) {
    const urlInput = document.getElementById('adminLiveUrl');
    const titleInput = document.getElementById('adminLiveTitle');

    if (activate) {
        const url = urlInput.value.trim();
        if (!url) { toast('Cole o link do YouTube!', 'error'); return; }
        const videoId = extractYouTubeId(url);
        if (!videoId) { toast('Link do YouTube inválido!', 'error'); return; }

        try {
            await db.collection('settings').doc('live').set({
                active: true,
                url: url,
                title: titleInput.value.trim(),
                videoId: videoId,
                startedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            toast('🔴 Live ativada!', 'success');
        } catch (e) {
            toast('Erro: ' + e.message, 'error');
        }
    } else {
        if (!confirm('Encerrar a transmissão ao vivo?')) return;
        try {
            await db.collection('settings').doc('live').set({ active: false });
            toast('⬛ Live encerrada.', 'success');
        } catch (e) {
            toast('Erro: ' + e.message, 'error');
        }
    }
}

async function loadAdminLiveStatus() {
    try {
        const doc = await db.collection('settings').doc('live').get();
        const data = doc.exists ? doc.data() : {};
        updateAdminLiveUI(data);
    } catch (e) {
        console.error('Error loading live status:', e);
    }
}

// ╔══════════════════════════════════╗
// ║       JORNAL MiRB               ║
// ╚══════════════════════════════════╝

// Get Sunday of a given week (start of week)
function getWeekSunday(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d;
}

// Get Saturday of a given week (end of week)
function getWeekSaturday(sundayDate) {
    const d = new Date(sundayDate);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
}

// Format date as "dd/mm"
function fmtDM(date) {
    return String(date.getDate()).padStart(2, '0') + '/' + String(date.getMonth() + 1).padStart(2, '0');
}

// Calculate weekly rating using MiRB v1.1 formula
function calcWeeklyRatings(entries) {
    if (!entries.length) return;
    const W_ADR = 0.25, W_KAST = 0.25, W_KD = 0.20, W_FK = 0.10, W_WIN = 0.05, W_MATCHES = 0.15;

    entries.forEach(p => {
        p.avgAdr  = p.adrSum / p.matches;
        p.avgKast = p.kastSum / p.matches;
        p.avgKdr  = p.deaths > 0 ? p.kills / p.deaths : p.kills;
        p.avgFk   = p.matches > 0 ? p.fk / p.matches : 0;
        p.winPct  = p.matches > 0 ? (p.wins / p.matches) * 100 : 0;
    });

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

    const avgRating    = entries.reduce((s, p) => s + p.rawScore, 0) / entries.length;
    const regThreshold = Math.ceil(maxMatches * 0.7);
    entries.forEach(p => {
        const confidence = Math.min(1, p.matches / regThreshold);
        p.rating = confidence * p.rawScore + (1 - confidence) * avgRating;
    });
}

async function generateJornal(targetSunday) {
    const weekStart = new Date(targetSunday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = getWeekSaturday(weekStart);
    const weekId = weekStart.toISOString().slice(0, 10); // "2026-02-15"

    // Check if already exists
    const existingDoc = await db.collection('jornal').doc(weekId).get();
    if (existingDoc.exists) return existingDoc.data();

    // Fetch all matches in the date range
    const allMatches = await db.collection('matches').orderBy('createdAt', 'desc').get();
    const allInPeriod = [];
    const weekMatches = [];
    allMatches.docs.forEach(d => {
        const m = { id: d.id, ...d.data() };
        if (!m.createdAt) return;
        const dt = m.createdAt.toDate();
        if (dt < weekStart || dt > weekEnd) return;
        allInPeriod.push(m);
        if (m.gcStats && m.gcStats.length > 0) weekMatches.push(m);
    });
    const missingGC = allInPeriod.filter(m => !m.gcStats || m.gcStats.length === 0);
    console.log(`[Jornal] Semana ${weekId} (${weekStart.toLocaleDateString()} a ${weekEnd.toLocaleDateString()}): ${allInPeriod.length} partidas no período, ${weekMatches.length} com GC stats, ${missingGC.length} sem GC stats`);
    if (missingGC.length > 0) console.log('[Jornal] Partidas sem GC stats:', missingGC.map(m => m.name || m.id));

    if (weekMatches.length === 0) return null;

    // Load base64 avatar cache for consistent avatars
    const avatarCache = await loadAvatarB64Cache();

    // Aggregate player stats
    const ps = {};
    weekMatches.forEach(m => {
        m.gcStats.forEach(g => {
            const key = g.playerName || g.gcName;
            if (!key) return;
            if (!ps[key]) {
                ps[key] = {
                    name: key, avatar: g.avatar || '',
                    kills: 0, deaths: 0, assists: 0, diff: 0,
                    adrSum: 0, kdrSum: 0, kastSum: 0, fk: 0,
                    rp: 0, matches: 0, wins: 0, losses: 0
                };
            }
            const p = ps[key];
            p.matches++;
            p.kills += g.k || 0;
            p.deaths += g.d || 0;
            p.assists += g.a || 0;
            p.diff += g.diff || 0;
            p.adrSum += g.adr || 0;
            p.kdrSum += g.kdr || 0;
            p.kastSum += g.kast || 0;
            p.fk += g.fk || 0;
            p.rp += g.rp || 0;
            const isWin = g.win != null ? g.win : ((g.rp || 0) >= 0);
            if (isWin) p.wins++; else p.losses++;
            if (!p.avatar && g.avatar) p.avatar = g.avatar;
        });
    });

    // Prefer base64 cached avatars (most up-to-date)
    Object.values(ps).forEach(p => {
        if (avatarCache[p.name]) p.avatar = avatarCache[p.name];
    });

    // Filter: minimum 30% of week's matches
    const minMatches = Math.max(1, Math.ceil(weekMatches.length * 0.3));
    const entries = Object.values(ps).filter(p => p.matches >= minMatches);
    if (entries.length === 0) return null;

    // Calculate weekly ratings
    calcWeeklyRatings(entries);

    // Tiebreaker helpers
    const tiebreakerPositive = (a, b) => (b.rating - a.rating) || (b.avgAdr - a.avgAdr);
    const tiebreakerNegative = (a, b) => (a.rating - b.rating) || (a.avgAdr - b.avgAdr);

    // ── Determine badges ──
    const badges = [];

    // Helper to build stats summary for a player
    const pStats = (p) => ({
        adr: p.avgAdr.toFixed(1), kast: p.avgKast.toFixed(1),
        kd: p.avgKdr.toFixed(2), fk: p.avgFk.toFixed(1),
        kills: p.kills, deaths: p.deaths, assists: p.assists,
        diff: p.diff, wins: p.wins, losses: p.losses, matches: p.matches,
        dpm: (p.deaths / p.matches).toFixed(1), kpm: (p.kills / p.matches).toFixed(1),
        winPct: p.winPct.toFixed(0), rating: p.rating.toFixed(1)
    });

    // 🏆 MVP — highest rating
    const sorted = [...entries].sort((a, b) => b.rating - a.rating);
    const mvp = sorted[0];
    const mvp2 = sorted.length > 1 ? sorted[1] : null;
    badges.push({ type: 'mvp', emoji: '🏆', label: 'MVP', player: mvp.name, value: mvp.rating.toFixed(1), avatar: mvp.avatar, s: pStats(mvp), runner: mvp2 ? { name: mvp2.name, rating: mvp2.rating.toFixed(1) } : null });

    // 🎯 Entry — most FK per match
    const fkSorted = [...entries].sort((a, b) => (b.avgFk - a.avgFk) || tiebreakerPositive(a, b));
    const entry = fkSorted[0];
    badges.push({ type: 'entry', emoji: '🎯', label: 'Entry', player: entry.name, value: entry.avgFk.toFixed(1), avatar: entry.avatar, s: pStats(entry) });

    // 💀 Saco de Pancada — most deaths per match
    const deathSorted = [...entries].sort((a, b) => {
        const dpmA = a.deaths / a.matches, dpmB = b.deaths / b.matches;
        return (dpmB - dpmA) || tiebreakerNegative(a, b);
    });
    const saco = deathSorted[0];
    badges.push({ type: 'saco_de_pancada', emoji: '💀', label: 'Saco de Pancada', player: saco.name, value: (saco.deaths / saco.matches).toFixed(1), avatar: saco.avatar, s: pStats(saco) });

    // 🤡 Pateta — lowest avg ADR
    const adrSorted = [...entries].sort((a, b) => (a.avgAdr - b.avgAdr) || (a.rating - b.rating));
    const pateta = adrSorted[0];
    badges.push({ type: 'pateta', emoji: '🤡', label: 'Pateta', player: pateta.name, value: pateta.avgAdr.toFixed(1), avatar: pateta.avatar, s: pStats(pateta) });

    // 📈 Em Alta / 📉 Em Queda — need previous week's jornal
    const prevSunday = new Date(weekStart);
    prevSunday.setDate(prevSunday.getDate() - 7);
    const prevWeekId = prevSunday.toISOString().slice(0, 10);
    const prevDoc = await db.collection('jornal').doc(prevWeekId).get();

    if (prevDoc.exists && prevDoc.data().playerRatings) {
        const prevRatings = prevDoc.data().playerRatings;

        const diffs = entries.filter(p => prevRatings[p.name] != null).map(p => ({
            ...p, ratingDiff: p.rating - prevRatings[p.name]
        }));

        // Jogadores com badge negativo não podem ser Em Alta, e MVP não pode ser Em Queda
        const negativeBadgePlayers = new Set(badges.filter(b => b.type === 'pateta' || b.type === 'saco_de_pancada').map(b => b.player));
        const positiveBadgePlayers = new Set(badges.filter(b => b.type === 'mvp').map(b => b.player));

        if (diffs.length > 0) {
            // Em Alta — biggest positive diff (mínimo 3 pontos, exclui pateta/saco)
            const altaSorted = diffs.filter(d => d.ratingDiff >= 3 && !negativeBadgePlayers.has(d.name)).sort((a, b) => (b.ratingDiff - a.ratingDiff) || tiebreakerPositive(a, b));
            if (altaSorted.length > 0) {
                const alta = altaSorted[0];
                badges.push({ type: 'em_alta', emoji: '📈', label: 'Em Alta', player: alta.name, value: '+' + alta.ratingDiff.toFixed(1), avatar: alta.avatar, s: pStats(alta), prevRating: prevRatings[alta.name].toFixed(1) });
            }

            // Em Queda — biggest negative diff (mínimo -3 pontos, exclui mvp)
            const quedaSorted = diffs.filter(d => d.ratingDiff <= -3 && !positiveBadgePlayers.has(d.name)).sort((a, b) => (a.ratingDiff - b.ratingDiff) || tiebreakerNegative(a, b));
            if (quedaSorted.length > 0) {
                const queda = quedaSorted[0];
                badges.push({ type: 'em_queda', emoji: '📉', label: 'Em Queda', player: queda.name, value: queda.ratingDiff.toFixed(1), avatar: queda.avatar, s: pStats(queda), prevRating: prevRatings[queda.name].toFixed(1) });
            }
        }
    }

    // ── General stats ──
    let totalWins = 0, totalLosses = 0;
    let closestScore = null, biggestWin = null;
    let closestDiff = 999, biggestDiff = 0;

    weekMatches.forEach(m => {
        if (!m.gcStats || m.gcStats.length === 0) return;
        // Get team scores from first GC match
        const teamsMap = {};
        m.gcStats.forEach(g => {
            if (g.teamName && g.teamScore != null && !teamsMap[g.teamName]) {
                teamsMap[g.teamName] = g.teamScore;
            }
        });
        const teams = Object.entries(teamsMap);
        if (teams.length === 2) {
            const [t1, s1] = teams[0];
            const [t2, s2] = teams[1];
            const diff = Math.abs(s1 - s2);
            const scoreStr = s1 + 'x' + s2;
            if (diff < closestDiff) { closestDiff = diff; closestScore = { match: m.name, score: scoreStr }; }
            if (diff > biggestDiff) { biggestDiff = diff; biggestWin = { match: m.name, score: scoreStr }; }
        }
    });

    entries.forEach(p => { totalWins += p.wins; totalLosses += p.losses; });
    const totalGames = totalWins + totalLosses;
    const winRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : 0;

    // Extra general stats
    const totalKills = entries.reduce((s, p) => s + p.kills, 0);
    const totalDeaths = entries.reduce((s, p) => s + p.deaths, 0);
    const totalAssists = entries.reduce((s, p) => s + p.assists, 0);
    const avgAdr = entries.length > 0 ? (entries.reduce((s, p) => s + p.avgAdr, 0) / entries.length).toFixed(1) : '0';
    // Top killer: most kills total
    const topKiller = [...entries].sort((a, b) => b.kills - a.kills)[0];
    // Top assister
    const topAssist = [...entries].sort((a, b) => b.assists - a.assists)[0];

    // Save player ratings for next week's "Em Alta"/"Em Queda"
    const playerRatings = {};
    entries.forEach(p => { playerRatings[p.name] = p.rating; });

    const jornalData = {
        weekStart: weekId,
        weekEnd: weekEnd.toISOString().slice(0, 10),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        totalMatches: weekMatches.length,
        matchesInPeriod: allInPeriod.length,
        matchesMissingGC: missingGC.map(m => m.name || m.id),
        totalPlayers: entries.length,
        winRate: parseFloat(winRate),
        closestScore,
        biggestWin,
        totalKills, totalDeaths, totalAssists,
        avgAdr: parseFloat(avgAdr),
        topKiller: topKiller ? { name: topKiller.name, kills: topKiller.kills } : null,
        topAssist: topAssist ? { name: topAssist.name, assists: topAssist.assists } : null,
        badges,
        playerRatings
    };

    await db.collection('jornal').doc(weekId).set(jornalData);
    return jornalData;
}

let jornalCache = [];

async function loadJornal() {
    const el = document.getElementById('jornalContent');
    el.innerHTML = '<div class="loading-spinner">Carregando Jornal MiRB</div>';

    try {
        // Auto-generate last week's jornal if missing
        const lastSunday = getWeekSunday(new Date());
        lastSunday.setDate(lastSunday.getDate() - 7);
        await generateJornal(lastSunday);

        // Fetch all jornais
        const snap = await db.collection('jornal').orderBy('weekStart', 'desc').get();

        if (snap.empty) {
            document.getElementById('jornalFilterEdition').innerHTML = '<option value="">Nenhuma edição</option>';
            el.innerHTML = '<div class="empty-state"><div class="icon">📰</div><p>Nenhum Jornal MiRB gerado ainda.</p></div>';
            return;
        }

        // Cache all jornais and populate dropdown
        jornalCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const sel = document.getElementById('jornalFilterEdition');
        const currentVal = sel.value;
        sel.innerHTML = jornalCache.map((j, idx) => {
            const ws = j.weekStart.split('-');
            const we = j.weekEnd.split('-');
            const edNum = jornalCache.length - idx;
            const label = `Edição Nº ${edNum} — ${ws[2]}/${ws[1]} a ${we[2]}/${we[1]}`;
            return `<option value="${idx}" ${String(idx) === currentVal ? 'selected' : ''}>${label}</option>`;
        }).join('');

        // Default to latest (idx 0) if nothing selected
        if (!currentVal) sel.value = '0';

        renderSelectedJornal();
    } catch (e) {
        el.innerHTML = `<p style="color:var(--red);text-align:center;padding:30px;">Erro ao carregar Jornal: ${e.message}</p>`;
    }
}

let _avatarB64Cache = null;
async function loadAvatarB64Cache() {
    if (_avatarB64Cache) return _avatarB64Cache;
    _avatarB64Cache = {};
    try {
        const snap = await db.collection('players').get();
        snap.docs.forEach(d => {
            const data = d.data();
            if (data.avatarB64) _avatarB64Cache[data.name] = data.avatarB64;
        });
    } catch {}
    return _avatarB64Cache;
}

// One-time migration: convert all existing avatar URLs to base64 in Firestore
async function syncAvatarCache() {
    toast('⏳ Convertendo avatares...', 'success');
    const snap = await db.collection('matches').orderBy('createdAt','desc').get();
    const avatarUrls = {}; // playerId → { name, url }
    snap.docs.forEach(d => {
        (d.data().gcStats || []).forEach(g => {
            if (g.avatar && g.playerId && !avatarUrls[g.playerId]) {
                avatarUrls[g.playerId] = { name: g.playerName, url: g.avatar };
            }
        });
    });
    let ok = 0, fail = 0;
    for (const [playerId, info] of Object.entries(avatarUrls)) {
        try {
            const b64 = await imgToDataURL(info.url);
            if (b64) {
                await db.collection('players').doc(playerId).update({ avatarB64: b64 });
                ok++;
            } else { fail++; }
        } catch { fail++; }
    }
    _avatarB64Cache = null;
    toast(`✅ Avatares: ${ok} convertidos, ${fail} falharam`, 'success');
}

async function imgToDataURL(url) {
    const proxies = [
        url,
        'https://wsrv.nl/?url=' + encodeURIComponent(url),
        'https://corsproxy.io/?' + encodeURIComponent(url)
    ];
    for (const fetchUrl of proxies) {
        try {
            const r = await fetch(fetchUrl, { mode: 'cors' });
            if (!r.ok) continue;
            const b = await r.blob();
            if (b.size < 100) continue;
            return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
        } catch { continue; }
    }
    return null;
}
async function shareJornal() {
    const paper = document.querySelector('#jornalContent .jornal-paper');
    if (!paper) { toast('Nenhum jornal para compartilhar', 'error'); return; }
    const btn = document.getElementById('btnShareJornal');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Gerando...';
    btn.disabled = true;
    const imgs = paper.querySelectorAll('img');
    const origSrcs = [];
    try {
        const b64Cache = await loadAvatarB64Cache();
        await Promise.all([...imgs].map(async (img) => {
            origSrcs.push({ el: img, src: img.src });
            // Try base64 cache first (by alt text = player name)
            const playerName = img.alt || '';
            if (playerName && b64Cache[playerName]) { img.src = b64Cache[playerName]; return; }
            const dataUrl = await imgToDataURL(img.src);
            if (dataUrl) img.src = dataUrl;
        }));
        const canvas = await html2canvas(paper, { useCORS: true, scale: 2, backgroundColor: '#d5d0c8', logging: false });
        const edIdx = parseInt(document.getElementById('jornalFilterEdition').value) || 0;
        const edNum = jornalCache.length - edIdx;
        const filename = `jornal-mirb-edicao-${edNum}.png`;
        origSrcs.forEach(o => o.el.src = o.src);
        canvas.toBlob(async (blob) => {
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: 'image/png' })] })) {
                try {
                    await navigator.share({ files: [new File([blob], filename, { type: 'image/png' })], title: `Jornal MiRB - Edição ${edNum}` });
                } catch (e) { if (e.name !== 'AbortError') downloadBlob(blob, filename); }
            } else {
                downloadBlob(blob, filename);
            }
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 'image/png');
    } catch (e) {
        origSrcs.forEach(o => o.el.src = o.src);
        toast('Erro ao gerar imagem: ' + e.message, 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function captureJornalImage(jornalData, edNum) {
    const html = renderJornalHtml(jornalData, edNum, true);
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;width:900px;';
    container.innerHTML = html;
    document.body.appendChild(container);
    const paper = container.querySelector('.jornal-paper');

    const b64Cache = await loadAvatarB64Cache();
    const imgs = paper.querySelectorAll('img');
    await Promise.all([...imgs].map(async (img) => {
        const playerName = img.alt || '';
        if (playerName && b64Cache[playerName]) { img.src = b64Cache[playerName]; return; }
        const dataUrl = await imgToDataURL(img.src);
        if (dataUrl) img.src = dataUrl;
    }));

    await document.fonts.ready;
    const canvas = await html2canvas(paper, { useCORS: true, scale: 2, backgroundColor: '#d5d0c8', logging: false });
    document.body.removeChild(container);
    return canvas.toDataURL('image/jpeg', 0.75);
}

async function viewArchivedJornal() {
    const sel = document.getElementById('jornalFilterEdition');
    const idx = parseInt(sel.value);
    if (isNaN(idx) || !jornalCache[idx]) return;
    const weekId = jornalCache[idx].id;

    toast('⏳ Carregando arquivo...', 'success');
    const doc = await db.collection('jornal').doc(weekId).collection('archive').doc('image').get();
    if (!doc.exists || !doc.data().imageBase64) {
        toast('Edição sem imagem arquivada', 'error');
        return;
    }
    const win = window.open();
    win.document.write(`<html><head><title>Jornal MiRB - Arquivo</title></head><body style="margin:0;background:#222;display:flex;justify-content:center;"><img src="${doc.data().imageBase64}" style="max-width:100%;height:auto;"></body></html>`);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Imagem salva!', 'success');
}

// ╔══════════════════════════════════╗
// ║    ESCALAÇÃO / FIGHT CARD       ║
// ╚══════════════════════════════════╝
let _fightCardCache = null;

async function fetchAllTimePlayerStats() {
    if (_fightCardCache) return _fightCardCache;
    const snap = await db.collection('matches').orderBy('createdAt','desc').get();
    const matches = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.gcStats && m.gcStats.length > 0);
    const ps = {};
    matches.forEach(m => {
        m.gcStats.forEach(g => {
            const key = g.playerId || g.gcName || g.playerName;
            if (!ps[key]) ps[key] = { name: g.playerName, avatar: '', matches: 0, kills: 0, deaths: 0, adrSum: 0, kastSum: 0, fk: 0, wins: 0, losses: 0 };
            const p = ps[key];
            p.matches++; p.kills += g.k; p.deaths += g.d; p.adrSum += g.adr; p.kastSum += g.kast; p.fk += g.fk;
            if (g.win != null ? g.win : (g.rp >= 0)) p.wins++; else p.losses++;
            if (!p.avatar && g.avatar) p.avatar = g.avatar;
        });
    });
    const entries = Object.values(ps);
    if (entries.length > 0) {
        const W = { adr: 0.25, kast: 0.25, kd: 0.20, fk: 0.10, win: 0.05, mp: 0.15 };
        entries.forEach(p => { p.avgAdr = p.adrSum/p.matches; p.avgKast = p.kastSum/p.matches; p.avgKd = p.deaths > 0 ? p.kills/p.deaths : p.kills; p.avgFk = p.fk/p.matches; p.winPct = p.matches > 0 ? (p.wins/p.matches)*100 : 0; });
        const mx = { adr: Math.max(...entries.map(p=>p.avgAdr)), kast: Math.max(...entries.map(p=>p.avgKast)), kd: Math.max(...entries.map(p=>p.avgKd)), fk: Math.max(...entries.map(p=>p.avgFk)), win: Math.max(...entries.map(p=>p.winPct)), mp: Math.max(...entries.map(p=>p.matches)) };
        entries.forEach(p => {
            p.rawRating = (mx.adr>0?(p.avgAdr/mx.adr)*100:0)*W.adr + (mx.kast>0?(p.avgKast/mx.kast)*100:0)*W.kast + (mx.kd>0?(p.avgKd/mx.kd)*100:0)*W.kd + (mx.fk>0?(p.avgFk/mx.fk)*100:0)*W.fk + (mx.win>0?(p.winPct/mx.win)*100:0)*W.win + (mx.mp>0?Math.max(0.1,p.matches/mx.mp)*100:0)*W.mp;
        });
        const avg = entries.reduce((s,p)=>s+p.rawRating,0)/entries.length;
        const thresh = Math.ceil(mx.mp * 0.7);
        entries.forEach(p => { const c = Math.min(1, p.matches/thresh); p.rating = c*p.rawRating + (1-c)*avg; });
    }
    _fightCardCache = ps;
    return ps;
}

async function fetchLatestBadges() {
    const snap = await db.collection('jornal').orderBy('weekStart','desc').limit(1).get();
    const m = {};
    if (!snap.empty) (snap.docs[0].data().badges || []).forEach(b => { if (!m[b.player]) m[b.player] = []; m[b.player].push({ emoji: b.emoji, label: b.label }); });
    return m;
}

function buildPlayerCard(player, stats, badgeMap, avatarB64Cache) {
    const s = stats;
    const rating = s?.rating ? s.rating.toFixed(1) : '—';
    const adr = s ? (s.adrSum/s.matches).toFixed(1) : '—';
    const kd = s ? (s.deaths>0?(s.kills/s.deaths).toFixed(2):s.kills) : '—';
    const kast = s ? (s.kastSum/s.matches).toFixed(0) : '—';
    const wr = s ? ((s.wins/s.matches)*100).toFixed(0)+'%' : '—';
    const avatar = (avatarB64Cache && avatarB64Cache[player.name]) || s?.avatar || '';
    const badges = badgeMap[player.name] ? badgeMap[player.name].map(b => `<span style="font-size:14px;" title="${b.label}">${b.emoji}</span>`).join(' ') : '';
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(255,255,255,0.04);border-radius:8px;margin-bottom:6px;border:1px solid rgba(255,255,255,0.06);">
        ${avatar ? `<img src="${avatar}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;">` : `<div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.1);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:16px;color:var(--text-dim);">👤</div>`}
        <div style="flex:1;min-width:0;">
            <div style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:15px;color:#e8eaf0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${player.name} ${badges}</div>
            <div style="font-size:11px;color:#8892a4;">${player.role || ''}</div>
        </div>
        <div style="display:flex;gap:12px;font-size:12px;text-align:center;flex-shrink:0;">
            <div><div style="color:#8892a4;font-size:9px;text-transform:uppercase;">ADR</div><div style="font-family:'Rajdhani',sans-serif;font-weight:700;color:#e8eaf0;">${adr}</div></div>
            <div><div style="color:#8892a4;font-size:9px;text-transform:uppercase;">K/D</div><div style="font-family:'Rajdhani',sans-serif;font-weight:700;color:#e8eaf0;">${kd}</div></div>
            <div><div style="color:#8892a4;font-size:9px;text-transform:uppercase;">KAST</div><div style="font-family:'Rajdhani',sans-serif;font-weight:700;color:#e8eaf0;">${kast}%</div></div>
            <div><div style="color:#8892a4;font-size:9px;text-transform:uppercase;">WIN</div><div style="font-family:'Rajdhani',sans-serif;font-weight:700;color:#00c853;">${wr}</div></div>
        </div>
    </div>`;
}

function buildMatchImageHtml(match, allStats, badgeMap, avatarB64Cache) {
    const date = match.createdAt ? match.createdAt.toDate().toLocaleDateString('pt-BR') : '';
    const hasTeams = match.result && match.result.teamA && match.result.teamB;
    const getStats = (p) => allStats[p.id] || Object.values(allStats).find(x => x.name.toLowerCase() === p.name.toLowerCase()) || null;

    let playersHtml, subtitle;
    if (hasTeams) {
        subtitle = 'FIGHT CARD';
        playersHtml = `
            <div style="display:flex;justify-content:center;margin-bottom:12px;">
                <span style="font-family:'Rajdhani',sans-serif;font-size:28px;font-weight:700;color:#ffd600;letter-spacing:4px;">⚔️ VS ⚔️</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div>
                    <div style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:16px;color:#4fc3f7;text-align:center;margin-bottom:8px;text-transform:uppercase;letter-spacing:2px;">💙 Time A (${match.result.sumA} pts)</div>
                    ${match.result.teamA.map(p => buildPlayerCard(p, getStats(p), badgeMap, avatarB64Cache)).join('')}
                </div>
                <div>
                    <div style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:16px;color:#ffd740;text-align:center;margin-bottom:8px;text-transform:uppercase;letter-spacing:2px;">🧡 Time B (${match.result.sumB} pts)</div>
                    ${match.result.teamB.map(p => buildPlayerCard(p, getStats(p), badgeMap, avatarB64Cache)).join('')}
                </div>
            </div>`;
    } else {
        subtitle = 'ESCALAÇÃO DA NOITE';
        const left = match.players.slice(0, Math.ceil(match.players.length/2));
        const right = match.players.slice(Math.ceil(match.players.length/2));
        playersHtml = `
            <div style="text-align:center;margin-bottom:12px;font-size:14px;color:#8892a4;">👥 ${match.players.length}/10 jogadores confirmados</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div>${left.map(p => buildPlayerCard(p, getStats(p), badgeMap, avatarB64Cache)).join('')}</div>
                <div>${right.map(p => buildPlayerCard(p, getStats(p), badgeMap, avatarB64Cache)).join('')}</div>
            </div>`;
    }

    return `<div class="fight-card" style="width:800px;padding:32px;background:#0a0e17;font-family:'Outfit',sans-serif;color:#e8eaf0;border:2px solid rgba(0,200,83,0.3);border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
            <div style="font-family:'Rajdhani',sans-serif;font-size:36px;font-weight:700;letter-spacing:6px;text-transform:uppercase;background:linear-gradient(135deg,#ffd600 0%,#00c853 50%,#2979ff 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">MIRB MIX</div>
            <div style="font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:600;color:#8892a4;letter-spacing:3px;text-transform:uppercase;margin-top:2px;">${subtitle}</div>
            <div style="font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:600;color:#e8eaf0;margin-top:8px;">${match.name || 'Partida'}</div>
            ${date ? `<div style="font-size:13px;color:#8892a4;margin-top:4px;">📅 ${date}</div>` : ''}
        </div>
        ${playersHtml}
        <div style="text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#8892a4;">mirbcs.com · Rating MiRB v1.1</div>
    </div>`;
}

// Pre-generated image cache: matchId → { blob, filename, title }
const _matchImageCache = {};

async function preGenerateMatchImage(matchId) {
    if (_matchImageCache[matchId]) return;
    try {
        const matchDoc = await db.collection('matches').doc(matchId).get();
        const match = matchDoc.data();
        const [allStats, badgeMap, avatarB64Cache] = await Promise.all([fetchAllTimePlayerStats(), fetchLatestBadges(), loadAvatarB64Cache()]);
        const cardHtml = buildMatchImageHtml(match, allStats, badgeMap, avatarB64Cache);

        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
        container.innerHTML = cardHtml;
        document.body.appendChild(container);
        const cardEl = container.querySelector('.fight-card');

        const imgs = cardEl.querySelectorAll('img');
        await Promise.all([...imgs].map(async img => {
            const d = await imgToDataURL(img.src);
            if (d) { img.src = d; }
            else {
                // CORS failed — replace with placeholder div
                const ph = document.createElement('div');
                ph.style.cssText = img.style.cssText + ';background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:16px;';
                ph.textContent = '👤';
                img.replaceWith(ph);
            }
        }));

        await document.fonts.ready;
        const canvas = await html2canvas(cardEl, { useCORS: true, scale: 2, backgroundColor: '#0a0e17', logging: false });
        document.body.removeChild(container);

        const hasTeams = match.result && match.result.teamA;
        const filename = `mirb-${hasTeams ? 'fightcard' : 'escalacao'}-${(match.name || 'mix').replace(/\s+/g, '-').toLowerCase()}.png`;
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const pCount = (match.players || []).length;
        const shareTitle = pCount >= 10 ? 'MiRB X5 Confirmed' : `MiRB informa: falta ${10 - pCount} noob`;
        _matchImageCache[matchId] = { blob, filename, title: shareTitle };
    } catch (e) { console.warn('Pre-gen failed:', e); }
}

async function shareMatchImage(matchId) {
    // If not cached yet, generate now (shows loading)
    if (!_matchImageCache[matchId]) {
        toast('⏳ Gerando imagem...', 'success');
        await preGenerateMatchImage(matchId);
    }
    const cached = _matchImageCache[matchId];
    if (!cached) { toast('Erro ao gerar imagem', 'error'); return; }

    if (navigator.share) {
        try {
            const file = new File([cached.blob], cached.filename, { type: 'image/png' });
            await navigator.share({ files: [file], title: cached.title });
            return;
        } catch (e) {
            if (e.name === 'AbortError') return;
        }
    }
    // Fallback: download
    downloadBlob(cached.blob, cached.filename);
}

// Keep generateMatchImage for admin buttons (opens overlay for preview)
async function generateMatchImage(matchId) {
    toast('⏳ Gerando imagem...', 'success');
    if (!_matchImageCache[matchId]) await preGenerateMatchImage(matchId);
    const cached = _matchImageCache[matchId];
    if (!cached) { toast('Erro ao gerar imagem', 'error'); return; }

    const dataUrl = URL.createObjectURL(cached.blob);
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `
        <img src="${dataUrl}" style="max-width:100%;max-height:60vh;border-radius:12px;border:1px solid rgba(255,255,255,0.1);">
        <div style="display:flex;gap:12px;margin-top:16px;">
            <button id="_shareBtn" class="btn btn-primary" style="font-size:14px;padding:10px 24px;">📤 Compartilhar</button>
            <button id="_downloadBtn" class="btn btn-secondary" style="font-size:14px;padding:10px 24px;">💾 Salvar</button>
        </div>
        <div style="margin-top:8px;text-align:center;color:var(--text-dim);font-size:11px;opacity:0.6;">ou segure a imagem para compartilhar</div>
        <button id="_closeBtn" style="position:absolute;top:12px;right:12px;background:rgba(255,255,255,0.1);border:none;color:#fff;font-size:22px;cursor:pointer;padding:8px 12px;border-radius:8px;">✕</button>
    `;
    document.body.appendChild(overlay);
    const closeOverlay = () => { URL.revokeObjectURL(dataUrl); if (overlay.parentNode) document.body.removeChild(overlay); };
    overlay.querySelector('#_closeBtn').onclick = closeOverlay;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });
    overlay.querySelector('#_shareBtn').onclick = () => {
        if (navigator.share) {
            const file = new File([cached.blob], cached.filename, { type: 'image/png' });
            navigator.share({ files: [file], title: cached.title }).then(closeOverlay).catch(e => { if (e.name !== 'AbortError') toast('Erro', 'error'); });
        } else { toast('📲 Segure a imagem para compartilhar', 'error'); }
    };
    overlay.querySelector('#_downloadBtn').onclick = () => { downloadBlob(cached.blob, cached.filename); closeOverlay(); };
}

const JORNAL_QUOTES = {
    mvp: [
        'Contra esse lobby, até meu avô fazia 30 kills.',
        'Se rating pagasse conta, ele já tinha se aposentado.',
        'Carregou o time nas costas e ainda pediu mais peso.',
        'Contra newba é fácil. Mas alguém tinha que fazer.',
        'Enquanto uns reclamam do time, ele carrega.',
        'Adversário tão perdido que ele jogou no modo fácil.',
        'Nível comprado? Esse aí comprou com nota fiscal.',
        'O adversário jogava melhor de olho fechado.',
        'Joga joga joga e só melhora. Qual é o segredo?',
        'Proibido reclamar quando ele tá no time.',
        'Lobby tão fraco que ele treinou mira no competitivo.',
        'Fez o adversário repensar as escolhas de vida.',
        'Com esse adversário, qualquer um brilha. Mas ele brilhou mais.',
        'Se destacar nesse nível é fácil — difícil é manter toda semana.',
        'O inimigo jogava como se fosse a primeira vez abrindo o CS.',
        'Não é que ele jogou bem, é que o oponente jogou pior.',
        'Rendimento tão alto que parece smurf no próprio lobby.',
        'Ganhar desse time adversário é obrigação. MVP é bônus.',
        'O adversário tava tão perdido que pediu GPS no meio do round.',
        'Não precisa de call: o inimigo já entrega a posição sozinho.',
        'O inimigo pediu timeout pra chorar.',
        'Com o nível do adversário, até smoke mata.',
        'O oponente errava tanto que ele matava de pena.',
        'Lobby tão fácil que ele jogou com a mão no mouse e a outra no celular.',
        'O adversário confundiu competitive com casual.'
    ],
    saco: [
        'Especialista em dar de presente a própria vida.',
        'Morreu mais vezes que personagem de novela.',
        'Se morrer desse XP, ele já era Global.',
        'O spawn dele já vem com vela acesa.',
        'Deveria vender o PC pois não consegue sobreviver um round.',
        'A cada round, um novo velório.',
        'Alugou um triplex no chão do bomb.',
        'A família pede justiça.',
        'O inimigo agradece a colaboração.',
        'Morre de lado, morre de frente, morre de tudo.',
        'O colete dele é só decoração.',
        'Não sobrevive nem o pistol round.',
        'Compra colete pra quê, se não dura 5 segundos?',
        'O kill feed é praticamente um obituário pessoal.',
        'Se a morte tivesse programa de fidelidade, ele já era VIP.',
        'O radar do inimigo já marca ele como alvo prioritário.',
        'Cogitaram dar respawn infinito só pra ele.',
        'O scoreboard dele parece contagem regressiva — só o D sobe.',
        'Até bot no Easy morre menos.',
        'Ele não joga CS, ele pratica speedrun de morte.',
        'O colete pede demissão antes do round começar.',
        'As mortes dele merecem um compilado no YouTube.',
        'Inventaram o trade frag por causa dele.',
        'O time adversário já sabe: é só esperar ele aparecer.',
        'Se CS fosse novela, ele seria o personagem que morre no piloto.'
    ],
    pateta: [
        'Fontes dizem que até os bots têm mais impacto.',
        'ADR tão baixo que parece bug do servidor.',
        'Até smoke faz mais estrago.',
        'Joga joga joga e não melhora: qual seria a raiz do problema?',
        'Nível carregado é pouco. Esse aí foi rebocado.',
        'Fez menos dano que uma molotov mal jogada.',
        'A torcida pede contratação urgente de reforço.',
        'O time adversário já nem comemora os rounds — agradece.',
        'Delimitar 4 horríveis por x5? Ele conta por 2.',
        'Se dano fosse opcional, ele já tinha desativado.',
        'Dano médio menor que o recuo da arma.',
        'Confundiram ele com decoração do mapa.',
        'Corre, atira, erra. A rotina não muda.',
        'Contribuição pro time: zero. Contribuição pro meme: máxima.',
        'O highlight dele é quando não morre primeiro.',
        'Ele não erra o spray — ele nunca acerta o spray.',
        'Se CS medisse esforço em vez de dano, talvez ele se salvasse.',
        'Até os mates pedem pra ele ficar na base.',
        'Último vivo do time e o clutch mais improvável da história — dele perdendo.',
        'Ele não joga mal, ele joga diferente. Muito diferente.',
        'O dano dele é mais emocional do que físico.',
        'Rumores dizem que a mira dele é aleatória.',
        'ADR de jogador que usa trackpad.',
        'Prometeu melhorar semana que vem. Prometeu semana passada também.'
    ],
    entry: [
        'Entra no bomb como se fosse a casa dele.',
        'O inimigo nem terminou de posicionar e já está no chão.',
        'Especialista em abrir caminho — na bala, sem pedir licença.',
        'Flash, corre, mata. Nessa ordem. Toda vez.',
        'O primeiro a entrar e o primeiro a matar.',
        'Abre round como quem abre porta de geladeira — natural.',
        'O awper inimigo nem tem tempo de mirar.',
        'First kill é sobrenome dele.',
        'Não pede passagem. Toma.',
        'Possui porte de arma. Se cuide.',
        'Quando ele entra no bomb, alguém já caiu.',
        'O bomb tá liberado antes de todo mundo sair do spawn.',
        'Abrir round com ele é abrir com vantagem numérica.',
        'Entra na fumaça e sai com frag. Instinto puro.',
        'O entry dele é mais confiável que o despertador.',
        'Os mates só precisam seguir — o caminho já tá limpo.',
        'Se entry fosse profissão, ele já tava aposentado pelo INSS.',
        'A primeira bala dele já tem endereço.',
        'Ele não confere o ângulo, ele executa o ângulo.',
        'Rush dele é mais organizado que a economia do time.',
        'Paga de entry e entrega resultado. Raro.',
        'O terror de quem segura ângulo.',
        'Agressividade calculada. Resultado: first kill garantido.',
        'Nem precisa de util. A presença dele já é vantagem.',
        'Entra no site como quem entra em casa — com autoridade.'
    ],
    emAlta: [
        'A fase é boa.',
        'Se mantiver esse ritmo, vira lenda.',
        'Evolução visível a cada partida.',
        'O rating agradece o esforço.',
        'Quem duvidou, tá calado agora.',
        'Crescimento consistente. A curva só aponta pra cima.',
        'O hype é real.',
        'Subiu tanto que precisa de oxigênio.',
        'De promessa a realidade em uma semana.',
        'A confiança tá lá em cima — e os números provam.',
        'Se continuar assim, vai assustar muita gente.',
        'O grind tá dando resultado.',
        'Semana passada era dúvida. Essa semana é certeza.',
        'Rating subindo e moral lá em cima.',
        'O próximo passo é o topo.',
        'Treino tá pagando. E com juros.',
        'Fase boa demais pra ser coincidência.',
        'Quando acha o ritmo, ninguém segura.',
        'Os números não mentem: a evolução é real.',
        'Quem dormiu nele, acordou atrasado.'
    ],
    emQueda: [
        'A torcida pede reação.',
        'Fase tão ruim que até o bot joga melhor.',
        'O rating tá pedindo socorro.',
        'Caiu mais que ação de empresa falida.',
        'Desceu a ladeira e esqueceu o freio.',
        'Se continuar assim, vai precisar de resgate.',
        'O declínio preocupa até quem torce contra.',
        'Fase tão negativa que virou meme no grupo.',
        'Urge uma mudança de ares — ou de sens.',
        'O gráfico de desempenho parece montanha-russa — só que só desce.',
        'Até o ranking tá com pena.',
        'Se forma é passageira, essa tá demorando pra ir embora.',
        'O time já olha pra ele com cara de preocupação.',
        'Rating em queda livre. Paraquedas não incluído.',
        'A última vez que subiu foi pra pegar água.',
        'Já pensou em mudar de role? Ou de jogo?',
        'Quem viu semana passada não reconhece.',
        'O declínio é tão consistente que parece proposital.',
        'Se rating fosse saldo bancário, já estava no cheque especial.',
        'Nem o coach salva essa fase.'
    ]
};

function buildJornalSnapshot(badges, edNum) {
    const bm = {};
    (badges || []).forEach(b => { bm[b.type] = b; });
    const snap = { edNum };
    if (bm.mvp) snap.mvpQuote = JORNAL_QUOTES.mvp[edNum % JORNAL_QUOTES.mvp.length];
    if (bm.saco_de_pancada) snap.sacoQuote = JORNAL_QUOTES.saco[edNum % JORNAL_QUOTES.saco.length];
    if (bm.pateta) snap.patetaQuote = JORNAL_QUOTES.pateta[edNum % JORNAL_QUOTES.pateta.length];
    if (bm.entry) snap.entryQuote = JORNAL_QUOTES.entry[edNum % JORNAL_QUOTES.entry.length];
    if (bm.em_alta) snap.emAltaQuote = JORNAL_QUOTES.emAlta[edNum % JORNAL_QUOTES.emAlta.length];
    if (bm.em_queda) snap.emQuedaQuote = JORNAL_QUOTES.emQueda[edNum % JORNAL_QUOTES.emQueda.length];
    return snap;
}

function renderJornalHtml(j, edNum, isLatest) {
    const ws = j.weekStart.split('-');
    const we = j.weekEnd.split('-');
    const weekLabel = `${ws[2]}/${ws[1]} a ${we[2]}/${we[1]}`;

    const bm = {};
    (j.badges || []).forEach(b => { bm[b.type] = b; });

    const placeholder = (name) => {
        const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
        return `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23555"/><text x="50" y="55" font-size="36" fill="white" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">' + initials + '</text></svg>')}`;
    };
    const photo = (b, cls) => b
        ? `<img src="${b.avatar || placeholder(b.player)}" onerror="this.onerror=null;this.src='${placeholder(b.player)}'" class="jornal-player-photo ${cls || ''}" alt="${b.player}">`
        : '';
    const caption = (b, text) => b
        ? `<div class="jornal-photo-caption">${text || b.player}</div>`
        : '';
    const n = v => { const x = parseFloat(v); return isNaN(x) ? v : (x % 1 === 0 ? x.toString() : x.toFixed(1)); };
    const snap = j.snapshot || {};

    let paperHtml = `<div class="jornal-paper">`;

    // Masthead
    paperHtml += `
        <div class="jornal-masthead">
            ${isLatest ? '<div class="jornal-stamp">Edição Atual</div>' : ''}
            <div class="jornal-masthead-title"><span class="jornal-word">Jornal</span> <span class="mirb-word">MiRB</span></div>
            <div class="jornal-masthead-sub">Semanário Oficial do Mix CS2</div>
        </div>
        <div class="jornal-infobar">
            <span>Edição Nº ${edNum}</span>
            <span>${weekLabel}</span>
            <span>${j.totalMatches} partida${j.totalMatches !== 1 ? 's' : ''} • ${j.totalPlayers} jogadores</span>
            <span>Distribuição gratuita</span>
        </div>`;

            // Headline bar
            const headlineBarText = bm.mvp ? `\uD83C\uDFC6 ${bm.mvp.player.toUpperCase()} \u00c9 ELEITO MVP DA SEMANA COM RATING ${n(bm.mvp.value)} \uD83C\uDFC6` : 'DESTAQUES DA SEMANA';
            paperHtml += `<div class="jornal-headline-bar">${headlineBarText}</div>`;

            // ── Main body — 2 columns ──
            paperHtml += `<div class="jornal-body">`;

            // LEFT COLUMN — MVP
            paperHtml += `<div class="jornal-article">`;
            paperHtml += `<div class="jornal-article-tag">\uD83C\uDFC6 Capa</div>`;
            if (bm.mvp) {
                const m = bm.mvp, s = m.s || {};
                const mvpQuote = snap.mvpQuote || JORNAL_QUOTES.mvp[edNum % JORNAL_QUOTES.mvp.length];
                paperHtml += `<div class="jornal-article-headline xlarge">${m.player} fecha a semana com rating ${n(m.value)} e n\u00e3o d\u00e1 chance para ninguém</div>`;
                paperHtml += photo(m, 'large');
                paperHtml += caption(m, `${m.player} \u2014 MVP da Edi\u00e7\u00e3o N\u00ba ${edNum}`);
                paperHtml += `<div class="jornal-quote">\u201c${mvpQuote}\u201d</div>`;
                paperHtml += `<div class="jornal-article-body">
                    Em ${s.matches || '?'} partidas disputadas, <strong>${m.player}</strong> registrou
                    <strong>${s.kills || '?'} abates</strong>, <strong>${n(s.adr)} de ADR m\u00e9dio</strong>
                    e <strong>${n(s.kast)}% de KAST</strong>, consolidando um K/D de <strong>${n(s.kd)}</strong>.
                    Com ${s.wins || '?'} vit\u00f3ria${(s.wins||0)!=1?'s':''} e ${s.losses || '?'} derrota${(s.losses||0)!=1?'s':''},
                    alcan\u00e7ou <strong>${n(s.winPct)}% de aproveitamento</strong>.${m.runner ? `
                    O vice-colocado, <strong>${m.runner.name}</strong>, ficou com rating ${n(m.runner.rating)} \u2014 longe, mas tentou.` : ''}
                </div>`;
            } else { paperHtml += `<div class="jornal-article-headline xlarge">Sem dados suficientes para eleger o MVP</div>`; }
            paperHtml += `</div>`;

            paperHtml += `<div class="jornal-divider-v"></div>`;

            // RIGHT COLUMN — Saco de Pancada + Pateta
            paperHtml += `<div>`;
            if (bm.saco_de_pancada) {
                const m = bm.saco_de_pancada, s = m.s || {};
                paperHtml += `<div class="jornal-article">`;
                paperHtml += `<div class="jornal-article-tag">${m.emoji} Saco de Pancada</div>`;
                paperHtml += `<div class="jornal-article-headline small">${m.player} coleciona ${s.deaths || '?'} mortes em ${s.matches || '?'} partidas: m\u00e9dia de ${n(m.value)} por jogo</div>`;
                paperHtml += `<div style="display:flex;gap:10px;align-items:flex-start;">`;
                paperHtml += `<img src="${m.avatar || placeholder(m.player)}" onerror="this.onerror=null;this.src='${placeholder(m.player)}'" class="jornal-player-photo" style="max-width:90px;" alt="${m.player}">`;
                paperHtml += `<div class="jornal-article-body">
                    <strong>${m.player}</strong> liderou o ranking de óbitos da semana
                    com <strong>${n(m.value)} mortes por partida</strong>.
                    Somou <strong>${s.kills || '?'} abates</strong> contra <strong>${s.deaths || '?'} mortes</strong>
                    (K/D de <strong>${n(s.kd)}</strong>, saldo de <strong>${s.diff > 0 ? '+' : ''}${s.diff}</strong>).
                    ${snap.sacoQuote || JORNAL_QUOTES.saco[edNum % JORNAL_QUOTES.saco.length]}
                </div>`;
                paperHtml += `</div></div>`;
            }
            paperHtml += `<div class="jornal-divider-h"></div>`;
            if (bm.pateta) {
                const m = bm.pateta, s = m.s || {};
                paperHtml += `<div class="jornal-article">`;
                paperHtml += `<div class="jornal-article-tag">${m.emoji} Pateta</div>`;
                paperHtml += `<div class="jornal-article-headline small">${m.player} amarga ${n(m.value)} de ADR e leva o troféu de Pateta</div>`;
                paperHtml += `<div style="display:flex;gap:10px;align-items:flex-start;">`;
                paperHtml += `<img src="${m.avatar || placeholder(m.player)}" onerror="this.onerror=null;this.src='${placeholder(m.player)}'" class="jornal-player-photo" style="max-width:90px;" alt="${m.player}">`;
                paperHtml += `<div class="jornal-article-body">
                    Com apenas <strong>${n(m.value)} de ADR médio</strong> em ${s.matches || '?'} partidas,
                    <strong>${m.player}</strong> entregou o menor dano por round da semana.
                    Seus n\u00fameros: <strong>${s.kills || '?'}/${s.deaths || '?'}/${s.assists || '?'}</strong> (K/D/A),
                    K/D de <strong>${n(s.kd)}</strong>.
                    ${snap.patetaQuote || JORNAL_QUOTES.pateta[edNum % JORNAL_QUOTES.pateta.length]}
                </div>`;
                paperHtml += `</div></div>`;
            }
            paperHtml += `</div>`;

            paperHtml += `</div>`; // end jornal-body

            // ── Bottom strip — Entry + Em Alta / Em Queda ──
            paperHtml += `<div class="jornal-bottom-strip">`;

            paperHtml += `<div class="jornal-article">`;
            if (bm.entry) {
                const m = bm.entry, s = m.s || {};
                const totalFk = s.fk > 0 ? Math.round(parseFloat(s.fk) * s.matches) : '?';
                paperHtml += `<div class="jornal-article-tag">${m.emoji} Entry</div>`;
                paperHtml += `<div class="jornal-article-headline small">${m.player} tem m\u00e9dia de ${n(m.value)} entry por partida</div>`;
                paperHtml += `<div style="display:flex;gap:10px;align-items:flex-start;">`;
                paperHtml += `<img src="${m.avatar || placeholder(m.player)}" onerror="this.onerror=null;this.src='${placeholder(m.player)}'" class="jornal-player-photo" style="max-width:70px;" alt="${m.player}">`;
                paperHtml += `<div class="jornal-article-body">
                    Em ${s.matches || '?'} partidas, <strong>${m.player}</strong> somou
                    <strong>${totalFk} first kills</strong>,
                    com <strong>${n(s.adr)} de ADR</strong> e <strong>${n(s.kast)}% de KAST</strong>.
                    ${snap.entryQuote || JORNAL_QUOTES.entry[edNum % JORNAL_QUOTES.entry.length]}
                </div></div>`;
            }
            paperHtml += `</div>`;

            paperHtml += `<div class="jornal-divider-v"></div>`;

            paperHtml += `<div class="jornal-article">`;
            if (bm.em_alta) {
                const m = bm.em_alta, s = m.s || {};
                paperHtml += `<div class="jornal-article-tag">${m.emoji} Em Alta</div>`;
                paperHtml += `<div class="jornal-article-headline small">${m.player} dispara: sobe ${n(m.value)} pontos no rating</div>`;
                paperHtml += `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px;">`;
                paperHtml += `<img src="${m.avatar || placeholder(m.player)}" onerror="this.onerror=null;this.src='${placeholder(m.player)}'" class="jornal-player-photo" style="max-width:55px;" alt="${m.player}">`;
                paperHtml += `<div class="jornal-article-body">
                    Rating saltou de <strong>${n(m.prevRating)}</strong> para <strong>${n(s.rating)}</strong>.
                    Registrou <strong>${n(s.adr)} ADR</strong> e <strong>${n(s.winPct)}%</strong> de vit\u00f3rias em ${s.matches || '?'} jogos.
                    ${snap.emAltaQuote || JORNAL_QUOTES.emAlta[edNum % JORNAL_QUOTES.emAlta.length]}
                </div></div>`;
            }
            if (bm.em_queda) {
                const m = bm.em_queda, s = m.s || {};
                if (bm.em_alta) paperHtml += `<div class="jornal-divider-h" style="margin:6px 0;"></div>`;
                paperHtml += `<div class="jornal-article-tag">${m.emoji} Em Queda</div>`;
                paperHtml += `<div class="jornal-article-headline small">${m.player} despenca ${n(m.value)} pontos no rating e preocupa</div>`;
                paperHtml += `<div style="display:flex;gap:10px;align-items:flex-start;">`;
                paperHtml += `<img src="${m.avatar || placeholder(m.player)}" onerror="this.onerror=null;this.src='${placeholder(m.player)}'" class="jornal-player-photo" style="max-width:55px;" alt="${m.player}">`;
                paperHtml += `<div class="jornal-article-body">
                    Caiu de <strong>${n(m.prevRating)}</strong> para <strong>${n(s.rating)}</strong>.
                    <strong>${n(s.adr)} ADR</strong> e K/D de <strong>${n(s.kd)}</strong> em ${s.matches || '?'} partidas.
                    ${snap.emQuedaQuote || JORNAL_QUOTES.emQueda[edNum % JORNAL_QUOTES.emQueda.length]}
                </div></div>`;
            }
            if (!bm.em_alta && !bm.em_queda) {
                paperHtml += `<div class="jornal-article-tag">\uD83D\uDCCA Mercado de Transfers</div>`;
                paperHtml += `<div class="jornal-article-body" style="font-style:italic;">Primeira edi\u00e7\u00e3o do Jornal MiRB \u2014 compara\u00e7\u00f5es de rating estar\u00e3o dispon\u00edveis a partir da pr\u00f3xima semana.</div>`;
            }
            paperHtml += `</div>`;

            paperHtml += `</div>`; // end bottom-strip

            // ── Footer — Resumo da Semana em Números ──
            paperHtml += `<div class="jornal-footer-stats">`;
            paperHtml += `<div><strong>${j.totalKills || '—'}</strong>Abates</div>`;
            paperHtml += `<div><strong>${j.totalAssists || '—'}</strong>Assistências</div>`;
            paperHtml += `<div><strong>${j.avgAdr || '—'}</strong>ADR Médio</div>`;
            if (j.closestScore) paperHtml += `<div><strong>${j.closestScore.score}</strong>Placar + Apertado</div>`;
            if (j.biggestWin) paperHtml += `<div><strong>${j.biggestWin.score}</strong>Maior Goleada</div>`;
            paperHtml += `</div>`;

            paperHtml += `</div>`; // end jornal-paper

    return paperHtml;
}

function renderSelectedJornal() {
    const el = document.getElementById('jornalContent');
    const sel = document.getElementById('jornalFilterEdition');
    const idx = parseInt(sel.value);
    if (isNaN(idx) || !jornalCache[idx]) { el.innerHTML = ''; return; }

    const j = jornalCache[idx];
    const totalEditions = jornalCache.length;
    const edNum = j.snapshot?.edNum || (totalEditions - idx);
    const isLatest = idx === 0;

    el.innerHTML = renderJornalHtml(j, edNum, isLatest);

    // Mostrar botão Arquivo se edição tem snapshot (foi gerada com auto-captura)
    const archiveBtn = document.getElementById('btnViewArchive');
    if (archiveBtn) archiveBtn.style.display = j.snapshot ? '' : 'none';
}

