// app.js - Main orchestrator

(function () {
    // ── Screen references ────────────────────────────────────────────────────
    const screens = {
        start: document.getElementById('screen-start'),
        intro: document.getElementById('screen-intro'),
        charSel: document.getElementById('screen-char'),
        game: document.getElementById('screen-game'),
        gameOver: document.getElementById('screen-gameover'),
        stats: document.getElementById('screen-stats'),
        settings: document.getElementById('screen-settings'),
    };

    function showScreen(name) {
        Object.values(screens).forEach(s => s && s.classList.remove('active'));
        if (screens[name]) screens[name].classList.add('active');
    }

    // ── State ────────────────────────────────────────────────────────────────
    let currentChar = null;
    let micGranted = false;
    let lastStats = null;

    const hudSpeed = document.getElementById('hud-speed');
    const hudDist = document.getElementById('hud-distance');
    const soundBar = document.getElementById('sound-bar-fill');
    const soundDbText = document.getElementById('sound-db-text');
    const peakMarker = document.getElementById('peak-marker');
    const hudChar = document.getElementById('hud-char-name');
    const canvas = document.getElementById('game-canvas');

    // ── Boot ─────────────────────────────────────────────────────────────────
    async function boot() {
        Localization.init();
        StatsManager.loadSettings();
        GameEngine.init(canvas);
        bindStartScreen();
        bindIntroScreen();
        bindCharScreen();
        bindGameOverScreen();
        bindSettingsScreen();
        bindNavButtons();
        populateCharSelector();
        showScreen('start');
    }

    // ── Start screen ──────────────────────────────────────────────────────────
    function bindStartScreen() {
        document.getElementById('btn-start').addEventListener('click', async () => {
            if (!micGranted) {
                const ok = await requestMicAndCalibrate();
                if (!ok) return;
            }
            showScreen('intro');
        });
    }

    // Request mic then auto-calibrate (3 s of silence sampling)
    async function requestMicAndCalibrate() {
        const result = await AudioProcessor.init();
        if (!result) {
            document.getElementById('mic-error').classList.remove('hidden');
            return false;
        }
        micGranted = true;

        // Show calibration overlay, sample noise, hide overlay
        document.getElementById('calibrating-overlay').classList.remove('hidden');
        AudioProcessor.start(() => { }); // spin analyser without acting on data
        const floor = await AudioProcessor.startCalibration();
        AudioProcessor.stop();
        StatsManager.saveNoiseFloor(floor);
        document.getElementById('calibrating-overlay').classList.add('hidden');
        return true;
    }

    // ── Intro screen ──────────────────────────────────────────────────────────
    function bindIntroScreen() {
        document.getElementById('btn-begin').addEventListener('click', () => {
            if (!currentChar) showScreen('charSel');
            else startGameplay();
        });
    }

    // ── Character selector ────────────────────────────────────────────────────
    function bindCharScreen() {
        document.querySelectorAll('.gender-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        document.getElementById('btn-create-char').addEventListener('click', () => {
            const input = document.getElementById('char-name-input');
            const name = input.value.trim();
            if (!name) { input.focus(); return; }
            const activeGender = document.querySelector('.gender-btn.active');
            const gender = activeGender ? activeGender.dataset.gender : 'boy';
            const char = StatsManager.createCharacter(name, gender);
            input.value = '';
            populateCharSelector();
            selectCharacter(char.id);
        });
    }

    function populateCharSelector() {
        const list = document.getElementById('char-list');
        if (!list) return;
        list.innerHTML = '';
        const chars = StatsManager.getCharacters();
        if (!chars.length) {
            const p = document.createElement('p');
            p.className = 'empty-msg';
            p.textContent = Localization.t('NO_DATA');
            list.appendChild(p);
            return;
        }
        chars.forEach(char => {
            const best = StatsManager.getBestForCharacter(char.id);
            const icon = char.gender === 'girl' ? '👧' : '👦';
            const div = document.createElement('div');
            div.className = 'char-card' + (currentChar?.id === char.id ? ' selected' : '');
            div.innerHTML = `
        <div class="char-avatar">${icon}</div>
        <div class="char-info">
          <strong>${char.name}</strong>
          <span>${best ? best.distance + 'm best' : 'No runs yet'}</span>
        </div>
        <button class="btn-icon btn-del" data-id="${char.id}" title="Delete">✕</button>
      `;
            div.addEventListener('click', e => {
                if (!e.target.classList.contains('btn-del')) selectCharacter(char.id);
            });
            div.querySelector('.btn-del').addEventListener('click', e => {
                e.stopPropagation();
                StatsManager.deleteCharacter(char.id);
                if (currentChar?.id === char.id) currentChar = null;
                populateCharSelector();
            });
            list.appendChild(div);
        });
    }

    function selectCharacter(id) {
        const chars = StatsManager.getCharacters();
        currentChar = chars.find(c => c.id === id) || null;
        if (currentChar) localStorage.setItem('scream_current_char', id);
        document.querySelectorAll('.char-card').forEach(el => {
            el.classList.toggle('selected', el.querySelector('.btn-del')?.dataset.id === id);
        });
        if (currentChar) setTimeout(() => startGameplay(), 300);
    }

    // ── Gameplay ──────────────────────────────────────────────────────────────
    function startGameplay() {
        if (!currentChar) { showScreen('charSel'); return; }
        if (hudChar) hudChar.textContent = `${currentChar.gender === 'girl' ? '👧' : '👦'} ${currentChar.name}`;
        showScreen('game');
        AudioProcessor.start(onVolume);
        GameEngine.startGame(currentChar.gender, onTick, onGameOver);
    }

    function onVolume(db, speed) {
        GameEngine.setTargetSpeed(speed);
        GameEngine.pushDbSample(db);
        updateSoundBar(db);
    }

    function onTick(speed, distance) {
        if (hudSpeed) hudSpeed.textContent = Math.round(speed);
        if (hudDist) hudDist.textContent = Math.round(distance);
    }

    function updateSoundBar(db) {
        if (!soundBar) return;
        const cfg = GAME_CONFIG.VISUAL;
        const maxDb = GAME_CONFIG.AUDIO.MAX_SPEED / GAME_CONFIG.AUDIO.VOLUME_MULTIPLIER + GAME_CONFIG.AUDIO.SCREAM_THRESHOLD_DB;
        const pct = Math.min(db / maxDb, 1) * 100;
        soundBar.style.width = pct + '%';
        soundBar.style.background =
            db < cfg.SOUND_BAR_THRESHOLDS.LOW_MAX ? cfg.SOUND_BAR_COLORS.LOW :
                db < cfg.SOUND_BAR_THRESHOLDS.MED_MAX ? cfg.SOUND_BAR_COLORS.MEDIUM :
                    cfg.SOUND_BAR_COLORS.HIGH;
        if (soundDbText) soundDbText.textContent = db.toFixed(1) + ' dB';
        if (peakMarker) peakMarker.style.left = pct + '%';
    }

    // ── Game Over ─────────────────────────────────────────────────────────────
    function onGameOver(stats) {
        lastStats = stats;
        AudioProcessor.stop();

        // Persist and log — automatically, immediately
        StatsManager.saveRun(currentChar?.id || 'anon', stats);
        if (currentChar) {
            StatsManager.writeRunLog(currentChar.name, currentChar.gender || 'boy', stats);
        }

        // Discord auto-post (if configured by advanced user via config.js)
        if (GAME_CONFIG.DISCORD.ENABLED && currentChar) {
            StatsManager.postToDiscord(currentChar.name, currentChar.gender || 'boy', stats);
        }

        const best = currentChar ? StatsManager.getBestForCharacter(currentChar.id) : null;
        document.getElementById('go-distance').textContent = stats.distance;
        document.getElementById('go-maxspeed').textContent = stats.maxSpeed;
        document.getElementById('go-avgdb').textContent = stats.avgDb.toFixed(1);
        document.getElementById('go-time').textContent = (stats.screamMs / 1000).toFixed(1);
        document.getElementById('go-best').textContent = best ? best.distance : stats.distance;
        document.getElementById('go-char-name').textContent = currentChar
            ? `${currentChar.gender === 'girl' ? '👧' : '👦'} ${currentChar.name}` : '';

        showScreen('gameOver');
    }

    function bindGameOverScreen() {
        document.getElementById('btn-scream-again').addEventListener('click', () => startGameplay());
        document.getElementById('btn-change-char').addEventListener('click', () => {
            populateCharSelector(); showScreen('charSel');
        });
        document.getElementById('btn-view-stats').addEventListener('click', () => {
            renderStats(); showScreen('stats');
        });
    }

    // ── Stats page ────────────────────────────────────────────────────────────
    function renderStats() {
        const totals = StatsManager.getTotals();
        document.getElementById('stat-total-sessions').textContent = totals.sessions;
        document.getElementById('stat-total-distance').textContent = totals.distance + 'm';
        document.getElementById('stat-total-time').textContent = (totals.screamMs / 1000).toFixed(1) + 's';

        const top = StatsManager.getTopRuns(GAME_CONFIG.STATS.TOP_SCORES_SHOWN);
        const tbody = document.getElementById('records-body');
        if (tbody) {
            tbody.innerHTML = '';
            const chars = StatsManager.getCharacters();
            if (!top.length) {
                tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">${Localization.t('NO_DATA')}</td></tr>`;
            } else {
                top.forEach((run, i) => {
                    const char = chars.find(c => c.id === run.charId);
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                    const icon = char?.gender === 'girl' ? '👧' : '👦';
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${medal}</td><td>${icon} ${char?.name || '?'}</td>
            <td>${run.distance}m</td><td>${run.maxSpeed} km/h</td>
            <td>${new Date(run.ts).toLocaleDateString()}</td>`;
                    tbody.appendChild(tr);
                });
            }
        }

        renderRunLog();
        renderRunsChart(StatsManager.getAllRuns().slice(0, 20));
    }

    function renderRunLog() {
        const tbody = document.getElementById('log-body');
        if (!tbody) return;
        const logs = StatsManager.getRunLogs().slice(0, 20);
        tbody.innerHTML = '';
        if (!logs.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">${Localization.t('NO_DATA')}</td></tr>`;
            return;
        }
        logs.forEach(entry => {
            const icon = entry.gender === 'girl' ? '👧' : '👦';
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${new Date(entry.ts).toLocaleTimeString()}</td>
        <td>${icon} ${entry.character}</td><td>${entry.distance}m</td>
        <td>${entry.maxSpeed} km/h</td><td>${(entry.screamMs / 1000).toFixed(1)}s</td>`;
            tbody.appendChild(tr);
        });
    }

    function renderRunsChart(runs) {
        const chartCanvas = document.getElementById('runs-chart');
        if (!chartCanvas) return;
        const ctx = chartCanvas.getContext('2d');
        const w = chartCanvas.width = chartCanvas.offsetWidth;
        const h = chartCanvas.height = 120;
        ctx.clearRect(0, 0, w, h);
        if (!runs.length) return;
        const maxDist = Math.max(...runs.map(r => r.distance), 1);
        const barW = Math.max(8, Math.floor(w / runs.length) - 4);
        [...runs].reverse().forEach((run, i) => {
            const barH = (run.distance / maxDist) * (h - 20);
            const x = i * (barW + 4) + 4;
            const y = h - barH - 2;
            const grad = ctx.createLinearGradient(0, y, 0, h);
            grad.addColorStop(0, '#ff6b6b');
            grad.addColorStop(1, 'rgba(255,107,107,0.2)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(x, y, barW, barH, 3);
            ctx.fill();
        });
    }

    // ── Settings (language only — calibration is automatic) ───────────────────
    function bindSettingsScreen() {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                Localization.setLang(btn.dataset.lang);
                populateCharSelector();
            });
        });
    }

    // ── Nav buttons ───────────────────────────────────────────────────────────
    function bindNavButtons() {
        document.querySelectorAll('[data-nav]').forEach(btn => {
            btn.addEventListener('click', () => {
                const t = btn.dataset.nav;
                if (t === 'stats') renderStats();
                if (t === 'charSel') populateCharSelector();
                showScreen(t);
            });
        });
        document.querySelectorAll('[data-back]').forEach(btn => {
            btn.addEventListener('click', () => showScreen(btn.dataset.back));
        });
    }

    // ── Restore last character ────────────────────────────────────────────────
    (function restoreChar() {
        const saved = localStorage.getItem('scream_current_char');
        if (saved) {
            const chars = StatsManager.getCharacters();
            currentChar = chars.find(c => c.id === saved) || null;
        }
    })();

    document.addEventListener('DOMContentLoaded', boot);
})();
