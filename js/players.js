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
    el.innerHTML = players.map(p => `
        <div class="player-selector" onclick="openEditPlayer('${p.id}')" data-name="${p.name.toLowerCase()}" style="cursor:pointer;position:relative;">
            <div class="player-name" style="color:var(--yellow);">${p.name}</div>
            <div class="player-meta">
                <span class="badge badge-role">${p.role}</span>
                ${p.playstyle && p.playstyle !== 'Normal' ? `<span class="badge badge-style-${p.playstyle}">${p.playstyle === 'Agressivo' ? '⚡' : '🐢'}</span>` : ''}
            </div>
            <div style="display:flex;gap:4px;font-size:10px;margin-top:2px;">
                ${p.duo ? `<span class="badge badge-duo" style="font-size:9px;padding:1px 5px;">Duo: ${getPlayerName(p.duo)}</span>` : ''}
                ${p.gcId ? `<span style="color:var(--green);font-size:10px;">🔗 GC</span>` : `<span style="color:var(--red);font-size:10px;">Sem GC</span>`}
            </div>
        </div>
    `).join('');
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

async function addPlayer(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('newPlayerName').value.trim(),
        gcId: document.getElementById('newPlayerGcId').value.trim(),
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
    document.getElementById('editGcId').value = p.gcId || '';
    document.getElementById('editRole').value = p.role;

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
    try {
        await db.collection('players').doc(id).update({
            name: document.getElementById('editName').value.trim(),
            gcId: document.getElementById('editGcId').value.trim(),
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

