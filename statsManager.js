// statsManager.js - localStorage persistence + Discord webhook + run log

const StatsManager = (() => {
    const STORAGE_KEY = 'scream_runner_stats';
    const LOG_KEY = 'scream_run_logs';
    let _webhookCooldown = false;

    // ── Storage helpers ────────────────────────────────────────────────────────
    function _load() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || _defaultData();
        } catch { return _defaultData(); }
    }

    function _save(data) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { }
    }

    function _defaultData() {
        return {
            characters: [],   // [{ id, name, gender, created }]
            runs: [],         // [{ charId, distance, maxSpeed, avgDb, screamMs, ts }]
            totals: { sessions: 0, distance: 0, screamMs: 0 },
        };
    }

    // ── Characters ─────────────────────────────────────────────────────────────
    function getCharacters() { return _load().characters; }

    function createCharacter(name, gender) {
        const data = _load();
        const char = {
            id: Date.now().toString(36),
            name: name.trim(),
            gender: gender || 'boy',
            created: Date.now(),
        };
        data.characters.push(char);
        _save(data);
        return char;
    }

    function deleteCharacter(id) {
        const data = _load();
        data.characters = data.characters.filter(c => c.id !== id);
        data.runs = data.runs.filter(r => r.charId !== id);
        _save(data);
    }

    // ── Run Logs (separate key → never pruned, full history) ──────────────────
    function _loadLogs() {
        try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch { return []; }
    }

    function _saveLogs(logs) {
        try { localStorage.setItem(LOG_KEY, JSON.stringify(logs)); } catch { }
    }

    function writeRunLog(charName, gender, stats) {
        const entry = {
            ts: Date.now(),
            character: charName,
            gender,
            distance: stats.distance,
            maxSpeed: stats.maxSpeed,
            avgDb: stats.avgDb,
            screamMs: stats.screamMs,
        };

        // ── Persist to localStorage log ──────────────────────────────────────────
        const logs = _loadLogs();
        logs.unshift(entry);
        // Keep last 200 log entries
        if (logs.length > 200) logs.length = 200;
        _saveLogs(logs);

        // ── Print to browser console ────────────────────────────────────────────
        const emoji = gender === 'girl' ? '👧' : '👦';
        const dateStr = new Date(entry.ts).toLocaleString();
        console.groupCollapsed(
            `%c🎤 Scream Runner Run Log — ${dateStr}`,
            'color:#ffe66d;font-weight:bold;font-size:13px'
        );
        console.log(`${emoji} Character : ${charName} (${gender})`);
        console.log(`📏 Distance  : ${stats.distance} m`);
        console.log(`⚡ Max Speed : ${stats.maxSpeed} km/h`);
        console.log(`🔊 Avg dB    : ${stats.avgDb} dB`);
        console.log(`⏱️ Scream    : ${(stats.screamMs / 1000).toFixed(1)} s`);
        console.table([entry]);
        console.groupEnd();

        return entry;
    }

    function getRunLogs() { return _loadLogs(); }

    // ── Runs (top-scores store) ────────────────────────────────────────────────
    function saveRun(charId, stats) {
        const data = _load();
        const run = { charId, ...stats, ts: Date.now() };
        data.runs.unshift(run);
        if (data.runs.length > GAME_CONFIG.STATS.MAX_STORED_RUNS) {
            data.runs = data.runs.slice(0, GAME_CONFIG.STATS.MAX_STORED_RUNS);
        }
        data.totals.sessions += 1;
        data.totals.distance += stats.distance || 0;
        data.totals.screamMs += stats.screamMs || 0;
        _save(data);
        return run;
    }

    function getBestForCharacter(charId) {
        const runs = _load().runs.filter(r => r.charId === charId);
        if (!runs.length) return null;
        return runs.reduce((best, r) => (r.distance > best.distance ? r : best), runs[0]);
    }

    function getAllRuns() { return _load().runs; }
    function getTotals() { return _load().totals; }

    function getTopRuns(limit = GAME_CONFIG.STATS.TOP_SCORES_SHOWN) {
        return [..._load().runs].sort((a, b) => b.distance - a.distance).slice(0, limit);
    }

    function getRunsForCharacter(charId) {
        return _load().runs.filter(r => r.charId === charId);
    }

    // ── Discord Webhook ────────────────────────────────────────────────────────
    async function postToDiscord(charName, gender, stats) {
        const cfg = GAME_CONFIG.DISCORD;
        if (!cfg.ENABLED) return;
        if (!cfg.WEBHOOK_URL || cfg.WEBHOOK_URL === 'YOUR_WEBHOOK_URL_HERE') return;
        if (stats.distance < cfg.MIN_DISTANCE_TO_POST) return;
        if (_webhookCooldown) return;

        _webhookCooldown = true;
        setTimeout(() => { _webhookCooldown = false; }, cfg.COOLDOWN_MS);

        const allTop = getTopRuns(3);
        let rank = '';
        const pos = allTop.findIndex(r => r.distance === stats.distance);
        if (pos === 0) rank = '🥇';
        else if (pos === 1) rank = '🥈';
        else if (pos === 2) rank = '🥉';

        const genderEmoji = gender === 'girl' ? '👧' : '👦';

        const payload = {
            username: cfg.BOT_USERNAME,
            embeds: [{
                title: rank ? `${rank} New High Score!` : '🎉 Great Run!',
                description: `${genderEmoji} **${charName}** screamed their way to glory!`,
                color: cfg.EMBED_COLOR,
                fields: [
                    { name: '📏 Distance', value: `${stats.distance}m`, inline: true },
                    { name: '⚡ Max Speed', value: `${stats.maxSpeed} km/h`, inline: true },
                    { name: '🔊 Avg Volume', value: `${stats.avgDb} dB`, inline: true },
                    { name: '⏱️ Scream Time', value: `${(stats.screamMs / 1000).toFixed(1)}s`, inline: true },
                ],
                timestamp: new Date().toISOString(),
                footer: { text: `Scream Runner • ${Localization.getLang()}` },
            }],
        };

        try {
            await fetch(cfg.WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } catch (err) {
            console.warn('[StatsManager] Discord webhook failed:', err);
        }
    }

    // ── Settings persistence ───────────────────────────────────────────────────
    function saveWebhookUrl(url) {
        GAME_CONFIG.DISCORD.WEBHOOK_URL = url;
        localStorage.setItem('scream_webhook', url);
        localStorage.setItem('scream_webhook_enabled', GAME_CONFIG.DISCORD.ENABLED ? '1' : '0');
    }

    function loadSettings() {
        const url = localStorage.getItem('scream_webhook');
        if (url) GAME_CONFIG.DISCORD.WEBHOOK_URL = url;
        const en = localStorage.getItem('scream_webhook_enabled');
        if (en !== null) GAME_CONFIG.DISCORD.ENABLED = en === '1';
        const nf = localStorage.getItem('scream_noise_floor');
        if (nf) AudioProcessor.setNoiseFloor(parseFloat(nf));
    }

    function saveNoiseFloor(val) {
        localStorage.setItem('scream_noise_floor', String(val));
    }

    return {
        getCharacters, createCharacter, deleteCharacter,
        saveRun, getBestForCharacter, getAllRuns, getTotals, getTopRuns, getRunsForCharacter,
        writeRunLog, getRunLogs,
        postToDiscord, saveWebhookUrl, loadSettings, saveNoiseFloor,
    };
})();
