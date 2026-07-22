// ╔══════════════════════════════════╗
// ║       PLAYERS CRUD              ║
// ╚══════════════════════════════════╝
async function loadAdminPlayers() {
    try {
        const snap = await db.collection('players').orderBy('name').get();
        players = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAdminPlayersList();
        renderPlayerSelectionForMatch();
        updateDuoSelects();
    } catch (e) {
        console.error(e);
        document.getElementById('adminPlayersList').innerHTML = '<p style="color:var(--red)">Erro ao carregar jogadores. Verifique o Firebase config.</p>';
    }
}

function renderAdminPlayersList() {
    const el = document.getElementById('adminPlayersList');
    const countEl = document.getElementById('adminPlayersCount');
    if (countEl) countEl.textContent = `(${players.length})`;
    const filterInput = document.getElementById('playersListFilter');
    if (filterInput) filterInput.value = '';

    if (!players.length) {
        el.innerHTML = '<div class="empty-state"><p>Nenhum jogador cadastrado.</p></div>';
        return;
    }
    el.innerHTML = players.map(p => {
        const gcCount = gcAccountCount(p);
        return `
        <div class="player-selector" onclick="openEditPlayer('${p.id}')" data-name="${p.name.toLowerCase()}" style="cursor:pointer;position:relative;">
            <div class="player-name" style="color:var(--yellow);">${p.name}</div>
            <div class="player-meta">
                <span class="badge badge-role">${p.role}</span>
                ${p.playstyle && p.playstyle !== 'Normal' ? `<span class="badge badge-style-${p.playstyle}">${p.playstyle === 'Agressivo' ? '⚡' : '🐢'}</span>` : ''}
            </div>
            <div style="display:flex;gap:4px;font-size:10px;margin-top:2px;">
                ${p.duo ? `<span class="badge badge-duo" style="font-size:9px;padding:1px 5px;">Duo: ${getPlayerName(p.duo)}</span>` : ''}
                ${gcCount ? `<span style="color:var(--green);font-size:10px;">🔗 GC</span>` : `<span style="color:var(--red);font-size:10px;">Sem GC</span>`}
            </div>
        </div>
    `;
    }).join('');
}

function filterAdminPlayersList() {
    const query = (document.getElementById('playersListFilter')?.value || '').toLowerCase();
    document.querySelectorAll('#adminPlayersList .player-selector').forEach(el => {
        const name = el.dataset.name || '';
        el.style.display = name.includes(query) ? '' : 'none';
    });
}

function getPlayerName(id) {
    const p = players.find(pl => pl.id === id);
    return p ? p.name : '?';
}

// ── Chips de contas GC (modal de editar) ────────────────────────────────
let editGcIds = [];

function renderEditGcChips() {
    const el = document.getElementById('editGcChips');
    if (!el) return;
    if (!editGcIds.length) {
        el.innerHTML = '<span style="color:var(--text-dim);font-size:12px;">Nenhuma conta vinculada.</span>';
        return;
    }
    el.innerHTML = editGcIds.map((id, i) => `
        <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 4px 3px 8px;background:${i === 0 ? 'rgba(255,214,0,0.12)' : 'rgba(255,255,255,0.06)'};border:1px solid ${i === 0 ? 'rgba(255,214,0,0.35)' : 'rgba(255,255,255,0.15)'};border-radius:14px;font-size:12px;">
            ${i === 0
                ? '<span style="color:var(--yellow);font-size:9px;text-transform:uppercase;letter-spacing:0.5px;">principal</span>'
                : `<button type="button" title="Tornar principal" onclick="promoteEditGcId('${id}')" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:12px;padding:0;line-height:1;">★</button>`}
            <span style="color:var(--text);">${id}</span>
            <button type="button" title="Remover" onclick="removeEditGcId('${id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:15px;padding:0 2px;line-height:1;">×</button>
        </span>
    `).join('');
}

function addEditGcId() {
    const inp = document.getElementById('editGcIdInput');
    if (!inp) return;
    const val = (inp.value || '').trim();
    if (!val) return;
    if (editGcIds.includes(val)) { toast('Essa conta GC já está vinculada.', 'error'); inp.value = ''; return; }
    editGcIds.push(val);
    inp.value = '';
    renderEditGcChips();
}

function removeEditGcId(id) {
    editGcIds = editGcIds.filter(x => x !== id);
    renderEditGcChips();
}

function promoteEditGcId(id) {
    editGcIds = [id, ...editGcIds.filter(x => x !== id)];
    renderEditGcChips();
}

// Nº de contas GC vinculadas (principal `gcId` + extras em `gcIds`).
function gcAccountCount(p) {
    const set = new Set();
    if (p.gcId) set.add(p.gcId);
    (p.gcIds || []).forEach(id => { if (id) set.add(id); });
    return set.size;
}

async function addPlayer(e) {
    e.preventDefault();
    const gcId = document.getElementById('newPlayerGcId').value.trim();
    const data = {
        name: document.getElementById('newPlayerName').value.trim(),
        gcId: gcId,
        gcIds: gcId ? [gcId] : [],
        role: document.getElementById('newPlayerRole').value,
        duo: document.getElementById('newPlayerDuo').value,
        playstyle: document.getElementById('newPlayerPlaystyle').value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
        await db.collection('players').add(data);
        document.getElementById('addPlayerForm').reset();
        toast('Jogador adicionado!', 'success');
        await loadAdminPlayers();
    } catch (e) {
        toast('Erro ao adicionar: ' + e.message, 'error');
    }
}

async function deletePlayer(id) {
    if (!confirm('Excluir este jogador?')) return;
    try {
        await db.collection('players').doc(id).delete();
        toast('Jogador excluído!', 'success');
        await loadAdminPlayers();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

function openEditPlayer(id) {
    const p = players.find(pl => pl.id === id);
    if (!p) return;
    document.getElementById('editPlayerId').value = id;
    document.getElementById('editName').value = p.name;
    document.getElementById('editRole').value = p.role;

    // Contas GC vinculadas (principal primeiro, depois extras — sem duplicar)
    editGcIds = [];
    if (p.gcId) editGcIds.push(p.gcId);
    (p.gcIds || []).forEach(gid => { if (gid && !editGcIds.includes(gid)) editGcIds.push(gid); });
    renderEditGcChips();
    const gcInput = document.getElementById('editGcIdInput');
    if (gcInput) gcInput.value = '';

    // Populate duo select
    const duoSelect = document.getElementById('editDuo');
    duoSelect.innerHTML = '<option value="">Nenhuma</option>' +
        players.filter(pl => pl.id !== id).map(pl =>
            `<option value="${pl.id}" ${p.duo === pl.id ? 'selected' : ''}>${pl.name}</option>`
        ).join('');

    // Populate playstyle
    document.getElementById('editPlaystyle').value = p.playstyle || 'Normal';

    document.getElementById('editModal').classList.add('active');
}

let editModalOriginalHTML = '';

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    // Restore original edit form if it was replaced by GC stats/import
    if (editModalOriginalHTML) {
        document.getElementById('editModal').querySelector('.modal-box').innerHTML = editModalOriginalHTML;
    }
}

async function savePlayerEdit(e) {
    e.preventDefault();
    const id = document.getElementById('editPlayerId').value;
    const gcIds = editGcIds.slice();
    try {
        await db.collection('players').doc(id).update({
            name: document.getElementById('editName').value.trim(),
            gcId: gcIds[0] || '',   // principal = 1ª conta
            gcIds: gcIds,
            role: document.getElementById('editRole').value,
            duo: document.getElementById('editDuo').value,
            playstyle: document.getElementById('editPlaystyle').value
        });
        closeEditModal();
        toast('Jogador atualizado!', 'success');
        await loadAdminPlayers();
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

function updateDuoSelects() {
    const selects = ['newPlayerDuo'];
    selects.forEach(selId => {
        const sel = document.getElementById(selId);
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = '<option value="">Nenhuma</option>' +
            players.map(p => `<option value="${p.id}" ${p.id === current ? 'selected' : ''}>${p.name}</option>`).join('');
    });
}

