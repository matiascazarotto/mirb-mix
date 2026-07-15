// ╔══════════════════════════════════════════════════════════╗
// ║  STORE — fonte única de dados (tempo real + cache)        ║
// ╚══════════════════════════════════════════════════════════╝
// Em vez de cada página buscar tudo da rede a cada clique, o Store mantém
// UM listener onSnapshot por dado quente (config/settings e a coleção matches).
// Páginas leem do cache em memória (instantâneo) e são notificadas quando o
// servidor empurra mudanças — sem F5 e sem dado velho.
const Store = (() => {
    const _subs = { settings: [], matches: [] };
    function _notify(topic) {
        _subs[topic].forEach(fn => { try { fn(); } catch (e) { console.warn('[Store] subscriber error:', e); } });
    }

    // ── config/settings (1 listener; toggles da staff chegam ao vivo) ──
    let _settings = null;
    let _settingsReady = null;
    function _initSettings() {
        if (_settingsReady) return _settingsReady;
        _settingsReady = new Promise(resolve => {
            db.collection('config').doc('settings').onSnapshot(doc => {
                _settings = doc.exists ? doc.data() : {};
                resolve(_settings);
                _notify('settings');
            }, err => {
                console.warn('[Store] settings listener:', err.message);
                if (!_settings) _settings = {};
                resolve(_settings);
            });
        });
        return _settingsReady;
    }
    async function getSettings() {
        if (_settings) return _settings;
        return _initSettings();
    }

    // ── matches (coleção inteira, desc; docs mudados chegam como delta) ──
    let _matches = null;
    let _matchesReady = null;
    function _initMatches() {
        if (_matchesReady) return _matchesReady;
        _matchesReady = new Promise((resolve, reject) => {
            db.collection('matches').orderBy('createdAt', 'desc').onSnapshot(snap => {
                _matches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                resolve(_matches);
                _notify('matches');
            }, err => {
                console.warn('[Store] matches listener:', err.message);
                if (_matches) resolve(_matches); else reject(err);
            });
        });
        return _matchesReady;
    }
    async function getMatches() {
        if (_matches) return _matches;
        return _initMatches();
    }

    function subscribe(topic, fn) {
        if (_subs[topic]) _subs[topic].push(fn);
    }

    // Liga os listeners no boot (init.js) pra 1ª navegação já encontrar dados chegando
    function start() {
        _initSettings();
        _initMatches().catch(() => {});
    }

    return { getSettings, getMatches, subscribe, start };
})();
