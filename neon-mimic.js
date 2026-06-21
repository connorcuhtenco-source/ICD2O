// Neon Mimic — steal enemy powers with your data-tether
const NeonMimic = (() => {
    const WORLD_W = 960;
    const WORLD_H = 620;
    const PLAYER_R = 18;
    const PLAYER_SPEED = 300;
    const GRID_SIZE = 40;
    const ARENA_PAD = 28;
    const POWER_DURATION = 10;
    const TETHER_RANGE = 140;
    const TETHER_LOCK_TIME = 0.75;
    const TETHER_COOLDOWN = 3;
    const CORE_BURST_COOLDOWN = 20;
    const TETHER_HACK_RANGE_MULT = 1.5;
    const TETHER_HACK_DURATION = 8;
    const HAZARD_SLOW_MULT = 0.4;

    const ENEMY_DEFS = {
        blaster: { hp: 2, speed: 95, radius: 22, color: '#39ff14', glow: '#39ff14', wire: 'rgba(57, 255, 20, 0.55)', label: 'Blaster Drone', power: 'blaster', weight: 0.55 },
        laser: { hp: 4, speed: 48, radius: 28, color: '#00eeff', glow: '#00eeff', wire: 'rgba(0, 238, 255, 0.55)', label: 'Laser Sentinel', power: 'laser', weight: 0.30 },
        orbit: { hp: 6, speed: 52, radius: 32, color: '#ff44cc', glow: '#ff66dd', wire: 'rgba(255, 68, 204, 0.55)', label: 'Orbit Bot', power: 'orbit', weight: 0.15 }
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
    let gridTime = 0;
    let ripples = [];
    let hazards = [];
    let hazardSpawnTimer = 6;
    let borderSparks = [];

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
        gridTime = 0;
        ripples = [];
        hazards = [];
        hazardSpawnTimer = 6;
        borderSparks = [];
    }

    function arenaMinX() { return ARENA_PAD + PLAYER_R; }
    function arenaMaxX() { return WORLD_W - ARENA_PAD - PLAYER_R; }
    function arenaMinY() { return ARENA_PAD + PLAYER_R; }
    function arenaMaxY() { return WORLD_H - ARENA_PAD - PLAYER_R; }

    function spawnBorderSpark(x, y) {
        borderSparks.push({ x, y, life: 0.35 });
    }

    function applyArenaBounds() {
        const minX = arenaMinX();
        const maxX = arenaMaxX();
        const minY = arenaMinY();
        const maxY = arenaMaxY();

        if (player.x < minX) {
            player.x = minX;
            spawnBorderSpark(player.x - PLAYER_R, player.y);
        } else if (player.x > maxX) {
            player.x = maxX;
            spawnBorderSpark(player.x + PLAYER_R, player.y);
        }
        if (player.y < minY) {
            player.y = minY;
            spawnBorderSpark(player.x, player.y - PLAYER_R);
        } else if (player.y > maxY) {
            player.y = maxY;
            spawnBorderSpark(player.x, player.y + PLAYER_R);
        }
    }

    function getHazardSlowMultiplier() {
        for (const hazard of hazards) {
            if (hazard.phase !== 'active') continue;
            if (player.x >= hazard.x && player.x <= hazard.x + hazard.w
                && player.y >= hazard.y && player.y <= hazard.y + hazard.h) {
                return HAZARD_SLOW_MULT;
            }
        }
        return 1;
    }

    function maybeSpawnHazard() {
        hazards.push({
            x: 70 + Math.random() * (WORLD_W - 220),
            y: 70 + Math.random() * (WORLD_H - 180),
            w: 72 + Math.random() * 56,
            h: 56 + Math.random() * 48,
            phase: 'warning',
            timer: 2.4
        });
    }

    function updateHazards(delta) {
        hazardSpawnTimer -= delta;
        if (hazardSpawnTimer <= 0) {
            maybeSpawnHazard();
            hazardSpawnTimer = 11 + Math.random() * 9;
        }

        hazards = hazards.filter(hazard => {
            hazard.timer -= delta;
            if (hazard.phase === 'warning' && hazard.timer <= 0) {
                hazard.phase = 'active';
                hazard.timer = 5.5;
            } else if (hazard.phase === 'active' && hazard.timer <= 0) {
                return false;
            }
            return true;
        });
    }

    function updateRipples(delta) {
        ripples = ripples.filter(ripple => {
            ripple.life -= delta;
            return ripple.life > 0;
        });
        borderSparks = borderSparks.filter(spark => {
            spark.life -= delta;
            return spark.life > 0;
        });
    }

    function addMovementRipple() {
        const tileX = Math.floor(player.x / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;
        const tileY = Math.floor(player.y / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;
        const existing = ripples.find(r => r.x === tileX && r.y === tileY && r.life > 0.7);
        if (!existing) {
            ripples.push({ x: tileX, y: tileY, life: 1 });
        }
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
            spinAngle: Math.random() * Math.PI * 2,
            ringAngle1: Math.random() * Math.PI * 2,
            ringAngle2: Math.random() * Math.PI * 2,
            spikeAngle: Math.random() * Math.PI * 2,
            charging: false,
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
                    color: '#39ff14'
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
            const hazardMult = getHazardSlowMultiplier();
            const prevX = player.x;
            const prevY = player.y;
            player.x += dx * PLAYER_SPEED * speedMult * hazardMult * delta;
            player.y += dy * PLAYER_SPEED * speedMult * hazardMult * delta;
            applyArenaBounds();
            if (Math.hypot(player.x - prevX, player.y - prevY) > 0.5) {
                addMovementRipple();
            }
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
            if (enemy.type === 'blaster') {
                enemy.spinAngle += delta * 2.8;
                enemy.charging = enemy.shootTimer < 0.35;
            }
            if (enemy.type === 'laser') {
                enemy.charging = enemy.shootTimer < 0.55;
            }
            if (enemy.type === 'orbit') {
                enemy.ringAngle1 += delta * 3.4;
                enemy.ringAngle2 -= delta * 2.6;
                enemy.spikeAngle += delta * 2.1;
            }

            if (enemy.shootTimer <= 0) {
                enemy.shootTimer = 1.8 + Math.random() * 1.5;
                if (enemy.type === 'blaster' && dist < 420) {
                    const angle = Math.atan2(dy, dx);
                    bullets.push({
                        x: enemy.x + Math.cos(angle) * def.radius,
                        y: enemy.y + Math.sin(angle) * def.radius,
                        vx: Math.cos(angle) * 280,
                        vy: Math.sin(angle) * 280,
                        life: 2.5,
                        damage: 1,
                        color: '#39ff14',
                        hostile: true
                    });
                }
                if (enemy.type === 'laser' && dist < 500) {
                    const angle = Math.atan2(dy, dx);
                    bullets.push({
                        x: enemy.x,
                        y: enemy.y,
                        vx: Math.cos(angle) * 340,
                        vy: Math.sin(angle) * 340,
                        life: 1.6,
                        damage: 1,
                        color: '#00eeff',
                        hostile: true,
                        beam: true
                    });
                }
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
        const floor = ctx.createLinearGradient(0, 0, 0, WORLD_H);
        floor.addColorStop(0, '#06040e');
        floor.addColorStop(0.55, '#0a0614');
        floor.addColorStop(1, '#120820');
        ctx.fillStyle = floor;
        ctx.fillRect(0, 0, WORLD_W, WORLD_H);

        ctx.fillStyle = 'rgba(8, 4, 16, 0.55)';
        for (let y = 0; y < WORLD_H; y += GRID_SIZE) {
            for (let x = 0; x < WORLD_W; x += GRID_SIZE) {
                if (((x / GRID_SIZE) + (y / GRID_SIZE)) % 2 === 0) {
                    ctx.fillRect(x, y, GRID_SIZE, GRID_SIZE);
                }
            }
        }

        const pulse = 0.45 + Math.sin(gridTime * 2.4) * 0.2;
        ctx.strokeStyle = `rgba(168, 72, 255, ${0.22 + pulse * 0.18})`;
        ctx.lineWidth = 1;
        for (let x = 0; x <= WORLD_W; x += GRID_SIZE) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, WORLD_H);
            ctx.stroke();
        }
        for (let y = 0; y <= WORLD_H; y += GRID_SIZE) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(WORLD_W, y);
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(120, 40, 200, 0.04)';
        ctx.fillRect(ARENA_PAD, ARENA_PAD, WORLD_W - ARENA_PAD * 2, WORLD_H - ARENA_PAD * 2);
    }

    function drawRipples() {
        for (const ripple of ripples) {
            const alpha = ripple.life * 0.35;
            const size = (1 - ripple.life) * GRID_SIZE * 0.55 + GRID_SIZE * 0.2;
            ctx.strokeStyle = `rgba(190, 110, 255, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(ripple.x, ripple.y, size, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    function drawHazards() {
        for (const hazard of hazards) {
            if (hazard.phase === 'warning') {
                const flash = Math.sin(hazard.timer * 14) > 0;
                ctx.fillStyle = flash ? 'rgba(255, 60, 120, 0.22)' : 'rgba(255, 200, 60, 0.12)';
                ctx.strokeStyle = flash ? 'rgba(255, 90, 140, 0.85)' : 'rgba(255, 220, 80, 0.55)';
            } else {
                ctx.fillStyle = 'rgba(90, 40, 140, 0.35)';
                ctx.strokeStyle = 'rgba(170, 90, 255, 0.45)';
            }
            ctx.lineWidth = 2;
            ctx.fillRect(hazard.x, hazard.y, hazard.w, hazard.h);
            ctx.strokeRect(hazard.x, hazard.y, hazard.w, hazard.h);

            if (hazard.phase === 'active') {
                ctx.fillStyle = 'rgba(200, 180, 255, 0.08)';
                for (let i = 0; i < 8; i++) {
                    const sx = hazard.x + ((i * 37) % hazard.w);
                    const sy = hazard.y + ((i * 53) % hazard.h);
                    ctx.fillRect(sx, sy, 2, 2);
                }
            }
        }
    }

    function drawBorders() {
        const beat = 0.55 + Math.sin(gridTime * 3.2) * 0.45;
        const colors = [
            `rgba(180, 80, 255, ${0.35 + beat * 0.35})`,
            `rgba(255, 77, 200, ${0.25 + beat * 0.3})`
        ];

        const drawBarrier = (x1, y1, x2, y2) => {
            const grd = ctx.createLinearGradient(x1, y1, x2, y2);
            grd.addColorStop(0, colors[0]);
            grd.addColorStop(1, colors[1]);
            ctx.strokeStyle = grd;
            ctx.lineWidth = 5 + beat * 3;
            ctx.shadowColor = '#b84cff';
            ctx.shadowBlur = 16 + beat * 12;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        };

        const p = ARENA_PAD;
        drawBarrier(p, p, WORLD_W - p, p);
        drawBarrier(WORLD_W - p, p, WORLD_W - p, WORLD_H - p);
        drawBarrier(WORLD_W - p, WORLD_H - p, p, WORLD_H - p);
        drawBarrier(p, WORLD_H - p, p, p);

        for (const spark of borderSparks) {
            const a = spark.life / 0.35;
            ctx.strokeStyle = `rgba(220, 240, 255, ${a})`;
            ctx.lineWidth = 2;
            for (let i = 0; i < 4; i++) {
                const angle = (Math.PI / 2) * i + gridTime * 8;
                ctx.beginPath();
                ctx.moveTo(spark.x, spark.y);
                ctx.lineTo(spark.x + Math.cos(angle) * 14 * a, spark.y + Math.sin(angle) * 14 * a);
                ctx.stroke();
            }
        }
    }

    function drawEnemyCore(color, size, shape = 'circle') {
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.fillStyle = color;
        if (shape === 'square') {
            ctx.fillRect(-size / 2, -size / 2, size, size);
        } else if (shape === 'star') {
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const a = (Math.PI * 2 / 5) * i - Math.PI / 2;
                const r = i % 2 === 0 ? size : size * 0.45;
                const px = Math.cos(a) * r;
                const py = Math.sin(a) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
    }

    function drawBlasterDrone(enemy, def) {
        const r = def.radius;
        const spin = enemy.spinAngle;
        ctx.rotate(spin);

        ctx.strokeStyle = def.wire;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(-r * 0.65, r * 0.75);
        ctx.lineTo(-r * 0.65, -r * 0.75);
        ctx.closePath();
        ctx.stroke();

        const verts = [
            [r, 0],
            [-r * 0.65, r * 0.75],
            [-r * 0.65, -r * 0.75]
        ];
        verts.forEach(([vx, vy], i) => {
            const orbGlow = enemy.charging ? 1 : 0.55 + Math.sin(gridTime * 5 + i) * 0.2;
            ctx.fillStyle = `rgba(57, 255, 20, ${orbGlow})`;
            ctx.shadowColor = '#39ff14';
            ctx.shadowBlur = enemy.charging ? 18 : 8;
            ctx.beginPath();
            ctx.arc(vx, vy, enemy.charging ? 7 : 5, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.shadowBlur = 0;

        const corePulse = 0.75 + Math.sin(gridTime * 6) * 0.25;
        drawEnemyCore(`rgba(57, 255, 20, ${corePulse})`, 6);
    }

    function drawLaserSentinel(enemy, def, distToPlayer) {
        const r = def.radius;
        const scale = enemy.charging ? 1.12 : 1;
        ctx.scale(scale, scale);
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);

        ctx.strokeStyle = def.wire;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r, 0);
        ctx.closePath();
        ctx.stroke();

        ctx.save();
        ctx.rotate(angle);
        ctx.strokeStyle = enemy.charging ? 'rgba(0, 238, 255, 0.9)' : 'rgba(0, 238, 255, 0.35)';
        ctx.lineWidth = enemy.charging ? 3 : 1.5;
        ctx.beginPath();
        ctx.moveTo(r * 0.2, 0);
        ctx.lineTo(r + Math.min(distToPlayer, 320), 0);
        ctx.stroke();
        if (enemy.charging) {
            ctx.fillStyle = 'rgba(0, 238, 255, 0.85)';
            ctx.fillRect(r * 0.55, -5, r * 0.45, 10);
        }
        ctx.restore();

        drawEnemyCore('#00eeff', 7, 'square');
    }

    function drawOrbitBot(enemy, def) {
        const r = def.radius * 0.55;
        ctx.strokeStyle = def.wire;
        ctx.lineWidth = 2;

        ctx.save();
        ctx.rotate(enemy.ringAngle1);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.35, r * 0.75, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.rotate(enemy.ringAngle2);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.1, r * 0.95, Math.PI / 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.beginPath();
        ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
        ctx.stroke();

        for (let i = 0; i < 3; i++) {
            const a = enemy.spikeAngle + (Math.PI * 2 / 3) * i;
            const sx = Math.cos(a) * r * 1.25;
            const sy = Math.sin(a) * r * 1.25;
            ctx.strokeStyle = '#ff66dd';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
            ctx.lineTo(sx, sy);
            ctx.stroke();
            ctx.fillStyle = '#ff44cc';
            ctx.beginPath();
            ctx.arc(sx, sy, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        const flicker = 0.65 + Math.sin(gridTime * 12 + enemy.spikeAngle) * 0.35;
        drawEnemyCore(`rgba(255, 100, 220, ${flicker})`, 6, 'star');
    }

    function drawEnemies() {
        for (const enemy of enemies) {
            const def = ENEMY_DEFS[enemy.type];
            const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
            ctx.save();
            ctx.translate(enemy.x, enemy.y);

            if (enemy.type === 'blaster') drawBlasterDrone(enemy, def);
            else if (enemy.type === 'laser') drawLaserSentinel(enemy, def, distToPlayer);
            else drawOrbitBot(enemy, def);

            if (enemy.frozen) {
                ctx.strokeStyle = 'rgba(180, 220, 255, 0.8)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, def.radius + 8, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.restore();
        }
    }

    function drawBullets() {
        for (const b of bullets) {
            ctx.fillStyle = b.color;
            ctx.shadowColor = b.color;
            ctx.shadowBlur = b.beam ? 16 : 10;
            if (b.beam) {
                ctx.fillRect(b.x - 3, b.y - 2, 18, 4);
            } else {
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.hostile ? 5 : 4, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.shadowBlur = 0;
        }
    }

    function drawBeams() {
        for (const beam of beams) {
            ctx.save();
            ctx.translate(player.x, player.y);
            ctx.rotate(beam.angle);
            const grd = ctx.createLinearGradient(0, 0, 700, 0);
            grd.addColorStop(0, 'rgba(0, 238, 255, 0.95)');
            grd.addColorStop(1, 'rgba(0, 238, 255, 0)');
            ctx.fillStyle = grd;
            ctx.fillRect(0, -7, 700, 14);
            ctx.restore();
        }
    }

    function drawOrbitSpikes() {
        if (player.power !== 'orbit') return;
        const orbitRadius = 55;
        ctx.strokeStyle = '#ff66dd';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#ff44cc';
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
            ctx.fillStyle = '#ff44cc';
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
            blaster: '#39ff14',
            laser: '#00eeff',
            orbit: '#ff44cc'
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
        drawHazards();
        drawRipples();
        drawBorders();
        drawBullets();
        drawBeams();
        drawEnemies();
        drawOrbitSpikes();
        drawPlayer();
    }

    function update(delta) {
        if (gameState !== 'playing') return;

        gridTime += delta;
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

        updateHazards(delta);
        updateRipples(delta);
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
