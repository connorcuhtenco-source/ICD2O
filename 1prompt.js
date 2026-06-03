// Space Runner Infinite Runner Game
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startButton = document.getElementById('startButton');
const playAgainButton = document.getElementById('playAgainButton');
const highscoreValue = document.getElementById('highscoreValue');
const finalScore = document.getElementById('finalScore');
const finalHighscore = document.getElementById('finalHighscore');
const newHighscore = document.getElementById('newHighscore');
const scoreDisplay = document.getElementById('scoreDisplay');
const yaySound = document.getElementById('yaySound');
const fartSound = document.getElementById('fartSound');

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
const IMMUNITY_DURATION = 12000; // ms (increased so stars grant longer immunity)

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

let gameState = 'start';
let player, obstacles, stars, score, highscore, speed, lastObstacleTime, lastStarTime, immunity, immunityEnd, lastSpeedIncrease, gameStartTime;

function resetGame() {
    player = {
        lane: 1, // 0: left, 1: center, 2: right
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
    immunity = false;
    immunityEnd = 0;
    lastSpeedIncrease = 0;
    gameStartTime = Date.now();
    scoreDisplay.innerText = 'Score: 0';
    scoreDisplay.style.display = 'block';
}

function drawBackground() {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // Draw stars
    for (let i = 0; i < 120; i++) {
        ctx.fillStyle = '#fff';
        let x = Math.random() * GAME_WIDTH;
        let y = Math.random() * GAME_HEIGHT;
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

function drawObstacles() {
    for (let obs of obstacles) {
        drawSingleObstacle(obs);
    }
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

function drawStars() {
    for (let star of stars) {
        ctx.save();
        const x = star.lane * LANE_WIDTH + LANE_WIDTH / 2;
        const y = star.y;
        const size = STAR_RADIUS * 2;
        // Draw glowing halo behind the sprite
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
    scoreDisplay.innerText = text;
}

function draw() {
    drawBackground();
    // When rolling, draw the player before obstacles so planets appear on top
    if (player.rolling) {
        drawStars();
        // draw obstacles behind the player
        for (let obs of obstacles) {
            if (obs.y < player.y) drawSingleObstacle(obs);
        }
        drawPlayer();
        // draw obstacles in front of the player so they appear to overlap
        for (let obs of obstacles) {
            if (obs.y >= player.y) drawSingleObstacle(obs);
        }
    } else {
        drawObstacles();
        drawStars();
        drawPlayer();
    }
    drawScore();
}

function updatePlayer() {
    // Jump
    if (player.jumping) {
        let t = (Date.now() - player.jumpStart) / JUMP_DURATION;
        if (t < 1) {
            player.y = PLAYER_Y - Math.sin(Math.PI * t) * JUMP_HEIGHT;
        } else {
            player.jumping = false;
            player.y = PLAYER_Y;
        }
    }
    // Horizontal movement
    if (player.moving) {
        let t = (Date.now() - player.moveStart) / PLAYER_MOVE_DURATION;
        if (t < 1) {
            player.x = player.startX + (player.targetLane * LANE_WIDTH + LANE_WIDTH / 2 - player.startX) * t;
        } else {
            player.moving = false;
            player.lane = player.targetLane;
            player.x = player.targetLane * LANE_WIDTH + LANE_WIDTH / 2;
        }
    }
    // Roll
    if (player.rolling) {
        let t = (Date.now() - player.rollStart) / ROLL_DURATION;
        if (t < 1) {
            player.y = PLAYER_Y + ROLL_HEIGHT * Math.sin(Math.PI * t);
        } else {
            player.rolling = false;
            player.y = PLAYER_Y;
        }
    }
    // Immunity
    if (player.immune && Date.now() > immunityEnd) {
        player.immune = false;
        immunityEnd = 0;
    }
}

function updateObstacles(dt) {
    for (let obs of obstacles) {
        obs.y += speed * dt;
    }
    obstacles = obstacles.filter(obs => obs.y < GAME_HEIGHT + OBSTACLE_RADIUS);
}

function updateStars(dt) {
    for (let star of stars) {
        // Stars move slower so they remain on-screen longer and are easier to collect
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

    for (let lane of lanes) {
        let planetIndex = Math.floor(Math.random() * planetImages.length);
        obstacles.push({
            lane: lane,
            y: -OBSTACLE_RADIUS,
            img: planetImages[planetIndex],
            color: colors[planetIndex % colors.length],
            angle: Math.random() * Math.PI * 2
        });
    }
}

function spawnStar() {
    let lane = Math.floor(Math.random() * LANES);
    stars.push({
        lane: lane,
        y: -STAR_RADIUS
    });
}

function checkCollisions() {
    // Obstacles
    for (let obs of obstacles) {
        if (obs.lane === player.lane) {
            let dist = Math.abs(obs.y - player.y);
            if (dist < PLAYER_RADIUS + OBSTACLE_HIT_RADIUS) {
                // Jumping or rolling should dodge obstacles while active
                if (player.jumping || player.rolling) continue;
                // If immune, ignore
                if (player.immune) continue;
                // Hit!
                endGame();
                return;
            }
        }
    }
    // Stars
    for (let i = 0; i < stars.length; i++) {
        let star = stars[i];
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
    scoreDisplay.style.display = 'none';
    let prevHighscore = highscore || 0;
    if (score > prevHighscore) {
        highscore = Math.floor(score);
        localStorage.setItem('spaceRunnerHighscore', highscore);
        newHighscore.style.display = 'block';
    } else {
        newHighscore.style.display = 'none';
    }
    finalScore.innerText = 'Score: ' + Math.floor(score);
    finalHighscore.innerText = 'Highscore: ' + (highscore || 0);
    gameOverScreen.style.display = 'flex';
}

function gameLoop() {
    if (gameState !== 'playing') return;
    let now = Date.now();
    let dt = (now - (gameLoop.lastTime || now)) / 16.67; // ~60fps
    gameLoop.lastTime = now;
    score = now - gameStartTime;
    updatePlayer();
    updateObstacles(dt);
    updateStars(dt);
    // Spawn obstacles
    if (now - lastObstacleTime > 900 - Math.min(600, speed * 40)) {
        spawnObstacle();
        lastObstacleTime = now;
    }
    // Spawn stars (rarer)
    // Previously ~8-20s; now much rarer (20-50s) to make stars more valuable
    if (now - lastStarTime > 20000 + Math.random() * 30000) {
        spawnStar();
        lastStarTime = now;
    }
    // Speed ramp
    if (now - lastSpeedIncrease > 20000) {
        speed += 1.2;
        lastSpeedIncrease = now;
    }
    checkCollisions();
    draw();
    if (gameState === 'playing') {
        requestAnimationFrame(gameLoop);
    }
}

function startGame() {
    resetGame();
    gameState = 'playing';
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    newHighscore.style.display = 'none';
    gameLoop.lastTime = Date.now();
    requestAnimationFrame(gameLoop);
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

document.addEventListener('keydown', handleKey);
startButton.addEventListener('click', startGame);
playAgainButton.addEventListener('click', startGame);

// Highscore from localStorage
highscore = parseInt(localStorage.getItem('spaceRunnerHighscore') || '0', 10);
highscoreValue.innerText = highscore;

// Initial draw
ctx.fillStyle = '#111';
ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
// Draw some stars for the start screen
for (let i = 0; i < 120; i++) {
    ctx.fillStyle = '#fff';
    let x = Math.random() * GAME_WIDTH;
    let y = Math.random() * GAME_HEIGHT;
    ctx.globalAlpha = Math.random() * 0.7 + 0.3;
    ctx.beginPath();
    ctx.arc(x, y, Math.random() * 1.2 + 0.5, 0, 2 * Math.PI);
    ctx.fill();
}
ctx.globalAlpha = 1;
ctx.font = '2em Arial';
ctx.fillStyle = '#fff';
ctx.textAlign = 'center';
ctx.fillText('Space Runner', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40);
ctx.font = '1.2em Arial';
ctx.fillText('Press Start to Play', GAME_WIDTH / 2, GAME_HEIGHT / 2);