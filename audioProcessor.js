// audioProcessor.js - Microphone & Web Audio API handling

const AudioProcessor = (() => {
    let audioContext = null;
    let analyser = null;
    let source = null;
    let stream = null;
    let dataArray = null;
    let _noiseFloor = GAME_CONFIG.AUDIO.NOISE_FLOOR_DB;
    let _calibrating = false;
    let _calibrationSamples = [];
    let _peakDb = -Infinity;
    let _peakTimer = null;
    let onVolumeUpdate = null; // callback(dB, speed)
    let _rafId = null;
    let _running = false;

    // ── Helpers ────────────────────────────────────────────────────────────────
    function bufferToDb(buffer) {
        let sumSq = 0;
        for (let i = 0; i < buffer.length; i++) {
            const norm = buffer[i] / 128 - 1; // convert 0-255 to -1..1
            sumSq += norm * norm;
        }
        const rms = Math.sqrt(sumSq / buffer.length);
        if (rms === 0) return 0;
        return Math.max(0, 20 * Math.log10(rms) + 90); // shift so silence ≈ 0 dB
    }

    function dbToSpeed(db) {
        const adjusted = db - (_noiseFloor + GAME_CONFIG.AUDIO.SCREAM_THRESHOLD_DB - 30);
        if (adjusted <= 0) return 0;
        const speed = Math.min(adjusted * GAME_CONFIG.AUDIO.VOLUME_MULTIPLIER, GAME_CONFIG.AUDIO.MAX_SPEED);
        return speed;
    }

    // ── Main loop ──────────────────────────────────────────────────────────────
    function _tick() {
        if (!_running || !analyser) return;
        analyser.getByteTimeDomainData(dataArray);
        const db = bufferToDb(dataArray);

        // Peak tracking
        if (db > _peakDb) {
            _peakDb = db;
            clearTimeout(_peakTimer);
            _peakTimer = setTimeout(() => { _peakDb = 0; }, GAME_CONFIG.AUDIO.PEAK_HOLD_MS);
        }

        // Calibration sampling
        if (_calibrating) {
            _calibrationSamples.push(db);
        }

        const speed = dbToSpeed(db);
        if (onVolumeUpdate) onVolumeUpdate(db, speed, _peakDb);

        _rafId = requestAnimationFrame(_tick);
    }

    // ── Public API ─────────────────────────────────────────────────────────────
    async function init() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: GAME_CONFIG.AUDIO.SAMPLE_RATE,
            });
            source = audioContext.createMediaStreamSource(stream);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = GAME_CONFIG.AUDIO.FFT_SIZE;
            analyser.smoothingTimeConstant = GAME_CONFIG.AUDIO.SMOOTHING_TIME_CONSTANT;
            analyser.minDecibels = GAME_CONFIG.AUDIO.MIN_DECIBELS;
            analyser.maxDecibels = GAME_CONFIG.AUDIO.MAX_DECIBELS;
            source.connect(analyser);
            dataArray = new Uint8Array(analyser.fftSize);
            return true;
        } catch (err) {
            console.warn('[AudioProcessor] mic init failed:', err);
            return false;
        }
    }

    function start(callback) {
        if (!analyser) return;
        onVolumeUpdate = callback;
        _running = true;
        _rafId = requestAnimationFrame(_tick);
    }

    function stop() {
        _running = false;
        if (_rafId) cancelAnimationFrame(_rafId);
        _rafId = null;
    }

    function destroy() {
        stop();
        if (stream) stream.getTracks().forEach(t => t.stop());
        if (audioContext) audioContext.close();
        stream = null;
        audioContext = null;
        analyser = null;
        source = null;
    }

    function startCalibration() {
        _calibrating = true;
        _calibrationSamples = [];
        return new Promise(resolve => {
            setTimeout(() => {
                _calibrating = false;
                if (_calibrationSamples.length) {
                    const avg = _calibrationSamples.reduce((a, b) => a + b, 0) / _calibrationSamples.length;
                    _noiseFloor = Math.max(avg + 5, GAME_CONFIG.AUDIO.NOISE_FLOOR_DB);
                }
                resolve(_noiseFloor);
            }, GAME_CONFIG.AUDIO.CALIBRATION_DURATION);
        });
    }

    function getNoiseFloor() { return _noiseFloor; }
    function setNoiseFloor(v) { _noiseFloor = v; }
    function isReady() { return !!analyser; }

    return { init, start, stop, destroy, startCalibration, getNoiseFloor, setNoiseFloor, isReady, dbToSpeed };
})();
