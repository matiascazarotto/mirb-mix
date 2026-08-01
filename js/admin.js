// ╔══════════════════════════════════╗
// ║       ADMIN PANEL               ║
// ╚══════════════════════════════════╝
async function renderAdminPanel() {
    let pollEnabled = true;
    try { const s = await Store.getSettings(); if (s.pollEnabled === false) pollEnabled = false; } catch(e) {}
    const container = document.getElementById('adminContent');
    container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <span style="color:var(--green);font-weight:600;">✅ Logado como ${isStaff ? 'Staff' : 'Admin'}</span>
            <button class="btn btn-secondary btn-small" onclick="adminLogout()">Sair</button>
        </div>

        <div class="admin-sub-tabs">
            <button class="admin-sub-tab" onclick="switchAdminTab(this, 'adminTabPlayers')">👥 Jogadores</button>
            <button class="admin-sub-tab active" onclick="switchAdminTab(this, 'adminTabMatch')">🎮 Partidas</button>
            <button class="admin-sub-tab" onclick="switchAdminTab(this, 'adminTabManage')">⚙️ Gerenciar</button>
            <button class="admin-sub-tab" onclick="switchAdminTab(this, 'adminTabLink')">⚡ Vincular GC</button>
            <button class="admin-sub-tab" onclick="switchAdminTab(this, 'adminTabBadges')">🏆 Badges</button>
            ${pollEnabled ? '<button class="admin-sub-tab" onclick="switchAdminTab(this, \'adminTabPoll\')">🗳️ Enquete</button>' : ''}
            ${isStaff ? '<button class="admin-sub-tab" onclick="switchAdminTab(this, \'adminTabOthers\')">🛠️ Outros</button>' : ''}
        </div>

        <!-- TAB: Jogadores -->
        <div class="admin-tab-content" id="adminTabPlayers">
            <div class="card">
                <div class="card-title">Cadastrar Jogador</div>
                <form id="addPlayerForm" onsubmit="addPlayer(event)">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Nome</label>
                            <input type="text" id="newPlayerName" required>
                        </div>
                        <div class="form-group">
                            <label>ID Gamers Club (opcional)</label>
                            <input type="text" id="newPlayerGcId" placeholder="Ex: 1138165">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Função</label>
                            <select id="newPlayerRole">
                                <option value="Rifler">Rifler</option>
                                <option value="Entry">Entry Fragger</option>
                                <option value="AWPer">AWPer</option>
                                <option value="Suporte">Suporte</option>
                                <option value="Lurker">Lurker</option>
                                <option value="IGL">IGL/Capitão</option>
                            </select>
                        </div>
                        ${isStaff ? `
                        <div class="form-group">
                            <label>Dupla</label>
                            <select id="newPlayerDuo">
                                <option value="">Nenhuma</option>
                            </select>
                        </div>` : '<div></div>'}
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Estilo de Jogo</label>
                            <select id="newPlayerPlaystyle">
                                <option value="Normal">Normal</option>
                                <option value="Agressivo">Agressivo</option>
                                <option value="Lento">Lento</option>
                            </select>
                        </div>
                        <div></div>
                    </div>
                    <button type="submit" class="btn btn-primary">Adicionar</button>
                </form>
            </div>

            <div class="card">
                <div class="card-title">Jogadores Cadastrados <span id="adminPlayersCount" style="color:var(--text-dim);font-size:14px;font-weight:400;"></span></div>
                <div style="position:relative;">
                    <span style="position:absolute;left:12px;top:10px;font-size:14px;color:var(--text-dim);pointer-events:none;">🔍</span>
                    <input type="text" class="player-filter-input" id="playersListFilter" placeholder="Filtrar jogador..." oninput="filterAdminPlayersList()">
                </div>
                <div id="adminPlayersList" class="player-selection-grid"><div class="loading-spinner">Carregando</div></div>
            </div>
        </div>

        <!-- TAB: Criar Partida -->
        <div class="admin-tab-content active" id="adminTabMatch">
            <div class="card">
                <div class="card-title">Criar Nova Partida</div>
                <div class="form-group">
                    <label>Nome da Partida (opcional)</label>
                    <input type="text" id="matchName" placeholder="Ex: Mix Quinta-Feira">
                </div>
                <div class="selection-counter">
                    <span class="count" id="adminSelectedCount">0</span> / 10 jogadores
                </div>
                <div style="position:relative;">
                    <span style="position:absolute;left:12px;top:10px;font-size:14px;color:var(--text-dim);pointer-events:none;">🔍</span>
                    <input type="text" class="player-filter-input" id="playerFilterInput" placeholder="Filtrar jogador..." oninput="filterPlayerSelection()">
                </div>
                <div id="adminPlayerSelection" class="player-selection-grid"></div>
                <button class="btn btn-primary" id="createMatchBtn" onclick="createMatch()" disabled style="margin-top:16px;">
                    Criar Partida
                </button>
            </div>
        </div>

        <!-- TAB: Gerenciar -->
        <div class="admin-tab-content" id="adminTabManage">
            <div class="card">
                <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                    <span>Gerenciar Partidas</span>
                    <button class="btn btn-secondary btn-small" onclick="showOutdatedMatches()" style="font-size:11px;">⚠️ Stats Desatualizadas</button>
                </div>
                <div id="adminMatchesList"><div class="loading-spinner">Carregando</div></div>
            </div>
        </div>

        <!-- TAB: Vincular GC -->
        <div class="admin-tab-content" id="adminTabLink">
            <div class="card">
                <div class="card-title">⚡ Partidas a Vincular</div>
                <p style="color:var(--text-dim);font-size:13px;margin-bottom:14px;">
                    Partidas enviadas pela extensão Chrome. Escolha a partida do MiRB para vincular os stats.<br>
                    <a href="mirb-extensao.zip" download style="color:var(--green);font-size:12px;text-decoration:underline;">Baixar extensão</a>
                    <span style="color:var(--text-dim);font-size:11px;margin-left:4px;">— Descompacte → Chrome → <code>chrome://extensions</code> → Modo desenvolvedor → Carregar sem compactação</span>
                </p>
                <div id="gcPendingImports"><div class="loading-spinner">Carregando</div></div>
            </div>
        </div>

        <!-- TAB: Badges -->
        <div class="admin-tab-content" id="adminTabBadges">
            <div class="card">
                <div class="card-title">🏆 Atribuir Badge</div>
                <p style="color:var(--text-dim);font-size:12px;margin-bottom:14px;">
                    Adicione conquistas aos jogadores (Campeão, MVP, Pior Jogador). Cada badge é cumulativa: atribua de novo para incrementar o contador.
                </p>
                <form onsubmit="addPlayerBadge(event)">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Jogador</label>
                            <select id="badgePlayerSelect" required>
                                <option value="">Carregando...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Badge</label>
                            <select id="badgeTypeSelect" required>
                                <option value="">Selecionar...</option>
                                <option value="campeao">🏆 Campeão de LAN</option>
                                <option value="mvp">⭐ MVP de LAN</option>
                                <option value="pior-jogador">🥚 Chocou em LAN</option>
                            </select>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary">Adicionar Badge</button>
                </form>
            </div>

            <div class="card">
                <div class="card-title">Badges Atribuídas</div>
                <div id="adminBadgesList"><div class="loading-spinner">Carregando</div></div>
            </div>
        </div>

        <!-- TAB: Enquete (Admin) -->
        <div class="admin-tab-content" id="adminTabPoll">
            <div id="pollAdminContent">
                <div class="loading-spinner">Carregando</div>
            </div>
        </div>

        ${isStaff ? `
        <!-- TAB: Outros (Staff) -->
        <div class="admin-tab-content" id="adminTabOthers">
            <div class="card">
                <div class="card-title">🛠️ Configurações Staff</div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <div>
                        <div style="font-weight:600;color:var(--text);font-size:14px;">📢 Ouvidoria MiRB</div>
                        <div style="font-size:12px;color:var(--text-dim);margin-top:2px;">Habilitar ou desabilitar a Ouvidoria na página de votação</div>
                    </div>
                    <div id="ouvidoriaToggleContainer">
                        <div class="loading-spinner" style="transform:scale(0.5);"></div>
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <div>
                        <div style="font-weight:600;color:var(--text);font-size:14px;">🔄 Refazer Times</div>
                        <div style="font-size:12px;color:var(--text-dim);margin-top:2px;">Permite re-sortear os times na confirmação (jogadores e admin). Desligado: ao balancear, os times já ficam confirmados.</div>
                    </div>
                    <div id="resortToggleContainer">
                        <div class="loading-spinner" style="transform:scale(0.5);"></div>
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <div>
                        <div style="font-weight:600;color:var(--text);font-size:14px;">⚔️ Tela 1 vs 1</div>
                        <div style="font-size:12px;color:var(--text-dim);margin-top:2px;">Habilitar ou desabilitar a tela 1 vs 1 no menu</div>
                    </div>
                    <div id="h2hToggleContainer">
                        <div class="loading-spinner" style="transform:scale(0.5);"></div>
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <div>
                        <div style="font-weight:600;color:var(--text);font-size:14px;">📰 Tela Jornal</div>
                        <div style="font-size:12px;color:var(--text-dim);margin-top:2px;">Habilitar ou desabilitar a tela Jornal no menu</div>
                    </div>
                    <div id="jornalToggleContainer">
                        <div class="loading-spinner" style="transform:scale(0.5);"></div>
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <div>
                        <div style="font-weight:600;color:var(--text);font-size:14px;">📰 Jornal MiRB</div>
                        <div style="font-size:12px;color:var(--text-dim);margin-top:2px;">Gerar ou regerar o jornal da semana passada manualmente</div>
                    </div>
                    <button class="btn btn-primary btn-small" onclick="adminGenerateJornal()">📰 Gerar Jornal</button>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <div>
                        <div style="font-weight:600;color:var(--text);font-size:14px;">🗳️ Enquetes</div>
                        <div style="font-size:12px;color:var(--text-dim);margin-top:2px;">Habilitar ou desabilitar enquetes rápidas para Admins</div>
                    </div>
                    <div id="pollToggleContainer">
                        <div class="loading-spinner" style="transform:scale(0.5);"></div>
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <div>
                        <div style="font-weight:600;color:var(--text);font-size:14px;">🗺️ Escolha de Mapa</div>
                        <div style="font-size:12px;color:var(--text-dim);margin-top:2px;">Habilitar votação de mapa (Top 3) e sorteio por rotação na página de votação</div>
                    </div>
                    <div id="mapSelectToggleContainer">
                        <div class="loading-spinner" style="transform:scale(0.5);"></div>
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;">
                    <div>
                        <div style="font-weight:600;color:var(--text);font-size:14px;">⚖️ Ajuste por Desempenho</div>
                        <div style="font-size:12px;color:var(--text-dim);margin-top:2px;">Equilibrar os times também pelo histórico de vitórias (win%), não só pelo nível votado. Afeta só o sorteio — o nível exibido continua o votado.</div>
                    </div>
                    <div id="winImpactToggleContainer">
                        <div class="loading-spinner" style="transform:scale(0.5);"></div>
                    </div>
                </div>
            </div>
            <div class="card" style="margin-top:16px;">
                <div class="card-title">🗺️ Lista de Mapas</div>
                <p style="color:var(--text-dim);font-size:12px;margin-bottom:12px;">Mapas ativos entram na votação (Top 3) e no sorteio. Desative um mapa para tirá-lo da rotação sem apagar.</p>
                <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">
                    <input type="text" id="newMapEmoji" placeholder="🗺️" maxlength="4" style="width:56px;padding:8px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);font-size:14px;text-align:center;box-sizing:border-box;">
                    <input type="text" id="newMapName" placeholder="Nome do mapa" maxlength="24" style="flex:1;min-width:120px;padding:8px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);font-size:14px;box-sizing:border-box;" onkeydown="if(event.key==='Enter')addMapToPool()">
                    <button class="btn btn-primary btn-small" onclick="addMapToPool()">➕ Add</button>
                </div>
                <div id="mapPoolEditorList"><div class="loading-spinner" style="transform:scale(0.7);">Carregando</div></div>
                <div style="margin-top:12px;text-align:right;">
                    <button class="btn btn-secondary btn-small" onclick="resetMapRotation()" style="font-size:11px;">🔄 Resetar rotação</button>
                </div>
            </div>
            <div class="card" style="margin-top:16px;">
                <div class="card-title">🔍 Buscar por IP ou Fingerprint</div>
                <div style="display:flex;gap:8px;margin-bottom:8px;">
                    <input type="text" id="staffIpInput" placeholder="IP" style="flex:1;padding:10px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);font-size:14px;font-family:inherit;" onkeydown="if(event.key==='Enter')staffSearchIP()">
                    <input type="text" id="staffFpInput" placeholder="Fingerprint" style="flex:1;padding:10px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);font-size:14px;font-family:inherit;" onkeydown="if(event.key==='Enter')staffSearchIP()">
                    <button class="btn btn-primary btn-small" onclick="staffSearchIP()">🔍 Buscar</button>
                </div>
                <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px;">Preencha IP, Fingerprint ou ambos.</div>
                <div id="ipLookupResults"></div>
            </div>
            <div class="card" style="margin-top:16px;">
                <div class="card-title">🚫 Bloquear Dispositivo</div>
                <div style="display:flex;gap:8px;margin-bottom:8px;">
                    <input type="text" id="blockIpInput" placeholder="IP" style="flex:1;padding:10px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);font-size:14px;font-family:inherit;box-sizing:border-box;">
                    <input type="text" id="blockFpInput" placeholder="Fingerprint" style="flex:1;padding:10px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);font-size:14px;font-family:inherit;box-sizing:border-box;">
                </div>
                <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px;">Preencha IP, Fingerprint ou ambos.</div>
                <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px;">
                    <label style="font-size:13px;color:var(--text);cursor:pointer;display:flex;align-items:center;gap:4px;"><input type="checkbox" id="blockMural" checked> Ouvidoria</label>
                    <label style="font-size:13px;color:var(--text);cursor:pointer;display:flex;align-items:center;gap:4px;"><input type="checkbox" id="blockVote"> Voto Nível</label>
                    <label style="font-size:13px;color:var(--text);cursor:pointer;display:flex;align-items:center;gap:4px;"><input type="checkbox" id="blockTeamVote"> Voto Time</label>
                    <label style="font-size:13px;color:var(--text);cursor:pointer;display:flex;align-items:center;gap:4px;"><input type="checkbox" id="blockPoll"> Enquete</label>
                    <label style="font-size:13px;color:var(--text);cursor:pointer;display:flex;align-items:center;gap:4px;"><input type="checkbox" id="blockMapVote"> Voto Mapa</label>
                </div>
                <button class="btn btn-small" onclick="staffBlockDevice()" style="width:100%;background:rgba(255,61,61,0.15);color:var(--red);border:1px solid rgba(255,61,61,0.3);">🚫 Bloquear</button>
                <div id="blockedDevicesList" style="margin-top:12px;"></div>
            </div>
        </div>
        ` : ''}
    `;

    loadAdminPlayers();
    loadAdminMatches();
    if (isStaff) loadStaffSettings();
}

function switchAdminTab(btn, tabId) {
    document.querySelectorAll('.admin-sub-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(tabId).classList.add('active');
    if (tabId === 'adminTabLink') loadPendingGCImports();
    if (tabId === 'adminTabPoll') loadAdminPollTab();
    if (tabId === 'adminTabOthers') loadStaffSettings();
    if (tabId === 'adminTabBadges') loadAdminBadgesTab();
}

// ╔══════════════════════════════════╗
// ║       STAFF SETTINGS            ║
// ╚══════════════════════════════════╝
async function loadStaffSettings() {
    try {
        const data = await Store.getSettings();
        renderOuvidoriaToggle(data.ouvidoriaEnabled !== false);
        renderNavToggle('resortToggleContainer', data.resortEnabled !== false, 'resortEnabled');
        renderNavToggle('h2hToggleContainer', data.h2hEnabled !== false, 'h2hEnabled');
        renderNavToggle('jornalToggleContainer', data.jornalEnabled !== false, 'jornalEnabled');
        renderNavToggle('pollToggleContainer', data.pollEnabled !== false, 'pollEnabled');
        renderNavToggle('mapSelectToggleContainer', data.mapSelectEnabled !== false, 'mapSelectEnabled');
        renderNavToggle('winImpactToggleContainer', data.winImpactEnabled === true, 'winImpactEnabled'); // default OFF
        loadMapPoolEditor();
        loadBlockedDevices();
    } catch (e) {
        ['ouvidoriaToggleContainer', 'resortToggleContainer', 'h2hToggleContainer', 'jornalToggleContainer', 'pollToggleContainer', 'mapSelectToggleContainer', 'winImpactToggleContainer'].forEach(id => {
            const c = document.getElementById(id);
            if (c) c.innerHTML = '<span style="color:var(--red);font-size:12px;">Erro ao carregar</span>';
        });
    }
}

function renderOuvidoriaToggle(enabled) {
    const container = document.getElementById('ouvidoriaToggleContainer');
    if (!container) return;
    container.innerHTML = `
        <button onclick="toggleOuvidoria()" class="btn btn-small" style="font-size:12px;padding:6px 14px;background:${enabled ? 'rgba(0,200,83,0.15)' : 'rgba(255,61,61,0.15)'};color:${enabled ? 'var(--green)' : 'var(--red)'};border:1px solid ${enabled ? 'rgba(0,200,83,0.3)' : 'rgba(255,61,61,0.3)'};">
            ${enabled ? '🟢 Ativa' : '🔴 Desativada'}
        </button>
    `;
}

async function toggleOuvidoria() {
    try {
        const data = await Store.getSettings();
        const currentEnabled = data.ouvidoriaEnabled !== false;
        const newEnabled = !currentEnabled;
        await db.collection('config').doc('settings').set({ ouvidoriaEnabled: newEnabled }, { merge: true });
        renderOuvidoriaToggle(newEnabled);
        toast(newEnabled ? 'Ouvidoria ativada!' : 'Ouvidoria desativada!', 'success');
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

function renderNavToggle(containerId, enabled, featureKey) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
        <button onclick="toggleNavFeature('${featureKey}')" class="btn btn-small" style="font-size:12px;padding:6px 14px;background:${enabled ? 'rgba(0,200,83,0.15)' : 'rgba(255,61,61,0.15)'};color:${enabled ? 'var(--green)' : 'var(--red)'};border:1px solid ${enabled ? 'rgba(0,200,83,0.3)' : 'rgba(255,61,61,0.3)'};">
            ${enabled ? '🟢 Ativa' : '🔴 Desativada'}
        </button>
    `;
}

async function toggleNavFeature(featureKey) {
    const map = {
        resortEnabled: { nav: null, container: 'resortToggleContainer', label: 'Refazer Times' },
        h2hEnabled: { nav: 'navH2h', container: 'h2hToggleContainer', label: '1 vs 1' },
        jornalEnabled: { nav: 'navJornal', container: 'jornalToggleContainer', label: 'Jornal' },
        pollEnabled: { nav: null, container: 'pollToggleContainer', label: 'Enquetes' },
        mapSelectEnabled: { nav: null, container: 'mapSelectToggleContainer', label: 'Escolha de Mapa' },
        winImpactEnabled: { nav: null, container: 'winImpactToggleContainer', label: 'Ajuste por Desempenho', defaultOn: false }
    };
    const cfg = map[featureKey];
    if (!cfg) return;
    try {
        const data = await Store.getSettings();
        // defaultOn:false → considera ligado só quando gravado === true (as demais flags são default ON)
        const current = (cfg.defaultOn === false) ? (data[featureKey] === true) : (data[featureKey] !== false);
        const newVal = !current;
        await db.collection('config').doc('settings').set({ [featureKey]: newVal }, { merge: true });
        renderNavToggle(cfg.container, newVal, featureKey);
        const navBtn = document.getElementById(cfg.nav);
        if (navBtn) navBtn.style.display = newVal ? '' : 'none';
        if (featureKey === 'h2hEnabled' || featureKey === 'jornalEnabled') {
            try {
                const cache = JSON.parse(localStorage.getItem('mirb_navCache') || '{}');
                cache[featureKey] = newVal;
                localStorage.setItem('mirb_navCache', JSON.stringify(cache));
            } catch (e) {}
        }
        toast(`${cfg.label} ${newVal ? 'ativada' : 'desativada'}!`, 'success');
    } catch (e) {
        toast('Erro: ' + e.message, 'error');
    }
}

// ── IP Blocking ──
let _blockedCache = null;
let _blockedCacheTime = 0;

async function _loadBlockedCache() {
    const now = Date.now();
    if (_blockedCache && now - _blockedCacheTime < 30000) return _blockedCache;
    try {
        const [ipDoc, fpDoc] = await Promise.all([
            db.collection('config').doc('blockedIPs').get(),
            db.collection('config').doc('blockedFingerprints').get()
        ]);
        _blockedCache = {
            ips: ipDoc.exists ? ipDoc.data() : {},
            fps: fpDoc.exists ? fpDoc.data() : {}
        };
    } catch (e) { _blockedCache = { ips: {}, fps: {} }; }
    _blockedCacheTime = now;
    return _blockedCache;
}

async function isIPBlocked(ip, feature, fingerprint) {
    const cache = await _loadBlockedCache();
    const byIp = cache.ips[ip];
    if (byIp && Array.isArray(byIp) && byIp.includes(feature)) return true;
    if (fingerprint) {
        const byFp = cache.fps[fingerprint];
        if (byFp && Array.isArray(byFp) && byFp.includes(feature)) return true;
    }
    return false;
}

async function staffBlockDevice() {
    const ip = document.getElementById('blockIpInput').value.trim();
    const fp = document.getElementById('blockFpInput').value.trim();
    if (!ip && !fp) { toast('Informe o IP ou Fingerprint!', 'error'); return; }
    const features = [];
    if (document.getElementById('blockMural').checked) features.push('mural');
    if (document.getElementById('blockVote').checked) features.push('vote');
    if (document.getElementById('blockTeamVote').checked) features.push('teamVote');
    if (document.getElementById('blockPoll').checked) features.push('poll');
    const blockMapVoteEl = document.getElementById('blockMapVote');
    if (blockMapVoteEl && blockMapVoteEl.checked) features.push('mapVote');
    if (!features.length) { toast('Selecione ao menos uma funcionalidade!', 'error'); return; }
    try {
        if (ip) await db.collection('config').doc('blockedIPs').set({ [ip]: features }, { merge: true });
        if (fp) await db.collection('config').doc('blockedFingerprints').set({ [fp]: features }, { merge: true });
        _blockedCache = null;
        toast(`${ip ? 'IP ' + ip : ''}${ip && fp ? ' + ' : ''}${fp ? 'FP ' + fp : ''} bloqueado!`, 'success');
        document.getElementById('blockIpInput').value = '';
        document.getElementById('blockFpInput').value = '';
        loadBlockedDevices();
    } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

async function staffUnblockDevice(key, type) {
    try {
        const docName = type === 'ip' ? 'blockedIPs' : 'blockedFingerprints';
        await db.collection('config').doc(docName).update(new firebase.firestore.FieldPath(key), firebase.firestore.FieldValue.delete());
        _blockedCache = null;
        toast(`${type === 'ip' ? 'IP' : 'FP'} ${key} desbloqueado!`, 'success');
        loadBlockedDevices();
    } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

async function loadBlockedDevices() {
    const el = document.getElementById('blockedDevicesList');
    if (!el) return;
    try {
        const [ipDoc, fpDoc] = await Promise.all([
            db.collection('config').doc('blockedIPs').get(),
            db.collection('config').doc('blockedFingerprints').get()
        ]);
        const ipData = ipDoc.exists ? ipDoc.data() : {};
        const fpData = fpDoc.exists ? fpDoc.data() : {};
        const labels = { mural: 'Ouvidoria', vote: 'Voto Nível', teamVote: 'Voto Time', poll: 'Enquete', mapVote: 'Voto Mapa' };
        let html = '';
        Object.entries(ipData).forEach(([ip, feats]) => {
            html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
                <div>
                    <span style="font-size:11px;background:rgba(255,255,255,0.08);padding:1px 6px;border-radius:3px;color:var(--text-dim);margin-right:4px;">IP</span>
                    <span style="font-size:13px;color:var(--text);font-weight:600;">${ip}</span>
                    <span style="font-size:11px;color:var(--text-dim);margin-left:6px;">${(feats || []).map(f => labels[f] || f).join(', ')}</span>
                </div>
                <button class="btn btn-small" onclick="staffUnblockDevice('${ip}','ip')" style="font-size:10px;padding:3px 8px;background:rgba(0,200,83,0.1);color:var(--green);border:1px solid rgba(0,200,83,0.2);">✅</button>
            </div>`;
        });
        Object.entries(fpData).forEach(([fp, feats]) => {
            html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
                <div>
                    <span style="font-size:11px;background:rgba(138,43,226,0.15);padding:1px 6px;border-radius:3px;color:#b388ff;margin-right:4px;">FP</span>
                    <span style="font-size:13px;color:var(--text);font-weight:600;font-family:monospace;">${fp}</span>
                    <span style="font-size:11px;color:var(--text-dim);margin-left:6px;">${(feats || []).map(f => labels[f] || f).join(', ')}</span>
                </div>
                <button class="btn btn-small" onclick="staffUnblockDevice('${fp}','fp')" style="font-size:10px;padding:3px 8px;background:rgba(0,200,83,0.1);color:var(--green);border:1px solid rgba(0,200,83,0.2);">✅</button>
            </div>`;
        });
        if (!html) html = '<div style="font-size:12px;color:var(--text-dim);">Nenhum dispositivo bloqueado.</div>';
        el.innerHTML = html;
    } catch (e) { el.innerHTML = ''; }
}

async function staffSearchIP() {
    const ip = (document.getElementById('staffIpInput').value || '').trim();
    const fp = (document.getElementById('staffFpInput') ? document.getElementById('staffFpInput').value : '').trim();
    const el = document.getElementById('ipLookupResults');
    if (!ip && !fp) { toast('Informe um IP ou Fingerprint!', 'error'); return; }
    el.innerHTML = '<div class="loading-spinner" style="transform:scale(0.7);margin:12px 0;">Buscando...</div>';
    try {
        const results = [];
        const foundIPs = new Set();
        const foundFPs = new Set();

        function matchesSearch(docIp, docFp) {
            if (ip && fp) return docIp === ip || docFp === fp;
            if (ip) return docIp === ip;
            return docFp === fp;
        }

        // 1. Votos de nível e time — últimas 30 partidas (subcoleções em paralelo)
        const recentMatches = (await Store.getMatches()).slice(0, 30);
        await Promise.all(recentMatches.map(async m => {
            const mName = m.name || m.id;
            const mDate = m.createdAt ? m.createdAt.toDate().toLocaleDateString('pt-BR') : '?';
            const ref = db.collection('matches').doc(m.id);
            const [votesSnap, tvSnap] = await Promise.all([
                ref.collection('votes').get(),
                ref.collection('teamVotes').get()
            ]);
            votesSnap.docs.forEach(v => {
                const d = v.data();
                if (d._meta && matchesSearch(d._meta.ip, d._meta.fingerprint)) {
                    if (d._meta.ip) foundIPs.add(d._meta.ip);
                    if (d._meta.fingerprint) foundFPs.add(d._meta.fingerprint);
                    results.push({ type: '🗳️ Voto Nível', detail: `${mName} (${mDate})`, sub: `Votou em ${d._meta.votedOn || '?'} jogadores — ${d._meta.timestamp || ''}` });
                }
            });
            tvSnap.docs.forEach(v => {
                const d = v.data();
                if (d._meta && matchesSearch(d._meta.ip, d._meta.fingerprint)) {
                    if (d._meta.ip) foundIPs.add(d._meta.ip);
                    if (d._meta.fingerprint) foundFPs.add(d._meta.fingerprint);
                    results.push({ type: '⚔️ Voto Time', detail: `${mName} (${mDate})`, sub: `Votou: Time ${d.vote || '?'} — ${d._meta.timestamp || ''}` });
                }
            });
        }));

        // 2. Enquetes
        const pollSnap = await db.collection('polls').get();
        for (const pDoc of pollSnap.docs) {
            const pData = pDoc.data();
            const pollOpts = getPollOptions(pData);
            const respSnap = await pDoc.ref.collection('responses').get();
            respSnap.docs.forEach(r => {
                const d = r.data();
                if (d.deviceId) {
                    const parts = d.deviceId.split('_');
                    const dIp = parts[0] || '';
                    const dFp = parts[1] || '';
                    if (matchesSearch(dIp, dFp)) {
                        if (dIp) foundIPs.add(dIp);
                        if (dFp) foundFPs.add(dFp);
                        const optLabel = (pollOpts.find(o => o.id === d.vote) || {}).label || d.vote;
                        results.push({ type: '📊 Enquete', detail: `"${pData.question}"`, sub: `Voto: ${optLabel}${d.playerName ? ' (' + d.playerName + ')' : ''}` });
                    }
                }
            });
        }

        // 3. Mural
        const muralSnap = await db.collection('mural').get();
        muralSnap.docs.forEach(m => {
            const d = m.data();
            if (matchesSearch(d._ip, d._fingerprint)) {
                if (d._ip) foundIPs.add(d._ip);
                if (d._fingerprint) foundFPs.add(d._fingerprint);
                const date = d.createdAt ? d.createdAt.toDate().toLocaleDateString('pt-BR') + ' ' + d.createdAt.toDate().toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) : '?';
                results.push({ type: '📢 Mural', detail: `"${d.text}"`, sub: `Sobre: ${d.targetPlayer} — por ${d.authorName} — ${date}` });
            }
        });

        if (results.length === 0) {
            el.innerHTML = '<div style="color:var(--text-dim);font-size:13px;padding:8px 0;">Nenhum registro encontrado.</div>';
            return;
        }

        let assocHtml = '';
        const showIPs = ip ? [] : [...foundIPs];
        const showFPs = fp ? [] : [...foundFPs];
        if (showIPs.length > 0 || showFPs.length > 0) {
            assocHtml = `<div style="background:rgba(138,43,226,0.08);border:1px solid rgba(138,43,226,0.2);border-radius:8px;padding:8px 10px;margin-bottom:10px;">`;
            if (showIPs.length > 0) {
                assocHtml += `<div style="font-size:11px;color:#b388ff;font-weight:600;margin-bottom:4px;">🌐 IPs associados:</div>`;
                assocHtml += showIPs.map(v => `<div style="display:flex;align-items:center;gap:6px;margin-top:3px;">
                    <code style="font-size:12px;color:var(--text);background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:3px;">${v}</code>
                    <button class="btn btn-small" onclick="navigator.clipboard.writeText('${v}');toast('Copiado!','success');" style="font-size:9px;padding:2px 6px;background:rgba(255,255,255,0.06);color:var(--text-dim);border:1px solid rgba(255,255,255,0.1);">📋</button>
                </div>`).join('');
            }
            if (showFPs.length > 0) {
                assocHtml += `<div style="font-size:11px;color:#b388ff;font-weight:600;margin-bottom:4px;${showIPs.length > 0 ? 'margin-top:8px;' : ''}">🔑 Fingerprints associados:</div>`;
                assocHtml += showFPs.map(v => `<div style="display:flex;align-items:center;gap:6px;margin-top:3px;">
                    <code style="font-size:12px;color:var(--text);background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:3px;">${v}</code>
                    <button class="btn btn-small" onclick="navigator.clipboard.writeText('${v}');toast('Copiado!','success');" style="font-size:9px;padding:2px 6px;background:rgba(255,255,255,0.06);color:var(--text-dim);border:1px solid rgba(255,255,255,0.1);">📋</button>
                </div>`).join('');
            }
            assocHtml += `</div>`;
        }

        el.innerHTML = assocHtml + `<div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;">${results.length} registro(s) encontrado(s)</div>` +
            results.map(r => `
                <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
                    <div style="font-size:12px;"><span style="color:var(--accent);font-weight:600;">${r.type}</span> <span style="color:var(--text);">${r.detail}</span></div>
                    <div style="font-size:11px;color:var(--text-dim);margin-top:2px;">${r.sub}</div>
                </div>`).join('');
    } catch (e) {
        el.innerHTML = `<span style="color:var(--red);font-size:12px;">Erro: ${e.message}</span>`;
    }
}

async function adminGenerateJornal() {
    try {
        const lastSunday = getWeekSunday(new Date());
        lastSunday.setDate(lastSunday.getDate() - 7);
        const weekId = lastSunday.toISOString().slice(0, 10);

        // Delete existing to force regeneration
        await db.collection('jornal').doc(weekId).delete();

        const sat = getWeekSaturday(lastSunday);
        const result = await generateJornal(lastSunday);
        if (result) {
            toast(`Jornal gerado! Arquivando imagem...`, 'success');

            // Determinar edNum
            const allJornals = await db.collection('jornal').orderBy('weekStart', 'asc').get();
            const edNum = allJornals.docs.findIndex(d => d.id === weekId) + 1;

            // Salvar snapshot de quotes
            const snapshot = buildJornalSnapshot(result.badges, edNum);
            await db.collection('jornal').doc(weekId).update({ snapshot });

            // Capturar JPEG e salvar na subcollection
            try {
                const imageBase64 = await captureJornalImage({ ...result, snapshot }, edNum);
                await db.collection('jornal').doc(weekId)
                    .collection('archive').doc('image')
                    .set({ imageBase64, capturedAt: firebase.firestore.FieldValue.serverTimestamp() });
                toast(`Jornal ${fmtDM(lastSunday)} a ${fmtDM(sat)} gerado e arquivado!`, 'success');
            } catch (imgErr) {
                console.warn('[Jornal] Image capture failed:', imgErr);
                toast(`Jornal gerado! (imagem não foi arquivada: ${imgErr.message})`, 'success');
            }

            if (document.getElementById('jornalContent')) loadJornal();
        } else {
            toast(`Sem partidas com GC Stats no período ${fmtDM(lastSunday)} a ${fmtDM(sat)}.`, 'error');
        }
    } catch (e) {
        toast('Erro ao gerar jornal: ' + e.message, 'error');
    }
}

