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

// Sprite paths — use your uploaded filenames as-is (place PNGs in repo root)
const weaponImages = {};
const weaponImageFiles = {
  pistol: 'water-gun-pistol-clour-palette_-white-gr-2.png',
  shotgun: 'water-gun-shotgun-colour-palette-white-3.png',
  sniper: 'water-gun_-sniper-clour-palette_-white-g-4.png',
  rifle: 'water-gun-rifle-colour-palette-white--4.png'
};
for (const key in weaponImageFiles) {
  const img = new Image();
  img.src = weaponImageFiles[key];
  weaponImages[key] = img;
}

const juggernautSprite = new Image();
juggernautSprite.src = 'juggernaut_sprite_1.png';
const juggernautSpriteFrame = { w: 24, h: 32, cols: 4, rows: 4 };
const juggernautSpriteDisplay = { w: juggernautSpriteFrame.w * 4, h: juggernautSpriteFrame.h * 4 };

const speedsterSprite = new Image();
speedsterSprite.src = 'speedster_sprite.png';
const speedsterSpriteFrame = { w: 24, h: 32, cols: 4, rows: 4 };
const speedsterSpriteDisplay = { w: speedsterSpriteFrame.w * 4, h: speedsterSpriteFrame.h * 4 };

const defaultSprite = new Image();
defaultSprite.src = 'deafult sprite.png';
const defaultSpriteFrame = { w: 24, h: 32, cols: 4, rows: 4 };
const defaultSpriteDisplay = { w: defaultSpriteFrame.w * 4, h: defaultSpriteFrame.h * 4 };

const wallSprite = new Image();
wallSprite.src = 'New_Piskel.png';

const speedTileSprite = new Image();
speedTileSprite.src = 'New_Piskel_1.png';

const bushSprite = new Image();
bushSprite.src = 'New_Piskel_2.png';

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
        if (target.hp <= 0) knockOut(target);
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

function drawTileMap() {
  ctx.fillStyle = "#6fc86d";
  ctx.fillRect(0, 0, arena.w, arena.h);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      if ((c + r) % 2 === 0) ctx.fillRect(c * tile, r * tile, tile, tile);
    }
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
  const scale = 1.45;
  const width = rect.w * scale;
  const height = rect.h * scale;
  const x = rect.x - (width - rect.w) / 2;
  const y = rect.y - (height - rect.h) / 2;

  if (wallSprite.complete && wallSprite.naturalWidth) {
    ctx.save();
    if (rect.flip) {
      ctx.translate(x + width / 2, y + height / 2);
      ctx.scale(1, -1);
      ctx.drawImage(wallSprite, -width / 2, -height / 2, width, height);
    } else {
      ctx.drawImage(wallSprite, x, y, width, height);
    }
    ctx.restore();
    return;
  }

  ctx.fillStyle = "#43bdf5";
  roundRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4, 6);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(rect.x + 8, rect.y + 7, rect.w - 16, 6);
  ctx.fillStyle = "rgba(0,60,90,0.2)";
  ctx.fillRect(rect.x + 5, rect.y + rect.h - 10, rect.w - 10, 5);
}

function drawBushTile(rect) {
  const scale = 1.45;
  const width = rect.w * scale;
  const height = rect.h * scale;
  const x = rect.x - (width - rect.w) / 2;
  const y = rect.y - (height - rect.h) / 2;

  if (bushSprite.complete && bushSprite.naturalWidth) {
    ctx.drawImage(bushSprite, x, y, width, height);
    return;
  }

  ctx.fillStyle = "#0fae5c";
  roundRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4, 7);
  ctx.fill();
  ctx.fillStyle = "#31df62";
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.arc(rect.x + 10 + i * 9, rect.y + 14 + Math.sin(rect.c + i) * 7, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSpeedTile(rect) {
  const scale = 1.35;
  const width = rect.w * scale;
  const height = rect.h * scale;
  const x = rect.x - (width - rect.w) / 2;
  const y = rect.y - (height - rect.h) / 2;

  if (speedTileSprite.complete && speedTileSprite.naturalWidth) {
    ctx.drawImage(speedTileSprite, x, y, width, height);
    return;
  }

  ctx.fillStyle = "#45f238";
  ctx.fillRect(x + 1, y + 1, width - 2, height - 2);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 10);
  ctx.lineTo(x + 30, y + 22);
  ctx.lineTo(x + 10, y + 34);
  ctx.closePath();
  ctx.fill();
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

  const spriteData = fighter.type === 'juggernaut'
    ? { sprite: juggernautSprite, frameInfo: juggernautSpriteFrame, display: juggernautSpriteDisplay }
    : fighter.type === 'speedster'
      ? { sprite: speedsterSprite, frameInfo: speedsterSpriteFrame, display: speedsterSpriteDisplay }
      : fighter.type === 'default'
        ? { sprite: defaultSprite, frameInfo: defaultSpriteFrame, display: defaultSpriteDisplay }
        : null;

  if (spriteData && spriteData.sprite.complete && spriteData.sprite.naturalWidth) {
    const dx = fighter.dirX;
    const dy = fighter.dirY;
    let row;
    if (Math.abs(dx) > Math.abs(dy)) {
      row = dx > 0 ? 3 : 2;
    } else {
      row = dy > 0 ? 0 : 1;
    }
    const frame = fighter.walkFrame || 0;
    ctx.drawImage(
      spriteData.sprite,
      frame * spriteData.frameInfo.w,
      row * spriteData.frameInfo.h,
      spriteData.frameInfo.w,
      spriteData.frameInfo.h,
      drawX - spriteData.display.w / 2,
      drawY - spriteData.display.h / 2,
      spriteData.display.w,
      spriteData.display.h
    );
    if (fighter.invulnerable > 0) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(drawX, drawY, fighter.r + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.rotate(aim);
    ctx.fillStyle = "#0f5a7c";
    roundRect(2, -7, 35, 14, 7);
    ctx.fill();
    ctx.restore();

    ctx.globalAlpha = fighter.invulnerable > 0 && Math.floor(state.time * 10) % 2 === 0 ? 0.55 : 1;
    ctx.fillStyle = fighter.color;
    ctx.beginPath();
    ctx.arc(drawX, drawY, fighter.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (fighter.invulnerable > 0) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(drawX, drawY, fighter.r + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.beginPath();
    ctx.arc(drawX + Math.cos(aim) * 7, drawY + Math.sin(aim) * 7, fighter.r * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#102e3f";
  ctx.font = "700 13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(fighter.name, drawX, drawY - fighter.r - 15);

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
  requestAnimationFrame(loop);
}

function endGame(won) {
  state.over = true;
  state.running = false;
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
requestAnimationFrame(loop);