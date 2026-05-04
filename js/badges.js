// ╔══════════════════════════════════╗
// ║         BADGES                  ║
// ╚══════════════════════════════════╝
// Badges persistentes de troféus (LAN, MVP, Pior Jogador).
// Coleção Firestore: playerBadges
// Doc shape: { playerId, playerName, type, awardedAt }

const BADGE_TYPES = {
    'campeao':       { label: 'Campeão de LAN',   img: 'assets/badges/campeao.png',       emoji: '🏆' },
    'mvp':           { label: 'MVP de LAN',       img: 'assets/badges/mvp.png',           emoji: '⭐' },
    'pior-jogador':  { label: 'Pior da LAN',       img: 'assets/badges/pior-jogador.png', emoji: '💩' }
};
const BADGE_DISPLAY_ORDER = ['campeao', 'mvp', 'pior-jogador'];

let _allBadges = [];
let _badgesByPlayerId = {};
let _badgesByName = {};

async function loadAllBadges() {
    try {
        const snap = await db.collection('playerBadges').get();
        _allBadges = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.warn('Erro ao carregar badges:', e.message);
        _allBadges = [];
    }
    _badgesByPlayerId = {};
    _badgesByName = {};
    _allBadges.forEach(b => {
        if (b.playerId) {
            (_badgesByPlayerId[b.playerId] = _badgesByPlayerId[b.playerId] || []).push(b);
        }
        if (b.playerName) {
            const key = b.playerName.toLowerCase().trim();
            (_badgesByName[key] = _badgesByName[key] || []).push(b);
        }
    });
    return _allBadges;
}

function getBadgesByPlayerName(name) {
    if (!name) return [];
    return _badgesByName[name.toLowerCase().trim()] || [];
}

function getBadgesByPlayerId(id) {
    if (!id) return [];
    return _badgesByPlayerId[id] || [];
}

function countBadges(badges) {
    const c = { 'campeao': 0, 'mvp': 0, 'pior-jogador': 0 };
    (badges || []).forEach(b => { if (c[b.type] != null) c[b.type]++; });
    return c;
}

// Inline (próximo ao nome) — usa imagem PNG, com contador "×N" se > 1.
function renderBadgesInline(badges, opts = {}) {
    if (!badges || badges.length === 0) return '';
    const size = opts.size || 18;
    const counts = countBadges(badges);
    const parts = [];
    BADGE_DISPLAY_ORDER.forEach(type => {
        const n = counts[type];
        if (!n) return;
        const meta = BADGE_TYPES[type];
        const title = n > 1 ? `${meta.label} (${n}x)` : meta.label;
        parts.push(`<span class="player-badge-inline" title="${title}" style="display:inline-flex;align-items:center;gap:1px;vertical-align:middle;">
            <img src="${meta.img}" alt="${meta.label}" style="width:${size}px;height:${size}px;object-fit:contain;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4));">
            ${n > 1 ? `<span style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:${Math.max(10, Math.round(size * 0.65))}px;color:var(--yellow);line-height:1;">×${n}</span>` : ''}
        </span>`);
    });
    if (!parts.length) return '';
    return `<span class="player-badges-inline" style="display:inline-flex;align-items:center;gap:4px;margin-left:6px;flex-shrink:0;">${parts.join('')}</span>`;
}

// Trophy showcase (perfil individual)
function renderBadgesShowcase(badges) {
    if (!badges || badges.length === 0) return '';
    const counts = countBadges(badges);
    const items = [];
    BADGE_DISPLAY_ORDER.forEach(type => {
        const n = counts[type];
        if (!n) return;
        const meta = BADGE_TYPES[type];
        const title = n > 1 ? `${meta.label} — ${n} vezes` : meta.label;
        items.push(`<div title="${title}" style="position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:80px;">
            <div style="position:relative;">
                <img src="${meta.img}" alt="${meta.label}" style="width:72px;height:72px;object-fit:contain;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.5));">
                ${n > 1 ? `<div style="position:absolute;top:-4px;right:-4px;background:var(--yellow);color:#000;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:12px;border-radius:12px;padding:2px 8px;line-height:1.3;box-shadow:0 2px 6px rgba(0,0,0,0.4);">×${n}</div>` : ''}
            </div>
            <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;text-align:center;line-height:1.2;">${meta.label}</div>
        </div>`);
    });
    if (!items.length) return '';
    return `<div class="card" style="margin-top:12px;border:1px solid rgba(255,193,7,0.18);background:linear-gradient(135deg,rgba(255,193,7,0.05),rgba(255,193,7,0.01));">
        <div class="card-title" style="font-size:14px;">🏅 Conquistas</div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;justify-content:center;padding:6px;">
            ${items.join('')}
        </div>
    </div>`;
}

// ╔══════════════════════════════════╗
// ║       ADMIN TAB UI              ║
// ╚══════════════════════════════════╝
async function loadAdminBadgesTab() {
    if (!players || !players.length) {
        try { await loadAdminPlayers(); } catch (_) {}
    }
    await loadAllBadges();
    renderAdminBadgesTab();
}

function renderAdminBadgesTab() {
    const playerSel = document.getElementById('badgePlayerSelect');
    if (playerSel) {
        const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
        playerSel.innerHTML = '<option value="">Selecionar jogador...</option>' +
            sorted.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }

    const container = document.getElementById('adminBadgesList');
    if (!container) return;
    if (_allBadges.length === 0) {
        container.innerHTML = '<div class="empty-state"><p style="color:var(--text-dim);">Nenhuma badge atribuída ainda.</p></div>';
        return;
    }

    const byPlayer = {};
    _allBadges.forEach(b => {
        const key = b.playerId || ('_name_' + (b.playerName || 'unknown'));
        if (!byPlayer[key]) byPlayer[key] = { name: b.playerName || '?', badges: [] };
        byPlayer[key].badges.push(b);
    });

    container.innerHTML = Object.values(byPlayer)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
        .map(group => {
            const inline = renderBadgesInline(group.badges, { size: 22 });
            const lines = group.badges
                .sort((a, b) => (b.awardedAt?.toMillis?.() || 0) - (a.awardedAt?.toMillis?.() || 0))
                .map(b => {
                    const meta = BADGE_TYPES[b.type] || { label: b.type, emoji: '🏅' };
                    const date = b.awardedAt ? b.awardedAt.toDate().toLocaleDateString('pt-BR') : '—';
                    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px;">
                        <span style="color:var(--text-dim);">${meta.emoji} ${meta.label} <span style="color:var(--text-dim);opacity:0.6;">· ${date}</span></span>
                        <button onclick="removePlayerBadge('${b.id}')" class="btn btn-small" style="font-size:10px;padding:3px 8px;background:rgba(255,61,61,0.1);color:var(--red);border:1px solid rgba(255,61,61,0.25);">Remover</button>
                    </div>`;
                }).join('');
            return `<div style="padding:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span style="font-family:'Rajdhani',sans-serif;font-weight:700;color:var(--yellow);font-size:16px;">${group.name}</span>
                        ${inline}
                    </div>
                    <span style="font-size:11px;color:var(--text-dim);">${group.badges.length} badge(s)</span>
                </div>
                <div style="margin-top:6px;">${lines}</div>
            </div>`;
        }).join('');
}

async function addPlayerBadge(e) {
    if (e) e.preventDefault();
    const playerId = document.getElementById('badgePlayerSelect').value;
    const type = document.getElementById('badgeTypeSelect').value;
    if (!playerId) { toast('Selecione um jogador!', 'error'); return; }
    if (!type) { toast('Selecione o tipo de badge!', 'error'); return; }
    const player = players.find(p => p.id === playerId);
    if (!player) { toast('Jogador não encontrado.', 'error'); return; }
    try {
        await db.collection('playerBadges').add({
            playerId,
            playerName: player.name,
            type,
            awardedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        toast(`${BADGE_TYPES[type]?.label || 'Badge'} atribuída a ${player.name}!`, 'success');
        document.getElementById('badgePlayerSelect').value = '';
        document.getElementById('badgeTypeSelect').value = '';
        await loadAllBadges();
        renderAdminBadgesTab();
    } catch (err) {
        toast('Erro: ' + err.message, 'error');
    }
}

async function removePlayerBadge(id) {
    if (!confirm('Remover esta badge?')) return;
    try {
        await db.collection('playerBadges').doc(id).delete();
        toast('Badge removida.', 'success');
        await loadAllBadges();
        renderAdminBadgesTab();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}
