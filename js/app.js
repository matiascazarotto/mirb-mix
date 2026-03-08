// ╔══════════════════════════════════════════════════════════╗
// ║  🔧 FIREBASE CONFIG — Substitua com suas credenciais    ║
// ╚══════════════════════════════════════════════════════════╝
const firebaseConfig = {
  apiKey: "AIzaSyAEXaBPQ7hggW1iqK8-tCMD7dfV8kPahUw",
  authDomain: "mirb-mix.firebaseapp.com",
  projectId: "mirb-mix",
  storageBucket: "mirb-mix.firebasestorage.app",
  messagingSenderId: "488557105379",
  appId: "1:488557105379:web:c35c30be0dd0ff27d875d6"
};

// ─── Admin password (stored in Firestore: config/admin → password field) ───

// ─── Init Firebase ───
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const ADMIN_EMAIL = 'admin@mirb-mix.firebaseapp.com';
const STAFF_EMAIL = 'staff@mirb-mix.firebaseapp.com';

// ─── App State ───
let isAdmin = false;
let isStaff = false;
let currentMatchVoting = null; // match id being voted on
let players = []; // cached players
let unsubscribers = []; // firestore listeners
let muralUnsubscribe = null; // mural listener
let teamVoteUnsubscribe = null; // team vote listener

// ╔══════════════════════════════════╗
// ║         NAVIGATION              ║
// ╚══════════════════════════════════╝
function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`page-${name}`).classList.add('active');
    document.querySelector(`.nav-btn[onclick*="${name}"]`).classList.add('active');

    if (name !== 'vote') destroyTeamVoteListener();

    if (name === 'vote') loadVotePage();
    if (name === 'matches') loadMatchesPage();
    if (name === 'admin' && isAdmin) renderAdminPanel();
    if (name === 'dashboard') loadDashboard();
    if (name === 'h2h') loadH2HPage();
    if (name === 'jornal') loadJornal();
}

function destroyTeamVoteListener() {
    if (teamVoteUnsubscribe) {
        teamVoteUnsubscribe();
        teamVoteUnsubscribe = null;
    }
}
// ╔══════════════════════════════════╗
// ║           TOAST                 ║
// ╚══════════════════════════════════╝
function toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast ${type} show`;
    setTimeout(() => el.classList.remove('show'), 3000);
}

