// Laser Dash — high-speed lane runner with shop integration
const LaserDash = (() => {
    const W = 480;
    const H = 720;
    const LANES = 3;
    const LANE_W = W / LANES;
    const PLAYER_Y = H - 110;
    const PLAYER_W = 44;
    const PLAYER_H = 56;
    const SCROLL_BASE = 280;
    const BLINK_COOLDOWN = 2;
    const DILATION_COOLDOWN = 12;
    const DILATION_NORMAL = 0.5;
    const DILATION_CHRONOS = 1.5;
    const INVINCIBLE_TIME = 1;

    let canvas;
    let ctx;
    let gameState = 'idle';
    let animationId = null;
    let lastTime = 0;

    let score;
    let gameSpeed;
    let blinkCooldown;
    let timeDilationCooldown;
    let isTimeDilated;
    let dilationTimer;
    let speedTimer;
    let spawnTimer;
    let tunnelOffset;

    let hasShieldBuffer;
    let hasChronosModule;
    let hasSonicBlast;

    let playerLane;
    let playerY;
    let isBlinking;
    let blinkTimer;
    let invincibleTimer;
    let shieldFlash;
    let obstacles;

    const dashHud = document.getElementById('dashHud');
    const dashScoreEl = document.getElementById('dashScore');
    const dashSpeedEl = document.getElementById('dashSpeed');
    const dashBlinkEl = document.getElementById('dashBlink');
    const dashDilationEl = document.getElementById('dashDilation');
    const dashStartScreen = document.getElementById('dashStartScreen');
    const dashGameOverScreen = document.getElementById('dashGameOverScreen');
    const dashFinalScore = document.getElementById('dashFinalScore');
    const dashHighScoreEl = document.getElementById('dashHighScore');
    const dashStartBtn = document.getElementById('dashStartBtn');
    const dashPlayAgainBtn = document.getElementById('dashPlayAgainBtn');

    function laneX(lane) {
        return lane * LANE_W + LANE_W / 2;
    }

    function resetRunState() {
        score = 0;
        gameSpeed = 1;
        blinkCooldown = 0;
        timeDilationCooldown = 0;
        isTimeDilated = false;
        dilationTimer = 0;
        speedTimer = 0;
        spawnTimer = 0.6;
        tunnelOffset = 0;
        playerLane = 1;
        playerY = PLAYER_Y;
        isBlinking = false;
        blinkTimer = 0;
        invincibleTimer = 0;
        shieldFlash = 0;
        obstacles = [];
    }

    function applyShopDefaults() {
        hasShieldBuffer = false;
        hasChronosModule = false;
        hasSonicBlast = false;

        if (window.ArcadeMeta?.hasEquippedUpgrade?.('dash-shield-buffer')) {
            hasShieldBuffer = true;
        }
        if (window.ArcadeMeta?.hasEquippedUpgrade?.('dash-chronos-module')) {
            hasChronosModule = true;
        }
        if (window.ArcadeMeta?.hasEquippedUpgrade?.('dash-sonic-blast')) {
            hasSonicBlast = true;
        }
    }

    window.LaserDashSetup = {
        enableShieldBuffer: () => { hasShieldBuffer = true; },
        enableChronosModule: () => { hasChronosModule = true; },
        enableSonicBlast: () => { hasSonicBlast = true; }
    };

    function effectiveSpeed() {
        return isTimeDilated ? gameSpeed / 4 : gameSpeed;
    }

    function spawnObstacle() {
        const roll = Math.random();
        if (roll < 0.55) {
            const laneCount = Math.random() < 0.45 ? 2 : 1;
            let lanes;
            if (laneCount === 1) {
                lanes = [Math.floor(Math.random() * LANES)];
            } else {
                lanes = Math.random() < 0.5 ? [0, 1] : [1, 2];
            }
            obstacles.push({
                type: 'laserWall',
                lanes,
                y: -120,
                height: 90
            });
        } else {
            obstacles.push({
                type: 'barrier',
                lane: Math.floor(Math.random() * LANES),
                y: -60,
                height: 28
            });
        }
    }

    function triggerBlink() {
        if (blinkCooldown > 0 || gameState !== 'playing') return;
        isBlinking = true;
        blinkTimer = 0.12;
        blinkCooldown = BLINK_COOLDOWN;
        playerY = PLAYER_Y - 70;
        window.ArcadeSettings?.playSound('powerOn');
    }

    function triggerDilation() {
        if (timeDilationCooldown > 0 || isTimeDilated || gameState !== 'playing') return;
        isTimeDilated = true;
        dilationTimer = hasChronosModule ? DILATION_CHRONOS : DILATION_NORMAL;
        timeDilationCooldown = DILATION_COOLDOWN;
        window.ArcadeSettings?.playSound('collect');
    }

    function triggerSonicBlast() {
        if (!hasSonicBlast || gameState !== 'playing') return;
        obstacles = [];
        hasSonicBlast = false;
        shieldFlash = 0.35;
        window.ArcadeSettings?.playSound('nuke');
    }

    function snapLane(direction) {
        if (direction < 0 && playerLane > 0) playerLane -= 1;
        if (direction > 0 && playerLane < LANES - 1) playerLane += 1;
        window.ArcadeSettings?.playSound('click');
    }

    function playerBox() {
        const cx = laneX(playerLane);
        return {
            x: cx - PLAYER_W / 2,
            y: playerY - PLAYER_H / 2,
            width: PLAYER_W,
            height: PLAYER_H
        };
    }

    function rectsOverlap(a, b) {
        return a.x < b.x + b.width && a.x + a.width > b.x
            && a.y < b.y + b.height && a.y + a.height > b.y;
    }

    function obstacleBoxes(obs) {
        if (obs.type === 'laserWall') {
            return obs.lanes.map(lane => ({
                x: lane * LANE_W + 8,
                y: obs.y,
                width: LANE_W - 16,
                height: obs.height
            }));
        }
        return [{
            x: obs.lane * LANE_W + 12,
            y: obs.y + obs.height - 8,
            width: LANE_W - 24,
            height: 16
        }];
    }

    function handleCollision(obs) {
        if (isBlinking || invincibleTimer > 0) return;

        if (hasShieldBuffer) {
            hasShieldBuffer = false;
            invincibleTimer = INVINCIBLE_TIME;
            shieldFlash = 0.6;
            const idx = obstacles.indexOf(obs);
            if (idx >= 0) obstacles.splice(idx, 1);
            window.ArcadeSettings?.playSound('hit');
            return;
        }

        gameOver();
    }

    function gameOver() {
        gameState = 'gameover';
        const prev = Number(localStorage.getItem('laserDashHighScore') || 0);
        if (score > prev) localStorage.setItem('laserDashHighScore', String(score));
        if (dashFinalScore) dashFinalScore.textContent = `Score: ${score}`;
        if (dashHighScoreEl) dashHighScoreEl.textContent = `Best: ${Math.max(score, prev)}`;
        dashStartScreen?.classList.add('hidden');
        dashGameOverScreen?.classList.remove('hidden');
        window.ArcadeMeta?.onLaserDashEnd?.(score);
        window.ArcadeSettings?.playSound('gameOver');
    }

    function updateHud() {
        if (dashScoreEl) dashScoreEl.textContent = String(score);
        if (dashSpeedEl) dashSpeedEl.textContent = gameSpeed.toFixed(1);
        if (dashBlinkEl) {
            dashBlinkEl.textContent = blinkCooldown > 0 ? `${blinkCooldown.toFixed(1)}s` : 'READY';
        }
        if (dashDilationEl) {
            dashDilationEl.textContent = timeDilationCooldown > 0
                ? `${timeDilationCooldown.toFixed(0)}s`
                : isTimeDilated ? 'ACTIVE' : 'READY';
        }
    }

    function update(delta) {
        if (gameState !== 'playing') return;

        score += 1;
        speedTimer += delta;
        if (speedTimer >= 10) {
            speedTimer -= 10;
            gameSpeed += 0.1;
        }

        if (blinkCooldown > 0) blinkCooldown = Math.max(0, blinkCooldown - delta);
        if (timeDilationCooldown > 0) timeDilationCooldown = Math.max(0, timeDilationCooldown - delta);
        if (invincibleTimer > 0) invincibleTimer = Math.max(0, invincibleTimer - delta);
        if (shieldFlash > 0) shieldFlash = Math.max(0, shieldFlash - delta);

        if (isTimeDilated) {
            dilationTimer -= delta;
            if (dilationTimer <= 0) isTimeDilated = false;
        }

        if (isBlinking) {
            blinkTimer -= delta;
            if (blinkTimer <= 0) {
                isBlinking = false;
                playerY = PLAYER_Y;
            }
        }

        const scroll = SCROLL_BASE * effectiveSpeed() * delta;
        tunnelOffset = (tunnelOffset + scroll * 0.4) % 48;

        spawnTimer -= delta;
        if (spawnTimer <= 0) {
            spawnObstacle();
            spawnTimer = Math.max(0.35, 1.1 - gameSpeed * 0.08);
        }

        for (const obs of obstacles) {
            obs.y += scroll;
        }
        obstacles = obstacles.filter(o => o.y < H + 80);

        if (!isBlinking && invincibleTimer <= 0) {
            const pBox = playerBox();
            for (const obs of [...obstacles]) {
                for (const box of obstacleBoxes(obs)) {
                    if (rectsOverlap(pBox, box)) {
                        handleCollision(obs);
                        if (gameState !== 'playing') return;
                        break;
                    }
                }
            }
        }

        updateHud();
    }

    function drawTunnel() {
        ctx.fillStyle = '#1a0033';
        ctx.fillRect(0, 0, W, H);

        const gridAlpha = isTimeDilated ? 0.35 : 0.18;
        ctx.strokeStyle = `rgba(180, 80, 255, ${gridAlpha})`;
        ctx.lineWidth = 1;
        for (let x = 0; x <= W; x += 48) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
        }
        for (let y = -48 + tunnelOffset; y < H; y += 48) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(0, 255, 255, 0.12)';
        for (let i = 1; i < LANES; i++) {
            const x = i * LANE_W;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
        }

        if (shieldFlash > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${shieldFlash * 0.35})`;
            ctx.fillRect(0, 0, W, H);
        }

        if (isTimeDilated) {
            ctx.fillStyle = 'rgba(0, 255, 255, 0.08)';
            ctx.fillRect(0, 0, W, H);
        }
    }

    function drawObstacles() {
        for (const obs of obstacles) {
            if (obs.type === 'laserWall') {
                for (const lane of obs.lanes) {
                    const x = lane * LANE_W + 8;
                    ctx.fillStyle = 'rgba(255, 40, 60, 0.25)';
                    ctx.fillRect(x, obs.y, LANE_W - 16, obs.height);
                    ctx.strokeStyle = '#ff2244';
                    ctx.lineWidth = 2;
                    ctx.shadowColor = '#ff2244';
                    ctx.shadowBlur = 12;
                    for (let gy = obs.y; gy < obs.y + obs.height; gy += 14) {
                        ctx.beginPath();
                        ctx.moveTo(x, gy);
                        ctx.lineTo(x + LANE_W - 16, gy);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(x + (gy - obs.y) % 20, obs.y);
                        ctx.lineTo(x + (gy - obs.y) % 20, obs.y + obs.height);
                        ctx.stroke();
                    }
                    ctx.shadowBlur = 0;
                }
            } else {
                const x = obs.lane * LANE_W + 12;
                const y = obs.y + obs.height - 8;
                ctx.fillStyle = 'rgba(255, 140, 40, 0.35)';
                ctx.fillRect(x, y, LANE_W - 24, 16);
                ctx.strokeStyle = '#ff8833';
                ctx.lineWidth = 3;
                ctx.shadowColor = '#ff8833';
                ctx.shadowBlur = 14;
                ctx.strokeRect(x, y, LANE_W - 24, 16);
                ctx.shadowBlur = 0;
            }
        }
    }

    function drawPlayer() {
        const cx = laneX(playerLane);
        const color = invincibleTimer > 0 ? '#74d2ff' : isBlinking ? '#ffe66d' : '#00ffcc';
        ctx.save();
        ctx.translate(cx, playerY);
        ctx.shadowColor = color;
        ctx.shadowBlur = isBlinking ? 24 : 16;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -PLAYER_H / 2);
        ctx.lineTo(PLAYER_W / 2, PLAYER_H / 2);
        ctx.lineTo(-PLAYER_W / 2, PLAYER_H / 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);
        drawTunnel();
        drawObstacles();
        drawPlayer();
    }

    function gameLoop(timestamp) {
        if (gameState !== 'playing') return;
        const delta = Math.min((timestamp - lastTime) / 1000, 0.033);
        lastTime = timestamp;
        window.ArcadeMeta?.tickPlayTime?.(delta);
        update(delta);
        draw();
        animationId = requestAnimationFrame(gameLoop);
    }

    function startGame() {
        resetRunState();
        applyShopDefaults();
        gameState = 'playing';
        dashStartScreen?.classList.add('hidden');
        dashGameOverScreen?.classList.add('hidden');
        lastTime = performance.now();
        animationId = requestAnimationFrame(gameLoop);
    }

    function open(targetCanvas, targetCtx) {
        canvas = targetCanvas;
        ctx = targetCtx;
        canvas.width = W;
        canvas.height = H;
        gameState = 'idle';
        resetRunState();
        applyShopDefaults();
        const best = localStorage.getItem('laserDashHighScore') || '0';
        if (dashHighScoreEl) dashHighScoreEl.textContent = `Best: ${best}`;
        dashHud?.classList.remove('hidden');
        dashStartScreen?.classList.remove('hidden');
        dashGameOverScreen?.classList.add('hidden');
        draw();
    }

    function stop() {
        gameState = 'idle';
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        dashHud?.classList.add('hidden');
        dashStartScreen?.classList.add('hidden');
        dashGameOverScreen?.classList.add('hidden');
        keys = {};
        keysJustPressed = {};
    }

    function handleKey(e, isDown) {
        if (gameState !== 'playing') return;

        const laneKeys = ['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'];
        const actionKeys = ['Space', 'ShiftLeft', 'ShiftRight', 'KeyW', 'ArrowUp'];

        if (laneKeys.includes(e.code) || actionKeys.includes(e.code)) {
            if (isDown) e.preventDefault();
        }

        if (!isDown) return;

        if (e.code === 'ArrowLeft' || e.code === 'KeyA') snapLane(-1);
        if (e.code === 'ArrowRight' || e.code === 'KeyD') snapLane(1);
        if (e.code === 'Space') triggerBlink();
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') triggerDilation();
        if (e.code === 'KeyW' || e.code === 'ArrowUp') triggerSonicBlast();
    }

    dashStartBtn?.addEventListener('click', startGame);
    dashPlayAgainBtn?.addEventListener('click', startGame);

    return { open, stop, handleKey };
})();
