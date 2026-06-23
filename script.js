/**
 * Arcade Arena — main hub launcher and embedded canvas games.
 *
 * This file drives the landing menu, game picker, settings drawer, and achievement
 * system. Two mini-games run inline on the shared canvas: Fast Eagle (Flappy-style)
 * and Tag Zone (top-down survival/tag). Other titles (Water Royale, Neon Kill,
 * Space Runner, Neon Hoops) are launched via navigation or delegated modules.
 */
// --- DOM references, shared game state, and per-game constants ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const menu = document.getElementById('menu');
const gamesPage = document.getElementById('gamesPage');
const gameContainer = document.getElementById('gameContainer');
const gameTitle = document.getElementById('gameTitle');
const gameMessage = document.getElementById('gameMessage');

const achievementsBtn = document.getElementById('achievementsBtn');
const achievementsBackdrop = document.getElementById('achievementsBackdrop');
const achievementsModal = document.getElementById('achievementsModal');
const achievementsList = document.getElementById('achievementsList');
const closeAchievementsBtn = document.getElementById('closeAchievementsBtn');

const tagZoneBtn = document.getElementById('tagZoneBtn');
const neonKillBtn = document.getElementById('neonKillBtn');
const neonHoopsBtn = document.getElementById('neonHoopsBtn');
const waterRoyaleBtn = document.getElementById('waterRoyaleBtn');
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

const demonWalkSprites = [];
const lizardWalkSprites = [];

for (let i = 1; i <= 6; i++) {
    const demonImg = new Image();
    demonImg.src = `sprites/enemys/Walk${i}.png`;
    demonWalkSprites.push(demonImg);

    const lizardImg = new Image();
    lizardImg.src = `sprites/enemys/Walk${i} copy.png`;
    lizardWalkSprites.push(lizardImg);
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
const TAG_HIT_BOOST_TIME = 4;
const TAG_HIT_BOOST_MULTIPLIER = 2.15;
const TAG_NUKE_SPAWN_CHANCE = 0.10;
const TAG_NUKE_DURATION = 2.4;
const TAG_PLAYER_SIZE = 64;
const TAG_REGULAR_ENEMY_SIZE = 72;
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
let tagNoHitRun = true;
let tagSurvivalTime = 0;
let tagFreezeTimer = 0;
let tagShieldTimer = 0;
let tagBoostTimer = 0;
let tagHearts = TAG_MAX_HEARTS;
let tagHitImmunityTimer = 0;
let tagHitBoostTimer = 0;
let tagNukeEffectTimer = 0;
let tagNukeActive = false;
let tagTimeAccelActive = false;
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

const nukeItemType = {
    name: 'Nuke',
    className: 'nuke',
    color: '#ff6b35',
    glow: 'rgba(255, 107, 53, 0.7)',
    icon: '☢'
};

const tagMapTileImages = TAG_MAP_TILE_SOURCES.map(src => {
    const img = new Image();
    img.src = src;
    return img;
});

function getFastEagleSpeed() {
    return starPowerTimer > 0 ? PIPE_SPEED * STAR_SPEED_MULTIPLIER : PIPE_SPEED;
}

// --- Achievements: definitions, persistence, unlock checks, and modal UI ---
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
    },
    {
        id: 'tank',
        name: 'Tank',
        description: 'Kill 5 brawlers without dying as Juggernaut in Water Royale.',
        icon: '🛡️'
    },
    {
        id: 'untouchable',
        name: 'Untouchable',
        description: 'Defeat a boss without taking damage in Neon Kill.',
        icon: '✨'
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

    const achievement = ACHIEVEMENTS.find(entry => entry.id === id);
    if (achievement && currentGame === 'tagZone') {
        showAchievementToast(achievement);
    }

    if (achievementsModal && !achievementsModal.classList.contains('hidden')) {
        renderAchievementsList();
    }
}

function showAchievementToast(achievement) {
    const host = document.getElementById('achievementToastHost');
    if (!host) return;

    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
        <h4>${achievement.icon} Achievement Unlocked</h4>
        <p><strong>${achievement.name}</strong> — ${achievement.description}</p>
    `;
    host.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    playUiSound('achievement');

    window.setTimeout(() => {
        toast.classList.remove('visible');
        window.setTimeout(() => toast.remove(), 320);
    }, 3800);
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

// --- Settings and audio: brightness overlay, volume sliders, and Web Audio UI SFX ---
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

    if (type === 'menuHover') {
        const click = audioContext.createOscillator();
        const clickGain = audioContext.createGain();
        click.type = 'square';
        click.frequency.setValueAtTime(1800, now);
        click.frequency.exponentialRampToValueAtTime(620, now + 0.025);
        clickGain.gain.setValueAtTime(0.0001, now);
        clickGain.gain.exponentialRampToValueAtTime(0.09 * volume, now + 0.004);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
        click.connect(clickGain);
        clickGain.connect(audioContext.destination);
        click.start(now);
        click.stop(now + 0.05);

        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(240, now);
        oscillator.frequency.exponentialRampToValueAtTime(120, now + 0.04);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.05 * volume, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
        oscillator.start(now);
        oscillator.stop(now + 0.065);
        return;
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

    if (type === 'achievement') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523, now);
        oscillator.frequency.exponentialRampToValueAtTime(784, now + 0.12);
        oscillator.frequency.exponentialRampToValueAtTime(1047, now + 0.28);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.14 * volume, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.1 * volume, now + 0.18);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
        oscillator.start(now);
        oscillator.stop(now + 0.44);
    }

    if (type === 'shoot') {
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(280, now);
        oscillator.frequency.exponentialRampToValueAtTime(120, now + 0.08);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.08 * volume, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.11);
    }

    if (type === 'enemyHit') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(180, now);
        oscillator.frequency.exponentialRampToValueAtTime(60, now + 0.14);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.09 * volume, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        oscillator.start(now);
        oscillator.stop(now + 0.17);
    }

    if (type === 'nuke') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(90, now);
        oscillator.frequency.exponentialRampToValueAtTime(40, now + 0.55);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.16 * volume, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.08 * volume, now + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
        oscillator.start(now);
        oscillator.stop(now + 0.62);
    }
}

// --- Hub navigation: side drawer, menu/games page transitions, and screen helpers ---
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
    ArcadeMeta.hideMetaPages();
    gamesPage.classList.remove('hidden');
    gameContainer.classList.add('hidden');
}

function setupHubControls() {
    ourGamesBtn.addEventListener('click', () => {
        ArcadeMeta.playGlitchTransition(showGamesPage);
    });
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
        ArcadeMusic.setVolumeMult(getSoundVolume());
        if (settings.sound <= 0) ArcadeMusic.stop();
        else if (!currentGame) ArcadeMusic.start('hub');
    });
}

function showMenu() {
    stopGame();
    SpaceRunner.stop();
    currentGame = null;
    closeDrawer();
    ArcadeMeta.hideMetaPages();
    menu.classList.remove('hidden');
    gamesPage.classList.add('hidden');
    gameContainer.classList.add('hidden');
    tagHud.classList.add('hidden');
    spaceRunnerUi.classList.add('hidden');
    gameMessage.classList.remove('hidden');
    if (settings.sound > 0) ArcadeMusic.start('hub');
}

function showGameScreen(name, message, useCanvas = false, showRestart = false) {
    menu.classList.add('hidden');
    gamesPage.classList.add('hidden');
    ArcadeMeta.hideMetaPages();
    gameContainer.classList.remove('hidden');
    LandingEffects.clearMouseTrail();
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

// --- Main game loop: requestAnimationFrame driver for embedded canvas games ---
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

    if (currentGame) {
        ArcadeMeta.tickPlayTime(delta);
    }

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

// --- Fast Eagle: Flappy-style pipe dodger with star power-ups and high score ---
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
    ArcadeMusic.start('fastEagle');
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
    checkFastEagleAchievements();
    ArcadeMeta.onFastEagleEnd(score);
    gameMessage.textContent = `Game Over - Score ${score}`;
    restartBtn.classList.remove('hidden');
    playUiSound('gameOver');
}

// --- Tag Zone: top-down survival — dodge taggers, collect powers, clear timed levels ---
function startTagZone() {
    spaceRunnerUi.classList.add('hidden');
    SpaceRunner.stop();
    currentGame = 'tagZone';
    canvas.width = 960;
    canvas.height = 620;

    tagLevel = 1;
    tagNoHitRun = true;
    tagHearts = TAG_MAX_HEARTS;
    tagHitImmunityTimer = 0;
    tagHitBoostTimer = 0;
    tagNukeEffectTimer = 0;
    tagNukeActive = false;
    tagTimeAccelActive = false;

    const metaRolls = ArcadeMeta.onTagZoneStart();
    tagTimeAccelActive = metaRolls.activateTimeAccel;

    setupTagLevel();

    tagHud.classList.remove('hidden');
    showGameScreen('Tag Zone', 'Get ready...', true, false);
    restartBtn.classList.add('hidden');
    ArcadeMusic.start('tagZone');
    startLoop();
}

function restartTagZone() {
    startTagZone();
}

function setupTagLevel(options = {}) {
    const { skipCountdown = false, keepInventory = false } = options;

    tagSurvivalTime = 0;
    tagFreezeTimer = 0;
    tagShieldTimer = 0;
    tagBoostTimer = 0;

    if (!keepInventory) {
        tagInventory = [];
    }

    if (skipCountdown) {
        countdown = 0;
        countdownActive = false;
    } else {
        countdown = 3;
        countdownActive = true;
    }
    tagPlayerFrame = 0;
    tagPlayerFrameTimer = 0;
    taggerFrame = 0;
    taggerFrameTimer = 0;

    tagPlayer = {
        x: WORLD_WIDTH / 2,
        y: WORLD_HEIGHT / 2,
        width: TAG_PLAYER_SIZE,
        height: TAG_PLAYER_SIZE,
        speed: 275,
        isMoving: false
    };

    const itemCount = Math.max(18 - tagLevel * 2, 8);
    tagItems = Array.from({ length: itemCount }, () => createTagItem());

    if (Math.random() < TAG_NUKE_SPAWN_CHANCE) {
        tagItems.push(createTagItem('nuke'));
    }

    if (tagTimeAccelActive && tagLevel === 1) {
        gameMessage.textContent = 'Time Acceleration active!';
    }

    spawnTaggersForLevel();
    tagMapTiles = createTagTiles();
    tagMapTrees = createTagBarrierTrees();
    tagMapRocks = [];
    tagHouse = null;
    tagAnimTime = 0;

    gameMessage.textContent = skipCountdown ? `NUKE! Level ${tagLevel}` : 'Get ready...';
    updateInventoryHud();
    updateTagHud();
}

function spawnTaggersForLevel() {
    taggers = [];

    const regularCount = Math.min(2 + tagLevel, 7);
    for (let i = 0; i < regularCount; i++) {
        taggers.push(createTagger('regular'));
    }

    if (tagLevel >= 3) {
        taggers.push(createTagger('brute'), createTagger('brute'));
    }

    if (tagLevel >= 5) {
        taggers.push(createTagger('stalker'), createTagger('stalker'));
    }
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

function createTagger(type = 'regular') {
    let x;
    let y;
    const minDistanceFromPlayer = 450;
    const configs = {
        regular: {
            width: TAG_REGULAR_ENEMY_SIZE,
            height: TAG_REGULAR_ENEMY_SIZE,
            hitboxOffsetX: 18,
            hitboxOffsetY: 16,
            hitboxWidth: 36,
            hitboxHeight: 46,
            speed: 155 + tagLevel * 22
        },
        brute: {
            width: Math.round(TAG_PLAYER_SIZE * 4.25),
            height: Math.round(TAG_PLAYER_SIZE * 4.25),
            hitboxOffsetX: 78,
            hitboxOffsetY: 72,
            hitboxWidth: 116,
            hitboxHeight: 128,
            speed: 128 + tagLevel * 9,
            oneShot: true
        },
        stalker: {
            width: TAG_REGULAR_ENEMY_SIZE * 3,
            height: TAG_REGULAR_ENEMY_SIZE * 3,
            hitboxOffsetX: 54,
            hitboxOffsetY: 50,
            hitboxWidth: 108,
            hitboxHeight: 130,
            speed: 310 + tagLevel * 6,
            aura: 'blue'
        }
    };
    const config = configs[type] || configs.regular;
    const width = config.width;
    const height = config.height;

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
        type,
        x,
        y,
        width,
        height,
        hitboxOffsetX: config.hitboxOffsetX,
        hitboxOffsetY: config.hitboxOffsetY,
        hitboxWidth: config.hitboxWidth,
        hitboxHeight: config.hitboxHeight,
        speed: config.speed,
        oneShot: config.oneShot || false,
        aura: config.aura || null
    };
}

function createTagItem(forcedType = null) {
    const type = forcedType === 'nuke'
        ? nukeItemType
        : itemTypes[Math.floor(Math.random() * itemTypes.length)];

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

    if (tagNukeActive) {
        tagAnimTime += delta;
        tagNukeEffectTimer = Math.max(0, tagNukeEffectTimer - delta);

        if (tagNukeEffectTimer <= 0) {
            tagNukeActive = false;
            tagLevel += 1;
            checkTagZoneAchievements();
            setupTagLevel({ skipCountdown: true, keepInventory: true });
        }

        camX = clamp(tagPlayer.x + tagPlayer.width / 2 - canvas.width / 2, 0, WORLD_WIDTH - canvas.width);
        camY = clamp(tagPlayer.y + tagPlayer.height / 2 - canvas.height / 2, 0, WORLD_HEIGHT - canvas.height);
        updateTagHud();
        return;
    }

    tagSurvivalTime += delta * (tagTimeAccelActive ? 1.65 : 1);
    tagAnimTime += delta;
    tagFreezeTimer = Math.max(0, tagFreezeTimer - delta);
    tagShieldTimer = Math.max(0, tagShieldTimer - delta);
    tagBoostTimer = Math.max(0, tagBoostTimer - delta);
    tagHitImmunityTimer = Math.max(0, tagHitImmunityTimer - delta);
    tagHitBoostTimer = Math.max(0, tagHitBoostTimer - delta);

    ArcadeMeta.onTagZoneUpdate(tagSurvivalTime, tagLevel);

    moveTagPlayer(delta);
    updateTagPlayerAnimation(delta);
    moveTaggers(delta);
    updateTaggerAnimation(delta);
    collectTagItems();
    checkTaggerCollisions();

    if (tagSurvivalTime >= TAG_LEVEL_TIME) {
        tagLevel += 1;
        ArcadeMeta.onTagLevelSurvived();
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

    const speedMultiplier = (tagBoostTimer > 0 ? 1.65 : 1)
        * (tagHitBoostTimer > 0 ? TAG_HIT_BOOST_MULTIPLIER : 1)
        * (tagTimeAccelActive ? 1.55 : 1);
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
                const newTagger = createTagger(tagger.type || 'regular');
                tagger.x = newTagger.x;
                tagger.y = newTagger.y;
                tagShieldTimer = 0;
                gameMessage.textContent = 'Shield saved you';
                return;
            }

            if (tagger.oneShot) {
                tagNoHitRun = false;
                tagHearts = 0;
                updateTagHud();
                playUiSound('hit');
                endTagZone();
                return;
            }

            tagNoHitRun = false;
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

    if (item.name === 'Nuke') {
        updateInventoryHud();
        playUiSound('nuke');
        triggerTagNuke();
        return;
    }

    updateInventoryHud();
    playUiSound('collect');
}

function triggerTagNuke() {
    if (tagNukeActive) return;

    tagNukeActive = true;
    tagNukeEffectTimer = TAG_NUKE_DURATION;
    taggers = [];
    gameMessage.textContent = 'NUKE!';
}

function handleTagZoneSpace() {
    if (currentGame !== 'tagZone' || !gameRunning || countdownActive || tagNukeActive) return;
    useTagItem();
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

    if (tagNukeEffectTimer > 0) {
        drawTagNukeEffect();
    }

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

function drawTagNukeEffect() {
    const progress = 1 - tagNukeEffectTimer / TAG_NUKE_DURATION;
    const intensity = tagNukeEffectTimer / TAG_NUKE_DURATION;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = Math.max(canvas.width, canvas.height) * 0.85;
    const radius = 40 + progress * maxRadius;

    ctx.fillStyle = `rgba(20, 0, 0, ${0.35 * intensity})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const flash = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    flash.addColorStop(0, `rgba(255, 255, 220, ${0.9 * intensity})`);
    flash.addColorStop(0.25, `rgba(255, 180, 60, ${0.7 * intensity})`);
    flash.addColorStop(0.55, `rgba(255, 80, 20, ${0.45 * intensity})`);
    flash.addColorStop(0.8, `rgba(255, 30, 0, ${0.2 * intensity})`);
    flash.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = flash;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let ring = 0; ring < 3; ring++) {
        const ringProgress = Math.max(0, progress - ring * 0.12);
        const ringRadius = 40 + ringProgress * maxRadius * 0.92;
        ctx.strokeStyle = `rgba(255, 230, 109, ${(0.85 - ring * 0.2) * intensity})`;
        ctx.lineWidth = 5 - ring;
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius * 0.72, 0, Math.PI * 2);
        ctx.stroke();
    }

    if (progress > 0.35) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * intensity})`;
        ctx.font = 'bold 42px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('NUKE!', centerX, centerY - 24);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }
}

function drawTagPowerUp(type, radius) {
    if (type.className === 'nuke') {
        ctx.fillStyle = type.color;
        ctx.strokeStyle = '#fff2cc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#1a1a1a';
        for (let i = 0; i < 3; i++) {
            const angle = (Math.PI * 2 / 3) * i - Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * radius * 0.18, Math.sin(angle) * radius * 0.18);
            ctx.lineTo(Math.cos(angle) * radius * 0.62, Math.sin(angle) * radius * 0.62);
            ctx.lineTo(Math.cos(angle + 0.45) * radius * 0.34, Math.sin(angle + 0.45) * radius * 0.34);
            ctx.closePath();
            ctx.fill();
        }
        return;
    }

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

function getTaggerSpriteSet(tagger) {
    if (tagger.type === 'brute') return demonWalkSprites;
    if (tagger.type === 'stalker') return lizardWalkSprites;
    return taggerRunSprites;
}

function drawTaggers() {
    const frozen = tagFreezeTimer > 0;

    taggers.forEach(tagger => {
        const spriteSet = getTaggerSpriteSet(tagger);
        const sprite = spriteSet[taggerFrame % spriteSet.length];
        ctx.save();

        if (tagger.aura === 'blue') {
            const pulse = 0.85 + Math.sin(tagAnimTime * 7) * 0.15;
            ctx.fillStyle = `rgba(74, 144, 255, ${0.18 * pulse})`;
            ctx.beginPath();
            ctx.arc(
                tagger.x + tagger.width / 2,
                tagger.y + tagger.height / 2,
                tagger.width * 0.72 * pulse,
                0,
                Math.PI * 2
            );
            ctx.fill();
            ctx.strokeStyle = `rgba(116, 210, 255, ${0.75 * pulse})`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        if (frozen) {
            ctx.shadowColor = 'rgba(116, 210, 255, 0.8)';
            ctx.shadowBlur = 18;
        }

        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
            ctx.drawImage(sprite, tagger.x, tagger.y, tagger.width, tagger.height);
        } else if (tagger.type === 'brute') {
            ctx.fillStyle = frozen ? '#8be9ff' : '#8b1f1f';
            ctx.fillRect(tagger.x, tagger.y, tagger.width, tagger.height);
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

// --- Game launchers: redirect to standalone pages or open delegated modules ---
function startWaterRoyale() {
    ArcadeMusic.stop();
    window.location.href = 'water-royale.html';
}

function startNeonKill() {
    ArcadeMusic.stop();
    sessionStorage.setItem('neonKillUpgrades', JSON.stringify({
        overclock: ArcadeMeta.hasEquippedUpgrade('kill-overclock-core'),
        siphon: ArcadeMeta.hasEquippedUpgrade('kill-siphon-nanites'),
        slam: ArcadeMeta.hasEquippedUpgrade('kill-slam-module'),
        yamato: ArcadeMeta.hasEquippedUpgrade('kill-cyber-yamato')
    }));
    window.location.href = 'neon-kill.html';
}

function startNeonHoops() {
    ArcadeMusic.stop();
    window.location.href = 'neon-hoops.html';
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
    ArcadeMusic.start('spaceRunner');
}

// --- Event listeners and boot: keyboard/game buttons, achievements API, landing init ---
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
            handleTagZoneSpace();
        }
    }
});

document.addEventListener('keyup', e => {
    keys[e.code] = false;
});

tagZoneBtn?.addEventListener('click', startTagZone);

neonKillBtn?.addEventListener('click', startNeonKill);

neonHoopsBtn?.addEventListener('click', startNeonHoops);

waterRoyaleBtn?.addEventListener('click', startWaterRoyale);

platformerBtn?.addEventListener('click', startSpaceRunner);

playBtn?.addEventListener('click', startFastEagle);

restartBtn?.addEventListener('click', () => {
    if (currentGame === 'fastEagle') restartFastEagle();
    if (currentGame === 'tagZone') restartTagZone();
});

backBtn.addEventListener('click', showMenu);

achievementsBtn?.addEventListener('click', () => {
    openAchievementsModal();
    playUiSound('click');
});
closeAchievementsBtn?.addEventListener('click', closeAchievementsModal);
achievementsBackdrop?.addEventListener('click', closeAchievementsModal);
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && achievementsModal && !achievementsModal.classList.contains('hidden')) {
        closeAchievementsModal();
    }
});

window.ArcadeAchievements = {
    unlock(id) {
        unlockAchievement(id);
    },
    onSpaceRunnerGameOver(highscore, runScore) {
        checkSpaceRunnerAchievements(highscore);
        ArcadeMeta.onSpaceRunnerEnd(runScore || 0);
    }
};

const LandingEffects = (() => {
    const TITLE_TEXT = 'ARCADE ARENA';
    const LETTER_STAGGER_MS = 90;
    const REVEAL_STAGGER_MS = 120;

    let landingCanvas;
    let landingCtx;
    let trailCanvas;
    let trailCtx;
    let bootOverlay;
    let landingTitle;
    let terminalGrid;
    let landingAnimationId = null;
    let landingPlaySound = () => {};
    let bootPlayed = false;
    let mouse = { x: -1000, y: -1000 };
    let gridGlitchTimer = 2.5;

    const shards = [];
    const trail = [];

    function isMenuVisible() {
        const menuEl = document.getElementById('menu');
        return menuEl && !menuEl.classList.contains('hidden');
    }

    function isHubTrailActive() {
        const gameContainer = document.getElementById('gameContainer');
        if (gameContainer && !gameContainer.classList.contains('hidden')) return false;
        return ['menu', 'gamesPage', 'shopPage', 'inventoryPage'].some(id => {
            const el = document.getElementById(id);
            return el && !el.classList.contains('hidden');
        });
    }

    function getEquippedTrailStyle(alpha) {
        if (typeof ArcadeMeta !== 'undefined' && ArcadeMeta.getTrailStyle) {
            return ArcadeMeta.getTrailStyle(alpha);
        }
        return {
            fill: `rgba(0, 255, 204, ${alpha})`,
            stroke: `rgba(255, 77, 141, ${Math.max(0.15, alpha * 0.7)})`
        };
    }

    function resizeCanvases() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = window.innerWidth;
        const height = window.innerHeight;

        [landingCanvas, trailCanvas].forEach(canvasEl => {
            canvasEl.width = width * dpr;
            canvasEl.height = height * dpr;
            canvasEl.style.width = `${width}px`;
            canvasEl.style.height = `${height}px`;
            canvasEl.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
        });
    }

    function initShards() {
        shards.length = 0;
        const count = 34;
        for (let i = 0; i < count; i += 1) {
            const verts = 3 + Math.floor(Math.random() * 2);
            const points = [];
            for (let v = 0; v < verts; v += 1) {
                const angle = (Math.PI * 2 / verts) * v + Math.random() * 0.35;
                const radius = 4 + Math.random() * 11;
                points.push({
                    x: Math.cos(angle) * radius,
                    y: Math.sin(angle) * radius
                });
            }
            const purple = Math.random() > 0.45;
            shards.push({
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                vx: (Math.random() - 0.5) * 0.28,
                vy: (Math.random() - 0.5) * 0.22,
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.01,
                points,
                fill: purple ? 'rgba(18, 8, 24, 0.55)' : 'rgba(6, 12, 18, 0.55)',
                stroke: purple ? 'rgba(170, 68, 255, 0.75)' : 'rgba(0, 255, 255, 0.65)'
            });
        }
    }

    function triggerGridGlitch() {
        if (!terminalGrid) return;
        terminalGrid.classList.add('glitching');
        window.setTimeout(() => terminalGrid.classList.remove('glitching'), 120 + Math.random() * 180);
    }

    function updateGridGlitch(dt) {
        gridGlitchTimer -= dt;
        if (gridGlitchTimer <= 0) {
            triggerGridGlitch();
            gridGlitchTimer = 2.2 + Math.random() * 4.5;
        }
    }

    function syncHubMusic() {
        if (settings.sound <= 0) {
            ArcadeMusic.stop();
            return;
        }
        ArcadeMusic.setVolumeMult(getSoundVolume());
        if (!currentGame) ArcadeMusic.start('hub');
    }

    function buildTitleLetters() {
        landingTitle.innerHTML = '';
        [...TITLE_TEXT].forEach(char => {
            const span = document.createElement('span');
            span.className = char === ' ' ? 'title-letter title-space' : 'title-letter';
            span.textContent = char === ' ' ? '\u00a0' : char;
            landingTitle.appendChild(span);
        });
    }

    function revealElement(element, delayMs) {
        element.style.setProperty('--reveal-delay', `${delayMs}ms`);
        element.classList.add('revealed');
    }

    function finishBoot() {
        if (bootOverlay) {
            bootOverlay.classList.remove('boot-sweeping', 'active');
            bootOverlay.classList.add('boot-done');
        }
        document.body.classList.remove('boot-sequence-active');
        if (landingTitle) {
            landingTitle.querySelectorAll('.title-letter').forEach(letter => letter.classList.add('powered-on'));
        }
        document.querySelectorAll('.landing-reveal').forEach((element, index) => {
            if (!element.classList.contains('revealed')) {
                revealElement(element, index * 40);
            }
        });
    }

    function runBootSequence() {
        if (bootPlayed) return;
        bootPlayed = true;

        const failsafe = window.setTimeout(finishBoot, 5000);
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (reducedMotion) {
            finishBoot();
            window.clearTimeout(failsafe);
            return;
        }

        bootOverlay.classList.add('active');
        bootOverlay.classList.remove('boot-done');
        document.body.classList.add('boot-sequence-active');

        window.setTimeout(() => {
            bootOverlay.classList.add('boot-sweeping');
            landingPlaySound('powerOn');
        }, 350);

        const letters = landingTitle.querySelectorAll('.title-letter');
        letters.forEach((letter, index) => {
            window.setTimeout(() => letter.classList.add('powered-on'), 700 + index * LETTER_STAGGER_MS);
        });

        const lettersDone = 700 + letters.length * LETTER_STAGGER_MS + 200;
        window.setTimeout(() => {
            window.clearTimeout(failsafe);
            finishBoot();
        }, lettersDone);

        document.querySelectorAll('.landing-reveal').forEach((element, index) => {
            revealElement(element, lettersDone + 150 + index * REVEAL_STAGGER_MS);
        });
    }

    function drawShards() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        shards.forEach(shard => {
            shard.x += shard.vx;
            shard.y += shard.vy;
            shard.rot += shard.rotSpeed;

            if (shard.x < -40) shard.x = width + 40;
            if (shard.x > width + 40) shard.x = -40;
            if (shard.y < -40) shard.y = height + 40;
            if (shard.y > height + 40) shard.y = -40;

            landingCtx.save();
            landingCtx.translate(shard.x, shard.y);
            landingCtx.rotate(shard.rot);
            landingCtx.beginPath();
            shard.points.forEach((point, index) => {
                if (index === 0) landingCtx.moveTo(point.x, point.y);
                else landingCtx.lineTo(point.x, point.y);
            });
            landingCtx.closePath();
            landingCtx.fillStyle = shard.fill;
            landingCtx.fill();
            landingCtx.strokeStyle = shard.stroke;
            landingCtx.lineWidth = 1;
            landingCtx.stroke();
            landingCtx.restore();
        });
    }

    function clearMouseTrail() {
        trail.length = 0;
        mouse.x = -1000;
        mouse.y = -1000;

        if (trailCtx && trailCanvas) {
            trailCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            trailCanvas.classList.add('hidden');
        }
    }

    function drawMouseTrail() {
        if (!trailCtx || !trailCanvas) return;

        trailCanvas.classList.remove('hidden');
        trailCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        if (mouse.x < 0) return;

        trail.push({ x: mouse.x, y: mouse.y, life: 1 });
        if (trail.length > 24) trail.shift();

        for (let i = trail.length - 1; i >= 0; i--) {
            const point = trail[i];
            point.life -= 0.06;
            if (point.life <= 0) {
                trail.splice(i, 1);
                continue;
            }
            const radius = 3 + (1 - point.life) * 8;
            const trailStyle = getEquippedTrailStyle(point.life * 0.35);
            trailCtx.fillStyle = trailStyle.fill;
            trailCtx.beginPath();
            trailCtx.arc(point.x, point.y, radius, 0, Math.PI * 2);
            trailCtx.fill();
            if (i > 0) {
                const prev = trail[i - 1];
                trailCtx.strokeStyle = trailStyle.stroke;
                trailCtx.lineWidth = 2;
                trailCtx.beginPath();
                trailCtx.moveTo(prev.x, prev.y);
                trailCtx.lineTo(point.x, point.y);
                trailCtx.stroke();
            }
        }
    }

    let lastLandingTime = performance.now();

    function animateLanding(time) {
        const dt = Math.min((time - lastLandingTime) / 1000, 0.05);
        lastLandingTime = time;
        if (isMenuVisible()) {
            landingCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            drawShards();
            updateGridGlitch(dt);
            syncHubMusic();
        } else if (!currentGame) {
            syncHubMusic();
            if (landingCtx) {
                landingCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            }
        } else if (landingCtx) {
            landingCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        }
        ArcadeMusic.advance();

        if (isHubTrailActive()) {
            drawMouseTrail();
        } else {
            clearMouseTrail();
        }
        landingAnimationId = requestAnimationFrame(animateLanding);
    }

    function setupButtonHovers() {
        let lastHoverSound = 0;
        document.querySelectorAll('#menu .landing-btn').forEach(button => {
            button.addEventListener('mouseenter', () => {
                const now = Date.now();
                if (now - lastHoverSound > 100) {
                    landingPlaySound('menuHover');
                    lastHoverSound = now;
                }
            });
        });
    }

    function init(soundFn) {
        landingCanvas = document.getElementById('landingCanvas');
        trailCanvas = document.getElementById('mouseTrailCanvas');
        bootOverlay = document.getElementById('bootOverlay');
        landingTitle = document.getElementById('landingTitle');
        terminalGrid = document.querySelector('.terminal-void-grid');

        if (!landingCanvas || !trailCanvas || !bootOverlay || !landingTitle) {
            finishBoot();
            return;
        }

        try {
            landingPlaySound = soundFn || landingPlaySound;
            landingCtx = landingCanvas.getContext('2d');
            trailCtx = trailCanvas.getContext('2d');
            buildTitleLetters();
            resizeCanvases();
            initShards();
            setupButtonHovers();
            runBootSequence();
            ArcadeMusic.init();
            syncHubMusic();

            window.addEventListener('resize', () => {
                resizeCanvases();
                initShards();
            });

            window.addEventListener('mousemove', event => {
                if (!isHubTrailActive()) return;
                mouse.x = event.clientX;
                mouse.y = event.clientY;
            });

            window.addEventListener('mouseleave', () => {
                mouse.x = -1000;
                mouse.y = -1000;
            });

            if (!landingAnimationId) {
                landingAnimationId = requestAnimationFrame(animateLanding);
            }
        } catch (error) {
            console.error('Landing effects failed to start:', error);
            finishBoot();
        }
    }

    return { init, clearMouseTrail, syncHubMusic };
})();

loadSettings();
loadAchievements();
ArcadeMeta.init();
setupHubControls();
showMenu();
ArcadeMusic.setVolumeMult(getSoundVolume());
if (settings.sound > 0) ArcadeMusic.start('hub');

window.ArcadeSettings = {
    playSound: playUiSound
};

LandingEffects.init(playUiSound);
