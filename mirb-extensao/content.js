// MiRB GC Stats Extension - Content Script
// Runs on: https://gamersclub.com.br/lobby/partida/*

(function () {
  const FIRESTORE_PROJECT = 'mirb-mix';
  const FIREBASE_API_KEY = 'AIzaSyAEXaBPQ7hggW1iqK8-tCMD7dfV8kPahUw';
  const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents`;
  const COLLECTION = 'gc-imports';

  // Extract match ID from URL (supports both /partida/ and /match/)
  const matchIdMatch = window.location.href.match(/(?:partida|match)\/(\d+)/);
  if (!matchIdMatch) return;
  const matchId = matchIdMatch[1];

  // Wait for page to finish loading
  function injectUI() {
    // Don't inject twice
    if (document.getElementById('mirb-gc-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'mirb-gc-panel';
    panel.innerHTML = `
      <button id="mirb-gc-btn" title="Enviar stats desta partida para o MiRB">
        <span style="font-size:18px;">&#9889;</span>
        <span>Enviar pro MiRB</span>
      </button>
      <div id="mirb-gc-status"></div>
    `;
    document.body.appendChild(panel);

    document.getElementById('mirb-gc-btn').addEventListener('click', handleSend);
  }

  async function handleSend() {
    const btn = document.getElementById('mirb-gc-btn');
    const status = document.getElementById('mirb-gc-status');

    btn.classList.add('loading');
    btn.querySelector('span:last-child').textContent = 'Buscando dados...';
    status.className = 'mirb-gc-status';
    status.classList.remove('visible');

    try {
      // 1. Fetch match data from GC API
      const resp = await fetch(`/lobby/match/${matchId}/1`, { credentials: 'include' });
      if (!resp.ok) throw new Error(`API retornou status ${resp.status}`);

      const data = await resp.json();
      if (!data.success) throw new Error('API retornou success=false');

      const jogos = data.jogos;
      const scoreA = parseInt(jogos.score_a) || 0;
      const scoreB = parseInt(jogos.score_b) || 0;
      const teamAName = data.time_a || 'Time A';
      const teamBName = data.time_b || 'Time B';
      const mapName = jogos.map_name || '';

      // 2. Build player stats
      const players = [];
      const processTeam = (teamPlayers, teamName, teamScore, isWin) => {
        if (!teamPlayers) return;
        teamPlayers.forEach(p => {
          players.push({
            name: p.player?.nick || '',
            gcId: String(p.idplayer || p.player?.id || ''),
            avatar: p.player?.avatar
              ? `https://static.gamersclub.com.br/${p.player.avatar}_medium.jpg`
              : '',
            k: parseInt(p.nb_kill) || 0,
            a: parseInt(p.assist) || 0,
            d: parseInt(p.death) || 0,
            diff: parseInt(p.diff) || 0,
            adr: parseFloat(p.adr) || 0,
            kdr: parseFloat(p.kdr) || 0,
            kast: parseInt(p.pkast) || 0,
            fk: parseInt(p.firstkill) || 0,
            rp: parseInt(p.rating_points) || 0,
            win: isWin,
            teamName: teamName,
            teamScore: teamScore,
            _v: 4
          });
        });
      };

      processTeam(jogos.players.team_a, teamAName, scoreA, scoreA > scoreB);
      processTeam(jogos.players.team_b, teamBName, scoreB, scoreB > scoreA);

      if (players.length === 0) throw new Error('Nenhum jogador encontrado');

      btn.querySelector('span:last-child').textContent = 'Enviando pro MiRB...';

      // 3. Send to Firestore via REST API
      const docData = {
        fields: {
          gcMatchId: { stringValue: matchId },
          teamA: { stringValue: teamAName },
          teamB: { stringValue: teamBName },
          scoreA: { integerValue: String(scoreA) },
          scoreB: { integerValue: String(scoreB) },
          map: { stringValue: mapName },
          status: { stringValue: 'pending' },
          playersJson: { stringValue: JSON.stringify(players) },
          createdAt: { timestampValue: new Date().toISOString() }
        }
      };

      const fbResp = await fetch(`${FIRESTORE_URL}/${COLLECTION}?key=${FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docData)
      });

      if (!fbResp.ok) {
        const errText = await fbResp.text();
        throw new Error(`Firebase erro ${fbResp.status}: ${errText.substring(0, 100)}`);
      }

      // 4. Success!
      btn.classList.remove('loading');
      btn.classList.add('success');
      btn.querySelector('span:last-child').textContent = 'Enviado!';

      status.className = 'visible success';
      status.id = 'mirb-gc-status';
      status.textContent = `${players.length} jogadores | ${teamAName} ${scoreA} x ${scoreB} ${teamBName} | ${mapName}`;

      // Reset after 5 seconds
      setTimeout(() => {
        btn.classList.remove('success');
        btn.querySelector('span:last-child').textContent = 'Enviar pro MiRB';
      }, 5000);

    } catch (err) {
      btn.classList.remove('loading');
      btn.classList.add('error');
      btn.querySelector('span:last-child').textContent = 'Erro!';

      status.className = 'visible error';
      status.id = 'mirb-gc-status';
      status.textContent = err.message;

      setTimeout(() => {
        btn.classList.remove('error');
        btn.querySelector('span:last-child').textContent = 'Enviar pro MiRB';
      }, 5000);
    }
  }

  // Wait for page content to load, then inject
  if (document.readyState === 'complete') {
    injectUI();
  } else {
    window.addEventListener('load', injectUI);
  }
})();
