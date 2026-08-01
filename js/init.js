// ╔══════════════════════════════════╗
// ║           INIT                  ║
// ╚══════════════════════════════════╝
document.addEventListener('DOMContentLoaded', () => {
    // Save original edit modal content
    editModalOriginalHTML = document.getElementById('editModal').querySelector('.modal-box').innerHTML;
    // Restore admin session (sync, para render imediato)
    if (sessionStorage.getItem('mirb_admin') === 'true') {
        isAdmin = true;
    }
    if (sessionStorage.getItem('mirb_staff') === 'true') {
        isStaff = true;
    }
    // Firebase Auth state listener (async, persistência entre abas)
    auth.onAuthStateChanged(user => {
        if (user) {
            isAdmin = true;
            sessionStorage.setItem('mirb_admin', 'true');
            if (user.email === STAFF_EMAIL) {
                isStaff = true;
                sessionStorage.setItem('mirb_staff', 'true');
            } else {
                isStaff = false;
                sessionStorage.removeItem('mirb_staff');
            }
        }
    });
    Store.start();
    // Pré-aquece dados do dashboard (badges + jornal) em segundo plano, com folga, pra 1ª
    // abertura do dashboard não pagar as idas à rede. Deferido: quem entra e sai rápido nem
    // dispara; memoizado: no máx. 1 busca de cada por sessão.
    if (typeof warmDashboardData === 'function') setTimeout(warmDashboardData, 1500);
    loadVotePage();
    // Apply nav visibility from settings (cache for next reload to avoid flicker)
    Store.getSettings().then(data => {
        const h2h = data.h2hEnabled !== false;
        const jornal = data.jornalEnabled !== false;
        const bH = document.getElementById('navH2h');
        if (bH) bH.style.display = h2h ? '' : 'none';
        const bJ = document.getElementById('navJornal');
        if (bJ) bJ.style.display = jornal ? '' : 'none';
        // Drop the pre-paint cache <style> so inline display rules take effect
        const cacheStyle = document.getElementById('navCacheStyle');
        if (cacheStyle) cacheStyle.remove();
        try { localStorage.setItem('mirb_navCache', JSON.stringify({ h2hEnabled: h2h, jornalEnabled: jornal })); } catch (e) {}
    }).catch(() => {
        const cacheStyle = document.getElementById('navCacheStyle');
        if (cacheStyle) cacheStyle.remove();
    });
    // Init first GC match slot
    addGCMatchSlot();
    // Migrate: mark existing finished matches with wasFinished flag
    Store.getMatches().then(all => {
        all.filter(m => m.status === 'finished' && !m.wasFinished)
            .forEach(m => db.collection('matches').doc(m.id).update({ wasFinished: true }).catch(() => {}));
    }).catch(() => {});
});

// Close modal on overlay click
document.getElementById('editModal').addEventListener('click', function(e) {
    if (e.target === this) closeEditModal();
});
