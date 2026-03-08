// ╔══════════════════════════════════╗
// ║         ADMIN AUTH              ║
// ╚══════════════════════════════════╝
async function hashPassword(pw) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function adminLogin() {
    const pw = document.getElementById('adminPassword').value;
    if (!pw) { toast('Digite a senha!', 'error'); return; }

    try {
        let loginType = null;

        // 1. Tentar Firebase Auth (fluxo pós-migração)
        try {
            await auth.signInWithEmailAndPassword(STAFF_EMAIL, pw);
            loginType = 'staff';
        } catch (e1) {
            try {
                await auth.signInWithEmailAndPassword(ADMIN_EMAIL, pw);
                loginType = 'admin';
            } catch (e2) {}
        }

        // 2. Fallback: verificação por hash (migração automática)
        if (!loginType) {
            const hashedPw = await hashPassword(pw);
            const doc = await db.collection('config').doc('admin').get();
            if (!doc.exists) { toast('Senha incorreta!', 'error'); return; }

            const data = doc.data();
            if (data.staffPassword && hashedPw === data.staffPassword) {
                loginType = 'staff';
            } else if (hashedPw === data.password) {
                loginType = 'admin';
            } else {
                toast('Senha incorreta!', 'error');
                return;
            }

            // Criar usuário Firebase Auth automaticamente
            const email = loginType === 'staff' ? STAFF_EMAIL : ADMIN_EMAIL;
            try {
                await auth.createUserWithEmailAndPassword(email, pw);
            } catch (createErr) {
                if (createErr.code !== 'auth/email-already-in-use') {
                    console.warn('Erro ao criar user Firebase Auth:', createErr.message);
                }
                // Tentar login mesmo assim
                try { await auth.signInWithEmailAndPassword(email, pw); } catch(_){}
            }
        }

        // 3. Sucesso
        isAdmin = true;
        isStaff = (loginType === 'staff');
        sessionStorage.setItem('mirb_admin', 'true');
        if (isStaff) sessionStorage.setItem('mirb_staff', 'true');
        toast(`Login de ${loginType} realizado!`, 'success');
        logAdminLogin(loginType);
        renderAdminPanel();
    } catch (e) {
        toast('Erro ao verificar senha: ' + e.message, 'error');
    }
}

function adminLogout() {
    isAdmin = false;
    isStaff = false;
    sessionStorage.removeItem('mirb_admin');
    sessionStorage.removeItem('mirb_staff');
    auth.signOut().catch(() => {});
    document.getElementById('adminContent').innerHTML = `
        <div class="admin-lock">
            <div class="lock-icon">🔒</div>
            <p>Acesso restrito. Digite a senha de administrador.</p>
            <div class="password-input-group">
                <input type="password" id="adminPassword" placeholder="Senha" onkeydown="if(event.key==='Enter')adminLogin()">
                <button class="btn btn-primary btn-small" onclick="adminLogin()">Entrar</button>
            </div>
        </div>
    `;
    toast('Logout realizado', 'success');
}

// ╔══════════════════════════════════╗
// ║       LOGIN LOGS                ║
// ╚══════════════════════════════════╝
async function logAdminLogin(type) {
    try {
        let ip = 'unknown';
        try { const r = await fetch('https://api.ipify.org?format=json'); ip = (await r.json()).ip || 'unknown'; } catch(_){}
        const ua = navigator.userAgent;
        let browser = 'Desconhecido';
        if (ua.includes('Edg/')) browser = 'Edge';
        else if (ua.includes('Chrome/')) browser = 'Chrome';
        else if (ua.includes('Firefox/')) browser = 'Firefox';
        else if (ua.includes('Safari/')) browser = 'Safari';
        await db.collection('loginLogs').add({
            type,
            ip,
            browser,
            userAgent: ua,
            platform: navigator.platform || 'unknown',
            language: navigator.language || 'unknown',
            screen: screen.width + 'x' + screen.height,
            cores: navigator.hardwareConcurrency || null,
            memory: navigator.deviceMemory || null,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch(_){}
}

