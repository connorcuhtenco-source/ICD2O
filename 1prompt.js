// Space Runner Infinite Runner Game
const SpaceRunner = (() => {
    let canvas;
    let ctx;

    const startScreen = document.getElementById('startScreen');
    const gameOverScreen = document.getElementById('gameOverScreen');
    const startButton = document.getElementById('startButton');
    const playAgainButton = document.getElementById('playAgainButton');
    const highscoreValue = document.getElementById('highscoreValue');
    const finalScore = document.getElementById('finalScore');
    const finalHighscore = document.getElementById('finalHighscore');
    const newHighscore = document.getElementById('newHighscore');
    const scoreDisplay = document.getElementById('scoreDisplay');

    const GAME_WIDTH = 600;
    const GAME_HEIGHT = 800;
    const LANES = 3;
    const LANE_WIDTH = GAME_WIDTH / LANES;
    const PLAYER_RADIUS = 28;
    const PLAYER_SPRITE_SIZE = 96;
    const PLAYER_Y = GAME_HEIGHT - 120;
    const OBSTACLE_SIZE = 132;
    const OBSTACLE_RADIUS = OBSTACLE_SIZE / 2;
    const OBSTACLE_HIT_RADIUS = 32;
    const STAR_RADIUS = 40;
    const JUMP_HEIGHT = 210;
    const JUMP_DURATION = 820;
    const PLAYER_MOVE_DURATION = 100;
    const ROLL_HEIGHT = 58;
    const ROLL_DURATION = 520;
    const IMMUNITY_DURATION = 12000;

    const playerImage = new Image();
    playerImage.src = 'sprites/astronautsprite.png';

    const planetImageSources = ['sprites/planet_1.png', 'sprites/planet_2.png', 'sprites/planet_3.png', 'sprites/planet_4.png'];
    const planetImages = planetImageSources.map(src => {
        const img = new Image();
        img.src = src;
        return img;
    });

    const starImage = new Image();
    starImage.src = 'sprites/star_sprite.png';

    let gameState = 'idle';
    let animationId = null;
    let player;
    let obstacles;
    let stars;
    let score;
    let highscore;
    let speed;
    let lastObstacleTime;
    let lastStarTime;
    let immunityEnd;
    let lastSpeedIncrease;
    let gameStartTime;

    function resetGame() {
        player = {
            lane: 1,
            x: 1 * LANE_WIDTH + LANE_WIDTH / 2,
            targetLane: 1,
            startX: 1 * LANE_WIDTH + LANE_WIDTH / 2,
            moving: false,
            moveStart: 0,
            y: PLAYER_Y,
            jumping: false,
            jumpStart: 0,
            rolling: false,
            rollStart: 0,
            immune: false
        };
        obstacles = [];
        stars = [];
        score = 0;
        speed = 6;
        lastObstacleTime = 0;
        lastStarTime = 0;
        immunityEnd = 0;
        lastSpeedIncrease = 0;
        gameStartTime = Date.now();
        scoreDisplay.textContent = 'Score: 0';
        scoreDisplay.classList.remove('hidden');
    }

    function drawBackground() {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        for (let i = 0; i < 120; i++) {
            ctx.fillStyle = '#fff';
            const x = Math.random() * GAME_WIDTH;
            const y = Math.random() * GAME_HEIGHT;
            ctx.globalAlpha = Math.random() * 0.7 + 0.3;
            ctx.beginPath();
            ctx.arc(x, y, Math.random() * 1.2 + 0.5, 0, 2 * Math.PI);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    }

    function drawPlayer() {
        ctx.save();
        const x = player.x;
        const y = player.y;
        const shadowBlur = player.immune ? 24 : 0;
        const shadowColor = player.immune ? '#0ff' : '#000';
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = shadowBlur;
        const spriteSize = PLAYER_SPRITE_SIZE;

        if (playerImage.complete && playerImage.naturalWidth !== 0) {
            ctx.drawImage(playerImage, x - spriteSize / 2, y - spriteSize / 2, spriteSize, spriteSize);
        } else {
            ctx.beginPath();
            ctx.arc(x, y, PLAYER_RADIUS, 0, 2 * Math.PI);
            ctx.fillStyle = player.immune ? '#aaa' : '#888';
            ctx.fill();
        }

        ctx.restore();
    }

    function drawSingleObstacle(obs) {
        ctx.save();
        const x = obs.lane * LANE_WIDTH + LANE_WIDTH / 2;
        const y = obs.y;

        if (obs.img && obs.img.complete && obs.img.naturalWidth !== 0) {
            ctx.translate(x, y);
            ctx.rotate(obs.angle || 0);
            ctx.drawImage(obs.img, -OBSTACLE_SIZE / 2, -OBSTACLE_SIZE / 2, OBSTACLE_SIZE, OBSTACLE_SIZE);
        } else {
            ctx.beginPath();
            ctx.arc(x, y, OBSTACLE_RADIUS, 0, 2 * Math.PI);
            ctx.fillStyle = obs.color;
            ctx.shadowColor = obs.color;
            ctx.shadowBlur = 16;
            ctx.fill();
        }

        ctx.restore();
    }

    function drawObstacles() {
        for (const obs of obstacles) {
            drawSingleObstacle(obs);
        }
    }

    function drawStars() {
        for (const star of stars) {
            ctx.save();
            const x = star.lane * LANE_WIDTH + LANE_WIDTH / 2;
            const y = star.y;
            const size = STAR_RADIUS * 2;
            ctx.shadowColor = 'rgba(128, 255, 255, 0.9)';
            ctx.shadowBlur = 14;
            ctx.fillStyle = 'rgba(128, 255, 255, 0.18)';
            ctx.beginPath();
            ctx.arc(x, y, size * 0.65, 0, 2 * Math.PI);
            ctx.fill();
            ctx.restore();

            ctx.save();
            if (starImage.complete && starImage.naturalWidth !== 0) {
                ctx.drawImage(starImage, x - size / 2, y - size / 2, size, size);
            } else {
                ctx.beginPath();
                ctx.arc(x, y, STAR_RADIUS, 0, 2 * Math.PI);
                ctx.fillStyle = '#fff';
                ctx.shadowColor = '#0ff';
                ctx.shadowBlur = 16;
                ctx.fill();
            }
            ctx.restore();
        }
    }

    function drawScore() {
        let text = 'Score: ' + Math.floor(score);

        if (player.immune) {
            const remaining = immunityEnd - Date.now();
            if (remaining <= 3000 && remaining > 0) {
                text += ' | Immunity: ' + Math.ceil(remaining / 1000) + 's';
            }
        }

        scoreDisplay.textContent = text;
    }

    function draw() {
        drawBackground();

        if (player.rolling) {
            drawStars();
            for (const obs of obstacles) {
                if (obs.y < player.y) drawSingleObstacle(obs);
            }
            drawPlayer();
            for (const obs of obstacles) {
                if (obs.y >= player.y) drawSingleObstacle(obs);
            }
        } else {
            drawObstacles();
            drawStars();
            drawPlayer();
        }

        drawScore();
    }

    function drawPreview() {
        drawBackground();
        ctx.font = '2em Arial';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('Space Runner', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40);
        ctx.font = '1.2em Arial';
        ctx.fillText('Press Start to Play', GAME_WIDTH / 2, GAME_HEIGHT / 2);
    }

    function updatePlayer() {
        if (player.jumping) {
            const t = (Date.now() - player.jumpStart) / JUMP_DURATION;
            if (t < 1) {
                player.y = PLAYER_Y - Math.sin(Math.PI * t) * JUMP_HEIGHT;
            } else {
                player.jumping = false;
                player.y = PLAYER_Y;
            }
        }

        if (player.moving) {
            const t = (Date.now() - player.moveStart) / PLAYER_MOVE_DURATION;
            if (t < 1) {
                player.x = player.startX + (player.targetLane * LANE_WIDTH + LANE_WIDTH / 2 - player.startX) * t;
            } else {
                player.moving = false;
                player.lane = player.targetLane;
                player.x = player.targetLane * LANE_WIDTH + LANE_WIDTH / 2;
            }
        }

        if (player.rolling) {
            const t = (Date.now() - player.rollStart) / ROLL_DURATION;
            if (t < 1) {
                player.y = PLAYER_Y + ROLL_HEIGHT * Math.sin(Math.PI * t);
            } else {
                player.rolling = false;
                player.y = PLAYER_Y;
            }
        }

        if (player.immune && Date.now() > immunityEnd) {
            player.immune = false;
            immunityEnd = 0;
        }
    }

    function updateObstacles(dt) {
        for (const obs of obstacles) {
            obs.y += speed * dt;
        }
        obstacles = obstacles.filter(obs => obs.y < GAME_HEIGHT + OBSTACLE_RADIUS);
    }

    function updateStars(dt) {
        for (const star of stars) {
            star.y += (speed * 0.5) * dt;
        }
        stars = stars.filter(star => star.y < GAME_HEIGHT + STAR_RADIUS);
    }

    function spawnObstacle() {
        const colors = ['#f55', '#5f5', '#55f', '#ff5'];
        const roll = Math.random();
        let lanes;

        if (roll < 0.02) {
            lanes = [0, 1, 2];
        } else if (roll < 0.17) {
            lanes = Math.random() < 0.5 ? [0, 1] : [1, 2];
        } else {
            lanes = [Math.floor(Math.random() * LANES)];
        }

        for (const lane of lanes) {
            const planetIndex = Math.floor(Math.random() * planetImages.length);
            obstacles.push({
                lane,
                y: -OBSTACLE_RADIUS,
                img: planetImages[planetIndex],
                color: colors[planetIndex % colors.length],
                angle: Math.random() * Math.PI * 2
            });
        }
    }

    function spawnStar() {
        const lane = Math.floor(Math.random() * LANES);
        stars.push({
            lane,
            y: -STAR_RADIUS
        });
    }

    function checkCollisions() {
        for (const obs of obstacles) {
            if (obs.lane === player.lane) {
                const dist = Math.abs(obs.y - player.y);
                if (dist < PLAYER_RADIUS + OBSTACLE_HIT_RADIUS) {
                    if (player.jumping || player.rolling) continue;
                    if (player.immune) continue;
                    endGame();
                    return;
                }
            }
        }

        for (let i = 0; i < stars.length; i++) {
            const star = stars[i];
            if (star.lane === player.lane && Math.abs(star.y - player.y) < PLAYER_RADIUS + STAR_RADIUS) {
                player.immune = true;
                immunityEnd = Date.now() + IMMUNITY_DURATION;
                stars.splice(i, 1);
                break;
            }
        }
    }

    function endGame() {
        gameState = 'gameover';
        scoreDisplay.classList.add('hidden');

        const prevHighscore = highscore || 0;
        if (score > prevHighscore) {
            highscore = Math.floor(score);
            localStorage.setItem('spaceRunnerHighscore', highscore);
            newHighscore.style.display = 'block';
        } else {
            newHighscore.style.display = 'none';
        }

        finalScore.textContent = 'Score: ' + Math.floor(score);
        finalHighscore.textContent = 'Highscore: ' + (highscore || 0);

        if (window.ArcadeAchievements?.onSpaceRunnerGameOver) {
            window.ArcadeAchievements.onSpaceRunnerGameOver(highscore || 0);
        }

        startScreen.classList.add('hidden');
        gameOverScreen.classList.remove('hidden');
    }

    function gameLoop() {
        if (gameState !== 'playing') return;

        const now = Date.now();
        const dt = (now - (gameLoop.lastTime || now)) / 16.67;
        gameLoop.lastTime = now;
        score = now - gameStartTime;
        updatePlayer();
        updateObstacles(dt);
        updateStars(dt);

        if (now - lastObstacleTime > 900 - Math.min(600, speed * 40)) {
            spawnObstacle();
            lastObstacleTime = now;
        }

        if (now - lastStarTime > 20000 + Math.random() * 30000) {
            spawnStar();
            lastStarTime = now;
        }

        if (now - lastSpeedIncrease > 20000) {
            speed += 1.2;
            lastSpeedIncrease = now;
        }

        checkCollisions();
        draw();

        if (gameState === 'playing') {
            animationId = requestAnimationFrame(gameLoop);
        }
    }

    function startGame() {
        resetGame();
        gameState = 'playing';
        startScreen.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
        newHighscore.style.display = 'none';
        gameLoop.lastTime = Date.now();
        animationId = requestAnimationFrame(gameLoop);
    }

    function handleKey(e) {
        if (gameState !== 'playing') return;

        if (e.code === 'Space' && !player.jumping && !player.rolling) {
            player.jumping = true;
            player.jumpStart = Date.now();
        } else if (e.code === 'KeyS' && !player.rolling && !player.jumping) {
            player.rolling = true;
            player.rollStart = Date.now();
        } else if (e.code === 'KeyA' && !player.moving && player.targetLane > 0) {
            player.targetLane--;
            player.startX = player.x;
            player.moveStart = Date.now();
            player.moving = true;
        } else if (e.code === 'KeyD' && !player.moving && player.targetLane < LANES - 1) {
            player.targetLane++;
            player.startX = player.x;
            player.moveStart = Date.now();
            player.moving = true;
        }
    }

    function stop() {
        gameState = 'idle';

        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }

        startScreen.classList.remove('hidden');
        gameOverScreen.classList.add('hidden');
        scoreDisplay.classList.add('hidden');
        newHighscore.style.display = 'none';
    }

    function open(gameCanvas, gameCtx) {
        canvas = gameCanvas;
        ctx = gameCtx;
        canvas.width = GAME_WIDTH;
        canvas.height = GAME_HEIGHT;
        highscore = parseInt(localStorage.getItem('spaceRunnerHighscore') || '0', 10);
        highscoreValue.textContent = highscore;
        gameState = 'start';
        startScreen.classList.remove('hidden');
        gameOverScreen.classList.add('hidden');
        scoreDisplay.classList.add('hidden');
        drawPreview();
    }

    startButton.addEventListener('click', startGame);
    playAgainButton.addEventListener('click', startGame);

    return {
        open,
        stop,
        handleKey
    };
})();
