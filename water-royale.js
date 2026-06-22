/**
 * Water Royale — top-down backyard water-gun battle royale.
 *
 * Procedurally styled tile arena with destructible walls, bush stealth, speed pads,
 * and weapon drops. Player picks a class (Default, Juggernaut, Speedster), fights
 * AI brawlers, and wins by being the last fighter standing.
 */
// --- Constants and config: arena size, classes, weapons, sprites, and draw helpers ---
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const hud = {
  classLabel: document.getElementById("classLabel"),
  weaponLabel: document.getElementById("weaponLabel"),
  ammoLabel: document.getElementById("ammoLabel"),
  aliveLabel: document.getElementById("aliveLabel"),
  menu: document.getElementById("menu"),
  message: document.getElementById("message"),
  messageTitle: document.getElementById("messageTitle"),
  messageBody: document.getElementById("messageBody")
};
let respawnInterval = null;

// respawn UI elements (added to DOM in index.html)
hud.respawn = document.getElementById("respawn");
hud.respawnTitle = document.getElementById("respawnTitle");
hud.respawnBody = document.getElementById("respawnBody");
hud.respawnTimer = document.getElementById("respawnTimer");

const tile = 44;
const cols = 50;
const rows = 34;
const arena = { w: cols * tile, h: rows * tile };
const keys = new Set();
const mouse = { x: 0, y: 0, down: false };
const camera = { x: 0, y: 0 };
const moveSpeedMultiplier = 2.15;
const speedTileMultiplier = 1.5;
const wallCollisionInset = 4;

const classes = {
  default: { label: "Default", hp: 100, speed: 75, color: "#12a4ff", regen: 6, wallJumpRecharge: 4 },
  juggernaut: { label: "Juggernaut", hp: 150, speed: 40, color: "#9c63ff", regen: 6, shieldDuration: 5 },
  speedster: { label: "Speedster", hp: 75, speed: 100, color: "#21c985", regen: 8, bushSpeed: 1.25, reloadMultiplier: 0.75, damageMultiplier: 0.82 }
};

const weaponStats = {
  pistol: { label: "Pistol", damage: 15, ammo: 4, reload: 0.85, fireRate: 0.32, speed: 680, size: 8, range: 520, color: "#3ecbff" },
  shotgun: { label: "Shotgun", damage: 20, ammo: 3, reload: 1.55, fireRate: 0.72, speed: 620, size: 7, range: 340, color: "#8df7ff", pellets: 7, spread: 0.58 },
  sniper: { label: "Sniper", damage: 75, ammo: 3, reload: 2.2, fireRate: 1, speed: 1120, size: 4, range: 760, color: "#dffcff" },
  rifle: { label: "Rifle", damage: 5, ammo: 3, reload: 1.1, fireRate: 0.09, speed: 760, size: 5, range: 560, color: "#16b8ff", burst: 8 }
};

// Sprite paths — PNGs live in sprites/water royal stuff/
const SPRITE_DIR = 'sprites/water royal stuff/';

function spritePath(filename) {
  return encodeURI(`${SPRITE_DIR}${filename}`);
}

const weaponImages = {};
const weaponImageFiles = {
  pistol: 'water-gun-pistol-clour-palette_-white-gr-2.png',
  shotgun: 'water-gun-shotgun-colour-palette-white-3.png',
  sniper: 'water-gun_-sniper-clour-palette_-white-g-4.png',
  rifle: 'water-gun-rifle-colour-palette-white--4.png'
};
for (const key in weaponImageFiles) {
  const img = new Image();
  img.src = spritePath(weaponImageFiles[key]);
  weaponImages[key] = img;
}

const WEAPON_HOLD = {
  pistol: { length: 54, gripX: 11, gripY: 4, imgScale: 1 },
  shotgun: { length: 70, gripX: 13, gripY: 5, imgScale: 1.08 },
  sniper: { length: 88, gripX: 15, gripY: 3, imgScale: 1.12 },
  rifle: { length: 76, gripX: 13, gripY: 4, imgScale: 1.05 }
};

function drawAttachedWeapon(fighter, x, y, bob, aim, style) {
  const hold = WEAPON_HOLD[fighter.weapon] || WEAPON_HOLD.pistol;
  const classScale = style.scale * (fighter.ai ? 0.94 : 1);
  const gripX = hold.gripX * classScale;
  const gripY = hold.gripY * classScale;
  const gunLen = hold.length * classScale * hold.imgScale;

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(aim);
  if (Math.cos(aim) < 0) ctx.scale(1, -1);

  ctx.strokeStyle = "#f7d7b5";
  ctx.lineWidth = 5 * classScale;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(3 * classScale, 2 * classScale);
  ctx.lineTo(gripX, gripY);
  ctx.stroke();

  ctx.fillStyle = style.trim;
  ctx.beginPath();
  ctx.arc(gripX, gripY, 4 * classScale, 0, Math.PI * 2);
  ctx.fill();

  const img = weaponImages[fighter.weapon];
  if (img && img.complete && img.naturalWidth) {
    const aspect = img.naturalHeight / img.naturalWidth;
    const drawW = gunLen;
    const drawH = drawW * aspect;
    ctx.drawImage(img, gripX, gripY - drawH * 0.52, drawW, drawH);
  } else {
    ctx.fillStyle = weaponStats[fighter.weapon].color;
    roundRect(gripX, gripY - 4 * classScale, gunLen, 8 * classScale, 3);
    ctx.fill();
    ctx.fillStyle = style.body[1];
    ctx.fillRect(gripX + gunLen - 6 * classScale, gripY - 3 * classScale, 6 * classScale, 6 * classScale);
  }

  ctx.restore();
}

const CHARACTER_STYLES = {
  default: {
    body: ["#1cb8ff", "#0a78c9"],
    trim: "#7ee3ff",
    gear: "#ffd166",
    shadow: "#063553",
    scale: 1
  },
  juggernaut: {
    body: ["#b688ff", "#6b38d9"],
    trim: "#e8d4ff",
    gear: "#3a1f78",
    shadow: "#1a0a3a",
    scale: 1.28
  },
  speedster: {
    body: ["#35f0a8", "#0f9a5c"],
    trim: "#b8ffe0",
    gear: "#063553",
    shadow: "#043326",
    scale: 0.92
  }
};

function tileSeed(c, r, salt = 0) {
  return ((c * 928371 + r * 689287 + salt * 17389) >>> 0) % 997;
}

function drawGradientBody(x, y, w, h, colors, radius) {
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
  ctx.fillStyle = grad;
  roundRect(x, y, w, h, radius);
  ctx.fill();
}

function drawCharacter(fighter, x, y, aim) {
  const style = CHARACTER_STYLES[fighter.type] || CHARACTER_STYLES.default;
  const moving = Math.hypot(fighter.dirX, fighter.dirY) > 0.05;
  const faceAngle = moving ? Math.atan2(fighter.dirY, fighter.dirX) : aim;
  const facingRight = Math.cos(faceAngle) >= 0;
  const walkPhase = fighter.walkFrame || 0;
  const bob = moving ? [0, -4, -1][walkPhase] : Math.sin(state.time * 3 + fighter.x) * 1.2;
  const legSwing = moving ? [-7, 0, 7][walkPhase] : 0;
  const scale = style.scale * (fighter.ai ? 0.94 : 1);

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(facingRight ? scale : -scale, scale);

  ctx.fillStyle = "rgba(6, 53, 83, 0.22)";
  ctx.beginPath();
  ctx.ellipse(0, 18, 16 * (fighter.type === "juggernaut" ? 1.35 : 1), 5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (fighter.type === "speedster" && moving) {
    ctx.strokeStyle = "rgba(53, 240, 168, 0.45)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-18 - i * 8, -8 + i * 6);
      ctx.lineTo(-30 - i * 8, -8 + i * 6);
      ctx.stroke();
    }
  }

  ctx.fillStyle = style.gear;
  ctx.fillRect(-8 + legSwing * 0.25, 12, 7, 10);
  ctx.fillRect(1 - legSwing * 0.25, 12, 7, 10);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-9 + legSwing * 0.25, 20, 9, 4);
  ctx.fillRect(0 - legSwing * 0.25, 20, 9, 4);

  if (fighter.type === "juggernaut") {
    drawGradientBody(-18, -8, 36, 28, style.body, 8);
    ctx.fillStyle = style.trim;
    roundRect(-14, -2, 28, 8, 4);
    ctx.fill();
    ctx.fillStyle = style.gear;
    roundRect(-22, -12, 10, 18, 4);
    ctx.fill();
    roundRect(12, -12, 10, 18, 4);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 2, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = style.body[1];
    ctx.fillRect(-4, -1, 8, 6);
  } else if (fighter.type === "speedster") {
    drawGradientBody(-11, -2, 22, 22, style.body, 10);
    ctx.fillStyle = style.trim;
    roundRect(-12, -10, 24, 8, 5);
    ctx.fill();
    ctx.fillStyle = style.gear;
    roundRect(-8, -8, 16, 5, 3);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-3, -7, 6, 3);
    ctx.fillStyle = style.trim;
    ctx.beginPath();
    ctx.moveTo(8, -4);
    ctx.lineTo(16, 0);
    ctx.lineTo(8, 4);
    ctx.closePath();
    ctx.fill();
  } else {
    drawGradientBody(-13, -2, 26, 24, style.body, 9);
    ctx.fillStyle = "#ffffff";
    roundRect(-10, 2, 20, 12, 4);
    ctx.fill();
    ctx.fillStyle = style.body[0];
    ctx.fillRect(-10, 7, 20, 3);
    ctx.fillStyle = style.gear;
    roundRect(-12, -14, 24, 10, 5);
    ctx.fill();
    ctx.fillStyle = style.trim;
    ctx.beginPath();
    ctx.arc(0, -9, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = style.shadow;
  ctx.beginPath();
  ctx.arc(0, -10, fighter.type === "juggernaut" ? 11 : 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f7d7b5";
  ctx.beginPath();
  ctx.arc(0, -10, fighter.type === "juggernaut" ? 9 : 7.5, 0, Math.PI * 2);
  ctx.fill();

  if (fighter.type === "juggernaut") {
    ctx.fillStyle = style.gear;
    roundRect(-10, -18, 20, 8, 4);
    ctx.fill();
    ctx.fillStyle = style.trim;
    ctx.fillRect(-8, -16, 16, 3);
  } else if (fighter.type === "speedster") {
    ctx.fillStyle = style.gear;
    roundRect(-9, -18, 18, 6, 3);
    ctx.fill();
    ctx.fillStyle = "#35f0a8";
    ctx.fillRect(-7, -17, 5, 2);
    ctx.fillRect(2, -17, 5, 2);
  } else {
    ctx.fillStyle = style.gear;
    roundRect(-11, -19, 22, 8, 4);
    ctx.fill();
    ctx.fillStyle = style.trim;
    ctx.fillRect(-8, -17, 16, 2);
  }

  ctx.restore();

  drawAttachedWeapon(fighter, x, y, bob, aim, style);

  if (fighter.invulnerable > 0) {
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y + bob, fighter.r + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(126, 227, 255, 0.35)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x, y + bob, fighter.r + 14, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Persistent lobby record (wins / losses) stored in localStorage
const recordKey = 'waterroyale_record_v1';
let record = { wins: 0, losses: 0 };
function loadRecord() {
  try {
    const s = localStorage.getItem(recordKey);
    if (s) record = JSON.parse(s);
  } catch (e) {
    record = { wins: 0, losses: 0 };
  }
  updateRecordDisplay();
}
function saveRecord() {
  try { localStorage.setItem(recordKey, JSON.stringify(record)); } catch (e) {}
}
function updateRecordDisplay() {
  const w = document.getElementById('winCount');
  const l = document.getElementById('lossCount');
  if (w) w.textContent = String(record.wins);
  if (l) l.textContent = String(record.losses);
}

// --- Map building: tile grid, mirrored layout, collision rects, and spawn points ---
const tiles = [];
const wallRects = [];
const bushes = [];
const speedPads = [];
const decoBlocks = [];
const spawnPoints = [];
const destroyedRects = [];
const wallHits = new Map();

function getEdgeSpawn(existing = []) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    const inset = tile * 2.2;
    if (side === 0) { // top edge
      x = Math.random() * (arena.w - inset * 2) + inset;
      y = inset;
    } else if (side === 1) { // right edge
      x = arena.w - inset;
      y = Math.random() * (arena.h - inset * 2) + inset;
    } else if (side === 2) { // bottom edge
      x = Math.random() * (arena.w - inset * 2) + inset;
      y = arena.h - inset;
    } else { // left edge
      x = inset;
      y = Math.random() * (arena.h - inset * 2) + inset;
    }

    if (currentTileAt(x, y) === "wall") continue;
    if (collidesWall(x, y, 28)) continue;
    let ok = true;
    for (const p of existing) {
      if (dist(p, { x, y }) < tile * 2.5) { ok = false; break; }
    }
    if (!ok) continue;
    return { x, y };
  }
  return { x: arena.w / 2, y: arena.h / 2 };
}

const state = {
  selectedClass: "default",
  running: false,
  over: false,
  lastTime: 0,
  player: null,
  bots: [],
  bullets: [],
  drops: [],
  splashes: [],
  time: 0
};

let juggernautKillStreak = 0;

function resetJuggernautKillStreak() {
  juggernautKillStreak = 0;
}

function onPlayerKill() {
  if (state.selectedClass !== "juggernaut") return;
  juggernautKillStreak += 1;
  if (juggernautKillStreak >= 5) {
    window.ArcadeAchievements?.unlock?.("tank");
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function setTile(c, r, type) {
  if (c < 0 || r < 0 || c >= cols || r >= rows) return;
  tiles[r][c] = type;
}

function fillTiles(c, r, w, h, type) {
  for (let y = r; y < r + h; y += 1) {
    for (let x = c; x < c + w; x += 1) setTile(x, y, type);
  }
}

function addMirrored(c, r, w, h, type) {
  fillTiles(c, r, w, h, type);
  fillTiles(cols - c - w, r, w, h, type);
}

function buildMap() {
  tiles.length = 0;
  for (let y = 0; y < rows; y += 1) {
    tiles.push(Array(cols).fill("grass"));
  }

  fillTiles(0, 0, cols, 1, "wall");
  fillTiles(0, rows - 1, cols, 1, "wall");
  fillTiles(0, 0, 1, rows, "wall");
  fillTiles(cols - 1, 0, 1, rows, "wall");

  addMirrored(2, 2, 5, 1, "wall");
  addMirrored(2, 3, 1, 4, "wall");
  addMirrored(6, 4, 2, 4, "bush");
  addMirrored(9, 2, 7, 2, "wall");
  addMirrored(18, 2, 5, 1, "wall");
  addMirrored(20, 3, 3, 4, "bush");
  addMirrored(11, 6, 2, 4, "wall");
  addMirrored(15, 7, 2, 2, "speed");
  addMirrored(4, 9, 6, 1, "bush");
  addMirrored(5, 10, 2, 1, "wall");

  addMirrored(3, 13, 4, 3, "wall");
  addMirrored(8, 12, 4, 1, "speed");
  addMirrored(11, 14, 4, 1, "bush");
  addMirrored(13, 15, 2, 3, "wall");
  addMirrored(18, 12, 2, 3, "wall");
  addMirrored(19, 15, 3, 2, "bush");

  addMirrored(2, 22, 4, 4, "wall");
  addMirrored(7, 23, 4, 1, "bush");
  addMirrored(9, 25, 2, 3, "wall");
  addMirrored(13, 21, 2, 5, "wall");
  addMirrored(16, 22, 3, 1, "speed");
  addMirrored(18, 24, 4, 2, "bush");

  addMirrored(2, 30, 6, 1, "wall");
  addMirrored(8, 27, 2, 3, "bush");
  addMirrored(12, 29, 5, 1, "wall");
  addMirrored(20, 27, 2, 4, "bush");

  fillTiles(23, 4, 4, 3, "wall");
  fillTiles(22, 7, 2, 2, "bush");
  fillTiles(26, 7, 2, 2, "bush");
  fillTiles(21, 12, 2, 4, "wall");
  fillTiles(27, 12, 2, 4, "wall");
  fillTiles(23, 15, 4, 2, "speed");
  fillTiles(21, 17, 8, 1, "speed");
  fillTiles(24, 18, 2, 2, "speed");
  fillTiles(23, 20, 4, 3, "wall");
  fillTiles(21, 24, 2, 3, "bush");
  fillTiles(27, 24, 2, 3, "bush");
  fillTiles(23, 28, 4, 2, "wall");

  fillTiles(24, 16, 2, 2, "grass");
  fillTiles(23, 17, 4, 1, "grass");
  fillTiles(24, 24, 2, 2, "grass");

  wallRects.length = 0;
  bushes.length = 0;
  speedPads.length = 0;
  decoBlocks.length = 0;
  destroyedRects.length = 0;
  wallHits.clear();
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const type = tiles[r][c];
      const rect = { x: c * tile, y: r * tile, w: tile, h: tile, c, r, flip: Math.random() < 0.5 };
      if (type === "wall") wallRects.push(rect);
      if (type === "bush") bushes.push(rect);
      if (type === "speed") speedPads.push(rect);
      if (type === "deco") decoBlocks.push(rect);
    }
  }
}

// --- Fighters and combat: spawning, movement, wall jumps, line-of-sight, and firing ---
function makeFighter(type, x, y, name, ai = false) {
  const spec = classes[type];
  return {
    type,
    name,
    ai,
    x,
    y,
    r: ai ? 20 : 22,
    hp: spec.hp,
    maxHp: spec.hp,
    healRate: spec.regen || 0,
    revealedTimer: 0,
    speed: spec.speed,
    color: spec.color,
    weapon: "pistol",
    ammo: weaponStats.pistol.ammo,
    reloadTimer: 0,
    fireTimer: 0,
    burstLeft: 0,
    burstTimer: 0,
    invulnerable: ai ? 2.8 : 3.5,
    spawnInvulnerable: true,
    shieldTriggered: false,
    wallJumpCooldown: 0,
    wallJumpTarget: null,
    wallJumpStart: null,
    wallJumpProgress: 0,
    wallJumpDuration: 0.28,
    hopOffset: 0,
    aiWarmup: ai ? 3.8 + Math.random() * 2 : 0,
    wander: Math.random() * Math.PI * 2,
    pathTimer: 0,
    speedBoostTimer: 0,
    walkTimer: 0,
    walkFrame: 0,
    dirX: 0,
    dirY: 1,
    alive: true
  };
}

function resetGame() {
  const spec = classes[state.selectedClass];
  resetJuggernautKillStreak();
  state.running = true;
  state.over = false;
  state.time = 0;
  state.bullets = [];
  state.drops = [];
  state.splashes = [];
  state.bots = [];
  spawnPoints.length = 0;

  // spawn player at a safe edge location
  const pSpawn = getEdgeSpawn(spawnPoints);
  spawnPoints.push({ x: pSpawn.x, y: pSpawn.y });
  state.player = makeFighter(state.selectedClass, pSpawn.x, pSpawn.y, "You");

  // spawn exactly 5 bots around the edges, avoiding walls and each other
  for (let i = 0; i < 5; i += 1) {
    const spawn = getEdgeSpawn(spawnPoints);
    spawnPoints.push({ x: spawn.x, y: spawn.y });
    const type = ["default", "juggernaut", "speedster"][Math.floor(Math.random() * 3)];
    const bot = makeFighter(type, spawn.x, spawn.y, `Bot ${i + 1}`, true);
    state.bots.push(bot);
  }

  [
    ["rifle", 24, 17], ["shotgun", 10, 13], ["shotgun", 39, 13],
    ["sniper", 24, 8], ["sniper", 25, 27], ["rifle", 15, 25], ["rifle", 34, 25]
  ].forEach(([weapon, c, r]) => spawnDrop(weapon, c * tile + tile / 2, r * tile + tile / 2));

  hud.classLabel.textContent = `Class: ${spec.label}`;
  hud.menu.classList.add("hidden");
  hud.message.classList.add("hidden");
  canvas.focus();
  updateHud();
}

function spawnDrop(weapon, x, y) {
  state.drops.push({ weapon, x, y, r: 22, bob: Math.random() * 10 });
}

function equip(fighter, weapon) {
  fighter.weapon = weapon;
  fighter.ammo = weaponStats[weapon].ammo;
  fighter.reloadTimer = 0;
  fighter.fireTimer = 0;
  fighter.burstLeft = 0;
}

function updateHud() {
  const p = state.player;
  if (!p) return;
  const w = weaponStats[p.weapon];
  const shield = p.invulnerable > 0 ? ` | Shield ${Math.ceil(p.invulnerable)}s` : "";
  hud.weaponLabel.textContent = `${w.label} | HP ${Math.ceil(p.hp)}/${p.maxHp}${shield}`;
  hud.ammoLabel.textContent = `Ammo: ${p.ammo}/${w.ammo}${p.reloadTimer > 0 ? " reloading" : ""}`;
  hud.aliveLabel.textContent = `Brawlers: ${1 + state.bots.filter(bot => bot.alive).length}`;
}

function currentTileAt(x, y) {
  const c = clamp(Math.floor(x / tile), 0, cols - 1);
  const r = clamp(Math.floor(y / tile), 0, rows - 1);
  return tiles[r][c];
}

function isInBush(fighter) {
  return currentTileAt(fighter.x, fighter.y) === "bush";
}

function isOnSpeed(fighter) {
  return currentTileAt(fighter.x, fighter.y) === "speed";
}

function circleIntersectsRect(cx, cy, radius, rect) {
  const minX = rect.x + Math.min(wallCollisionInset, rect.w / 2);
  const maxX = rect.x + rect.w - Math.min(wallCollisionInset, rect.w / 2);
  const minY = rect.y + Math.min(wallCollisionInset, rect.h / 2);
  const maxY = rect.y + rect.h - Math.min(wallCollisionInset, rect.h / 2);
  const nearestX = clamp(cx, minX, maxX);
  const nearestY = clamp(cy, minY, maxY);
  return Math.hypot(cx - nearestX, cy - nearestY) < radius;
}

function collidesWall(x, y, radius) {
  return wallRects.some(rect => circleIntersectsRect(x, y, radius, rect));
}

function moveFighter(fighter, dx, dy, dt, scale = 1) {
  const mag = Math.hypot(dx, dy);
  if (!mag) {
    if (fighter.type === 'juggernaut' || fighter.type === 'speedster' || fighter.type === 'default') {
      fighter.walkTimer = 0;
      fighter.walkFrame = 0;
    }
    if (currentTileAt(fighter.x, fighter.y) === "speed") fighter.speedBoostTimer = 1.0;
    return;
  }
  const bushScale = fighter.type === 'speedster' && isInBush(fighter) ? classes.speedster.bushSpeed : 1;
  const step = fighter.speed * moveSpeedMultiplier * scale * bushScale * dt;
  const nx = clamp(fighter.x + dx / mag * step, fighter.r, arena.w - fighter.r);
  if (!collidesWall(nx, fighter.y, fighter.r)) fighter.x = nx;
  const ny = clamp(fighter.y + dy / mag * step, fighter.r, arena.h - fighter.r);
  if (!collidesWall(fighter.x, ny, fighter.r)) fighter.y = ny;
  if (fighter.type === 'juggernaut' || fighter.type === 'speedster' || fighter.type === 'default') {
    fighter.walkTimer += dt;
    fighter.walkFrame = Math.floor(fighter.walkTimer * 10) % 3;
    fighter.dirX = dx / mag;
    fighter.dirY = dy / mag;
  }
  if (currentTileAt(fighter.x, fighter.y) === "speed") fighter.speedBoostTimer = 1.0;
}

function getReloadTime(fighter, baseReload) {
  if (fighter.type === 'speedster') {
    return baseReload * classes.speedster.reloadMultiplier;
  }
  return baseReload;
}

function getBulletDamage(fighter, baseDamage) {
  if (fighter.type === 'speedster') {
    return baseDamage * classes.speedster.damageMultiplier;
  }
  return baseDamage;
}

function tryJumpOverWall(fighter) {
  if (!fighter.alive || fighter.type !== 'default' || fighter.wallJumpCooldown > 0) return false;
  let dx = 0;
  let dy = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) dy -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) dy += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;
  if (dx === 0 && dy === 0) {
    const aim = angleTo(fighter, screenToWorld(mouse.x, mouse.y));
    dx = Math.cos(aim);
    dy = Math.sin(aim);
  }
  const mag = Math.hypot(dx, dy);
  if (!mag) return false;

  // Allow jumping over up to N contiguous wall tiles
  const maxWalls = 3;
  const step = tile * 0.5;
  const maxDist = tile * (maxWalls + 3);
  const dirX = dx / mag;
  const dirY = dy / mag;

  let t = step;
  let wallEncountered = false;
  let lastTile = null;
  let wallCount = 0;
  let destTile = null;
  while (t <= maxDist) {
    const checkX = clamp(fighter.x + dirX * t, fighter.r, arena.w - fighter.r);
    const checkY = clamp(fighter.y + dirY * t, fighter.r, arena.h - fighter.r);
    const tileType = currentTileAt(checkX, checkY);
    const cc = clamp(Math.floor(checkX / tile), 0, cols - 1);
    const rr = clamp(Math.floor(checkY / tile), 0, rows - 1);
    if (tileType === 'wall') {
      wallEncountered = true;
      if (!lastTile || lastTile.c !== cc || lastTile.r !== rr) {
        wallCount += 1;
        lastTile = { c: cc, r: rr };
      }
      if (wallCount > maxWalls) return false;
    } else {
      if (wallEncountered) {
        destTile = { c: cc, r: rr };
        break;
      }
    }
    t += step;
  }
  if (!wallEncountered || !destTile) return false;

  const targetX = clamp(destTile.c * tile + tile / 2, fighter.r, arena.w - fighter.r);
  const targetY = clamp(destTile.r * tile + tile / 2, fighter.r, arena.h - fighter.r);
  if (collidesWall(targetX, targetY, fighter.r)) return false;
  fighter.x = targetX;
  fighter.y = targetY;
  fighter.wallJumpCooldown = classes.default.wallJumpRecharge;
  fighter.wallJumpStart = { x: fighter.x, y: fighter.y };
  fighter.wallJumpTarget = { x: targetX, y: targetY };
  fighter.wallJumpProgress = 0;
  // cooldown set already; landing splash will be created when animation completes
  return true;
}

function updateWallJump(fighter, dt) {
  if (!fighter.wallJumpTarget) return false;
  fighter.wallJumpProgress = Math.min(fighter.wallJumpDuration, fighter.wallJumpProgress + dt);
  const t = Math.min(1, fighter.wallJumpProgress / fighter.wallJumpDuration);
  const ease = t * (2 - t); // ease out
  const sx = fighter.wallJumpStart.x;
  const sy = fighter.wallJumpStart.y;
  const tx = fighter.wallJumpTarget.x;
  const ty = fighter.wallJumpTarget.y;
  fighter.x = sx + (tx - sx) * ease;
  fighter.y = sy + (ty - sy) * ease;
  fighter.hopOffset = Math.sin(ease * Math.PI) * 10;
  if (t >= 1) {
    fighter.wallJumpTarget = null;
    fighter.wallJumpStart = null;
    fighter.wallJumpProgress = 0;
    fighter.hopOffset = 0;
    splash(fighter.x, fighter.y, "#ffd44a");
  }
  return true;
}

function hasLineOfSight(a, b) {
  const steps = Math.ceil(dist(a, b) / 28);
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (currentTileAt(x, y) === "wall") return false;
  }
  return true;
}

function fire(fighter, targetX, targetY) {
  const w = weaponStats[fighter.weapon];
  // only remove spawn invulnerability when the fighter fires; preserve class-triggered shields
  if (fighter.spawnInvulnerable) fighter.invulnerable = 0;
  if (fighter.fireTimer > 0 || fighter.reloadTimer > 0) return;

  if (fighter.ammo <= 0) {
    fighter.reloadTimer = getReloadTime(fighter, w.reload);
    return;
  }

  fighter.fireTimer = w.fireRate;
  fighter.ammo -= 1;

  if (fighter.weapon === "shotgun") {
    for (let i = 0; i < w.pellets; i += 1) addBullet(fighter, targetX, targetY, (Math.random() - 0.5) * w.spread);
    if (isInBush(fighter)) fighter.revealedTimer = 1.0;
  } else if (fighter.weapon === "rifle") {
    fighter.burstLeft = w.burst - 1;
    fighter.burstTimer = w.fireRate;
    addBullet(fighter, targetX, targetY, (Math.random() - 0.5) * 0.08);
    if (isInBush(fighter)) fighter.revealedTimer = 1.0;
  } else {
    addBullet(fighter, targetX, targetY, 0);
    if (isInBush(fighter)) fighter.revealedTimer = 2.0;
  }

  if (fighter.ammo <= 0) fighter.reloadTimer = getReloadTime(fighter, w.reload);
}

// --- Bullets: spawn projectiles, distance falloff, wall destruction, and hit resolution ---
function addBullet(fighter, targetX, targetY, spread) {
  const w = weaponStats[fighter.weapon];
  const ang = Math.atan2(targetY - fighter.y, targetX - fighter.x) + spread;
  state.bullets.push({
    owner: fighter,
    x: fighter.x + Math.cos(ang) * (fighter.r + 10),
    y: fighter.y + Math.sin(ang) * (fighter.r + 10),
    vx: Math.cos(ang) * w.speed,
    vy: Math.sin(ang) * w.speed,
    r: w.size,
    life: w.range / w.speed,
    // store origin and base damage so we can apply distance-based falloff on hit
    originX: fighter.x,
    originY: fighter.y,
    baseDamage: getBulletDamage(fighter, w.damage),
    range: w.range,
    color: w.color
  });
}

function updateFighterTimers(fighter, dt) {
  fighter.fireTimer = Math.max(0, fighter.fireTimer - dt);
  fighter.invulnerable = Math.max(0, fighter.invulnerable - dt);
  fighter.aiWarmup = Math.max(0, fighter.aiWarmup - dt);
  fighter.revealedTimer = Math.max(0, (fighter.revealedTimer || 0) - dt);
  fighter.wallJumpCooldown = Math.max(0, (fighter.wallJumpCooldown || 0) - dt);
  if (fighter.type === 'juggernaut' && !fighter.shieldTriggered && fighter.hp <= fighter.maxHp / 2) {
    fighter.shieldTriggered = true;
    fighter.invulnerable = Math.max(fighter.invulnerable, classes.juggernaut.shieldDuration);
  }
  // passive health regeneration
  if (fighter.alive && fighter.healRate && fighter.hp < fighter.maxHp) {
    fighter.hp = Math.min(fighter.maxHp, fighter.hp + fighter.healRate * dt);
  }
  if (fighter.reloadTimer > 0) {
    fighter.reloadTimer -= dt;
    if (fighter.reloadTimer <= 0) fighter.ammo = weaponStats[fighter.weapon].ammo;
  }
  // clear spawnInvulnerable when invulnerability expires
  if (fighter.spawnInvulnerable && fighter.invulnerable <= 0) fighter.spawnInvulnerable = false;
  fighter.speedBoostTimer = Math.max(0, fighter.speedBoostTimer - dt);
  const resting = fighter.ai ? fighter.aiWarmup > 0 || !state.player || dist(fighter, state.player) > weaponStats[fighter.weapon].range : !mouse.down;
  if (fighter.burstLeft > 0 && fighter.reloadTimer <= 0) {
    fighter.burstTimer -= dt;
    if (fighter.burstTimer <= 0) {
      fighter.burstTimer = weaponStats.rifle.fireRate;
      fighter.burstLeft -= 1;
      const target = fighter.ai ? state.player : screenToWorld(mouse.x, mouse.y);
      addBullet(fighter, target.x, target.y, (Math.random() - 0.5) * 0.11);
      if (isInBush(fighter)) fighter.revealedTimer = 1.0;
    }
  }
}

function updatePlayer(dt) {
  const p = state.player;
  if (p && updateWallJump(p, dt)) {
    updateFighterTimers(p, dt);
    return;
  }
  let dx = 0;
  let dy = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) dy -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) dy += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;
  if (keys.has("Space")) {
    tryJumpOverWall(p);
    keys.delete("Space");
  }
  // apply speed tile multiplier for player while on a tile or for 1 second afterwards
  const playerSpeedScale = (isOnSpeed(p) || p.speedBoostTimer > 0) ? speedTileMultiplier : 1;
  moveFighter(p, dx, dy, dt, playerSpeedScale);
  updateFighterTimers(p, dt);
  // pickup drops
  for (let i = state.drops.length - 1; i >= 0; i -= 1) {
    const drop = state.drops[i];
    if (dist(p, drop) < p.r + drop.r + 8 && keys.has("KeyE")) {
      equip(p, drop.weapon);
      state.drops.splice(i, 1);
      break;
    }
  }
}

// --- AI bots: warmup wandering, drop pickup, pursuit, and combat decisions ---
function updateBots(dt) {
  for (const bot of state.bots) {
    if (!bot.alive) continue;
    if (updateWallJump(bot, dt)) {
      updateFighterTimers(bot, dt);
      continue;
    }
    updateFighterTimers(bot, dt);
    const p = state.player;
    const w = weaponStats[bot.weapon];
    const distance = dist(bot, p);
    const playerHiddenByBush = isInBush(p) && p.revealedTimer <= 0;
    const canSeePlayer = distance < w.range && hasLineOfSight(bot, p) && !playerHiddenByBush;
    const nearestDrop = state.drops.sort((a, b) => dist(bot, a) - dist(bot, b))[0];
    const wantsDrop = nearestDrop && bot.weapon === "pistol" && dist(bot, nearestDrop) < 560;

    let target = wantsDrop ? nearestDrop : p;
    if (bot.aiWarmup > 0) {
      bot.pathTimer -= dt;
      if (bot.pathTimer <= 0) {
        bot.wander = Math.random() * Math.PI * 2;
        bot.pathTimer = 0.8 + Math.random() * 1.2;
      }
      // include speed tile multiplier for bots as well while on or just off a speed tile
      const warmupScale = 0.75 * ((isOnSpeed(bot) || bot.speedBoostTimer > 0) ? speedTileMultiplier : 1);
      moveFighter(bot, Math.cos(bot.wander), Math.sin(bot.wander), dt, warmupScale);
      continue;
    }

    let desired = angleTo(bot, target);
    if (!wantsDrop && distance < 180) desired += Math.PI;
    if (!canSeePlayer && !wantsDrop) {
      bot.pathTimer -= dt;
      if (bot.pathTimer <= 0) {
        bot.wander = Math.random() * Math.PI * 2;
        bot.pathTimer = 0.6 + Math.random();
      }
      desired = bot.wander;
    }

    let speedScale = wantsDrop || distance > w.range * 0.75 ? 1.45 : 0.72;
    if (isOnSpeed(bot) || bot.speedBoostTimer > 0) speedScale *= speedTileMultiplier;
    moveFighter(bot, Math.cos(desired), Math.sin(desired), dt, speedScale);

    if (wantsDrop && dist(bot, nearestDrop) < bot.r + nearestDrop.r + 8) {
      equip(bot, nearestDrop.weapon);
      state.drops.splice(state.drops.indexOf(nearestDrop), 1);
    }
    if (canSeePlayer && Math.random() < 0.68) fire(bot, p.x, p.y);
  }
}

function updateBullets(dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    const hitWall = currentTileAt(b.x, b.y) === "wall";
    const targets = b.owner === state.player ? state.bots : [state.player];
    let hit = false;
    for (const target of targets) {
      if (!target.alive || target === b.owner || target.invulnerable > 0) continue;
      if (Math.hypot(target.x - b.x, target.y - b.y) < target.r + b.r) {
        // apply linear damage falloff based on distance from bullet origin to impact
        const d = dist({ x: b.originX, y: b.originY }, { x: b.x, y: b.y });
        const maxRange = (b.range && b.range > 0) ? b.range : 1;
        const minFactor = 0.35; // minimum damage fraction at max range
        const factor = Math.max(minFactor, 1 - (d / maxRange) * (1 - minFactor));
        const actualDamage = Math.max(1, Math.round((b.baseDamage || b.damage || 1) * factor));
        target.hp -= actualDamage;
        hit = true;
        splash(b.x, b.y, b.color);
        if (target.hp <= 0) {
          if (b.owner === state.player) onPlayerKill();
          knockOut(target);
        }
        break;
      }
    }
    if (hit || hitWall || b.life <= 0 || b.x < 0 || b.y < 0 || b.x > arena.w || b.y > arena.h) {
      if (hitWall) {
        splash(b.x, b.y, "#7ee7ff");
        // register wall hit
        const cc = clamp(Math.floor(b.x / tile), 0, cols - 1);
        const rr = clamp(Math.floor(b.y / tile), 0, rows - 1);
        if (tiles[rr][cc] === "wall") {
          const key = `${cc},${rr}`;
          const prev = wallHits.get(key) || 0;
          const now = prev + 1;
          wallHits.set(key, now);
          if (now >= 10) {
            // destroy wall: change tile and remove rect
            setTile(cc, rr, "destroyed");
            // remove from wallRects
            for (let wi = wallRects.length - 1; wi >= 0; wi -= 1) {
              const wr = wallRects[wi];
              if (wr.c === cc && wr.r === rr) wallRects.splice(wi, 1);
            }
            // add destroyed rect with respawn time
            destroyedRects.push({ x: cc * tile, y: rr * tile, w: tile, h: tile, c: cc, r: rr, respawnAt: state.time + 40 });
            wallHits.delete(key);
          }
        }
      }
      state.bullets.splice(i, 1);
    }
  }
}

function knockOut(fighter) {
  fighter.alive = false;
  for (let i = 0; i < 8; i += 1) splash(fighter.x, fighter.y, "#87ecff");
}

function splash(x, y, color) {
  state.splashes.push({ x, y, color, r: 6 + Math.random() * 14, life: 0.45 });
}

// --- Rendering: tile map, fighters, drops, camera world draw, and minimap ---
function drawTileMap() {
  const grassGrad = ctx.createLinearGradient(0, 0, arena.w, arena.h);
  grassGrad.addColorStop(0, "#7ad86a");
  grassGrad.addColorStop(0.5, "#66c85a");
  grassGrad.addColorStop(1, "#5fbf56");
  ctx.fillStyle = grassGrad;
  ctx.fillRect(0, 0, arena.w, arena.h);

  ctx.fillStyle = "rgba(255,255,255,0.04)";
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      if ((c + r) % 2 === 0) ctx.fillRect(c * tile, r * tile, tile, tile);
    }
  }

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let r = 1; r < rows; r += 3) {
    ctx.beginPath();
    ctx.moveTo(0, r * tile + 0.5);
    ctx.lineTo(arena.w, r * tile + 0.5);
    ctx.stroke();
  }

  drawPatioPatches();
  speedPads.forEach(drawSpeedTile);
  decoBlocks.forEach(drawDecoTile);
  bushes.forEach(drawBushTile);
  wallRects.forEach(drawWallTile);
  destroyedRects.forEach(drawDestroyedWallTile);
  drawSpawnCircles();
}

function drawDestroyedWallTile(rect) {
  ctx.fillStyle = "#8b7f6b";
  roundRect(rect.x + 3, rect.y + 8, rect.w - 6, rect.h - 16, 4);
  ctx.fill();
  ctx.fillStyle = "#5b4f3f";
  for (let i = 0; i < 6; i += 1) {
    const sx = rect.x + 8 + (i % 3) * 10 + Math.random() * 4;
    const sy = rect.y + 12 + Math.floor(i / 3) * 8 + Math.random() * 4;
    ctx.fillRect(sx, sy, 4, 3);
  }
}

function drawPatioPatches() {
  ctx.fillStyle = "#5abf8d";
  roundRect(tile * 4, tile * 18, tile * 4, tile * 3, 8);
  ctx.fill();
  roundRect(arena.w - tile * 8, tile * 18, tile * 4, tile * 3, 8);
  ctx.fill();
  roundRect(tile * 21, tile * 11, tile * 3, tile * 3, 8);
  ctx.fill();
  roundRect(tile * 26, tile * 19, tile * 3, tile * 3, 8);
  ctx.fill();
}

function drawWallTile(rect) {
  const { x, y, w, h, c, r } = rect;
  const seed = tileSeed(c, r, 11);

  ctx.fillStyle = "#2f6f95";
  roundRect(x + 1, y + 1, w - 2, h - 2, 5);
  ctx.fill();

  const slats = 5;
  const gap = (w - 10) / slats;
  for (let i = 0; i < slats; i += 1) {
    const sx = x + 5 + i * gap;
    const grad = ctx.createLinearGradient(sx, y + 4, sx + gap - 2, y + h - 6);
    grad.addColorStop(0, "#8edcff");
    grad.addColorStop(0.45, "#49b8ea");
    grad.addColorStop(1, "#1f7fb8");
    ctx.fillStyle = grad;
    roundRect(sx, y + 6, gap - 2, h - 12, 3);
    ctx.fill();
  }

  ctx.fillStyle = "#f4fbff";
  roundRect(x + 2, y + 3, w - 4, 7, 4);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(x + 6, y + 5, w - 12, 2);

  ctx.fillStyle = "rgba(6, 53, 83, 0.18)";
  ctx.fillRect(x + 4, y + h - 7, w - 8, 4);

  if (seed % 4 === 0) {
    ctx.fillStyle = "rgba(126, 227, 255, 0.85)";
    ctx.beginPath();
    ctx.arc(x + w * 0.72, y + h * 0.35, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w * 0.72, y + h * 0.35 + 5, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (rect.flip) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x + 3, y + 8, 4, h - 16);
  }
}

function drawBushTile(rect) {
  const { x, y, w, h, c, r } = rect;
  const seed = tileSeed(c, r, 23);
  const cx = x + w / 2;
  const cy = y + h / 2 + 2;

  ctx.fillStyle = "rgba(18, 92, 48, 0.35)";
  roundRect(x + 3, y + h - 10, w - 6, 8, 4);
  ctx.fill();

  const blobs = [
    { ox: -10, oy: 4, rad: 13, color: "#0f7a42" },
    { ox: 10, oy: 4, rad: 13, color: "#0f7a42" },
    { ox: 0, oy: -6, rad: 15, color: "#18a857" },
    { ox: -6, oy: -2, rad: 10, color: "#31df62" },
    { ox: 8, oy: -1, rad: 10, color: "#31df62" }
  ];

  blobs.forEach((blob, i) => {
    ctx.fillStyle = blob.color;
    ctx.beginPath();
    ctx.arc(cx + blob.ox, cy + blob.oy, blob.rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath();
    ctx.arc(cx + blob.ox - 3, cy + blob.oy - 4, blob.rad * 0.35, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.strokeStyle = "rgba(8, 58, 31, 0.35)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    const angle = -Math.PI / 2 + (i - 2) * 0.35;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 2);
    ctx.lineTo(cx + Math.cos(angle) * 14, cy + 2 + Math.sin(angle) * 14);
    ctx.stroke();
  }

  if (seed % 3 === 0) {
    const fx = x + 10 + (seed % 5) * 4;
    const fy = y + 12 + (seed % 4) * 3;
    ctx.fillStyle = "#ff7eb6";
    ctx.beginPath();
    ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(fx + 8, fy + 5, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSpeedTile(rect) {
  const { x, y, w, h, c, r } = rect;
  const pulse = 0.5 + Math.sin(state.time * 6 + c * 0.7 + r * 0.5) * 0.5;

  const padGrad = ctx.createLinearGradient(x, y, x + w, y + h);
  padGrad.addColorStop(0, "#8dffb8");
  padGrad.addColorStop(0.5, "#45f238");
  padGrad.addColorStop(1, "#1ec76a");
  ctx.fillStyle = padGrad;
  roundRect(x + 2, y + 2, w - 4, h - 4, 6);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  roundRect(x + 4, y + 4, w - 8, h - 8, 5);
  ctx.stroke();

  ctx.fillStyle = `rgba(255,255,255,${0.18 + pulse * 0.22})`;
  for (let i = 0; i < 3; i += 1) {
    const offset = ((state.time * 90 + i * 14) % (w + 20)) - 10;
    ctx.beginPath();
    ctx.moveTo(x + offset, y + 8);
    ctx.lineTo(x + offset + 12, y + h / 2);
    ctx.lineTo(x + offset, y + h - 8);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "rgba(6, 53, 83, 0.82)";
  const chevY = y + h / 2;
  for (let i = 0; i < 2; i += 1) {
    const cx = x + w * (0.38 + i * 0.18);
    ctx.beginPath();
    ctx.moveTo(cx - 8, chevY - 10);
    ctx.lineTo(cx + 2, chevY);
    ctx.lineTo(cx - 8, chevY + 10);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = `rgba(255,255,255,${0.25 + pulse * 0.2})`;
  ctx.fillRect(x + 6, y + 6, w - 12, 3);
}

function drawDecoTile(rect) {
  ctx.fillStyle = "#e75488";
  roundRect(rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(rect.x + 11, rect.y + 11, rect.w - 22, 5);
}

function drawSpawnCircles() {
  ctx.strokeStyle = "rgba(255,255,255,0.76)";
  ctx.lineWidth = 3;
  spawnPoints.forEach(point => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 25, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
}

function drawRangeIndicator() {
  if (!mouse.down) return;
  const p = state.player;
  const w = weaponStats[p.weapon];
  const aim = angleTo(p, screenToWorld(mouse.x, mouse.y));
  const width = p.weapon === "sniper" ? 28 : p.weapon === "shotgun" ? 90 : 42;
  const endX = p.x + Math.cos(aim) * w.range;
  const endY = p.y + Math.sin(aim) * w.range;
  const px = Math.cos(aim + Math.PI / 2) * width / 2;
  const py = Math.sin(aim + Math.PI / 2) * width / 2;
  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(255,255,255,0.78)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  if (p.weapon === "shotgun") {
    ctx.moveTo(p.x, p.y);
    ctx.arc(p.x, p.y, w.range, aim - w.spread / 2, aim + w.spread / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.moveTo(p.x + px, p.y + py);
    ctx.lineTo(endX + px, endY + py);
    ctx.arc(endX, endY, width / 2, aim + Math.PI / 2, aim - Math.PI / 2);
    ctx.lineTo(p.x - px, p.y - py);
    ctx.arc(p.x, p.y, width / 2, aim - Math.PI / 2, aim + Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawFighter(fighter) {
  if (!fighter.alive) return;
  const hidden = fighter.ai && isInBush(fighter) && dist(fighter, state.player) > 190 && (fighter.revealedTimer || 0) <= 0;
  if (hidden) return;
  const aim = fighter.ai ? angleTo(fighter, state.player) : angleTo(fighter, screenToWorld(mouse.x, mouse.y));
  const drawX = fighter.x;
  const drawY = fighter.y - (fighter.hopOffset || 0);

  drawCharacter(fighter, drawX, drawY, aim);

  ctx.fillStyle = "#102e3f";
  ctx.font = "700 13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(fighter.name, drawX, drawY - fighter.r - 18);

  ctx.fillStyle = "rgba(14,31,45,0.4)";
  ctx.fillRect(drawX - 30, drawY + fighter.r + 9, 60, 8);
  ctx.fillStyle = fighter.hp > fighter.maxHp * 0.35 ? "#2ee080" : "#ff6372";
  ctx.fillRect(drawX - 30, drawY + fighter.r + 9, 60 * Math.max(0, fighter.hp / fighter.maxHp), 8);
}

function drawDrops() {
  for (const drop of state.drops) {
    const y = drop.y + Math.sin(state.time * 4 + drop.bob) * 4;
    const img = weaponImages[drop.weapon];
    // If image loaded, draw it centered at the drop; otherwise fallback to the original placeholder drawing
    if (img && img.complete && img.naturalWidth) {
      const size = 64;
      ctx.drawImage(img, drop.x - size / 2, y - size / 2, size, size);
      // small shadow/outline under image for visibility
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 2;
      ctx.strokeRect(drop.x - size / 2, y - size / 2, size, size);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(drop.x, y, drop.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = weaponStats[drop.weapon].color;
      ctx.fillRect(drop.x - 18, y - 6, 36, 12);
      ctx.fillRect(drop.x + 4, y + 2, 10, 14);
    }
    ctx.fillStyle = "#143952";
    ctx.font = "800 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(weaponStats[drop.weapon].label, drop.x, y + 37);
  }
}

function drawWorld() {
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawTileMap();
  drawRangeIndicator();
  drawDrops();

  for (const b of state.bullets) {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = state.splashes.length - 1; i >= 0; i -= 1) {
    const s = state.splashes[i];
    ctx.globalAlpha = Math.max(0, s.life / 0.45);
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  state.bots.forEach(drawFighter);
  drawFighter(state.player);
  ctx.restore();
}

function drawMinimap() {
  const size = 138;
  const pad = 18;
  const x = canvas.width - size - pad;
  const y = pad;
  ctx.fillStyle = "rgba(8,35,48,0.56)";
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.strokeRect(x, y, size, size);
  ctx.fillStyle = "#21e85b";
  speedPads.forEach(rect => ctx.fillRect(x + rect.x / arena.w * size, y + rect.y / arena.h * size, 2, 2));
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x + state.player.x / arena.w * size - 2, y + state.player.y / arena.h * size - 2, 4, 4);
  ctx.fillStyle = "#ff6372";
  for (const bot of state.bots) {
    if (bot.alive) ctx.fillRect(x + bot.x / arena.w * size - 2, y + bot.y / arena.h * size - 2, 4, 4);
  }
}

// --- Game loop: update tick, draw pass, win/loss end states, and respawn countdown ---
function update(dt) {
  if (!state.running || state.over) return;
  state.time += dt;
  updatePlayer(dt);
  updateBots(dt);
  updateBullets(dt);

  for (let i = state.splashes.length - 1; i >= 0; i -= 1) {
    state.splashes[i].life -= dt;
    state.splashes[i].r += 26 * dt;
    if (state.splashes[i].life <= 0) state.splashes.splice(i, 1);
  }

  // respawn destroyed walls when their timer expires
  for (let i = destroyedRects.length - 1; i >= 0; i -= 1) {
    const d = destroyedRects[i];
    if (state.time >= d.respawnAt) {
      // restore tile
      setTile(d.c, d.r, "wall");
      wallRects.push({ x: d.c * tile, y: d.r * tile, w: tile, h: tile, c: d.c, r: d.r, flip: Math.random() < 0.5 });
      destroyedRects.splice(i, 1);
    }
  }

  const p = state.player;
  camera.x = clamp(p.x - canvas.width / 2, 0, Math.max(0, arena.w - canvas.width));
  camera.y = clamp(p.y - canvas.height / 2, 0, Math.max(0, arena.h - canvas.height));
  updateHud();

  const botsAlive = state.bots.filter(bot => bot.alive).length;
  if (!p.alive || p.hp <= 0) endGame(false);
  if (botsAlive === 0) endGame(true);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state.player) {
    drawWorld();
    drawMinimap();
  } else {
    ctx.fillStyle = "#6fc86d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function loop(time) {
  const dt = Math.min(0.033, (time - state.lastTime) / 1000 || 0);
  state.lastTime = time;
  update(dt);
  draw();
  if (window.ArcadeMusic) ArcadeMusic.advance();
  requestAnimationFrame(loop);
}

function endGame(won) {
  state.over = true;
  state.running = false;
  if (!won) resetJuggernautKillStreak();
  if (won) {
    record.wins += 1;
    saveRecord();
    updateRecordDisplay();
    hud.message.classList.remove("hidden");
    hud.messageTitle.textContent = "Victory!";
    hud.messageBody.textContent = "You cleared the backyard arena.";
  } else {
    record.losses += 1;
    saveRecord();
    updateRecordDisplay();
    startRespawnCountdown(3);
  }
}

function startRespawnCountdown(seconds = 3) {
  // clear previous interval if any
  if (respawnInterval) clearInterval(respawnInterval);
  hud.respawn.classList.remove("hidden");
  hud.respawnTitle.textContent = "Soaked!";
  let t = Math.max(1, Math.floor(seconds));
  hud.respawnTimer.textContent = String(t);
  state.running = false;
  respawnInterval = setInterval(() => {
    t -= 1;
    hud.respawnTimer.textContent = String(Math.max(0, t));
    if (t <= 0) {
      clearInterval(respawnInterval);
      respawnInterval = null;
      hud.respawn.classList.add("hidden");
      resetGame();
    }
  }, 1000);
}

function screenToWorld(x, y) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: camera.x + (x - rect.left) * canvas.width / rect.width,
    y: camera.y + (y - rect.top) * canvas.height / rect.height
  };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(900, Math.floor(rect.width * scale));
  canvas.height = Math.max(520, Math.floor(rect.height * scale));
}

// --- Input: class selection, keyboard/mouse controls, and lobby navigation ---
document.querySelectorAll(".water-class-card").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".water-class-card").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    state.selectedClass = button.dataset.class;
    hud.classLabel.textContent = `Class: ${classes[state.selectedClass].label}`;
  });
});

document.getElementById("startBtn").addEventListener("click", resetGame);
document.getElementById("restartBtn").addEventListener("click", resetGame);

function goToLobby() {
  state.running = false;
  state.over = false;
  hud.menu.classList.remove('hidden');
  hud.respawn.classList.add('hidden');
  hud.message.classList.add('hidden');
  canvas.blur();
}

// Allow Escape to return to lobby
window.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' || ev.code === 'Escape') {
    goToLobby();
  }
});

window.addEventListener("keydown", event => {
  const validCodes = ["KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
  let code = event.code;
  if (!code) {
    const k = event.key;
    if (k) {
      const upper = k.length === 1 ? k.toUpperCase() : k;
      if (["W", "A", "S", "D", "E"].includes(upper)) code = `Key${upper}`;
      else if (upper === " ") code = "Space";
      else if (upper.startsWith("Arrow")) code = upper;
    }
  }
  if (validCodes.includes(code)) {
    event.preventDefault();
    keys.add(code);
  }
});

window.addEventListener("keyup", event => {
  let code = event.code;
  if (!code) {
    const k = event.key;
    if (k) {
      const upper = k.length === 1 ? k.toUpperCase() : k;
      if (["W", "A", "S", "D", "E"].includes(upper)) code = `Key${upper}`;
      else if (upper === " ") code = "Space";
      else if (upper.startsWith("Arrow")) code = upper;
    }
  }
  if (code) keys.delete(code);
});

// Dedicated Space handler to trigger wall-jump immediately (fallback for input mapping issues)
window.addEventListener('keydown', ev => {
  if (ev.code === 'Space' || ev.key === ' ' || ev.key === 'Spacebar') {
    if (state.player && state.player.alive && state.player.type === 'default') {
      const jumped = tryJumpOverWall(state.player);
      if (jumped) ev.preventDefault();
    }
  }
});

window.addEventListener("blur", () => {
  keys.clear();
  mouse.down = false;
});

canvas.addEventListener("mousemove", event => {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
});

canvas.addEventListener("mousedown", event => {
  canvas.focus();
  const world = screenToWorld(event.clientX, event.clientY);
  if (event.button === 0) {
    mouse.down = true;
    // allow left-click pickup as a fallback for KeyE issues
    if (state.player) {
      for (let i = state.drops.length - 1; i >= 0; i -= 1) {
        const drop = state.drops[i];
        if (Math.hypot(state.player.x - drop.x, state.player.y - drop.y) < state.player.r + drop.r + 8) {
          equip(state.player, drop.weapon);
          state.drops.splice(i, 1);
          break;
        }
      }
    }
  }
});

window.addEventListener("mouseup", (event) => {
  // fire on left-button release
  if (event.button === 0) {
    mouse.down = false;
    if (state.player) {
      const target = screenToWorld(mouse.x, mouse.y);
      fire(state.player, target.x, target.y);
    }
  } else {
    mouse.down = false;
  }
});

canvas.addEventListener("contextmenu", event => event.preventDefault());
window.addEventListener("resize", resizeCanvas);

loadRecord();
buildMap();
resizeCanvas();
if (window.ArcadeMusic) {
  ArcadeMusic.init();
  ArcadeMusic.start("waterRoyale");
}
requestAnimationFrame(loop);