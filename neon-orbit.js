// Neon Orbit — 360° circular brick-breaker
const NeonOrbit = (() => {
    const SIZE = 700;
    const CX = SIZE / 2;
    const CY = SIZE / 2;
    const R_TRACK = 296;
    const R_PERIM = 312;
    const R_CORE = 26;
    const PADDLE_ARC = 0.52;
    const PADDLE_ROT_SPEED = 2.6;
    const BALL_R = 7;
    const BALL_SPEED = 360;
    const BLOCK_DRIFT = 22;
    const BLOCK_DANGER_R = 278;

    const SHAPES = ['triangle', 'square', 'hex'];
    const COLORS = ['#00ffcc', '#ff4d8d', '#ffe66d', '#74d2ff', '#b388ff'];

    let canvas;
    let ctx;
    let gameState = 'idle';
    let animationId = null;
    let lastTime = 0;
    let keys = {};

    let paddleAngle;
    let balls;
    let blocks;
    let score;
    let lives;
    let wave;
    let corePulse;
    let coreLaunchTimer;
    let multiballCooldown;
    let laserGateActive;
    let laserFlash;

    const orbitHud = document.getElementById('orbitHud');
    const orbitScoreEl = document.getElementById('orbitScore');
    const orbitLivesEl = document.getElementById('orbitLives');
    const orbitWaveEl = document.getElementById('orbitWave');
    const orbitStartScreen = document.getElementById('orbitStartScreen');
    const orbitGameOverScreen = document.getElementById('orbitGameOverScreen');
    const orbitFinalScore = document.getElementById('orbitFinalScore');
    const orbitHighScoreEl = document.getElementById('orbitHighScore');
    const orbitStartBtn = document.getElementById('orbitStartBtn');
    const orbitPlayAgainBtn = document.getElementById('orbitPlayAgainBtn');

    function hasUpgrade(id) {
        return window.ArcadeMeta?.hasEquippedUpgrade?.(id) || false;
    }

    function angleDiff(a, b) {
        let d = a - b;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return d;
    }

    function resetGame() {
        paddleAngle = -Math.PI / 2;
        balls = [];
        blocks = [];
        score = 0;
        lives = 3;
        wave = 1;
        corePulse = 0;
        coreLaunchTimer = 0.8;
        multiballCooldown = 0;
        laserGateActive = hasUpgrade('orbit-laser-gate');
        laserFlash = 0;
        spawnWave();
        launchBall(paddleAngle + Math.PI + (Math.random() - 0.5) * 0.4);
    }

    function spawnWave() {
        const count = 10 + wave * 3;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 90 + Math.random() * (R_TRACK - 150);
            blocks.push({
                angle,
                radius,
                size: 14 + Math.random() * 8,
                hp: 1 + Math.floor(wave / 3),
                shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
                color: COLORS[Math.floor(Math.random() * COLORS.length)]
            });
        }
    }

    function launchBall(angle, speed = BALL_SPEED) {
        balls.push({
            x: CX + Math.cos(angle) * (R_CORE + 8),
            y: CY + Math.sin(angle) * (R_CORE + 8),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            stuck: false
        });
    }

    function blockXY(block) {
        return {
            x: CX + Math.cos(block.angle) * block.radius,
            y: CY + Math.sin(block.angle) * block.radius
        };
    }

    function releaseStuckBall(ball) {
        if (!ball.stuck) return;
        ball.stuck = false;
        const launchAngle = paddleAngle + Math.PI;
        ball.vx = Math.cos(launchAngle) * BALL_SPEED;
        ball.vy = Math.sin(launchAngle) * BALL_SPEED;
        window.ArcadeSettings?.playSound('click');
    }

    function triggerMultiball() {
        if (!hasUpgrade('orbit-multi-ball') || multiballCooldown > 0) return;
        const source = balls.filter(b => !b.stuck);
        if (!source.length) return;

        multiballCooldown = 22;
        const newBalls = [];
        for (const ball of source) {
            const speed = Math.hypot(ball.vx, ball.vy) || BALL_SPEED;
            const base = Math.atan2(ball.vy, ball.vx);
            for (const offset of [-0.28, 0, 0.28]) {
                newBalls.push({
                    x: ball.x,
                    y: ball.y,
                    vx: Math.cos(base + offset) * speed,
                    vy: Math.sin(base + offset) * speed,
                    stuck: false
                });
            }
        }
        balls = newBalls;
        window.ArcadeSettings?.playSound('powerOn');
    }

    function useLaserGate(ball) {
        if (!laserGateActive) return false;
        laserGateActive = false;
        laserFlash = 0.5;
        const angle = Math.atan2(ball.y - CY, ball.x - CX);
        const speed = Math.hypot(ball.vx, ball.vy) || BALL_SPEED;
        ball.x = CX + Math.cos(angle) * (R_TRACK - 30);
        ball.y = CY + Math.sin(angle) * (R_TRACK - 30);
        ball.vx = -Math.cos(angle) * speed;
        ball.vy = -Math.sin(angle) * speed;
        window.ArcadeSettings?.playSound('collect');
        return true;
    }

    function loseLife() {
        lives -= 1;
        if (lives <= 0) {
            endGame();
            return;
        }
        balls = balls.filter(b => b.stuck);
        if (!balls.length) launchBall(paddleAngle + Math.PI);
        window.ArcadeSettings?.playSound('hit');
    }

    function endGame() {
        gameState = 'gameover';
        const prev = Number(localStorage.getItem('neonOrbitHighScore') || 0);
        if (score > prev) localStorage.setItem('neonOrbitHighScore', String(score));
        if (orbitFinalScore) orbitFinalScore.textContent = `Score: ${score}`;
        if (orbitHighScoreEl) orbitHighScoreEl.textContent = `Best: ${Math.max(score, prev)}`;
        orbitStartScreen?.classList.add('hidden');
        orbitGameOverScreen?.classList.remove('hidden');
        window.ArcadeMeta?.onNeonOrbitEnd?.(score, wave);
        window.ArcadeSettings?.playSound('gameOver');
    }

    function updatePaddle(delta) {
        if (keys.ArrowLeft || keys.KeyA) paddleAngle -= PADDLE_ROT_SPEED * delta;
        if (keys.ArrowRight || keys.KeyD) paddleAngle += PADDLE_ROT_SPEED * delta;
    }

    function handlePaddleHit(ball) {
        const dx = ball.x - CX;
        const dy = ball.y - CY;
        const dist = Math.hypot(dx, dy) || 1;
        const ballAngle = Math.atan2(dy, dx);
        const diff = angleDiff(ballAngle, paddleAngle);

        if (Math.abs(diff) > PADDLE_ARC / 2 + 0.08) return false;
        if (dist < R_TRACK - 28 || dist > R_TRACK + 16) return false;

        const nx = dx / dist;
        const ny = dy / dist;
        const speed = Math.hypot(ball.vx, ball.vy) || BALL_SPEED;
        const vDot = ball.vx * nx + ball.vy * ny;

        if (vDot > 0) {
            ball.vx -= 2 * vDot * nx;
            ball.vy -= 2 * vDot * ny;
        }

        const english = diff / (PADDLE_ARC / 2);
        const tx = -ny;
        const ty = nx;
        ball.vx += tx * english * 140;
        ball.vy += ty * english * 140;

        const newSpeed = Math.hypot(ball.vx, ball.vy) || 1;
        ball.vx = (ball.vx / newSpeed) * speed;
        ball.vy = (ball.vy / newSpeed) * speed;

        ball.x = CX + nx * (R_TRACK - 20);
        ball.y = CY + ny * (R_TRACK - 20);

        if (hasUpgrade('orbit-sticky-paddle')) {
            ball.stuck = true;
        }

        window.ArcadeSettings?.playSound('click');
        return true;
    }

    function updateBalls(delta) {
        for (let bi = balls.length - 1; bi >= 0; bi--) {
            const ball = balls[bi];

            if (ball.stuck) {
                const r = R_TRACK - 18;
                ball.x = CX + Math.cos(paddleAngle) * r;
                ball.y = CY + Math.sin(paddleAngle) * r;
                continue;
            }

            ball.x += ball.vx * delta;
            ball.y += ball.vy * delta;

            const dx = ball.x - CX;
            const dy = ball.y - CY;
            const dist = Math.hypot(dx, dy) || 1;
            const nx = dx / dist;
            const ny = dy / dist;

            if (dist > R_PERIM) {
                if (useLaserGate(ball)) continue;
                balls.splice(bi, 1);
                if (!balls.length) loseLife();
                continue;
            }

            if (dist < R_CORE + BALL_R + 8) {
                const vDot = ball.vx * nx + ball.vy * ny;
                if (vDot < 0) {
                    ball.vx -= 2 * vDot * nx;
                    ball.vy -= 2 * vDot * ny;
                }
                ball.x = CX + nx * (R_CORE + BALL_R + 10);
                ball.y = CY + ny * (R_CORE + BALL_R + 10);
            }

            const vOut = ball.vx * nx + ball.vy * ny;
            if (dist > R_TRACK - 32 && vOut > 0) {
                handlePaddleHit(ball);
            }

            for (let i = blocks.length - 1; i >= 0; i--) {
                const block = blocks[i];
                const pos = blockXY(block);
                if (Math.hypot(ball.x - pos.x, ball.y - pos.y) < block.size + BALL_R) {
                    block.hp -= 1;
                    score += 50;
                    if (block.hp <= 0) blocks.splice(i, 1);
                    const bx = ball.x - pos.x;
                    const by = ball.y - pos.y;
                    const bl = Math.hypot(bx, by) || 1;
                    ball.vx = (bx / bl) * BALL_SPEED;
                    ball.vy = (by / bl) * BALL_SPEED;
                    window.ArcadeSettings?.playSound('enemyHit');
                    break;
                }
            }
        }
    }

    function updateBlocks(delta) {
        let breach = false;
        for (const block of blocks) {
            block.radius += BLOCK_DRIFT * delta * (0.65 + wave * 0.04);
            if (block.radius >= BLOCK_DANGER_R) breach = true;
        }
        if (breach) {
            blocks = blocks.filter(b => b.radius < BLOCK_DANGER_R);
            loseLife();
        }

        if (!blocks.length) {
            wave += 1;
            score += 200;
            spawnWave();
            window.ArcadeSettings?.playSound('collect');
        }
    }

    function updateCore(delta) {
        corePulse += delta * 4;
        coreLaunchTimer -= delta;
        if (coreLaunchTimer <= 0 && balls.length < 2) {
            const angle = Math.random() * Math.PI * 2;
            launchBall(angle);
            coreLaunchTimer = 2.8;
        }
    }

    function updateHud() {
        if (orbitScoreEl) orbitScoreEl.textContent = String(score);
        if (orbitLivesEl) orbitLivesEl.textContent = '♥'.repeat(Math.max(0, lives)) || '—';
        if (orbitWaveEl) orbitWaveEl.textContent = String(wave);
    }

    function drawArena() {
        const bg = ctx.createRadialGradient(CX, CY, 40, CX, CY, R_TRACK + 40);
        bg.addColorStop(0, '#0c0820');
        bg.addColorStop(0.55, '#08061a');
        bg.addColorStop(1, '#04030f');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, SIZE, SIZE);

        for (let r = 70; r < R_TRACK; r += 46) {
            ctx.strokeStyle = 'rgba(168, 72, 255, 0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(CX, CY, r, 0, Math.PI * 2);
            ctx.stroke();
        }

        const beat = 0.5 + Math.sin(corePulse * 1.6) * 0.5;
        ctx.strokeStyle = `rgba(255, 77, 200, ${0.35 + beat * 0.35})`;
        ctx.lineWidth = 4 + beat * 2;
        ctx.shadowColor = '#ff4d8d';
        ctx.shadowBlur = 12 + beat * 10;
        ctx.beginPath();
        ctx.arc(CX, CY, R_TRACK + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (laserFlash > 0) {
            ctx.strokeStyle = `rgba(0, 255, 255, ${laserFlash})`;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(CX, CY, R_PERIM, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    function drawCore() {
        const pulse = 0.7 + Math.sin(corePulse) * 0.3;
        ctx.fillStyle = `rgba(0, 255, 204, ${pulse})`;
        ctx.shadowColor = '#00ffcc';
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.arc(CX, CY, R_CORE, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    function drawShape(x, y, size, shape, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        if (shape === 'square') {
            ctx.rect(x - size, y - size, size * 2, size * 2);
        } else if (shape === 'triangle') {
            ctx.moveTo(x, y - size * 1.2);
            ctx.lineTo(x + size, y + size);
            ctx.lineTo(x - size, y + size);
            ctx.closePath();
        } else {
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i - Math.PI / 2;
                const px = x + Math.cos(a) * size;
                const py = y + Math.sin(a) * size;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
        }
        ctx.stroke();
        ctx.fillStyle = `${color}28`;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    function drawBlocks() {
        for (const block of blocks) {
            const pos = blockXY(block);
            drawShape(pos.x, pos.y, block.size, block.shape, block.color);
        }
    }

    function drawPaddle() {
        ctx.save();
        ctx.translate(CX, CY);
        ctx.rotate(paddleAngle);
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#00ffcc';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(0, 0, R_TRACK, -PADDLE_ARC / 2, PADDLE_ARC / 2);
        ctx.stroke();
        ctx.restore();
    }

    function drawBalls() {
        for (const ball of balls) {
            ctx.fillStyle = ball.stuck ? '#ffe66d' : '#ffffff';
            ctx.shadowColor = ball.stuck ? '#ffe66d' : '#00ffcc';
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    function draw() {
        ctx.clearRect(0, 0, SIZE, SIZE);
        drawArena();
        drawBlocks();
        drawCore();
        drawPaddle();
        drawBalls();
    }

    function update(delta) {
        if (gameState !== 'playing') return;

        if (multiballCooldown > 0) multiballCooldown -= delta;
        if (laserFlash > 0) laserFlash -= delta;

        updatePaddle(delta);
        updateCore(delta);
        updateBalls(delta);
        updateBlocks(delta);
        updateHud();
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
        resetGame();
        gameState = 'playing';
        orbitStartScreen?.classList.add('hidden');
        orbitGameOverScreen?.classList.add('hidden');
        lastTime = performance.now();
        animationId = requestAnimationFrame(gameLoop);
    }

    function open(targetCanvas, targetCtx) {
        canvas = targetCanvas;
        ctx = targetCtx;
        canvas.width = SIZE;
        canvas.height = SIZE;
        gameState = 'idle';
        resetGame();
        const best = localStorage.getItem('neonOrbitHighScore') || '0';
        if (orbitHighScoreEl) orbitHighScoreEl.textContent = `Best: ${best}`;
        orbitHud?.classList.remove('hidden');
        orbitStartScreen?.classList.remove('hidden');
        orbitGameOverScreen?.classList.add('hidden');
        draw();
    }

    function stop() {
        gameState = 'idle';
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        orbitHud?.classList.add('hidden');
        orbitStartScreen?.classList.add('hidden');
        orbitGameOverScreen?.classList.add('hidden');
    }

    function handleKey(e, isDown) {
        const tracked = ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space'];
        if (!tracked.includes(e.code)) return;

        keys[e.code] = isDown;
        if (!isDown) return;

        if (e.code === 'Space' && gameState === 'playing') {
            e.preventDefault();
            const stuck = balls.find(b => b.stuck);
            if (stuck) releaseStuckBall(stuck);
            else triggerMultiball();
        }
    }

    orbitStartBtn?.addEventListener('click', startGame);
    orbitPlayAgainBtn?.addEventListener('click', startGame);

    return { open, stop, handleKey };
})();
