const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const menu = document.getElementById('menu');
const gameContainer = document.getElementById('gameContainer');
const gameTitle = document.getElementById('gameTitle');
const gameMessage = document.getElementById('gameMessage');
const highScoreText = document.getElementById('highScore');

const tagZoneBtn = document.getElementById('tagZoneBtn');
const platformerBtn = document.getElementById('platformerBtn');
const playBtn = document.getElementById('playBtn');
const backBtn = document.getElementById('backBtn');
const restartBtn = document.getElementById('restartBtn');

const tagHud = document.getElementById('tagHud');
const tagTimerText = document.getElementById('tagTimer');
const tagLevelText = document.getElementById('tagLevel');
const inventorySlots = document.querySelectorAll('.inventory-slot');

let highScore = 0;
let currentGame = null;
let gameRunning = false;
let animationId = null;
let lastTime = 0;
let keys = {};

let bird = null;
let pipes = [];
let clouds = [];
let score = 0;
let fastStar = null;
let pipesPassedForStar = 0;
let starPowerTimer = 0;

const gravity = 0.3;
const lift = -6.5;
const PIPE_SPEED = 2.4;
const PIPE_WIDTH = 50;
const PIPE_GAP = 140;
const STAR_CHANCE = 0.25;
const STAR_POWER_TIME = 10;
const STAR_SPEED_MULTIPLIER = 1.75;

const WORLD_WIDTH = 1800;
const WORLD_HEIGHT = 1800;
const TAG_LEVEL_TIME = 25;
const TAG_MAX_INVENTORY = 3;

let tagPlayer = null;
let taggers = [];
let tagItems = [];
let tagInventory = [];
let tagLevel = 1;
let tagSurvivalTime = 0;
let tagFreezeTimer = 0;
let tagShieldTimer = 0;
let tagBoostTimer = 0;
let countdown = 3;
let countdownActive = false;
let camX = 0;
let camY = 0;

const itemTypes = [
    { name: 'Boost', className: 'boost', color: '#ffe66d' },
    { name: 'Freeze', className: 'freeze', color: '#74d2ff' },
    { name: 'Shield', className: 'shield', color: '#ff5fa2' }
];

function getFastEagleSpeed() {
    return starPowerTimer > 0 ? PIPE_SPEED * STAR_SPEED_MULTIPLIER : PIPE_SPEED;
}

function showMenu() {
    stopGame();
    currentGame = null;
    menu.classList.remove('hidden');
    gameContainer.classList.add('hidden');
    tagHud.classList.add('hidden');
}

function showGameScreen(name, message, useCanvas = false, showRestart = false) {
    menu.classList.add('hidden');
    gameContainer.classList.remove('hidden');

    gameTitle.textContent = name;
    gameMessage.textContent = message;

    canvas.classList.toggle('hidden', !useCanvas);
    restartBtn.classList.toggle('hidden', !showRestart);
}

function updateHighScore() {
    highScoreText.textContent = `Fast Eagle High Score: ${highScore}`;
}

function stopGame() {
    gameRunning = false;

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

function startLoop() {
    stopGame();
    gameRunning = true;
    lastTime = performance.now();
    animationId = requestAnimationFrame(loop);
}

function loop(timestamp) {
    if (!gameRunning) return;

    const delta = Math.min((timestamp - lastTime) / 1000, 0.033);
    lastTime = timestamp;

    if (currentGame === 'fastEagle') {
        updateFastEagle();
        drawFastEagle();
    }

    if (currentGame === 'tagZone') {
        updateTagZone(delta);
        drawTagZone();
    }

    animationId = requestAnimationFrame(loop);
}

function initFastEagle() {
    currentGame = 'fastEagle';
    canvas.width = 600;
    canvas.height = 720;
    score = 0;
    fastStar = null;
    pipesPassedForStar = 0;
    starPowerTimer = 0;

    bird = {
        x: 80,
        y: 250,
        width: 26,
        height: 24,
        velocity: 0,
        rotation: 0,
        wingAngle: 0
    };

    pipes = [];

    clouds = Array.from({ length: 5 }, () => ({
        x: Math.random() * canvas.width,
        y: 40 + Math.random() * 140,
        size: 18 + Math.random() * 22,
        speed: 0.2 + Math.random() * 0.4,
        alpha: 0.5 + Math.random() * 0.2
    }));

    spawnPipe();
}

function startFastEagle() {
    tagHud.classList.add('hidden');
    showGameScreen('Fast Eagle', '', true, false);
    initFastEagle();
    restartBtn.classList.add('hidden');
    startLoop();
}

function restartFastEagle() {
    showGameScreen('Fast Eagle', '', true, false);
    initFastEagle();
    restartBtn.classList.add('hidden');
    startLoop();
}

function flap() {
    if (currentGame !== 'fastEagle' || !gameRunning) return;
    bird.velocity = lift;
}

function updateFastEagle() {
    const currentPipeSpeed = getFastEagleSpeed();

    if (starPowerTimer > 0) {
        starPowerTimer = Math.max(0, starPowerTimer - 1 / 60);
    }

    bird.velocity += gravity;
    bird.y += bird.velocity;
    bird.wingAngle += 0.25;
    bird.rotation = Math.max(Math.min(bird.velocity * 0.08, 0.6), -0.6);

    clouds.forEach(cloud => {
        cloud.x -= cloud.speed * (starPowerTimer > 0 ? 2 : 1);

        if (cloud.x + cloud.size * 3 < 0) {
            cloud.x = canvas.width + 20;
            cloud.y = 40 + Math.random() * 140;
        }
    });

    if (bird.y + bird.height > canvas.height || bird.y < 0) {
        endFastEagle();
        return;
    }

    pipes.forEach(pipe => {
        pipe.x -= currentPipeSpeed;

        if (!pipe.passed && pipe.x + PIPE_WIDTH < bird.x) {
            score += 1;
            pipe.passed = true;
            pipesPassedForStar += 1;

            if (pipesPassedForStar >= 3) {
                pipesPassedForStar = 0;

                if (!fastStar && Math.random() < STAR_CHANCE) {
                    spawnFastStar();
                }
            }
        }

        const hitPipe =
            bird.x < pipe.x + PIPE_WIDTH &&
            bird.x + bird.width > pipe.x &&
            (bird.y < pipe.top || bird.y + bird.height > pipe.top + PIPE_GAP);

        if (hitPipe && starPowerTimer <= 0) {
            endFastEagle();
        }
    });

    if (fastStar) {
        fastStar.x -= currentPipeSpeed;

        if (circleRectCollision(fastStar, bird)) {
            starPowerTimer = STAR_POWER_TIME;
            fastStar = null;
            gameMessage.textContent = 'Rainbow star power!';
        } else if (fastStar.x + fastStar.radius < 0) {
            fastStar = null;
        }
    }

    pipes = pipes.filter(pipe => pipe.x + PIPE_WIDTH > 0);

    if (pipes.length === 0 || pipes[pipes.length - 1].x < 220) {
        spawnPipe();
    }
}

function spawnPipe() {
    const top = Math.random() * (canvas.height - PIPE_GAP - 120) + 50;

    pipes.push({
        x: canvas.width,
        top,
        passed: false
    });
}

function spawnFastStar() {
    fastStar = {
        x: canvas.width + 40,
        y: 90 + Math.random() * (canvas.height - 180),
        radius: 18,
        rotation: 0
    };
}

function circleRectCollision(circle, rect) {
    const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
    const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
    const distanceX = circle.x - closestX;
    const distanceY = circle.y - closestY;

    return distanceX * distanceX + distanceY * distanceY < circle.radius * circle.radius;
}

function drawFastEagle() {
    drawSky();
    drawClouds();
    drawPipes();

    if (fastStar) {
        drawFastStar();
    }

    drawBird();
    drawScore();

    if (starPowerTimer > 0) {
        drawStarPowerTimer();
    }
}

function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, '#0b2f66');
    sky.addColorStop(0.5, '#1e4a8d');
    sky.addColorStop(1, '#071122');

    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawClouds() {
    clouds.forEach(cloud => {
        ctx.save();
        ctx.globalAlpha = cloud.alpha;
        ctx.fillStyle = '#ffffff';

        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.size * 1.1, cloud.y - cloud.size * 0.35, cloud.size * 0.75, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.size * 2.1, cloud.y, cloud.size * 0.9, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    });
}

function drawPipes() {
    pipes.forEach(pipe => {
        ctx.fillStyle = '#2c8f4a';
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
        ctx.fillRect(pipe.x, pipe.top + PIPE_GAP, PIPE_WIDTH, canvas.height - pipe.top - PIPE_GAP);

        ctx.fillStyle = '#1f6d3a';
        ctx.fillRect(pipe.x - 4, pipe.top - 18, PIPE_WIDTH + 8, 18);
        ctx.fillRect(pipe.x - 4, pipe.top + PIPE_GAP, PIPE_WIDTH + 8, 18);
    });
}

function drawFastStar() {
    fastStar.rotation += 0.08;

    ctx.save();
    ctx.translate(fastStar.x, fastStar.y);
    ctx.rotate(fastStar.rotation);

    const points = 5;
    const outerRadius = fastStar.radius;
    const innerRadius = fastStar.radius * 0.45;

    ctx.beginPath();

    for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (Math.PI / points) * i - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }

    ctx.closePath();

    const rainbow = ctx.createLinearGradient(-outerRadius, -outerRadius, outerRadius, outerRadius);
    rainbow.addColorStop(0, '#ff4d6d');
    rainbow.addColorStop(0.25, '#ffe66d');
    rainbow.addColorStop(0.5, '#00ffcc');
    rainbow.addColorStop(0.75, '#74d2ff');
    rainbow.addColorStop(1, '#c77dff');

    ctx.fillStyle = rainbow;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
}

function drawStarPowerTimer() {
    ctx.fillStyle = '#ffe66d';
    ctx.font = '18px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`Star: ${Math.ceil(starPowerTimer)}s`, 14, 42);
}

function drawBird() {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rotation);

    const wingFlap = Math.sin(bird.wingAngle) * 6;

    ctx.fillStyle = starPowerTimer > 0 ? '#ffe66d' : '#4d3826';
    ctx.beginPath();
    ctx.ellipse(8, 12, 16, 11, -0.26, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = starPowerTimer > 0 ? '#ff4d6d' : '#2f2316';
    ctx.beginPath();
    ctx.moveTo(-8, 14);
    ctx.lineTo(-18, 16);
    ctx.lineTo(-20, 20);
    ctx.lineTo(-14, 22);
    ctx.lineTo(-8, 18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = starPowerTimer > 0 ? '#00ffcc' : '#332715';
    ctx.beginPath();
    ctx.moveTo(-2, 6);
    ctx.quadraticCurveTo(12, -16 - wingFlap, 30, 10);
    ctx.lineTo(18, 12);
    ctx.quadraticCurveTo(8, 5, -2, 6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = starPowerTimer > 0 ? '#74d2ff' : '#5d4b3a';
    ctx.beginPath();
    ctx.moveTo(2, 6);
    ctx.quadraticCurveTo(14, -6 - wingFlap, 26, 8);
    ctx.lineTo(18, 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f3f3ec';
    ctx.beginPath();
    ctx.arc(26, 6, 6.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e8b832';
    ctx.beginPath();
    ctx.moveTo(31, 6);
    ctx.lineTo(39, 8);
    ctx.lineTo(31, 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(22.5, 4.5, 1.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawScore() {
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`Score: ${score}`, 14, 14);
    ctx.fillText(`High: ${highScore}`, canvas.width - 160, 14);
}

function endFastEagle() {
    gameRunning = false;
    highScore = Math.max(highScore, score);
    updateHighScore();
    gameMessage.textContent = `Game Over - Score ${score}`;
    restartBtn.classList.remove('hidden');
}

function startTagZone() {
    currentGame = 'tagZone';
    canvas.width = 960;
    canvas.height = 620;

    tagLevel = 1;
    setupTagLevel();

    tagHud.classList.remove('hidden');
    showGameScreen('Tag Zone', 'Get ready...', true, false);
    restartBtn.classList.add('hidden');
    startLoop();
}

function restartTagZone() {
    startTagZone();
}

function setupTagLevel() {
    tagSurvivalTime = 0;
    tagFreezeTimer = 0;
    tagShieldTimer = 0;
    tagBoostTimer = 0;
    countdown = 3;
    countdownActive = true;
    tagInventory = [];

    tagPlayer = {
        x: WORLD_WIDTH / 2,
        y: WORLD_HEIGHT / 2,
        width: 30,
        height: 30,
        speed: 275
    };

    const taggerCount = Math.min(2 + tagLevel, 7);

    taggers = Array.from({ length: taggerCount }, () => ({
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        width: 32,
        height: 32,
        speed: 120 + tagLevel * 18
    }));

    const itemCount = Math.max(18 - tagLevel * 2, 8);
    tagItems = Array.from({ length: itemCount }, createTagItem);

    gameMessage.textContent = 'Get ready...';
    updateInventoryHud();
    updateTagHud();
}

function createTagItem() {
    const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];

    return {
        x: 80 + Math.random() * (WORLD_WIDTH - 160),
        y: 80 + Math.random() * (WORLD_HEIGHT - 160),
        radius: 13,
        type
    };
}

function updateTagZone(delta) {
    if (countdownActive) {
        countdown -= delta;

        if (countdown <= 0) {
            countdown = 0;
            countdownActive = false;
            gameMessage.textContent = 'Go!';
        }

        camX = clamp(tagPlayer.x + tagPlayer.width / 2 - canvas.width / 2, 0, WORLD_WIDTH - canvas.width);
        camY = clamp(tagPlayer.y + tagPlayer.height / 2 - canvas.height / 2, 0, WORLD_HEIGHT - canvas.height);

        updateTagHud();
        return;
    }

    tagSurvivalTime += delta;
    tagFreezeTimer = Math.max(0, tagFreezeTimer - delta);
    tagShieldTimer = Math.max(0, tagShieldTimer - delta);
    tagBoostTimer = Math.max(0, tagBoostTimer - delta);

    moveTagPlayer(delta);
    moveTaggers(delta);
    collectTagItems();
    checkTaggerCollisions();

    if (tagSurvivalTime >= TAG_LEVEL_TIME) {
        tagLevel += 1;
        gameMessage.textContent = `Level ${tagLevel}`;
        setupTagLevel();
    }

    camX = clamp(tagPlayer.x + tagPlayer.width / 2 - canvas.width / 2, 0, WORLD_WIDTH - canvas.width);
    camY = clamp(tagPlayer.y + tagPlayer.height / 2 - canvas.height / 2, 0, WORLD_HEIGHT - canvas.height);

    updateTagHud();
}

function moveTagPlayer(delta) {
    let dx = 0;
    let dy = 0;

    if (keys.ArrowUp || keys.KeyW) dy -= 1;
    if (keys.ArrowDown || keys.KeyS) dy += 1;
    if (keys.ArrowLeft || keys.KeyA) dx -= 1;
    if (keys.ArrowRight || keys.KeyD) dx += 1;

    if (dx !== 0 || dy !== 0) {
        const length = Math.hypot(dx, dy);
        dx /= length;
        dy /= length;
    }

    const speed = tagBoostTimer > 0 ? tagPlayer.speed * 1.65 : tagPlayer.speed;

    tagPlayer.x = clamp(tagPlayer.x + dx * speed * delta, 0, WORLD_WIDTH - tagPlayer.width);
    tagPlayer.y = clamp(tagPlayer.y + dy * speed * delta, 0, WORLD_HEIGHT - tagPlayer.height);
}

function moveTaggers(delta) {
    if (tagFreezeTimer > 0) return;

    taggers.forEach(tagger => {
        const targetX = tagPlayer.x - tagger.x;
        const targetY = tagPlayer.y - tagger.y;
        const distance = Math.hypot(targetX, targetY) || 1;

        tagger.x += (targetX / distance) * tagger.speed * delta;
        tagger.y += (targetY / distance) * tagger.speed * delta;

        tagger.x = clamp(tagger.x, 0, WORLD_WIDTH - tagger.width);
        tagger.y = clamp(tagger.y, 0, WORLD_HEIGHT - tagger.height);
    });
}

function collectTagItems() {
    tagItems = tagItems.filter(item => {
        const playerCenterX = tagPlayer.x + tagPlayer.width / 2;
        const playerCenterY = tagPlayer.y + tagPlayer.height / 2;
        const distance = Math.hypot(playerCenterX - item.x, playerCenterY - item.y);

        if (distance < item.radius + tagPlayer.width / 2) {
            if (tagInventory.length < TAG_MAX_INVENTORY) {
                tagInventory.push(item.type);
                updateInventoryHud();
            }

            return false;
        }

        return true;
    });
}

function checkTaggerCollisions() {
    for (const tagger of taggers) {
        if (rectsOverlap(tagPlayer, tagger)) {
            if (tagShieldTimer > 0) {
                tagger.x = Math.random() * WORLD_WIDTH;
                tagger.y = Math.random() * WORLD_HEIGHT;
                tagShieldTimer = 0;
                gameMessage.textContent = 'Shield saved you';
                return;
            }

            endTagZone();
            return;
        }
    }
}

function useTagItem() {
    if (currentGame !== 'tagZone' || !gameRunning || countdownActive || tagInventory.length === 0) return;

    const item = tagInventory.shift();

    if (item.name === 'Boost') {
        tagBoostTimer = 4;
        gameMessage.textContent = 'Boost activated';
    }

    if (item.name === 'Freeze') {
        tagFreezeTimer = 3;
        gameMessage.textContent = 'Freeze activated';
    }

    if (item.name === 'Shield') {
        tagShieldTimer = 6;
        gameMessage.textContent = 'Shield activated';
    }

    updateInventoryHud();
}

function endTagZone() {
    gameRunning = false;
    gameMessage.textContent = `Tagged on Level ${tagLevel}`;
    restartBtn.classList.remove('hidden');
}

function drawTagZone() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camX, -camY);

    drawTagMap();
    drawTagItems();
    drawTaggers();
    drawTagPlayer();

    ctx.restore();

    if (countdownActive) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 72px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.ceil(countdown), canvas.width / 2, canvas.height / 2);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }
}

function drawTagMap() {
    ctx.fillStyle = '#122018';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    for (let x = 0; x <= WORLD_WIDTH; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, WORLD_HEIGHT);
        ctx.stroke();
    }

    for (let y = 0; y <= WORLD_HEIGHT; y += 100) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WORLD_WIDTH, y);
        ctx.stroke();
    }

    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}

function drawTagItems() {
    tagItems.forEach(item => {
        ctx.fillStyle = item.type.color;
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

function drawTaggers() {
    taggers.forEach(tagger => {
        ctx.fillStyle = tagFreezeTimer > 0 ? '#8be9ff' : '#ff4d4d';
        ctx.fillRect(tagger.x, tagger.y, tagger.width, tagger.height);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(tagger.x, tagger.y, tagger.width, tagger.height);
    });
}

function drawTagPlayer() {
    ctx.fillStyle = tagShieldTimer > 0 ? '#ff5fa2' : '#00ffcc';
    ctx.fillRect(tagPlayer.x, tagPlayer.y, tagPlayer.width, tagPlayer.height);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(tagPlayer.x, tagPlayer.y, tagPlayer.width, tagPlayer.height);

    if (tagShieldTimer > 0) {
        ctx.strokeStyle = 'rgba(255, 95, 162, 0.8)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(tagPlayer.x + tagPlayer.width / 2, tagPlayer.y + tagPlayer.height / 2, 28, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function updateTagHud() {
    tagTimerText.textContent = Math.ceil(TAG_LEVEL_TIME - tagSurvivalTime);
    tagLevelText.textContent = tagLevel;
}

function updateInventoryHud() {
    inventorySlots.forEach((slot, index) => {
        slot.className = 'inventory-slot';
        slot.textContent = '';

        const item = tagInventory[index];

        if (item) {
            slot.classList.add(item.className);
            slot.textContent = item.name;
        }
    });
}

function rectsOverlap(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

document.addEventListener('keydown', e => {
    keys[e.code] = true;

    if (e.code === 'Space') {
        e.preventDefault();

        if (currentGame === 'fastEagle') {
            if (gameRunning) {
                flap();
            } else {
                restartFastEagle();
            }
        }

        if (currentGame === 'tagZone') {
            useTagItem();
        }
    }
});

document.addEventListener('keyup', e => {
    keys[e.code] = false;
});

canvas.addEventListener('click', () => {
    if (currentGame === 'fastEagle') {
        flap();
    }
});

tagZoneBtn.addEventListener('click', startTagZone);

platformerBtn.addEventListener('click', () => {
    tagHud.classList.add('hidden');
    currentGame = 'spaceRunner';
    stopGame();
    showGameScreen('Space Runner', 'Space Runner is under construction. Stay tuned.', false, false);
});

playBtn.addEventListener('click', startFastEagle);

restartBtn.addEventListener('click', () => {
    if (currentGame === 'fastEagle') {
        restartFastEagle();
    }

    if (currentGame === 'tagZone') {
        restartTagZone();
    }
});

backBtn.addEventListener('click', showMenu);

updateHighScore();
showMenu();