const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const menu = document.getElementById('menu');
const gameContainer = document.getElementById('gameContainer');
const gameTitle = document.getElementById('gameTitle');
const gameMessage = document.getElementById('gameMessage');

const achievementsBtn = document.getElementById('achievementsBtn');
const achievementsBackdrop = document.getElementById('achievementsBackdrop');
const achievementsModal = document.getElementById('achievementsModal');
const achievementsList = document.getElementById('achievementsList');
const closeAchievementsBtn = document.getElementById('closeAchievementsBtn');

const tagZoneBtn = document.getElementById('tagZoneBtn');
const platformerBtn = document.getElementById('platformerBtn');
const playBtn = document.getElementById('playBtn');
const backBtn = document.getElementById('backBtn');
const restartBtn = document.getElementById('restartBtn');

const tagHud = document.getElementById('tagHud');
const spaceRunnerUi = document.getElementById('spaceRunnerUi');
const tagTimerText = document.getElementById('tagTimer');
const tagLevelText = document.getElementById('tagLevel');
const inventorySlots = document.querySelectorAll('.inventory-slot');

const tagPlayerIdleSprite = new Image();
tagPlayerIdleSprite.src = 'sprites/characters/owlet-idle.png';

const tagPlayerRunSprite = new Image();
tagPlayerRunSprite.src = 'sprites/characters/owlet-run.png';

const taggerRunSprites = [];

for (let i = 0; i < 6; i++) {
    const img = new Image();
    img.src = `sprites/characters/3_enemies_1_run_00${i}.png`;
    taggerRunSprites.push(img);
}

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
const PIPE_SPEED = 3.2;
const PIPE_WIDTH = 50;
const PIPE_GAP = 140;
const STAR_CHANCE = 0.25;
const STAR_POWER_TIME = 10;
const STAR_SPEED_MULTIPLIER = 1.9;

const WORLD_WIDTH = 1800;
const WORLD_HEIGHT = 1800;
const TAG_LEVEL_TIME = 25;
const TAG_MAX_INVENTORY = 3;
const TAG_MAP_TILE_SIZE = 100;
const TAG_MAP_TILE_SOURCES = [
    'sprites/map/Map_tile_52.png'
];

let tagPlayer = null;
let taggers = [];
let tagItems = [];
let tagInventory = [];
let tagMapTiles = [];
let tagMapTrees = [];
let tagMapRocks = [];
let tagHouse = null;
let tagLevel = 1;
let tagNoHitRun = true;
let tagSurvivalTime = 0;
let tagFreezeTimer = 0;
let tagShieldTimer = 0;
let tagBoostTimer = 0;
let countdown = 3;
let countdownActive = false;
let camX = 0;
let camY = 0;

let tagPlayerFrame = 0;
let tagPlayerFrameTimer = 0;
let tagPlayerFacing = 1;

let taggerFrame = 0;
let taggerFrameTimer = 0;

const TAG_PLAYER_FRAME_SIZE = 32;
const TAG_PLAYER_IDLE_FRAMES = 4;
const TAG_PLAYER_RUN_FRAMES = 6;
const TAG_PLAYER_ANIMATION_SPEED = 0.1;
const TAGGER_ANIMATION_SPEED = 0.1;

const itemTypes = [
    { name: 'Boost', className: 'boost', color: '#ffe66d' },
    { name: 'Freeze', className: 'freeze', color: '#74d2ff' },
    { name: 'Shield', className: 'shield', color: '#ff5fa2' }
];

const tagMapTileImages = TAG_MAP_TILE_SOURCES.map(src => {
    const img = new Image();
    img.src = src;
    return img;
});

function getFastEagleSpeed() {
    return starPowerTimer > 0 ? PIPE_SPEED * STAR_SPEED_MULTIPLIER : PIPE_SPEED;
}

const ACHIEVEMENTS_STORAGE_KEY = 'arcadeAchievements';
const ACHIEVEMENTS = [
    {
        id: 'true-eagle',
        name: 'True Eagle',
        description: 'Reach score 99 in Fast Eagle.',
        icon: '🦅'
    },
    {
        id: 'hardcore',
        name: 'Hardcore',
        description: 'Reach level 5 in Tag Zone without getting hit.',
        icon: '💀'
    },
    {
        id: 'how-are-you-alive',
        name: 'How are you alive?',
        description: 'Get a 200,000 high score in Space Runner.',
        icon: '🚀'
    }
];

let unlockedAchievements = new Set();

function loadAchievements() {
    try {
        const saved = JSON.parse(localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY) || '[]');
        unlockedAchievements = new Set(Array.isArray(saved) ? saved : []);
    } catch {
        unlockedAchievements = new Set();
    }

    const spaceRunnerHighscore = parseInt(localStorage.getItem('spaceRunnerHighscore') || '0', 10);
    checkSpaceRunnerAchievements(spaceRunnerHighscore);
}

function saveAchievements() {
    localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify([...unlockedAchievements]));
}

function unlockAchievement(id) {
    if (unlockedAchievements.has(id)) return;
    unlockedAchievements.add(id);
    saveAchievements();

    if (achievementsModal && !achievementsModal.classList.contains('hidden')) {
        renderAchievementsList();
    }
}

function hasAchievement(id) {
    return unlockedAchievements.has(id);
}

function renderAchievementsList() {
    if (!achievementsList) return;

    achievementsList.innerHTML = ACHIEVEMENTS.map(achievement => {
        const unlocked = hasAchievement(achievement.id);

        return `
            <article class="achievement-card ${unlocked ? 'unlocked' : 'locked'}">
                <h4>${achievement.icon} ${achievement.name}</h4>
                <p>${achievement.description}</p>
                <span class="achievement-status ${unlocked ? 'unlocked' : 'locked'}">${unlocked ? 'Unlocked' : 'Locked'}</span>
            </article>
        `;
    }).join('');
}

function openAchievementsModal() {
    if (!achievementsModal || !achievementsBackdrop) return;

    renderAchievementsList();
    achievementsBackdrop.classList.remove('hidden');
    achievementsModal.classList.remove('hidden');
    achievementsModal.setAttribute('aria-hidden', 'false');
    closeAchievementsBtn?.focus();
}

function closeAchievementsModal() {
    if (!achievementsModal || !achievementsBackdrop) return;

    achievementsBackdrop.classList.add('hidden');
    achievementsModal.classList.add('hidden');
    achievementsModal.setAttribute('aria-hidden', 'true');
}

function checkFastEagleAchievements() {
    if (score >= 99) {
        unlockAchievement('true-eagle');
    }
}

function checkTagZoneAchievements() {
    if (tagLevel >= 5 && tagNoHitRun) {
        unlockAchievement('hardcore');
    }
}

function checkSpaceRunnerAchievements(highscore) {
    if (highscore >= 200000) {
        unlockAchievement('how-are-you-alive');
    }
}

function showMenu() {
    stopGame();
    SpaceRunner.stop();
    currentGame = null;
    menu.classList.remove('hidden');
    gameContainer.classList.add('hidden');
    tagHud.classList.add('hidden');
    spaceRunnerUi.classList.add('hidden');
    gameMessage.classList.remove('hidden');
}

function showGameScreen(name, message, useCanvas = false, showRestart = false) {
    menu.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    gameTitle.textContent = name;
    gameMessage.textContent = message;
    canvas.classList.toggle('hidden', !useCanvas);
    restartBtn.classList.toggle('hidden', !showRestart);
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
        updateFastEagle(delta);
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
    spaceRunnerUi.classList.add('hidden');
    SpaceRunner.stop();
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

function updateFastEagle(delta) {
    const frameScale = delta * 60;
    const currentPipeSpeed = getFastEagleSpeed() * frameScale;

    if (starPowerTimer > 0) {
        starPowerTimer = Math.max(0, starPowerTimer - delta);
    }

    bird.velocity += gravity * frameScale;
    bird.y += bird.velocity * frameScale;
    bird.wingAngle += 0.25 * frameScale;
    bird.rotation = Math.max(Math.min(bird.velocity * 0.08, 0.6), -0.6);

    clouds.forEach(cloud => {
        cloud.x -= cloud.speed * frameScale * (starPowerTimer > 0 ? 2 : 1);

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

            if (score >= 99) {
                checkFastEagleAchievements();
            }

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

    if (pipes.length === 0 || pipes[pipes.length - 1].x < 260) {
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

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
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
    checkFastEagleAchievements();
    gameMessage.textContent = `Game Over - Score ${score}`;
    restartBtn.classList.remove('hidden');
}

function startTagZone() {
    spaceRunnerUi.classList.add('hidden');
    SpaceRunner.stop();
    currentGame = 'tagZone';
    canvas.width = 960;
    canvas.height = 620;

    tagLevel = 1;
    tagNoHitRun = true;
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
    tagPlayerFrame = 0;
    tagPlayerFrameTimer = 0;
    taggerFrame = 0;
    taggerFrameTimer = 0;

    tagPlayer = {
        x: WORLD_WIDTH / 2,
        y: WORLD_HEIGHT / 2,
        width: 64,
        height: 64,
        speed: 275,
        isMoving: false
    };

    const taggerCount = Math.min(2 + tagLevel, 7);
    taggers = Array.from({ length: taggerCount }, () => createTagger());

    const itemCount = Math.max(18 - tagLevel * 2, 8);
    tagItems = Array.from({ length: itemCount }, createTagItem);
    tagMapTiles = createTagTiles();

    gameMessage.textContent = 'Get ready...';
    updateInventoryHud();
    updateTagHud();
}

function createTagTiles() {
    const columns = Math.ceil(WORLD_WIDTH / TAG_MAP_TILE_SIZE);
    const rows = Math.ceil(WORLD_HEIGHT / TAG_MAP_TILE_SIZE);
    return Array.from({ length: rows }, () =>
        Array.from({ length: columns }, () => 0)
    );
}

function createTagHouse() {
    return {
        x: WORLD_WIDTH * 0.34,
        y: WORLD_HEIGHT * 0.30,
        width: 140,
        height: 90
    };
}

function createTagMapTrees(count = 3) {
    const trees = [];

    while (trees.length < count) {
        const tree = {
            x: 60 + Math.random() * (WORLD_WIDTH - 120),
            y: 60 + Math.random() * (WORLD_HEIGHT - 120),
            width: 28 + Math.random() * 18,
            height: 42 + Math.random() * 18
        };

        const houseBounds = {
            x: tagHouse.x - 100,
            y: tagHouse.y - 100,
            width: tagHouse.width + 200,
            height: tagHouse.height + 200
        };

        if (rectsOverlap(tree, houseBounds)) continue;
        if (Math.hypot(tree.x - WORLD_WIDTH / 2, tree.y - WORLD_HEIGHT / 2) < 160) continue;

        trees.push(tree);
    }

    return trees;
}

function createTagger() {
    let x;
    let y;
    const width = 72;
    const height = 72;
    const minDistanceFromPlayer = 450;

    do {
        x = Math.random() * (WORLD_WIDTH - width);
        y = Math.random() * (WORLD_HEIGHT - height);
    } while (
        Math.hypot(
            x + width / 2 - (tagPlayer.x + tagPlayer.width / 2),
            y + height / 2 - (tagPlayer.y + tagPlayer.height / 2)
        ) < minDistanceFromPlayer
    );

    return {
        x,
        y,
        width,
        height,
        hitboxOffsetX: 18,
        hitboxOffsetY: 16,
        hitboxWidth: 36,
        hitboxHeight: 46,
        speed: 120 + tagLevel * 18
    };
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

function createTagMapRocks(count = 90, avoid = null) {
    const rocks = [];

    while (rocks.length < count) {
        const rock = {
            x: 40 + Math.random() * (WORLD_WIDTH - 80),
            y: 40 + Math.random() * (WORLD_HEIGHT - 80),
            width: 18 + Math.random() * 24,
            height: 10 + Math.random() * 12,
            rotation: Math.random() * Math.PI * 2,
            color: Math.random() < 0.45 ? '#635142' : '#8b7b62',
            highlight: Math.random() * 0.14 + 0.08
        };

        if (avoid && rectsOverlap(rock, {
            x: avoid.x - 80,
            y: avoid.y - 80,
            width: avoid.width + 160,
            height: avoid.height + 160
        })) {
            continue;
        }

        rocks.push(rock);
    }

    return rocks;
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
    updateTagPlayerAnimation(delta);
    moveTaggers(delta);
    updateTaggerAnimation(delta);
    collectTagItems();
    checkTaggerCollisions();

    if (tagSurvivalTime >= TAG_LEVEL_TIME) {
        tagLevel += 1;
        checkTagZoneAchievements();
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

    tagPlayer.isMoving = dx !== 0 || dy !== 0;

    if (dx < 0) tagPlayerFacing = -1;
    if (dx > 0) tagPlayerFacing = 1;

    if (dx !== 0 || dy !== 0) {
        const length = Math.hypot(dx, dy);
        dx /= length;
        dy /= length;
    }

    const speed = tagBoostTimer > 0 ? tagPlayer.speed * 1.65 : tagPlayer.speed;

    tagPlayer.x = clamp(tagPlayer.x + dx * speed * delta, 0, WORLD_WIDTH - tagPlayer.width);
    tagPlayer.y = clamp(tagPlayer.y + dy * speed * delta, 0, WORLD_HEIGHT - tagPlayer.height);
}

function updateTagPlayerAnimation(delta) {
    const frameCount = tagPlayer.isMoving ? TAG_PLAYER_RUN_FRAMES : TAG_PLAYER_IDLE_FRAMES;

    tagPlayerFrameTimer += delta;

    if (tagPlayerFrameTimer >= TAG_PLAYER_ANIMATION_SPEED) {
        tagPlayerFrameTimer = 0;
        tagPlayerFrame = (tagPlayerFrame + 1) % frameCount;
    }
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

    // Handle enemy-to-enemy collisions
    for (let i = 0; i < taggers.length; i++) {
        for (let j = i + 1; j < taggers.length; j++) {
            const t1 = taggers[i];
            const t2 = taggers[j];

            const dx = t2.x - t1.x;
            const dy = t2.y - t1.y;
            const dist = Math.hypot(dx, dy);
            const minDist = Math.max(t1.width, t1.height) / 2 + Math.max(t2.width, t2.height) / 2;

            if (dist < minDist && dist > 0) {
                // Push enemies apart
                const overlap = minDist - dist;
                const pushX = (dx / dist) * overlap * 0.5;
                const pushY = (dy / dist) * overlap * 0.5;

                t1.x -= pushX;
                t1.y -= pushY;
                t2.x += pushX;
                t2.y += pushY;

                // Keep within bounds
                t1.x = clamp(t1.x, 0, WORLD_WIDTH - t1.width);
                t1.y = clamp(t1.y, 0, WORLD_HEIGHT - t1.height);
                t2.x = clamp(t2.x, 0, WORLD_WIDTH - t2.width);
                t2.y = clamp(t2.y, 0, WORLD_HEIGHT - t2.height);
            }
        }
    }
}

function updateTaggerAnimation(delta) {
    taggerFrameTimer += delta;

    if (taggerFrameTimer >= TAGGER_ANIMATION_SPEED) {
        taggerFrameTimer = 0;
        taggerFrame = (taggerFrame + 1) % taggerRunSprites.length;
    }
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
    const playerHitbox = getPlayerHitbox();

    for (const tagger of taggers) {
        const taggerHitbox = getTaggerHitbox(tagger);

        if (rectsOverlap(playerHitbox, taggerHitbox)) {
            if (tagShieldTimer > 0) {
                const newTagger = createTagger();
                tagger.x = newTagger.x;
                tagger.y = newTagger.y;
                tagShieldTimer = 0;
                gameMessage.textContent = 'Shield saved you';
                return;
            }

            tagNoHitRun = false;
            endTagZone();
            return;
        }
    }
}

function getPlayerHitbox() {
    return {
        x: tagPlayer.x + 18,
        y: tagPlayer.y + 16,
        width: tagPlayer.width - 36,
        height: tagPlayer.height - 26
    };
}

function getTaggerHitbox(tagger) {
    return {
        x: tagger.x + tagger.hitboxOffsetX,
        y: tagger.y + tagger.hitboxOffsetY,
        width: tagger.hitboxWidth,
        height: tagger.hitboxHeight
    };
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
    const columns = tagMapTiles[0]?.length || Math.ceil(WORLD_WIDTH / TAG_MAP_TILE_SIZE);
    const rows = tagMapTiles.length || Math.ceil(WORLD_HEIGHT / TAG_MAP_TILE_SIZE);

    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            const tileIndex = tagMapTiles[row]?.[column] ?? 0;
            const tile = tagMapTileImages[tileIndex];
            const x = column * TAG_MAP_TILE_SIZE;
            const y = row * TAG_MAP_TILE_SIZE;

            if (tile && tile.complete && tile.naturalWidth > 0) {
                ctx.drawImage(tile, x, y, TAG_MAP_TILE_SIZE, TAG_MAP_TILE_SIZE);
            } else {
                ctx.fillStyle = '#2a6a28';
                ctx.fillRect(x, y, TAG_MAP_TILE_SIZE, TAG_MAP_TILE_SIZE);
            }
        }
    }

    // add a lightweight grass pattern overlay so tiles read better
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 0; y < WORLD_HEIGHT; y += 80) {
        for (let x = 0; x < WORLD_WIDTH; x += 80) {
            ctx.fillRect(x + 8, y + 30, 52, 6);
        }
    }

    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}

function drawTagHouse() {
    if (!tagHouse) return;

    ctx.save();
    ctx.translate(tagHouse.x, tagHouse.y);

    ctx.fillStyle = '#7c4d24';
    ctx.fillRect(0, 0, tagHouse.width, tagHouse.height);

    ctx.fillStyle = '#a56d32';
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(tagHouse.width + 16, 0);
    ctx.lineTo(tagHouse.width / 2, -84);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#3d2a1a';
    ctx.fillRect(tagHouse.width * 0.08, tagHouse.height * 0.28, 44, 48);
    ctx.fillStyle = '#f5e9c9';
    ctx.fillRect(tagHouse.width * 0.12, tagHouse.height * 0.34, 24, 24);
    ctx.fillRect(tagHouse.width * 0.65, tagHouse.height * 0.34, 24, 24);

    ctx.fillStyle = '#d7b17a';
    ctx.fillRect(tagHouse.width * 0.42, tagHouse.height * 0.5, tagHouse.width * 0.18, tagHouse.height * 0.34);

    ctx.restore();
}

function drawTagTrees() {
    tagMapTrees.forEach(tree => {
        ctx.save();
        ctx.translate(tree.x, tree.y);

        ctx.fillStyle = '#5a3d1e';
        ctx.fillRect(-tree.width * 0.08, 0, tree.width * 0.16, tree.height * 0.42);

        ctx.fillStyle = '#2a6d28';
        ctx.beginPath();
        ctx.moveTo(0, -tree.height * 0.08);
        ctx.bezierCurveTo(tree.width * 0.75, tree.height * 0.15, tree.width * 0.75, tree.height * 0.65, 0, tree.height * 0.98);
        ctx.bezierCurveTo(-tree.width * 0.75, tree.height * 0.65, -tree.width * 0.75, tree.height * 0.15, 0, -tree.height * 0.08);
        ctx.fill();

        ctx.restore();
    });
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
    const sprite = taggerRunSprites[taggerFrame];

    taggers.forEach(tagger => {
        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
            ctx.drawImage(sprite, tagger.x, tagger.y, tagger.width, tagger.height);
        } else {
            ctx.fillStyle = tagFreezeTimer > 0 ? '#8be9ff' : '#ff4d4d';
            ctx.fillRect(tagger.x, tagger.y, tagger.width, tagger.height);
        }
    });
}

function drawTagPlayer() {
    const sprite = tagPlayer.isMoving ? tagPlayerRunSprite : tagPlayerIdleSprite;
    const frameCount = tagPlayer.isMoving ? TAG_PLAYER_RUN_FRAMES : TAG_PLAYER_IDLE_FRAMES;
    const frame = tagPlayerFrame % frameCount;

    if (sprite.complete && sprite.naturalWidth > 0) {
        ctx.save();

        if (tagPlayerFacing === -1) {
            ctx.translate(tagPlayer.x + tagPlayer.width, tagPlayer.y);
            ctx.scale(-1, 1);
            ctx.drawImage(
                sprite,
                frame * TAG_PLAYER_FRAME_SIZE,
                0,
                TAG_PLAYER_FRAME_SIZE,
                TAG_PLAYER_FRAME_SIZE,
                0,
                0,
                tagPlayer.width,
                tagPlayer.height
            );
        } else {
            ctx.drawImage(
                sprite,
                frame * TAG_PLAYER_FRAME_SIZE,
                0,
                TAG_PLAYER_FRAME_SIZE,
                TAG_PLAYER_FRAME_SIZE,
                tagPlayer.x,
                tagPlayer.y,
                tagPlayer.width,
                tagPlayer.height
            );
        }

        ctx.restore();
    } else {
        ctx.fillStyle = '#00ffcc';
        ctx.fillRect(tagPlayer.x, tagPlayer.y, tagPlayer.width, tagPlayer.height);
    }

    if (tagShieldTimer > 0) {
        ctx.strokeStyle = 'rgba(255, 95, 162, 0.8)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(
            tagPlayer.x + tagPlayer.width / 2,
            tagPlayer.y + tagPlayer.height / 2,
            tagPlayer.width * 0.7,
            0,
            Math.PI * 2
        );
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

function startSpaceRunner() {
    stopGame();
    currentGame = 'spaceRunner';
    tagHud.classList.add('hidden');
    showGameScreen('Space Runner', '', true, false);
    gameMessage.classList.add('hidden');
    restartBtn.classList.add('hidden');
    spaceRunnerUi.classList.remove('hidden');
    SpaceRunner.open(canvas, ctx);
}

document.addEventListener('keydown', e => {
    keys[e.code] = true;

    if (currentGame === 'spaceRunner') {
        SpaceRunner.handleKey(e);
        if (e.code === 'Space') {
            e.preventDefault();
        }
        return;
    }

    if (e.code === 'Space') {
        e.preventDefault();

        if (currentGame === 'fastEagle') {
            if (gameRunning) flap();
            else restartFastEagle();
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

platformerBtn.addEventListener('click', startSpaceRunner);

playBtn.addEventListener('click', startFastEagle);

restartBtn.addEventListener('click', () => {
    if (currentGame === 'fastEagle') restartFastEagle();
    if (currentGame === 'tagZone') restartTagZone();
});

backBtn.addEventListener('click', showMenu);

achievementsBtn?.addEventListener('click', openAchievementsModal);
closeAchievementsBtn?.addEventListener('click', closeAchievementsModal);
achievementsBackdrop?.addEventListener('click', closeAchievementsModal);
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && achievementsModal && !achievementsModal.classList.contains('hidden')) {
        closeAchievementsModal();
    }
});

window.ArcadeAchievements = {
    onSpaceRunnerGameOver(highscore) {
        checkSpaceRunnerAchievements(highscore);
    }
};

loadAchievements();
showMenu();