// gameEngine.js - 3D Perspective Endless Hallway + gendered runner

const GameEngine = (() => {
    // ── State ──────────────────────────────────────────────────────────────────
    let canvas, ctx;
    let _running = false;
    let _rafId = null;
    let _lastTime = 0;

    // Physics
    let _speed = 0;       // km/h (current smoothed)
    let _targetSpeed = 0; // km/h (set by audio)
    let _distance = 0;    // metres
    let _silenceMs = 0;

    // Session stats
    let _maxSpeed = 0;
    let _dbSamples = [];
    let _screamMs = 0;
    let _lastDb = 0; // for real-time visual pulse

    // Callbacks
    let _onGameOver = null;
    let _onTick = null;

    // Character
    let _gender = 'boy'; // 'boy' | 'girl'

    // ── Hallway perspective constants ──────────────────────────────────────────
    const HALL_SEGS = 20;       // number of "tiles" visible ahead
    let hallOffset = 0;       // 0..1 continuous scroll offset

    // Colour palette for hallway
    const C = {
        wallL: '#1a0a2e',
        wallR: '#1a0a2e',
        floorNear: '#0d0d20',
        floorFar: '#160830',
        ceilNear: '#100820',
        ceilFar: '#0a0510',
        neonL: '#4ecdc4',
        neonR: '#ff6b6b',
        neonFloor: '#c77dff',
        neonLine: 'rgba(200,180,255,0.18)',
        tile1: 'rgba(30,10,60,0.9)',
        tile2: 'rgba(20,5,40,0.9)',
        light: '#ffe66d',
    };

    // ── Helpers ────────────────────────────────────────────────────────────────
    function W() { return canvas.width; }
    function H() { return canvas.height; }
    function lerp(a, b, t) { return a + (b - a) * t; }

    // Convert a "depth" (0=near, 1=far) + hallway coords to screen coords.
    // Hallway vanishing point is at horizon (h=0.45*H), center horizontally.
    function hallProject(normX, normY, depth) {
        const vx = W() * 0.5;
        const vy = H() * 0.44;
        const halfW = W() * 0.46;
        const halfH = H() * 0.44;
        // Perspective: objects shrink toward (vx,vy) with depth
        const t = Math.pow(depth, 0.9); // slight ease for nicer perspective
        return {
            x: vx + (normX - 0) * halfW * (1 - t),
            y: vy + normY * halfH * (1 - t),
        };
    }

    // ── Hallway renderer ───────────────────────────────────────────────────────
    function drawHallway(dt) {
        const w = W(), h = H();

        // ── 0. Camera Shake at High Speed ──────────────────────────────────────
        ctx.save();
        if (_speed > 80) {
            const shake = (_speed / 120) * 3.5;
            ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        }

        // Scroll offset advances with speed (8x faster than original 0.9)
        const scrollRate = (_speed / GAME_CONFIG.AUDIO.MAX_SPEED) * 7.2;
        hallOffset = (hallOffset + scrollRate * dt) % 1;

        const dbPulse = Math.max(0, (_lastDb - 30) / 70); // 0..1 range for loud sounds
        const speedRatio = Math.min(_speed / GAME_CONFIG.AUDIO.MAX_SPEED, 1);

        // ── 1. Sky/wall background ──────────────────────────────────────────────
        const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
        bgGrad.addColorStop(0, '#020005');
        bgGrad.addColorStop(1, '#0e041a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // ── 1b. Vanishing Point Bloom ───────────────────────────────────────────
        const vx = w * 0.5, vy = h * 0.44;
        const bloomRadius = h * (0.12 + speedRatio * 0.45 + dbPulse * 0.25);
        const bloomGrad = ctx.createRadialGradient(vx, vy, 0, vx, vy, bloomRadius);
        bloomGrad.addColorStop(0, `rgba(220, 150, 255, ${0.25 + speedRatio * 0.4 + dbPulse * 0.3})`);
        bloomGrad.addColorStop(0.3, `rgba(130, 80, 240, ${0.12 + speedRatio * 0.15})`);
        bloomGrad.addColorStop(1, 'rgba(40, 0, 100, 0)');
        ctx.fillStyle = bloomGrad;
        ctx.fillRect(0, 0, w, h);

        // ── 1c. Speed Warp Streaks ──────────────────────────────────────────────
        if (_speed > 20) {
            const streakCount = Math.floor(speedRatio * 15);
            ctx.lineWidth = 1.5;
            for (let i = 0; i < streakCount; i++) {
                // Pseudo-random based on index and time
                const seed = i * 1.57 + performance.now() * 0.002;
                const angle = seed % (Math.PI * 2);
                const distOffset = (seed * 0.3) % 1; // 0..1 depth
                const p1 = hallProject(Math.cos(angle) * 4, Math.sin(angle) * 4, 1 - distOffset);
                const p2 = hallProject(Math.cos(angle) * 4.5, Math.sin(angle) * 4.5, 1 - distOffset - 0.1);

                const streakGrad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
                streakGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
                streakGrad.addColorStop(0.5, `rgba(100, 200, 255, ${speedRatio * 0.6})`);
                streakGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.strokeStyle = streakGrad;
                ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
            }
        }

        // ── 2. Draw floor & ceiling trapezoids ──────────────────────────────────
        // Far-near left/right walls use projected corners
        const corners = {
            tFL: hallProject(-1, -1, 1),  // top-far-left
            tFR: hallProject(1, -1, 1),  // top-far-right
            bFL: hallProject(-1, 1, 1),  // bot-far-left
            bFR: hallProject(1, 1, 1),  // bot-far-right
            tNL: hallProject(-1, -1, 0),  // top-near-left
            tNR: hallProject(1, -1, 0),  // top-near-right
            bNL: hallProject(-1, 1, 0),  // bot-near-left
            bNR: hallProject(1, 1, 0),  // bot-near-right
        };

        // Ceiling
        {
            const grad = ctx.createLinearGradient(0, corners.tFL.y, 0, corners.tNL.y);
            grad.addColorStop(0, C.ceilFar);
            grad.addColorStop(1, C.ceilNear);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(corners.tNL.x, corners.tNL.y);
            ctx.lineTo(corners.tNR.x, corners.tNR.y);
            ctx.lineTo(corners.tFL.x, corners.tFL.y);
            ctx.lineTo(corners.tFR.x, corners.tFR.y);
            ctx.fill();
        }

        // Floor
        {
            const grad = ctx.createLinearGradient(0, corners.bFL.y, 0, corners.bNL.y);
            grad.addColorStop(0, C.floorFar);
            grad.addColorStop(1, C.floorNear);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(corners.bNL.x, corners.bNL.y);
            ctx.lineTo(corners.bNR.x, corners.bNR.y);
            ctx.lineTo(corners.bFL.x, corners.bFL.y);
            ctx.lineTo(corners.bFR.x, corners.bFR.y);
            ctx.fill();
        }

        // Left wall
        {
            const grad = ctx.createLinearGradient(corners.tFL.x, 0, corners.tNL.x, 0);
            grad.addColorStop(0, '#090520');
            grad.addColorStop(1, '#14093a');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(corners.tNL.x, corners.tNL.y);
            ctx.lineTo(corners.bNL.x, corners.bNL.y);
            ctx.lineTo(corners.bFL.x, corners.bFL.y);
            ctx.lineTo(corners.tFL.x, corners.tFL.y);
            ctx.fill();
        }

        // Right wall
        {
            const grad = ctx.createLinearGradient(corners.tNR.x, 0, corners.tFR.x, 0);
            grad.addColorStop(0, '#14093a');
            grad.addColorStop(1, '#090520');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(corners.tNR.x, corners.tNR.y);
            ctx.lineTo(corners.bNR.x, corners.bNR.y);
            ctx.lineTo(corners.bFR.x, corners.bFR.y);
            ctx.lineTo(corners.tFR.x, corners.tFR.y);
            ctx.fill();
        }

        // ── 3. Perspective grid lines on floor & ceiling ────────────────────────
        const GRID_LINES = 10;
        const pulseWidth = 1 + dbPulse * 3;
        ctx.strokeStyle = `rgba(200,180,255,${0.18 + dbPulse * 0.4})`;
        ctx.lineWidth = pulseWidth;

        for (let i = 0; i <= GRID_LINES; i++) {
            const tx = lerp(-1, 1, i / GRID_LINES);
            // Floor vertical lines
            const fNear = hallProject(tx, 1, 0);
            const fFar = hallProject(tx, 1, 1);
            ctx.beginPath(); ctx.moveTo(fNear.x, fNear.y); ctx.lineTo(fFar.x, fFar.y); ctx.stroke();
            // Ceiling vertical lines
            const cNear = hallProject(tx, -1, 0);
            const cFar = hallProject(tx, -1, 1);
            ctx.beginPath(); ctx.moveTo(cNear.x, cNear.y); ctx.lineTo(cFar.x, cFar.y); ctx.stroke();
        }

        // Horizontal floor tiles (scroll with offset)
        for (let i = 0; i <= GRID_LINES; i++) {
            const rawT = ((i / GRID_LINES) + hallOffset) % 1;
            const ty = lerp(-1, 1, rawT);
            const lNear = hallProject(-1, ty, rawT);
            const rNear = hallProject(1, ty, rawT);
            ctx.beginPath(); ctx.moveTo(lNear.x, lNear.y); ctx.lineTo(rNear.x, rNear.y); ctx.stroke();
            // Ceiling
            const lyC = lerp(-1, 1, rawT) * -1;
            const clN = hallProject(-1, lyC, rawT);
            const crN = hallProject(1, lyC, rawT);
            ctx.beginPath(); ctx.moveTo(clN.x, clN.y); ctx.lineTo(crN.x, crN.y); ctx.stroke();
        }

        // ── 4. Neon strip lights along walls (Audio-reactive Pulse) ─────────────
        const flare = 1 + dbPulse * 2.5;
        drawNeonStrip(corners.tNL, corners.tFL, C.neonL, 2 * flare, 10 + dbPulse * 20);   // left top
        drawNeonStrip(corners.bNL, corners.bFL, C.neonL, 1.5 * flare, 8 + dbPulse * 15); // left bottom
        drawNeonStrip(corners.tNR, corners.tFR, C.neonR, 2 * flare, 10 + dbPulse * 20);   // right top
        drawNeonStrip(corners.bNR, corners.bFR, C.neonR, 1.5 * flare, 8 + dbPulse * 15); // right bottom

        // ── 4b. Wall Circuit Details ───────────────────────────────────────────
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(255,255,255,${0.05 + speedRatio * 0.1})`;
        for (let j = 0; j < 3; j++) {
            const sideY = -0.5 + j * 0.5;
            const lNear = hallProject(-1, sideY, hallOffset);
            const lFar = hallProject(-1, sideY, 1);
            ctx.beginPath(); ctx.moveTo(lNear.x, lNear.y); ctx.lineTo(lFar.x, lFar.y); ctx.stroke();
            const rNear = hallProject(1, sideY, hallOffset);
            const rFar = hallProject(1, sideY, 1);
            ctx.beginPath(); ctx.moveTo(rNear.x, rNear.y); ctx.lineTo(rFar.x, rFar.y); ctx.stroke();
        }

        // ── 5. Ceiling lamps ────────────────────────────────────────────────────
        drawCeilingLamps(corners, dt);

        // ── 6. Speed glow vignette (tunnel-rush feeling) ─────────────────────────
        if (_speed > 10) {
            const alpha = Math.min(_speed / GAME_CONFIG.AUDIO.MAX_SPEED * 0.55, 0.55);
            const vGrad = ctx.createRadialGradient(w / 2, h / 2, h * 0.05, w / 2, h / 2, h * 0.75);
            vGrad.addColorStop(0, 'rgba(0,0,0,0)');
            vGrad.addColorStop(1, `rgba(255,107,107,${alpha.toFixed(2)})`);
            ctx.fillStyle = vGrad;
            ctx.fillRect(0, 0, w, h);
        }

        ctx.restore(); // end camera shake
    }

    function drawNeonStrip(near, far, color, lw, blur) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = blur;
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(near.x, near.y);
        ctx.lineTo(far.x, far.y);
        ctx.stroke();
        ctx.restore();
    }

    function drawCeilingLamps(corners, dt) {
        const LAMP_COUNT = 6;
        ctx.save();
        for (let i = 0; i < LAMP_COUNT; i++) {
            const rawDepth = ((i / LAMP_COUNT) + hallOffset * 0.5) % 1;
            const lampPos = hallProject(0, -0.92, rawDepth);
            const radius = lerp(18, 2, rawDepth);
            const alpha = lerp(0.9, 0.2, rawDepth);
            ctx.shadowColor = C.light;
            ctx.shadowBlur = 24 * (1 - rawDepth);
            const glowGrad = ctx.createRadialGradient(lampPos.x, lampPos.y, 0, lampPos.x, lampPos.y, radius * 3);
            glowGrad.addColorStop(0, `rgba(255,230,109,${(alpha * 0.4).toFixed(2)})`);
            glowGrad.addColorStop(1, 'rgba(255,230,109,0)');
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.arc(lampPos.x, lampPos.y, radius * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(255,230,109,${alpha.toFixed(2)})`;
            ctx.beginPath();
            ctx.arc(lampPos.x, lampPos.y, Math.max(radius, 1.5), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // ── Character (boy / girl) ─────────────────────────────────────────────────
    let _runFrame = 0;
    let _runFrameTimer = 0;
    const FRAMES = 8;

    function drawCharacter() {
        const w = W(), h = H();
        const baseX = w * 0.5;
        const baseY = h * 0.79;      // feet sit on the floor perspective
        const sc = h * 0.21;         // much larger so character is clearly visible

        const phase = (_runFrame / FRAMES) * Math.PI * 2;
        const speedFactor = Math.min(_speed / GAME_CONFIG.AUDIO.MAX_SPEED, 1);

        // Bobbing: vertical oscillation based on run phase
        const bob = Math.abs(Math.cos(phase)) * sc * 0.04;
        // Lean: forward tilt based on speed
        const lean = speedFactor * 0.12;

        ctx.save();
        ctx.translate(baseX, baseY - bob);
        ctx.rotate(lean);

        // Ground shadow oval
        ctx.save();
        ctx.globalAlpha = 0.38;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(0, 4, sc * 0.28, sc * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();

        // Speed motion-blur lines (Juiced Up)
        if (_speed > 12) {
            const lineAlpha = Math.min(speedFactor * 0.85, 0.85);
            const lineCount = _speed > 60 ? 8 : 4;
            ctx.strokeStyle = `rgba(78,205,196,${lineAlpha.toFixed(2)})`;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            for (let i = 0; i < lineCount; i++) {
                const seed = (i * 0.77 + performance.now() * 0.01);
                const len = 40 + speedFactor * 120 + Math.sin(seed) * 20;
                const ly = -sc * (0.15 + i * 0.12);
                const lx = -sc * 0.45 - (seed % 30); // staggered
                ctx.beginPath();
                ctx.moveTo(lx, ly);
                ctx.lineTo(lx - len, ly);
                ctx.stroke();

                // Tiny spark at the end of some lines
                if (_speed > 70 && i % 2 === 0) {
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.arc(lx - len, ly, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        if (_gender === 'girl') {
            drawGirl(sc, phase, speedFactor);
        } else {
            drawBoy(sc, phase, speedFactor);
        }

        ctx.restore();
    }

    function drawBoy(s, phase, spd) {
        const bodyColor = '#4a90d9';
        const skinColor = '#f5c5a3';
        const hairColor = '#3d2314';
        const pantsColor = '#2c3e6a';
        const glowColor = '#4ecdc4';

        ctx.save();
        // ── Glow pass (drawn slightly larger, blurred)
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 18;

        // Legs: Thigh -> Shin -> Foot
        const stride = phase;
        ctx.lineCap = 'round';
        ctx.lineWidth = s * 0.14;

        // Left Leg - Moved up to -0.42s to attach to torso
        drawLeg(0, -s * 0.42, stride, pantsColor, bodyColor, s);
        // Right Leg
        drawLeg(0, -s * 0.42, stride + Math.PI, pantsColor, bodyColor, s);

        function drawLeg(x, y, p, pColor, bColor, scale) {
            const angle1 = Math.sin(p) * 0.6; // Thigh angle
            const angle2 = Math.cos(p) * 0.5 + 0.5; // Knee bend (0 to 1 rad)

            const thighLen = scale * 0.35;
            const shinLen = scale * 0.32;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle1);

            // Thigh
            ctx.strokeStyle = pColor;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, thighLen);
            ctx.stroke();

            // Shin
            ctx.translate(0, thighLen);
            ctx.rotate(angle2);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, shinLen);
            ctx.stroke();

            // Foot/Shoe (White sneaker)
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.ellipse(scale * 0.08, shinLen, scale * 0.12, scale * 0.05, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Torso (jacket)
        ctx.shadowBlur = 10;
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.roundRect(-s * 0.18, -s * 0.9, s * 0.36, s * 0.48, 6);
        ctx.fill();
        ctx.strokeStyle = '#6aaff5';
        ctx.lineWidth = s * 0.025;
        ctx.stroke();

        // Arms
        const laA = Math.sin(phase + Math.PI) * 0.6 * (0.3 + spd * 0.7);
        const raA = Math.sin(phase) * 0.6 * (0.3 + spd * 0.7);
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = s * 0.12;
        ctx.beginPath();
        ctx.moveTo(-s * 0.18, -s * 0.8);
        ctx.lineTo(-s * 0.18 + Math.sin(laA) * s * 0.3, -s * 0.8 + Math.cos(laA) * s * 0.38);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s * 0.18, -s * 0.8);
        ctx.lineTo(s * 0.18 + Math.sin(raA) * s * 0.3, -s * 0.8 + Math.cos(raA) * s * 0.38);
        ctx.stroke();

        // Head
        ctx.shadowBlur = 6;
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.arc(0, -s * 1.07, s * 0.24, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200,160,120,0.4)';
        ctx.lineWidth = s * 0.02;
        ctx.stroke();

        // Hair
        ctx.shadowBlur = 0;
        ctx.fillStyle = hairColor;
        ctx.beginPath();
        ctx.arc(0, -s * 1.19, s * 0.24, Math.PI, 0);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(s * 0.09, -s * 1.06, s * 0.075, s * 0.065, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(s * 0.11, -s * 1.06, s * 0.036, 0, Math.PI * 2);
        ctx.fill();
        // pupil shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(s * 0.125, -s * 1.075, s * 0.012, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function drawGirl(s, phase, spd) {
        const bodyColor = '#ff6b9d';
        const skirtColor = '#c44d82';
        const skinColor = '#f5c5a3';
        const hairColor = '#c0392b';
        const legColor = '#dda0dd';
        const glowColor = '#ff6b9d';

        ctx.save();
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 18;

        // Legs
        const stride = phase;
        ctx.lineCap = 'round';
        ctx.lineWidth = s * 0.12;
        // Girl has purple-ish stockings/legs
        drawGirlLeg(0, s * 0.05, stride, legColor, s);
        drawGirlLeg(0, s * 0.05, stride + Math.PI, legColor, s);

        function drawGirlLeg(x, y, p, color, scale) {
            const angle1 = Math.sin(p) * 0.5;
            const angle2 = Math.cos(p) * 0.4 + 0.4;
            const thighLen = scale * 0.32;
            const shinLen = scale * 0.3;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle1);
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, thighLen);
            ctx.stroke();

            ctx.translate(0, thighLen);
            ctx.rotate(angle2);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, shinLen);
            ctx.stroke();

            // Foot (Pink flat)
            ctx.fillStyle = '#ffb3ba';
            ctx.beginPath();
            ctx.ellipse(scale * 0.06, shinLen, scale * 0.1, scale * 0.04, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Skirt — trapezoid with outline
        ctx.shadowBlur = 8;
        ctx.fillStyle = skirtColor;
        ctx.beginPath();
        ctx.moveTo(-s * 0.22, -s * 0.42);
        ctx.lineTo(-s * 0.34, s * 0.12);
        ctx.lineTo(s * 0.34, s * 0.12);
        ctx.lineTo(s * 0.22, -s * 0.42);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#e06090';
        ctx.lineWidth = s * 0.022;
        ctx.stroke();

        // Torso
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.roundRect(-s * 0.17, -s * 0.9, s * 0.34, s * 0.5, 6);
        ctx.fill();
        ctx.strokeStyle = '#ff8fb8';
        ctx.lineWidth = s * 0.022;
        ctx.stroke();

        // Arms
        const laA = Math.sin(phase + Math.PI) * 0.55 * (0.3 + spd * 0.7);
        const raA = Math.sin(phase) * 0.55 * (0.3 + spd * 0.7);
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = s * 0.11;
        ctx.beginPath();
        ctx.moveTo(-s * 0.17, -s * 0.78);
        ctx.lineTo(-s * 0.17 + Math.sin(laA) * s * 0.28, -s * 0.78 + Math.cos(laA) * s * 0.34);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s * 0.17, -s * 0.78);
        ctx.lineTo(s * 0.17 + Math.sin(raA) * s * 0.28, -s * 0.78 + Math.cos(raA) * s * 0.34);
        ctx.stroke();

        // Head
        ctx.shadowBlur = 6;
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.arc(0, -s * 1.07, s * 0.23, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200,160,120,0.4)';
        ctx.lineWidth = s * 0.02;
        ctx.stroke();

        // Hair
        ctx.shadowBlur = 0;
        ctx.fillStyle = hairColor;
        ctx.beginPath();
        ctx.arc(0, -s * 1.19, s * 0.23, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = hairColor;
        ctx.beginPath();
        ctx.ellipse(-s * 0.23, -s * 0.97, s * 0.08, s * 0.22, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(s * 0.23, -s * 0.97, s * 0.08, s * 0.22, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Bow
        ctx.fillStyle = '#ffe66d';
        ctx.beginPath();
        ctx.ellipse(-s * 0.11, -s * 1.32, s * 0.10, s * 0.07, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(s * 0.11, -s * 1.32, s * 0.10, s * 0.07, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(0, -s * 1.32, s * 0.05, 0, Math.PI * 2);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(s * 0.08, -s * 1.06, s * 0.075, s * 0.065, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(s * 0.10, -s * 1.06, s * 0.036, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(s * 0.115, -s * 1.075, s * 0.012, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // ── Game loop ──────────────────────────────────────────────────────────────
    function _frame(timestamp) {
        if (!_running) return;
        const dt = Math.min((timestamp - _lastTime) / 1000, 0.05);
        _lastTime = timestamp;

        // Physics
        _speed = lerp(_speed, _targetSpeed, 0.13);
        if (_speed < 0.4) _speed = 0;

        if (_targetSpeed === 0) {
            _silenceMs += dt * 1000;
        } else {
            _silenceMs = 0;
            _screamMs += dt * 1000;
        }

        // Distance (km/h → m/s → m)
        const mps = _speed / 3.6;
        _distance += mps * dt * GAME_CONFIG.GAME.DISTANCE_MULTIPLIER;
        _maxSpeed = Math.max(_maxSpeed, _speed);

        // Runner animation frame (16x faster than original 0.5 + speed/30)
        if (_speed > 1) {
            _runFrameTimer += dt * (8.0 + _speed * 0.533);
            if (_runFrameTimer >= 1) { _runFrameTimer = 0; _runFrame = (_runFrame + 1) % FRAMES; }
        }

        // Draw
        drawHallway(dt);
        drawCharacter();

        if (_onTick) _onTick(_speed, _distance, dt);

        // End on silence — stop almost immediately (1.2 s grace, but only after > 2 m)
        const timeout = _distance > 2 ? 1200 : GAME_CONFIG.GAME.SESSION_TIMEOUT_MS;
        if (_silenceMs >= timeout && _distance > 0) {
            endGame();
            return;
        }

        _rafId = requestAnimationFrame(_frame);
    }

    // ── Public API ─────────────────────────────────────────────────────────────
    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }

    function resizeCanvas() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }

    function startGame(gender, onTick, onGameOver) {
        _gender = gender || 'boy';
        _running = true;
        _speed = 0; _targetSpeed = 0; _distance = 0; _maxSpeed = 0;
        _silenceMs = 0; _screamMs = 0; _dbSamples = [];
        _runFrame = 0; _runFrameTimer = 0;
        hallOffset = 0;
        _onTick = onTick; _onGameOver = onGameOver;
        _lastTime = performance.now();

        // Critical: force canvas resize after the game container is shown
        // This fixes the 0x0 size issue when display:none is swapped to active
        setTimeout(() => resizeCanvas(), 50);

        _rafId = requestAnimationFrame(_frame);
    }

    function stopGame() {
        _running = false;
        if (_rafId) cancelAnimationFrame(_rafId);
        _rafId = null;
    }

    function endGame() {
        stopGame();
        const avgDb = _dbSamples.length
            ? _dbSamples.reduce((a, b) => a + b, 0) / _dbSamples.length : 0;
        if (_onGameOver) _onGameOver({
            distance: Math.round(_distance),
            maxSpeed: Math.round(_maxSpeed),
            avgDb: Math.round(avgDb * 10) / 10,
            screamMs: Math.round(_screamMs),
        });
    }

    function setTargetSpeed(speed) {
        _targetSpeed = Math.max(0, Math.min(speed, GAME_CONFIG.AUDIO.MAX_SPEED));
    }

    function pushDbSample(db) {
        _lastDb = db;
        if (db > GAME_CONFIG.AUDIO.NOISE_FLOOR_DB) _dbSamples.push(db);
    }

    function getDistance() { return _distance; }
    function getSpeed() { return _speed; }
    function isRunning() { return _running; }

    return { init, startGame, stopGame, endGame, setTargetSpeed, pushDbSample, getDistance, getSpeed, isRunning };
})();
