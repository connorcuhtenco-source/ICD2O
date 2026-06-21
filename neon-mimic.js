// Neon Mimic — steal enemy powers with your data-tether
const NeonMimic = (() => {
    const WORLD_W = 960;
    const WORLD_H = 620;
    const PLAYER_R = 18;
    const PLAYER_SPEED = 300;
    const POWER_DURATION = 10;
    const TETHER_RANGE = 140;
    const TETHER_LOCK_TIME = 0.75;
    const TETHER_COOLDOWN = 3;
    const CORE_BURST_COOLDOWN = 20;
    const TETHER_HACK_RANGE_MULT = 1.5;
    const TETHER_HACK_DURATION = 8;

    const ENEMY_DEFS = {
        blaster: { hp: 2, speed: 95, radius: 22, color: '#00ffcc', glow: '#00ffcc', label: 'Blaster Drone', power: 'blaster', weight: 0.55 },
        laser: { hp: 4, speed: 68, radius: 28, color: '#ff44aa', glow: '#ff66cc', label: 'Laser Sentinel', power: 'laser', weight: 0.30 },
        orbit: { hp: 6, speed: 52, radius: 32, color: '#ffaa22', glow: '#ffcc44', label: 'Orbit Bot', power: 'orbit', weight: 0.15 }
    };

    let canvas;
    let ctx;
    let gameState = 'idle';
    let animationId = null;
    let lastTime = 0;
    let keys = {};
    let mouseDown = false;
    let rightMouseDown = false;
    let mouseX = 0;
    let mouseY = 0;

    let player;
    let enemies;
    let bullets;
    let beams;
    let orbitSpikes;
    let spawnTimer;
    let wave;
    let score;
    let shards;
    let kills;
    let survivalTime;
    let aimAngle;

    let tetherTarget;
    let tetherLockTimer;
    let tetherCooldown;
    let tetherHackTimer;
    let coreBurstCooldown;
    let emergencyShield;
    let empFreezeTimer;
    let fireCooldown;
    let laserFireTimer;
    let fireRateMult;
    let overclockActive;

    const mimicHud = document.getElementById('mimicHud');
    const mimicScoreEl = document.getElementById('mimicScore');
    const mimicShardsEl = document.getElementById('mimicShards');
    const mimicPowerEl = document.getElementById('mimicPower');
    const mimicTetherEl = document.getElementById('mimicTether');
    const mimicBurstEl = document.getElementById('mimicBurst');
    const mimicLoadoutEl = document.getElementById('mimicLoadout');
    const mimicStartScreen = document.getElementById('mimicStartScreen');
    const mimicGameOverScreen = document.getElementById('mimicGameOverScreen');
    const mimicFinalScore = document.getElementById('mimicFinalScore');
    const mimicFinalShards = document.getElementById('mimicFinalShards');
    const mimicStartBtn = document.getElementById('mimicStartBtn');
    const mimicPlayAgainBtn = document.getElementById('mimicPlayAgainBtn');

    function resetGame() {
        player = {
            x: WORLD_W / 2,
            y: WORLD_H / 2,
            power: null,
            powerTimer: 0,
            facing: 0
        };
        enemies = [];
        bullets = [];
        beams = [];
        orbitSpikes = [];
        spawnTimer = 1.2;
        wave = 1;
        score = 0;
        shards = 0;
        kills = 0;
        survivalTime = 0;
        aimAngle = -Math.PI / 2;
        tetherTarget = null;
        tetherLockTimer = 0;
        tetherCooldown = 0;
        tetherHackTimer = 0;
        coreBurstCooldown = 0;
        emergencyShield = false;
        empFreezeTimer = 0;
        fireCooldown = 0;
        laserFireTimer = 0;
        fireRateMult = 1;
        overclockActive = false;
    }

    function getTetherRange() {
        return TETHER_RANGE * (tetherHackTimer > 0 ? TETHER_HACK_RANGE_MULT : 1);
    }

    function getEquippedConsumable() {
        return window.ArcadeMeta?.getEquippedMimicConsumable?.() || null;
    }

    function getConsumableLabel(id) {
        const labels = {
            'mimic-emp': 'EMP Overload',
            'mimic-tether-hack': 'Tether Hack',
            'mimic-overclock': 'Overclock Battery',
            'mimic-shield': 'Emergency Shield'
        };
        return labels[id] || 'None';
    }

    function updateLoadoutDisplay() {
        const id = getEquippedConsumable();
        const charges = id ? (window.ArcadeMeta?.getMimicCharges?.(id) || 0) : 0;
        if (mimicLoadoutEl) {
            mimicLoadoutEl.textContent = id && charges > 0
                ? `${getConsumableLabel(id)} (${charges} ready)`
                : 'No consumable equipped — buy one in the Shop';
        }
    }

    function pickEnemyType() {
        const roll = Math.random();
        let cumulative = 0;
        for (const [type, def] of Object.entries(ENEMY_DEFS)) {
            cumulative += def.weight;
            if (roll <= cumulative) return type;
        }
        return 'blaster';
    }

    function spawnEnemy() {
        const type = pickEnemyType();
        const def = ENEMY_DEFS[type];
        const edge = Math.floor(Math.random() * 4);
        let x;
        let y;
        const pad = 40;

        if (edge === 0) { x = pad + Math.random() * (WORLD_W - pad * 2); y = -pad; }
        else if (edge === 1) { x = WORLD_W + pad; y = pad + Math.random() * (WORLD_H - pad * 2); }
        else if (edge === 2) { x = pad + Math.random() * (WORLD_W - pad * 2); y = WORLD_H + pad; }
        else { x = -pad; y = pad + Math.random() * (WORLD_H - pad * 2); }

        enemies.push({
            type,
            x,
            y,
            hp: def.hp + Math.floor(wave / 3),
            maxHp: def.hp + Math.floor(wave / 3),
            shootTimer: 1 + Math.random() * 2,
            orbitAngle: Math.random() * Math.PI * 2,
            frozen: false
        });
    }

    function stealPower(enemy) {
        const def = ENEMY_DEFS[enemy.type];
        player.power = def.power;
        player.powerTimer = POWER_DURATION;
        tetherCooldown = TETHER_COOLDOWN;
        tetherTarget = null;
        tetherLockTimer = 0;
        fireCooldown = 0;
        laserFireTimer = 0;
        overclockActive = false;
        fireRateMult = 1;

        if (def.power === 'orbit') {
            orbitSpikes = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
        } else {
            orbitSpikes = [];
        }

        window.ArcadeSettings?.playSound('collect');
    }

    function findTetherTarget() {
        let best = null;
        let bestDist = getTetherRange();

        for (const enemy of enemies) {
            const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
            if (dist < bestDist) {
                bestDist = dist;
                best = enemy;
            }
        }
        return best;
    }

    function fireWeapon() {
        if (!player.power || player.powerTimer <= 0) return;

        if (player.power === 'blaster') {
            if (fireCooldown > 0) return;
            const spread = 0.22;
            for (let i = -1; i <= 1; i++) {
                const angle = aimAngle + i * spread;
                bullets.push({
                    x: player.x + Math.cos(angle) * (PLAYER_R + 6),
                    y: player.y + Math.sin(angle) * (PLAYER_R + 6),
                    vx: Math.cos(angle) * 520,
                    vy: Math.sin(angle) * 520,
                    life: 1.4,
                    damage: 1,
                    color: '#00ffcc'
                });
            }
            fireCooldown = 0.15 / fireRateMult;
            window.ArcadeSettings?.playSound('click');
        }

        if (player.power === 'laser') {
            if (laserFireTimer > 0) return;
            laserFireTimer = 2;
            beams.push({
                angle: aimAngle,
                life: 2,
                damageTick: 0
            });
            window.ArcadeSettings?.playSound('powerOn');
        }
    }

    function damageEnemy(enemy, amount) {
        enemy.hp -= amount;
        if (enemy.hp <= 0) {
            const idx = enemies.indexOf(enemy);
            if (idx >= 0) {
                enemies.splice(idx, 1);
                kills += 1;
                shards += 1;
                score += 100;
                window.ArcadeSettings?.playSound('enemyHit');
            }
        }
    }

    function triggerCoreBurst() {
        if (coreBurstCooldown > 0) return;
        const consumable = getEquippedConsumable();
        if (!consumable) return;
        if (!window.ArcadeMeta?.useMimicCharge?.(consumable)) return;

        coreBurstCooldown = CORE_BURST_COOLDOWN;

        if (consumable === 'mimic-emp') {
            empFreezeTimer = 4;
            enemies.forEach(e => { e.frozen = true; });
            window.ArcadeSettings?.playSound('nuke');
        } else if (consumable === 'mimic-tether-hack') {
            tetherCooldown = 0;
            tetherHackTimer = TETHER_HACK_DURATION;
            window.ArcadeSettings?.playSound('collect');
        } else if (consumable === 'mimic-overclock') {
            if (player.power) {
                player.powerTimer = POWER_DURATION;
                fireRateMult = 2;
                overclockActive = true;
            }
            window.ArcadeSettings?.playSound('powerOn');
        } else if (consumable === 'mimic-shield') {
            emergencyShield = true;
            window.ArcadeSettings?.playSound('collect');
        }

        updateLoadoutDisplay();
    }

    function endGame() {
        gameState = 'gameover';
        window.ArcadeMeta?.onNeonMimicEnd?.(score, shards, survivalTime);

        if (mimicFinalScore) mimicFinalScore.textContent = `Score: ${score}`;
        if (mimicFinalShards) mimicFinalShards.textContent = `Shards: ${shards}`;
        mimicStartScreen?.classList.add('hidden');
        mimicGameOverScreen?.classList.remove('hidden');
        window.ArcadeSettings?.playSound('gameOver');
    }

    function updatePlayer(delta) {
        let dx = 0;
        let dy = 0;
        if (keys.ArrowUp || keys.KeyW) dy -= 1;
        if (keys.ArrowDown || keys.KeyS) dy += 1;
        if (keys.ArrowLeft || keys.KeyA) dx -= 1;
        if (keys.ArrowRight || keys.KeyD) dx += 1;

        const tethering = rightMouseDown || keys.KeyK;
        const moveSlow = player.power === 'laser' && laserFireTimer > 0;
        const speedMult = moveSlow ? 0.5 : 1;

        if (dx !== 0 || dy !== 0) {
            const len = Math.hypot(dx, dy) || 1;
            dx /= len;
            dy /= len;
            aimAngle = Math.atan2(dy, dx);
            player.facing = aimAngle;
        } else {
            const mx = mouseX - player.x;
            const my = mouseY - player.y;
            if (Math.hypot(mx, my) > 8) {
                aimAngle = Math.atan2(my, mx);
            }
        }

        if (!tethering) {
            player.x = clamp(player.x + dx * PLAYER_SPEED * speedMult * delta, PLAYER_R, WORLD_W - PLAYER_R);
            player.y = clamp(player.y + dy * PLAYER_SPEED * speedMult * delta, PLAYER_R, WORLD_H - PLAYER_R);
        }

        if (player.powerTimer > 0) {
            player.powerTimer -= delta;
            if (player.powerTimer <= 0) {
                player.power = null;
                player.powerTimer = 0;
                orbitSpikes = [];
                laserFireTimer = 0;
                overclockActive = false;
                fireRateMult = 1;
            }
        }

        if (keys.KeyJ || mouseDown) {
            fireWeapon();
        }
    }

    function updateTether(delta) {
        if (tetherCooldown > 0) tetherCooldown = Math.max(0, tetherCooldown - delta);
        if (tetherHackTimer > 0) tetherHackTimer = Math.max(0, tetherHackTimer - delta);
        if (coreBurstCooldown > 0) coreBurstCooldown = Math.max(0, coreBurstCooldown - delta);
        if (empFreezeTimer > 0) {
            empFreezeTimer = Math.max(0, empFreezeTimer - delta);
            if (empFreezeTimer <= 0) enemies.forEach(e => { e.frozen = false; });
        }

        const tethering = (rightMouseDown || keys.KeyK) && tetherCooldown <= 0 && !player.power;

        if (!tethering) {
            tetherTarget = null;
            tetherLockTimer = 0;
            return;
        }

        tetherTarget = findTetherTarget();
        if (!tetherTarget) {
            tetherLockTimer = 0;
            return;
        }

        tetherLockTimer += delta;
        if (tetherLockTimer >= TETHER_LOCK_TIME) {
            stealPower(tetherTarget);
        }
    }

    function updateEnemies(delta) {
        for (const enemy of enemies) {
            if (enemy.frozen) continue;

            const def = ENEMY_DEFS[enemy.type];
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const dist = Math.hypot(dx, dy) || 1;
            enemy.x += (dx / dist) * def.speed * delta;
            enemy.y += (dy / dist) * def.speed * delta;

            enemy.shootTimer -= delta;
            if (enemy.shootTimer <= 0) {
                enemy.shootTimer = 1.8 + Math.random() * 1.5;
                if (enemy.type === 'blaster' && dist < 420) {
                    const angle = Math.atan2(dy, dx);
                    bullets.push({
                        x: enemy.x,
                        y: enemy.y,
                        vx: Math.cos(angle) * 280,
                        vy: Math.sin(angle) * 280,
                        life: 2.5,
                        damage: 1,
                        color: '#ff6688',
                        hostile: true
                    });
                }
            }

            if (enemy.type === 'orbit') {
                enemy.orbitAngle += delta * 2.2;
            }

            const touchDist = def.radius + PLAYER_R;
            if (dist < touchDist) {
                if (player.power === 'orbit' && player.powerTimer > 0) continue;
                if (emergencyShield) {
                    emergencyShield = false;
                    const push = Math.atan2(enemy.y - player.y, enemy.x - player.x);
                    enemy.x += Math.cos(push) * 80;
                    enemy.y += Math.sin(push) * 80;
                    window.ArcadeSettings?.playSound('hit');
                    continue;
                }
                endGame();
                return;
            }
        }
    }

    function updateBullets(delta) {
        for (const b of bullets) {
            b.x += b.vx * delta;
            b.y += b.vy * delta;
            b.life -= delta;
        }
        bullets = bullets.filter(b => b.life > 0 && b.x > -20 && b.x < WORLD_W + 20 && b.y > -20 && b.y < WORLD_H + 20);

        if (!player.power || player.powerTimer <= 0) return;

        for (const b of bullets) {
            if (b.hostile) {
                if (Math.hypot(b.x - player.x, b.y - player.y) < PLAYER_R + 6) {
                    if (emergencyShield) {
                        emergencyShield = false;
                        b.life = 0;
                        window.ArcadeSettings?.playSound('hit');
                    } else {
                        endGame();
                        return;
                    }
                }
                continue;
            }

            for (const enemy of enemies) {
                const def = ENEMY_DEFS[enemy.type];
                if (Math.hypot(b.x - enemy.x, b.y - enemy.y) < def.radius) {
                    damageEnemy(enemy, b.damage);
                    b.life = 0;
                    break;
                }
            }
        }
    }

    function updateBeams(delta) {
        for (const beam of beams) {
            beam.life -= delta;
            beam.damageTick -= delta;
            if (beam.damageTick > 0) continue;
            beam.damageTick = 0.12;

            const len = 900;
            const bx = Math.cos(beam.angle);
            const by = Math.sin(beam.angle);

            for (const enemy of enemies) {
                const ex = enemy.x - player.x;
                const ey = enemy.y - player.y;
                const proj = ex * bx + ey * by;
                if (proj < 0 || proj > len) continue;
                const perp = Math.abs(ex * by - ey * bx);
                const def = ENEMY_DEFS[enemy.type];
                if (perp < def.radius + 8) {
                    damageEnemy(enemy, 1);
                }
            }
        }
        beams = beams.filter(b => b.life > 0);
        if (laserFireTimer > 0) laserFireTimer = Math.max(0, laserFireTimer - delta);
    }

    function updateOrbitSpikes(delta) {
        if (player.power !== 'orbit' || player.powerTimer <= 0) return;
        const orbitRadius = 55;
        for (let i = 0; i < orbitSpikes.length; i++) {
            orbitSpikes[i] += delta * 3.2;
            const sx = player.x + Math.cos(orbitSpikes[i]) * orbitRadius;
            const sy = player.y + Math.sin(orbitSpikes[i]) * orbitRadius;
            for (const enemy of [...enemies]) {
                const def = ENEMY_DEFS[enemy.type];
                if (Math.hypot(sx - enemy.x, sy - enemy.y) < def.radius + 10) {
                    damageEnemy(enemy, 2);
                }
            }
        }
    }

    function updateHud() {
        if (mimicScoreEl) mimicScoreEl.textContent = String(score);
        if (mimicShardsEl) mimicShardsEl.textContent = String(shards);
        if (mimicPowerEl) {
            mimicPowerEl.textContent = player.power
                ? `${player.power.toUpperCase()} ${Math.ceil(player.powerTimer)}s`
                : 'BLANK CORE';
        }
        if (mimicTetherEl) {
            mimicTetherEl.textContent = tetherCooldown > 0
                ? `Tether ${tetherCooldown.toFixed(1)}s`
                : tetherHackTimer > 0 ? 'Tether BOOST' : 'Tether READY';
        }
        if (mimicBurstEl) {
            const c = getEquippedConsumable();
            mimicBurstEl.textContent = c
                ? `Burst ${coreBurstCooldown > 0 ? coreBurstCooldown.toFixed(0) + 's' : 'READY'}`
                : 'No Burst';
        }
    }

    function drawBackground() {
        const grd = ctx.createLinearGradient(0, 0, 0, WORLD_H);
        grd.addColorStop(0, '#0a0a18');
        grd.addColorStop(1, '#12082a');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, WORLD_W, WORLD_H);

        ctx.strokeStyle = 'rgba(0, 255, 204, 0.06)';
        ctx.lineWidth = 1;
        for (let x = 0; x < WORLD_W; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, WORLD_H);
            ctx.stroke();
        }
        for (let y = 0; y < WORLD_H; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(WORLD_W, y);
            ctx.stroke();
        }
    }

    function drawEnemies() {
        for (const enemy of enemies) {
            const def = ENEMY_DEFS[enemy.type];
            ctx.save();
            ctx.translate(enemy.x, enemy.y);
            ctx.shadowColor = def.glow;
            ctx.shadowBlur = 16;

            if (enemy.type === 'blaster') {
                ctx.fillStyle = def.color;
                ctx.beginPath();
                ctx.moveTo(def.radius, 0);
                ctx.lineTo(-def.radius * 0.6, def.radius * 0.7);
                ctx.lineTo(-def.radius * 0.6, -def.radius * 0.7);
                ctx.closePath();
                ctx.fill();
            } else if (enemy.type === 'laser') {
                ctx.fillStyle = def.color;
                ctx.fillRect(-def.radius, -def.radius * 0.6, def.radius * 2, def.radius * 1.2);
                ctx.fillStyle = '#fff';
                ctx.fillRect(def.radius * 0.3, -4, def.radius * 0.5, 8);
            } else {
                ctx.strokeStyle = def.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, def.radius * 0.65, 0, Math.PI * 2);
                ctx.stroke();
                for (let i = 0; i < 3; i++) {
                    const a = enemy.orbitAngle + (Math.PI * 2 / 3) * i;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(a) * def.radius * 0.4, Math.sin(a) * def.radius * 0.4);
                    ctx.lineTo(Math.cos(a) * def.radius * 1.1, Math.sin(a) * def.radius * 1.1);
                    ctx.stroke();
                }
            }

            if (enemy.frozen) {
                ctx.strokeStyle = 'rgba(180, 220, 255, 0.8)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, def.radius + 6, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.restore();
        }
    }

    function drawBullets() {
        for (const b of bullets) {
            ctx.fillStyle = b.color;
            ctx.shadowColor = b.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.hostile ? 5 : 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    function drawBeams() {
        for (const beam of beams) {
            ctx.save();
            ctx.translate(player.x, player.y);
            ctx.rotate(beam.angle);
            const grd = ctx.createLinearGradient(0, 0, 700, 0);
            grd.addColorStop(0, 'rgba(255, 68, 170, 0.9)');
            grd.addColorStop(1, 'rgba(255, 68, 170, 0)');
            ctx.fillStyle = grd;
            ctx.fillRect(0, -6, 700, 12);
            ctx.restore();
        }
    }

    function drawOrbitSpikes() {
        if (player.power !== 'orbit') return;
        const orbitRadius = 55;
        ctx.strokeStyle = '#ffcc44';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#ffaa22';
        ctx.shadowBlur = 14;
        for (const angle of orbitSpikes) {
            const sx = player.x + Math.cos(angle) * orbitRadius;
            const sy = player.y + Math.sin(angle) * orbitRadius;
            ctx.beginPath();
            ctx.moveTo(player.x, player.y);
            ctx.lineTo(sx, sy);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(sx, sy, 8, 0, Math.PI * 2);
            ctx.fillStyle = '#ffcc44';
            ctx.fill();
        }
        ctx.shadowBlur = 0;
    }

    function drawPlayer() {
        ctx.save();
        ctx.translate(player.x, player.y);

        if (player.powerTimer > 0) {
            const pct = player.powerTimer / POWER_DURATION;
            ctx.strokeStyle = 'rgba(0, 255, 204, 0.35)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, PLAYER_R + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
            ctx.stroke();
        }

        if (emergencyShield) {
            ctx.strokeStyle = 'rgba(100, 200, 255, 0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, PLAYER_R + 10, 0, Math.PI * 2);
            ctx.stroke();
        }

        const powerColors = {
            blaster: '#00ffcc',
            laser: '#ff44aa',
            orbit: '#ffcc44'
        };
        const coreColor = player.power ? powerColors[player.power] : 'rgba(200, 200, 255, 0.5)';
        ctx.shadowColor = coreColor;
        ctx.shadowBlur = player.power ? 22 : 10;
        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(0, 0, PLAYER_R, 0, Math.PI * 2);
        ctx.fill();

        if (!player.power) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, PLAYER_R + 4, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();

        if (tetherTarget && tetherLockTimer > 0) {
            ctx.strokeStyle = `rgba(0, 255, 204, ${0.4 + tetherLockTimer / TETHER_LOCK_TIME * 0.6})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.moveTo(player.x, player.y);
            ctx.lineTo(tetherTarget.x, tetherTarget.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    function draw() {
        ctx.clearRect(0, 0, WORLD_W, WORLD_H);
        drawBackground();
        drawBullets();
        drawBeams();
        drawEnemies();
        drawOrbitSpikes();
        drawPlayer();
    }

    function update(delta) {
        if (gameState !== 'playing') return;

        survivalTime += delta;
        score += Math.floor(delta * 10);
        spawnTimer -= delta;
        if (spawnTimer <= 0) {
            const count = 1 + Math.floor(wave / 4);
            for (let i = 0; i < count; i++) spawnEnemy();
            spawnTimer = Math.max(0.8, 2.4 - wave * 0.08);
            wave += 0.15;
        }

        if (fireCooldown > 0) fireCooldown -= delta;

        updatePlayer(delta);
        updateTether(delta);
        updateEnemies(delta);
        if (gameState !== 'playing') return;
        updateBullets(delta);
        if (gameState !== 'playing') return;
        updateBeams(delta);
        updateOrbitSpikes(delta);
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
        updateLoadoutDisplay();
        gameState = 'playing';
        mimicStartScreen?.classList.add('hidden');
        mimicGameOverScreen?.classList.add('hidden');
        lastTime = performance.now();
        animationId = requestAnimationFrame(gameLoop);
    }

    function open(targetCanvas, targetCtx) {
        canvas = targetCanvas;
        ctx = targetCtx;
        canvas.width = WORLD_W;
        canvas.height = WORLD_H;
        gameState = 'idle';
        resetGame();
        updateLoadoutDisplay();
        mimicHud?.classList.remove('hidden');
        mimicStartScreen?.classList.remove('hidden');
        mimicGameOverScreen?.classList.add('hidden');
        drawBackground();
        drawPlayer();
    }

    function stop() {
        gameState = 'idle';
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        mimicHud?.classList.add('hidden');
        mimicStartScreen?.classList.add('hidden');
        mimicGameOverScreen?.classList.add('hidden');
    }

    function handleKey(e, isDown) {
        const tracked = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'KeyK'];
        if (tracked.includes(e.code)) {
            keys[e.code] = isDown;
            if (isDown) e.preventDefault();
        }
        if (isDown && e.code === 'Space' && gameState === 'playing') {
            e.preventDefault();
            triggerCoreBurst();
        }
    }

    function handleMouseMove(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        mouseX = (e.clientX - rect.left) * scaleX;
        mouseY = (e.clientY - rect.top) * scaleY;
    }

    function handleMouseDown(e) {
        if (e.button === 0) mouseDown = true;
        if (e.button === 2) rightMouseDown = true;
    }

    function handleMouseUp(e) {
        if (e.button === 0) mouseDown = false;
        if (e.button === 2) rightMouseDown = false;
    }

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    mimicStartBtn?.addEventListener('click', startGame);
    mimicPlayAgainBtn?.addEventListener('click', startGame);

    return {
        open,
        stop,
        startGame,
        handleKey,
        handleMouseMove,
        handleMouseDown,
        handleMouseUp
    };
})();
