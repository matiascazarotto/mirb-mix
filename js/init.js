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
    loadVotePage();
    // Apply nav visibility from settings
    db.collection('config').doc('settings').get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            if (data.h2hEnabled === false) { const b = document.getElementById('navH2h'); if (b) b.style.display = 'none'; }
            if (data.jornalEnabled === false) { const b = document.getElementById('navJornal'); if (b) b.style.display = 'none'; }
        }
    }).catch(() => {});
    // Init first GC match slot
    addGCMatchSlot();
    // Init live stream listener
    initLiveListener();
    // Migrate: mark existing finished matches with wasFinished flag
    db.collection('matches').where('status', '==', 'finished').get().then(snap => {
        snap.docs.forEach(d => {
            if (!d.data().wasFinished) d.ref.update({ wasFinished: true });
        });
    }).catch(() => {});
});

// Close modal on overlay click
document.getElementById('editModal').addEventListener('click', function(e) {
    if (e.target === this) closeEditModal();
});
