const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const menu = document.getElementById('menu');
const gamesPage = document.getElementById('gamesPage');
const gameContainer = document.getElementById('gameContainer');
const gameTitle = document.getElementById('gameTitle');
const gameMessage = document.getElementById('gameMessage');
const highScoreText = document.getElementById('highScore');

const tagZoneBtn = document.getElementById('tagZoneBtn');
const platformerBtn = document.getElementById('platformerBtn');
const playBtn = document.getElementById('playBtn');
const backBtn = document.getElementById('backBtn');
const restartBtn = document.getElementById('restartBtn');
const ourGamesBtn = document.getElementById('ourGamesBtn');
const settingsBtn = document.getElementById('settingsBtn');
const keybindsBtn = document.getElementById('keybindsBtn');
const backToMenuBtn = document.getElementById('backToMenuBtn');
const drawerBackdrop = document.getElementById('drawerBackdrop');
const sideDrawer = document.getElementById('sideDrawer');
const closeDrawerBtn = document.getElementById('closeDrawerBtn');
const settingsDrawerContent = document.getElementById('settingsDrawerContent');
const keybindsDrawerContent = document.getElementById('keybindsDrawerContent');
const brightnessSlider = document.getElementById('brightnessSlider');
const soundSlider = document.getElementById('soundSlider');
const brightnessValue = document.getElementById('brightnessValue');
const soundValue = document.getElementById('soundValue');
const brightnessOverlay = document.getElementById('brightnessOverlay');

const tagHud = document.getElementById('tagHud');
const spaceRunnerUi = document.getElementById('spaceRunnerUi');
const tagTimerText = document.getElementById('tagTimer');
const tagLevelText = document.getElementById('tagLevel');
const tagHeartsText = document.getElementById('tagHearts');
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
const TAG_MAX_HEARTS = 3;
const TAG_HIT_IMMUNITY_TIME = 3;
const TAG_HIT_BOOST_TIME = 1.5;
const TAG_HIT_BOOST_MULTIPLIER = 1.35;
const TAG_MAP_TILE_SIZE = 32;
const TAG_BARRIER_DEPTH = 96;
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
let tagSurvivalTime = 0;
let tagFreezeTimer = 0;
let tagShieldTimer = 0;
let tagBoostTimer = 0;
let tagHearts = TAG_MAX_HEARTS;
let tagHitImmunityTimer = 0;
let tagHitBoostTimer = 0;
let countdown = 3;
let countdownActive = false;
let camX = 0;
let camY = 0;

let tagPlayerFrame = 0;
let tagPlayerFrameTimer = 0;
let tagPlayerFacing = 1;

let taggerFrame = 0;
let taggerFrameTimer = 0;
let tagAnimTime = 0;
let fastEagleTime = 0;

const TAG_PLAYER_FRAME_SIZE = 32;
const TAG_PLAYER_IDLE_FRAMES = 4;
const TAG_PLAYER_RUN_FRAMES = 6;
const TAG_PLAYER_ANIMATION_SPEED = 0.1;
const TAGGER_ANIMATION_SPEED = 0.1;

const itemTypes = [
    { name: 'Boost', className: 'boost', color: '#ffe66d', glow: 'rgba(255, 230, 109, 0.65)', icon: '⚡' },
    { name: 'Freeze', className: 'freeze', color: '#74d2ff', glow: 'rgba(116, 210, 255, 0.65)', icon: '❄' },
    { name: 'Shield', className: 'shield', color: '#ff5fa2', glow: 'rgba(255, 95, 162, 0.65)', icon: '🛡' }
];

const tagMapTileImages = TAG_MAP_TILE_SOURCES.map(src => {
    const img = new Image();
    img.src = src;
    return img;
});

function getFastEagleSpeed() {
    return starPowerTimer > 0 ? PIPE_SPEED * STAR_SPEED_MULTIPLIER : PIPE_SPEED;
}

const settings = {
    brightness: 100,
    sound: 80
};

let audioContext = null;

function loadSettings() {
    settings.brightness = Number(localStorage.getItem('arcadeBrightness') ?? 100);
    settings.sound = Number(localStorage.getItem('arcadeSound') ?? 80);
    brightnessSlider.value = String(settings.brightness);
    soundSlider.value = String(settings.sound);
    applyBrightness(settings.brightness);
    updateSettingsLabels();
}

function saveSettings() {
    localStorage.setItem('arcadeBrightness', String(settings.brightness));
    localStorage.setItem('arcadeSound', String(settings.sound));
}

function applyBrightness(value) {
    const darkness = (100 - value) / 100;
    brightnessOverlay.style.opacity = String(darkness * 0.72);
}

function updateSettingsLabels() {
    brightnessValue.textContent = `${settings.brightness}%`;
    soundValue.textContent = `${settings.sound}%`;
}

function getSoundVolume() {
    return settings.sound / 100;
}

function playUiSound(type = 'click') {
    if (settings.sound <= 0) return;

    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    const volume = getSoundVolume();

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    if (type === 'click') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(520, now);
        oscillator.frequency.exponentialRampToValueAtTime(360, now + 0.08);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.08 * volume, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.11);
    }

    if (type === 'collect') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(640, now);
        oscillator.frequency.exponentialRampToValueAtTime(980, now + 0.12);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.12 * volume, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        oscillator.start(now);
        oscillator.stop(now + 0.17);
    }

    if (type === 'gameOver') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(220, now);
        oscillator.frequency.exponentialRampToValueAtTime(90, now + 0.35);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.1 * volume, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
        oscillator.start(now);
        oscillator.stop(now + 0.4);
    }

    if (type === 'hit') {
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(180, now);
        oscillator.frequency.exponentialRampToValueAtTime(120, now + 0.12);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.09 * volume, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        oscillator.start(now);
        oscillator.stop(now + 0.15);
    }

    if (type === 'hover') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, now);
        oscillator.frequency.exponentialRampToValueAtTime(1040, now + 0.05);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.04 * volume, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
        oscillator.start(now);
        oscillator.stop(now + 0.08);
    }

    if (type === 'powerOn') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(90, now);
        oscillator.frequency.exponentialRampToValueAtTime(420, now + 0.45);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.11 * volume, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.06 * volume, now + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
        oscillator.start(now);
        oscillator.stop(now + 0.52);
    }
}

function openDrawer(type) {
    settingsDrawerContent.classList.toggle('hidden', type !== 'settings');
    keybindsDrawerContent.classList.toggle('hidden', type !== 'keybinds');
    drawerBackdrop.classList.remove('drawer-closed');
    sideDrawer.classList.remove('drawer-closed');
    sideDrawer.setAttribute('aria-hidden', 'false');
    playUiSound('click');
}

function closeDrawer() {
    drawerBackdrop.classList.add('drawer-closed');
    sideDrawer.classList.add('drawer-closed');
    sideDrawer.setAttribute('aria-hidden', 'true');
}

function showGamesPage() {
    menu.classList.add('hidden');
    gamesPage.classList.remove('hidden');
    gameContainer.classList.add('hidden');
    playUiSound('click');
}

function setupHubControls() {
    ourGamesBtn.addEventListener('click', showGamesPage);
    settingsBtn.addEventListener('click', () => openDrawer('settings'));
    keybindsBtn.addEventListener('click', () => openDrawer('keybinds'));
    closeDrawerBtn.addEventListener('click', closeDrawer);
    drawerBackdrop.addEventListener('click', closeDrawer);
    backToMenuBtn.addEventListener('click', showMenu);

    brightnessSlider.addEventListener('input', () => {
        settings.brightness = Number(brightnessSlider.value);
        applyBrightness(settings.brightness);
        updateSettingsLabels();
        saveSettings();
    });

    soundSlider.addEventListener('input', () => {
        settings.sound = Number(soundSlider.value);
        updateSettingsLabels();
        saveSettings();
        playUiSound('click');
    });
}

function showMenu() {
    stopGame();
    SpaceRunner.stop();
    currentGame = null;
    closeDrawer();
    menu.classList.remove('hidden');
    gamesPage.classList.add('hidden');
    gameContainer.classList.add('hidden');
    tagHud.classList.add('hidden');
    spaceRunnerUi.classList.add('hidden');
    gameMessage.classList.remove('hidden');
}

function showGameScreen(name, message, useCanvas = false, showRestart = false) {
    menu.classList.add('hidden');
    gamesPage.classList.add('hidden');
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

    clouds = Array.from({ length: 8 }, (_, index) => ({
        x: Math.random() * canvas.width,
        y: 30 + Math.random() * 160,
        size: 14 + Math.random() * 26,
        speed: 0.15 + Math.random() * 0.45,
        alpha: 0.35 + Math.random() * 0.35,
        layer: index % 3,
        seed: Math.random() * Math.PI * 2
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
    fastEagleTime += delta;

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
    drawDistantHills();
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
    sky.addColorStop(0, '#4a90d9');
    sky.addColorStop(0.42, '#7eb8ea');
    sky.addColorStop(0.72, '#b9daf5');
    sky.addColorStop(1, '#dfeef9');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sunX = canvas.width * 0.78;
    const sunY = canvas.height * 0.16;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 120);
    sunGlow.addColorStop(0, 'rgba(255, 248, 210, 0.95)');
    sunGlow.addColorStop(0.35, 'rgba(255, 230, 140, 0.35)');
    sunGlow.addColorStop(1, 'rgba(255, 230, 140, 0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.45);

    const horizon = ctx.createLinearGradient(0, canvas.height * 0.68, 0, canvas.height);
    horizon.addColorStop(0, 'rgba(255, 255, 255, 0)');
    horizon.addColorStop(1, 'rgba(196, 214, 196, 0.55)');
    ctx.fillStyle = horizon;
    ctx.fillRect(0, canvas.height * 0.68, canvas.width, canvas.height * 0.32);
}

function drawDistantHills() {
    const baseY = canvas.height * 0.78;

    ctx.fillStyle = 'rgba(72, 108, 72, 0.45)';
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= canvas.width; x += 40) {
        const y = baseY - 18 - Math.sin((x * 0.01) + fastEagleTime * 0.15) * 12;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(58, 92, 58, 0.55)';
    ctx.beginPath();
    ctx.moveTo(0, baseY + 24);
    for (let x = 0; x <= canvas.width; x += 30) {
        const y = baseY + 10 - Math.sin((x * 0.014) + 1.4) * 20;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    ctx.fill();
}

function drawClouds() {
    clouds.forEach(cloud => {
        const depth = 0.55 + cloud.layer * 0.2;
        const puffCount = 4 + cloud.layer;

        ctx.save();
        ctx.globalAlpha = cloud.alpha * depth;
        ctx.translate(cloud.x, cloud.y);

        for (let i = 0; i < puffCount; i++) {
            const angle = cloud.seed + i * 1.3;
            const puffX = Math.cos(angle) * cloud.size * (0.4 + i * 0.35);
            const puffY = Math.sin(angle) * cloud.size * 0.18;
            const puffRadius = cloud.size * (0.55 + (i % 2) * 0.2);

            const puffGradient = ctx.createRadialGradient(
                puffX - puffRadius * 0.25,
                puffY - puffRadius * 0.35,
                puffRadius * 0.1,
                puffX,
                puffY,
                puffRadius
            );
            puffGradient.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
            puffGradient.addColorStop(0.55, 'rgba(240, 246, 255, 0.82)');
            puffGradient.addColorStop(1, 'rgba(210, 224, 240, 0.2)');

            ctx.fillStyle = puffGradient;
            ctx.beginPath();
            ctx.arc(puffX, puffY, puffRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = cloud.alpha * 0.25;
        ctx.fillStyle = 'rgba(120, 140, 170, 0.35)';
        ctx.beginPath();
        ctx.ellipse(cloud.size * 0.8, cloud.size * 0.35, cloud.size * 1.4, cloud.size * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    });
}

function drawPipeSegment(x, y, width, height, isTop) {
    const bodyGradient = ctx.createLinearGradient(x, 0, x + width, 0);
    bodyGradient.addColorStop(0, '#1f6d38');
    bodyGradient.addColorStop(0.18, '#2f9a4d');
    bodyGradient.addColorStop(0.5, '#3cb35d');
    bodyGradient.addColorStop(0.82, '#267a3f');
    bodyGradient.addColorStop(1, '#1a5730');

    ctx.fillStyle = bodyGradient;
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(x + 6, y + 4, 8, Math.max(height - 8, 0));

    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(x + width - 10, y + 4, 6, Math.max(height - 8, 0));

    for (let stripeY = y + 18; stripeY < y + height; stripeY += 26) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.fillRect(x + 4, stripeY, width - 8, 2);
    }

    const lipY = isTop ? y + height - 18 : y;
    const lipGradient = ctx.createLinearGradient(x, lipY, x, lipY + 18);
    lipGradient.addColorStop(0, '#49c76d');
    lipGradient.addColorStop(0.5, '#2f9a4d');
    lipGradient.addColorStop(1, '#1d6a37');

    ctx.fillStyle = lipGradient;
    ctx.fillRect(x - 5, lipY, width + 10, 18);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(x - 2, lipY + 3, width + 4, 4);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(x - 5, lipY + 14, width + 10, 4);

    const mossColor = isTop ? 'rgba(88, 132, 62, 0.55)' : 'rgba(72, 108, 52, 0.45)';
    ctx.fillStyle = mossColor;
    ctx.fillRect(x + 4, isTop ? lipY - 8 : lipY + 18, width - 8, 8);
}

function drawPipes() {
    pipes.forEach(pipe => {
        drawPipeSegment(pipe.x, 0, PIPE_WIDTH, pipe.top, true);
        drawPipeSegment(
            pipe.x,
            pipe.top + PIPE_GAP,
            PIPE_WIDTH,
            canvas.height - pipe.top - PIPE_GAP,
            false
        );

        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.fillRect(pipe.x + PIPE_WIDTH, pipe.top, 8, PIPE_GAP);
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
    updateHighScore();
    gameMessage.textContent = `Game Over - Score ${score}`;
    restartBtn.classList.remove('hidden');
    playUiSound('gameOver');
}

function startTagZone() {
    spaceRunnerUi.classList.add('hidden');
    SpaceRunner.stop();
    currentGame = 'tagZone';
    canvas.width = 960;
    canvas.height = 620;

    tagLevel = 1;
    tagHearts = TAG_MAX_HEARTS;
    tagHitImmunityTimer = 0;
    tagHitBoostTimer = 0;
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
    tagMapTrees = createTagBarrierTrees();
    tagMapRocks = [];
    tagHouse = null;
    tagAnimTime = 0;

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

function createTagBarrierTrees() {
    const trees = [];
    const spacing = 44;
    const treeW = 40;
    const treeH = 56;

    for (let x = 0; x < WORLD_WIDTH; x += spacing) {
        trees.push({ x, y: 0, width: treeW, height: treeH, barrier: true });
        trees.push({ x, y: WORLD_HEIGHT - treeH, width: treeW, height: treeH, barrier: true });
    }

    for (let y = TAG_BARRIER_DEPTH; y < WORLD_HEIGHT - TAG_BARRIER_DEPTH; y += spacing) {
        trees.push({ x: 0, y, width: treeW, height: treeH, barrier: true });
        trees.push({ x: WORLD_WIDTH - treeW, y, width: treeW, height: treeH, barrier: true });
    }

    return trees;
}

function getTagPlayableBounds() {
    return {
        minX: TAG_BARRIER_DEPTH,
        minY: TAG_BARRIER_DEPTH,
        maxX: WORLD_WIDTH - TAG_BARRIER_DEPTH - tagPlayer.width,
        maxY: WORLD_HEIGHT - TAG_BARRIER_DEPTH - tagPlayer.height
    };
}

function isTagPositionBlocked(x, y, width, height) {
    const testRect = { x, y, width, height };

    return tagMapTrees.some(tree => rectsOverlap(testRect, tree));
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
        x = TAG_BARRIER_DEPTH + Math.random() * (WORLD_WIDTH - TAG_BARRIER_DEPTH * 2 - width);
        y = TAG_BARRIER_DEPTH + Math.random() * (WORLD_HEIGHT - TAG_BARRIER_DEPTH * 2 - height);
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
        x: TAG_BARRIER_DEPTH + 80 + Math.random() * (WORLD_WIDTH - TAG_BARRIER_DEPTH * 2 - 160),
        y: TAG_BARRIER_DEPTH + 80 + Math.random() * (WORLD_HEIGHT - TAG_BARRIER_DEPTH * 2 - 160),
        radius: 16,
        bobOffset: Math.random() * Math.PI * 2,
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
    tagAnimTime += delta;
    tagFreezeTimer = Math.max(0, tagFreezeTimer - delta);
    tagShieldTimer = Math.max(0, tagShieldTimer - delta);
    tagBoostTimer = Math.max(0, tagBoostTimer - delta);
    tagHitImmunityTimer = Math.max(0, tagHitImmunityTimer - delta);
    tagHitBoostTimer = Math.max(0, tagHitBoostTimer - delta);

    moveTagPlayer(delta);
    updateTagPlayerAnimation(delta);
    moveTaggers(delta);
    updateTaggerAnimation(delta);
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

    tagPlayer.isMoving = dx !== 0 || dy !== 0;

    if (dx < 0) tagPlayerFacing = -1;
    if (dx > 0) tagPlayerFacing = 1;

    if (dx !== 0 || dy !== 0) {
        const length = Math.hypot(dx, dy);
        dx /= length;
        dy /= length;
    }

    const speedMultiplier = (tagBoostTimer > 0 ? 1.65 : 1) * (tagHitBoostTimer > 0 ? TAG_HIT_BOOST_MULTIPLIER : 1);
    const speed = tagPlayer.speed * speedMultiplier;
    const bounds = getTagPlayableBounds();
    const nextX = clamp(tagPlayer.x + dx * speed * delta, bounds.minX, bounds.maxX);
    const nextY = clamp(tagPlayer.y + dy * speed * delta, bounds.minY, bounds.maxY);

    if (!isTagPositionBlocked(nextX, tagPlayer.y, tagPlayer.width, tagPlayer.height)) {
        tagPlayer.x = nextX;
    }

    if (!isTagPositionBlocked(tagPlayer.x, nextY, tagPlayer.width, tagPlayer.height)) {
        tagPlayer.y = nextY;
    }
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

        tagger.x = clamp(tagger.x, TAG_BARRIER_DEPTH, WORLD_WIDTH - TAG_BARRIER_DEPTH - tagger.width);
        tagger.y = clamp(tagger.y, TAG_BARRIER_DEPTH, WORLD_HEIGHT - TAG_BARRIER_DEPTH - tagger.height);
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
                t1.x = clamp(t1.x, TAG_BARRIER_DEPTH, WORLD_WIDTH - TAG_BARRIER_DEPTH - t1.width);
                t1.y = clamp(t1.y, TAG_BARRIER_DEPTH, WORLD_HEIGHT - TAG_BARRIER_DEPTH - t1.height);
                t2.x = clamp(t2.x, TAG_BARRIER_DEPTH, WORLD_WIDTH - TAG_BARRIER_DEPTH - t2.width);
                t2.y = clamp(t2.y, TAG_BARRIER_DEPTH, WORLD_HEIGHT - TAG_BARRIER_DEPTH - t2.height);
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
                playUiSound('collect');
            }

            return false;
        }

        return true;
    });
}

function checkTaggerCollisions() {
    if (tagHitImmunityTimer > 0) return;

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

            tagHearts -= 1;
            tagHitImmunityTimer = TAG_HIT_IMMUNITY_TIME;
            tagHitBoostTimer = TAG_HIT_BOOST_TIME;
            updateTagHud();
            playUiSound('hit');

            const pushAngle = Math.atan2(
                tagger.y - tagPlayer.y,
                tagger.x - tagPlayer.x
            );
            tagger.x = clamp(
                tagger.x + Math.cos(pushAngle) * 120,
                TAG_BARRIER_DEPTH,
                WORLD_WIDTH - TAG_BARRIER_DEPTH - tagger.width
            );
            tagger.y = clamp(
                tagger.y + Math.sin(pushAngle) * 120,
                TAG_BARRIER_DEPTH,
                WORLD_HEIGHT - TAG_BARRIER_DEPTH - tagger.height
            );

            if (tagHearts <= 0) {
                endTagZone();
                return;
            }

            gameMessage.textContent = `${tagHearts} heart${tagHearts === 1 ? '' : 's'} left`;
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
    playUiSound('collect');
}

function endTagZone() {
    gameRunning = false;
    gameMessage.textContent = `Out of hearts on Level ${tagLevel}`;
    restartBtn.classList.remove('hidden');
    playUiSound('gameOver');
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

    drawTagVignette();
}

function drawTagVignette() {
    const vignette = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        canvas.height * 0.2,
        canvas.width / 2,
        canvas.height / 2,
        canvas.height * 0.75
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawTagMap() {
    draw8BitGrasslands();
    drawTagTrees();

    ctx.strokeStyle = '#2d5a2d';
    ctx.lineWidth = 4;
    ctx.strokeRect(
        TAG_BARRIER_DEPTH,
        TAG_BARRIER_DEPTH,
        WORLD_WIDTH - TAG_BARRIER_DEPTH * 2,
        WORLD_HEIGHT - TAG_BARRIER_DEPTH * 2
    );
}

function draw8BitGrasslands() {
    const tileSize = TAG_MAP_TILE_SIZE;

    for (let y = 0; y < WORLD_HEIGHT; y += tileSize) {
        for (let x = 0; x < WORLD_WIDTH; x += tileSize) {
            const checker = ((x + y) / tileSize) % 2 === 0;
            ctx.fillStyle = checker ? '#5cb85c' : '#4caf50';
            ctx.fillRect(x, y, tileSize, tileSize);

            const seed = Math.abs(Math.sin((x + 1) * 12.9898 + (y + 1) * 78.233) * 43758.5453) % 1;

            if (seed > 0.92) {
                ctx.fillStyle = '#3d8b3d';
                ctx.fillRect(x + 6, y + 10, 4, 4);
                ctx.fillRect(x + 18, y + 20, 4, 4);
            }

            if (seed > 0.97) {
                ctx.fillStyle = '#ff6b9d';
                ctx.fillRect(x + 12, y + 8, 4, 4);
                ctx.fillStyle = '#ffe66d';
                ctx.fillRect(x + 14, y + 6, 4, 4);
            }

            if (seed < 0.04) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
                ctx.fillRect(x + 22, y + 14, 3, 3);
            }
        }
    }
}

function drawTagRocks() {
    tagMapRocks.forEach(rock => {
        ctx.save();
        ctx.translate(rock.x, rock.y);
        ctx.rotate(rock.rotation);

        ctx.fillStyle = rock.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, rock.width * 0.5, rock.height * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255, 255, 255, ${rock.highlight})`;
        ctx.beginPath();
        ctx.ellipse(-rock.width * 0.12, -rock.height * 0.12, rock.width * 0.18, rock.height * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    });
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

        ctx.fillStyle = '#5c3d1e';
        ctx.fillRect(tree.width * 0.38, tree.height * 0.55, tree.width * 0.24, tree.height * 0.45);

        ctx.fillStyle = '#2d6b2d';
        ctx.fillRect(0, tree.height * 0.28, tree.width, tree.height * 0.3);

        ctx.fillStyle = '#3d8f3d';
        ctx.fillRect(4, tree.height * 0.12, tree.width - 8, tree.height * 0.28);

        ctx.fillStyle = '#58b858';
        ctx.fillRect(8, 2, tree.width - 16, tree.height * 0.18);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(10, 6, 6, 4);

        ctx.restore();
    });
}

function drawTagItems() {
    tagItems.forEach(item => {
        const bob = Math.sin(tagAnimTime * 4 + item.bobOffset) * 4;
        const pulse = 0.85 + Math.sin(tagAnimTime * 6 + item.bobOffset) * 0.15;
        const x = item.x;
        const y = item.y + bob;
        const radius = item.radius * pulse;

        ctx.save();
        ctx.translate(x, y);

        const glow = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 2.2);
        glow.addColorStop(0, item.type.glow);
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 2.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.rotate(Math.sin(tagAnimTime * 2 + item.bobOffset) * 0.08);
        drawTagPowerUp(item.type, radius);
        ctx.restore();
    });
}

function drawTagPowerUp(type, radius) {
    if (type.className === 'boost') {
        ctx.fillStyle = type.color;
        ctx.strokeStyle = '#fff8d6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -radius);
        ctx.lineTo(radius * 0.28, -radius * 0.2);
        ctx.lineTo(radius * 0.9, -radius * 0.35);
        ctx.lineTo(radius * 0.35, radius * 0.2);
        ctx.lineTo(radius * 0.55, radius);
        ctx.lineTo(0, radius * 0.45);
        ctx.lineTo(-radius * 0.55, radius);
        ctx.lineTo(-radius * 0.35, radius * 0.2);
        ctx.lineTo(-radius * 0.9, -radius * 0.35);
        ctx.lineTo(-radius * 0.28, -radius * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        return;
    }

    if (type.className === 'freeze') {
        ctx.strokeStyle = '#dff7ff';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(116, 210, 255, 0.85)';

        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            ctx.lineTo(Math.cos(angle + 0.22) * radius * 0.45, Math.sin(angle + 0.22) * radius * 0.45);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.22, 0, Math.PI * 2);
        ctx.fill();
        return;
    }

    ctx.fillStyle = 'rgba(255, 95, 162, 0.9)';
    ctx.strokeStyle = '#ffd3e8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.quadraticCurveTo(radius * 0.95, -radius * 0.55, radius * 0.82, radius * 0.15);
    ctx.quadraticCurveTo(radius * 0.45, radius, 0, radius * 0.82);
    ctx.quadraticCurveTo(-radius * 0.45, radius, -radius * 0.82, radius * 0.15);
    ctx.quadraticCurveTo(-radius * 0.95, -radius * 0.55, 0, -radius);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function drawTaggers() {
    const sprite = taggerRunSprites[taggerFrame];
    const frozen = tagFreezeTimer > 0;

    taggers.forEach(tagger => {
        ctx.save();

        if (frozen) {
            ctx.shadowColor = 'rgba(116, 210, 255, 0.8)';
            ctx.shadowBlur = 18;
        }

        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
            ctx.drawImage(sprite, tagger.x, tagger.y, tagger.width, tagger.height);
        } else {
            ctx.fillStyle = frozen ? '#8be9ff' : '#ff4d4d';
            ctx.fillRect(tagger.x, tagger.y, tagger.width, tagger.height);
        }

        if (frozen) {
            ctx.fillStyle = 'rgba(180, 230, 255, 0.28)';
            ctx.fillRect(tagger.x, tagger.y, tagger.width, tagger.height);
        }

        ctx.restore();
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

    if (tagHitImmunityTimer > 0) {
        const flash = Math.sin(tagAnimTime * 18) > 0;
        ctx.strokeStyle = flash ? 'rgba(116, 210, 255, 0.9)' : 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(
            tagPlayer.x + tagPlayer.width / 2,
            tagPlayer.y + tagPlayer.height / 2,
            tagPlayer.width * 0.62,
            0,
            Math.PI * 2
        );
        ctx.stroke();
    }

    if (tagShieldTimer > 0) {
        const pulse = 0.9 + Math.sin(tagAnimTime * 8) * 0.1;
        ctx.strokeStyle = 'rgba(255, 95, 162, 0.85)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(
            tagPlayer.x + tagPlayer.width / 2,
            tagPlayer.y + tagPlayer.height / 2,
            tagPlayer.width * 0.72 * pulse,
            0,
            Math.PI * 2
        );
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
            tagPlayer.x + tagPlayer.width / 2,
            tagPlayer.y + tagPlayer.height / 2,
            tagPlayer.width * 0.62 * pulse,
            0,
            Math.PI * 2
        );
        ctx.stroke();
    }

    if (tagBoostTimer > 0) {
        ctx.strokeStyle = 'rgba(255, 230, 109, 0.75)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(
            tagPlayer.x + tagPlayer.width / 2,
            tagPlayer.y + tagPlayer.height / 2,
            tagPlayer.width * 0.55,
            0,
            Math.PI * 2
        );
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function updateTagHud() {
    tagTimerText.textContent = Math.ceil(TAG_LEVEL_TIME - tagSurvivalTime);
    tagLevelText.textContent = tagLevel;
    tagHeartsText.textContent = '♥'.repeat(tagHearts) + '♡'.repeat(Math.max(0, TAG_MAX_HEARTS - tagHearts));
}

function updateInventoryHud() {
    inventorySlots.forEach((slot, index) => {
        slot.className = 'inventory-slot';
        slot.innerHTML = '';

        const item = tagInventory[index];

        if (item) {
            slot.classList.add(item.className);
            slot.innerHTML = `<span class="power-icon">${item.icon}</span>${item.name}`;
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

    if (e.code === 'Escape') {
        closeDrawer();
    }

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

loadSettings();
setupHubControls();
updateHighScore();
showMenu();

window.ArcadeSettings = {
    playSound: playUiSound
};

if (typeof LandingEffects !== 'undefined') {
    LandingEffects.init(playUiSound);
}