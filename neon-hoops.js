/* ============================================================
   NEON HOOPS // RETRO-84  —  script.js  v2
   ============================================================ */
'use strict';

// ─── Constants ──────────────────────────────────────────────
const GRAVITY       = -22;
const PLAYER_SPEED  = 8;
const JUMP_FORCE    = 11;
const FLOOR_Y       = 0;
const BALL_RADIUS   = 0.35;
const HOOP_X        = 0;
const HOOP_Z        = -14;
const HOOP_Y        = 5.2;
const RIM_RADIUS    = 0.9;
const GAME_DURATION = 60;
const DUNK_DIST     = 3.2;   // max distance from rim to attempt dunk
const AI_ZONE_Z     = -24;   // centre of AI spawn zone
const HALF_COURT_Z  = -4;    // mid-court check-up spot after picking AI difficulty
const AI_DUEL_DEF_Z = HOOP_Z + 8; // defender spawns here for half-court 1v1
const PLAYER_STEAL_DURATION = 0.55;
const AI_STEAL_WINDUP = { easy: 0.9, medium: 0.72, hard: 0.58 };
const STEAL_STUN_DURATION = 2.0;
const STEAL_PUNISH_START = 0.62; // crossover during this window of AI wind-up stuns them

const C_CYAN   = 0x00f5ff;
const C_PURPLE = 0xbf00ff;
const C_PINK   = 0xff2d78;
const C_ORANGE = 0xff6b00;
const C_GREEN  = 0x00ff88;
const C_YELLOW = 0xffe600;

// Skin hex values for customization
const SKIN_COLORS   = [0xf5cba7, 0xe8a87c, 0xc68642, 0x8d5524, 0xffe4e1];
const JERSEY_COLORS = [0xbf00ff, 0xff2d78, 0x00f5ff, 0xffe600, 0x00ff88, 0xff6b00];
const SHOE_COLORS   = [0xff2d78, 0x00f5ff, 0xffe600, 0xffffff, 0xff6b00];

// ─── Global Objects ─────────────────────────────────────────
let scene, camera, renderer, clock;
let playerGroup;
let pBody, pHead, pHair, pHat, pLegL, pLegR, pArmL, pArmR, pShoeL, pShoeR, pFaceEl;
let pKneeL, pKneeR;       // knee sub-groups (shin + shoe pivot)
let pElbowL, pElbowR;     // forearm sub-groups (pivot at elbow)
let playerBallAnchorR, playerBallAnchorL;
let ballMesh, ballLight;
let hoopGroup;
let aiGroup = null;        // AI defender mesh group
let aiZoneMesh;            // glowing floor zone

// Skinning references for live customization
let skinMeshes   = [];     // head + arms
let jerseyMeshes = [];
let shortsRef    = null;
let hairMesh     = null;
let hatMesh      = null;
let shoeMeshes   = [];
let faceMesh     = null;

// ─── Game State ─────────────────────────────────────────────
let keys = {};
let prevKeys = {};

// Player
let playerPos = { x:0, y:FLOOR_Y, z:5 };
let playerVel = { x:0, y:0, z:0 };
let playerOnGround = true;
let playerFacing = 0;      // rotation.y angle

// Dunk
let jumpCount   = 0;       // 0=on ground, 1=first jump, 2=dunking
let dunkActive  = false;
let dunkPhase   = 0;       // 0-1 animation progress
let dunkTimeout = null;

// Dribble — phase-driven bounce physics and contextual stance
let dribbleHand   = 'right';
let dribblePhase  = 0;          // 0 = hand/apex, 0.5 = floor impact, 1 = hand again
let dribbleSpeed  = 2.35;       // bounces per second (dt-clamped, human-readable)
const DRIBBLE_HEIGHT = 1.3;
const BALL_STAND_Y = 1.2;
let onBallCrouch  = 0;          // 0-1 on-ball stance blend
let offBallCrouch = 0;          // 0-1 off-ball ready stance blend
let stanceDropY   = 0;          // current root Y drop applied to playerGroup
const ON_BALL_CROUCH_IDLE = 0.20;
const ON_BALL_CROUCH_RUN  = 0.34;
const OFF_BALL_CROUCH     = 0.11;
let crossoverActive = false;
let crossoverPhase  = 0;
let crossoverFrom   = 'right';
let crossoverTo     = 'left';

// Shot meter
let shotCharging  = false;
let shotPower     = 0;         // 0-100
let shotNeedle    = 0;         // 0-100 oscillating
let shotNeedleDir = 1;
let shotNeedleSpd = 65;        // %/s speed
let shotGreenLo   = 55;
let shotGreenHi   = 75;

// Ball
let ballState  = 'held';  // 'held'|'flying'|'dead'|'dunking'|'ai'
let ballPos    = { x:0, y:0, z:0 };
let ballVel    = { x:0, y:0, z:0 };
let ballBounces = 0;
let ballWasAboveRim = false;
let ballRimContactTime = 0;

// AI Defender
let aiActive   = false;
let aiPos      = { x:2, y:FLOOR_Y, z:AI_ZONE_Z + 4 };
let aiVel      = { x:0, y:0, z:0 };
let aiState    = 'idle';   // 'idle'|'defend'|'shoot'|'steal_windup'|'stunned'
let aiDifficulty = 'medium'; // 'easy'|'medium'|'hard'
let aiShootTimer = 0;
let aiStealCooldown = 0;
let aiShootChargeTime = 0;
let aiStealWindup = 0;
let aiStunnedTimer = 0;

const AI_SPEED    = { easy:3, medium:5.5, hard:8 };
const AI_STEAL_R  = { easy:1.8, medium:1.3, hard:1.0 };
const AI_REACT    = { easy:2.0, medium:1.0, hard:0.3 };

// ─── Animation State ────────────────────────────────────────
// Named poses blend into each other smoothly every frame
let animState   = 'idle';   // 'idle'|'run'|'jump'|'shoot'|'dunk'|'land'|'steal'|'block'
let animBlend   = 0;        // 0-1 blend toward target pose
let animTimer   = 0;        // time in current state

// Per-joint current rotations (smoothed each frame toward target)
const jRot = {
  torsoX:0, torsoZ:0,
  headX:0,  headZ:0,
  armLX:0, armLZ:0,
  armRX:0, armRZ:0,
  elbLX:0, elbRX:0,
  legLX:0, legRX:0,
  legLZ:0, legRZ:0,
};

// Steal
let stealCooldown = 0;
let stealAnimTimer = 0;
let playerStealActive = false;
let playerStealPhase = 0;

// Score / timer
let score = 0, timeLeft = GAME_DURATION, timerAccum = 0;
let gameActive = false, lastTimestamp = null;
let feedbackTimeout = null;

// Customization
let custom = {
  skin: 0, hair: 0, face: 0, jersey: 0, hat: 0, shoes: 0, build: 1
};

// Camera
let camTargetPos  = new THREE.Vector3();
let camCurrentPos = new THREE.Vector3(0, 10, 18);

// DOM refs
const canvasEl       = document.getElementById('canvas-container');
const scoreEl        = document.getElementById('score-display');
const timerEl        = document.getElementById('timer-display');
const feedbackEl     = document.getElementById('feedback-msg');
const startScreenEl  = document.getElementById('start-screen');
const gameoverEl     = document.getElementById('gameover-screen');
const finalScoreEl   = document.getElementById('final-score');
const rankEl         = document.getElementById('rank-display');
const startBtn       = document.getElementById('start-btn');
const restartBtn     = document.getElementById('restart-btn');
const shotWrapEl     = document.getElementById('shot-meter-wrap');
const shotFillEl     = document.getElementById('shot-meter-fill');
const shotZoneEl     = document.getElementById('shot-meter-zone');
const shotNeedleEl   = document.getElementById('shot-meter-needle');
const dribbleIndEl   = document.getElementById('dribble-indicator');
const dribbleLblEl   = document.getElementById('dribble-label');
const aiZonePromptEl = document.getElementById('ai-zone-prompt');
const aiStealWarningEl = document.getElementById('ai-steal-warning');
const tutScreenEl    = document.getElementById('tutorial-screen');
const customScreenEl = document.getElementById('custom-screen');

// ─── Utility ────────────────────────────────────────────────
function lerp(a,b,t){ return a+(b-a)*t; }
function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }
function vecLen(v){ return Math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z); }
function dist2D(ax,az,bx,bz){ const dx=ax-bx,dz=az-bz; return Math.sqrt(dx*dx+dz*dz); }
function padNum(n){ return String(Math.max(0,Math.floor(n))).padStart(2,'0'); }
function keyJustPressed(code){ return keys[code] && !prevKeys[code]; }

// ─── Three.js Init ──────────────────────────────────────────
function initThree(){
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05020f, 0.022);
  camera = new THREE.PerspectiveCamera(65, innerWidth/innerHeight, 0.1, 200);
  renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasEl.appendChild(renderer.domElement);
  clock = new THREE.Clock();
  window.addEventListener('resize', ()=>{
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

// ─── Lighting ───────────────────────────────────────────────
function buildLighting(){
  // Bright white ambient so the character is always visible
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));

  // Strong overhead white fill light centred on court
  const overhead = new THREE.PointLight(0xffffff, 1.8, 80);
  overhead.position.set(0, 16, -4);
  scene.add(overhead);

  // Player-side fill so the character front is well lit
  const playerFill = new THREE.PointLight(0xffffff, 1.2, 40);
  playerFill.position.set(0, 8, 12);
  scene.add(playerFill);

  // Cyan side accent (keeps neon mood without darkening)
  const fill = new THREE.PointLight(C_CYAN, 0.8, 60);
  fill.position.set(-10, 10, 0);
  scene.add(fill);

  // Purple side accent
  const back = new THREE.PointLight(C_PURPLE, 0.6, 50);
  back.position.set(10, 10, 0);
  scene.add(back);

  // Hoop spotlight — brighter
  const spot = new THREE.SpotLight(0xffffff, 2.2, 35, Math.PI/5, 0.35);
  spot.position.set(HOOP_X, 18, HOOP_Z + 4);
  spot.target.position.set(HOOP_X, HOOP_Y, HOOP_Z);
  spot.castShadow = true;
  scene.add(spot);
  scene.add(spot.target);

  // Second softer spot for mid-court
  const midSpot = new THREE.SpotLight(0xffeedd, 1.4, 40, Math.PI/4, 0.5);
  midSpot.position.set(0, 16, 0);
  midSpot.target.position.set(0, 0, 0);
  scene.add(midSpot);
  scene.add(midSpot.target);
}

// ─── Court ──────────────────────────────────────────────────
function buildCourt(){
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40,60),
    new THREE.MeshStandardMaterial({ color:0x0a0020, roughness:.9, metalness:.1 })
  );
  floor.rotation.x = -Math.PI/2;
  floor.position.y = -0.01;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(40, 20, C_CYAN, C_PURPLE);
  grid.position.y = 0.01;
  grid.material.opacity = 0.5;
  grid.material.transparent = true;
  scene.add(grid);

  circleOutline(0, 0.015, 0, 5.5, 64, C_CYAN, 0.5);
  circleOutline(0, 0.015, -7, 7.5, 64, C_PURPLE, 0.4);

  // AI Zone — glowing purple floor disc
  const azGeo = new THREE.CylinderGeometry(3, 3, 0.05, 32);
  const azMat = new THREE.MeshBasicMaterial({ color:C_PURPLE, transparent:true, opacity:0.18 });
  aiZoneMesh = new THREE.Mesh(azGeo, azMat);
  aiZoneMesh.position.set(0, 0.02, AI_ZONE_Z);
  scene.add(aiZoneMesh);
  circleOutline(0, 0.03, AI_ZONE_Z, 3, 48, C_PURPLE, 0.8);

  // Zone label mesh (billboard text via a thin plane with colour)
  const labelGeo = new THREE.PlaneGeometry(4, 0.6);
  const labelMat = new THREE.MeshBasicMaterial({ color:C_PURPLE, transparent:true, opacity:0.7, side:THREE.DoubleSide });
  const labelMesh = new THREE.Mesh(labelGeo, labelMat);
  labelMesh.rotation.x = -Math.PI/2;
  labelMesh.position.set(0, 0.05, AI_ZONE_Z);
  scene.add(labelMesh);
}

function circleOutline(cx,cy,cz,r,segs,col,op){
  const pts=[];
  for(let i=0;i<=segs;i++){
    const a=(i/segs)*Math.PI*2;
    pts.push(new THREE.Vector3(cx+Math.cos(a)*r, cy, cz+Math.sin(a)*r));
  }
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color:col, opacity:op, transparent:true })
  );
  scene.add(line);
}

// ─── Hoop (FIXED — faces player, pole behind backboard) ─────
function buildHoop(){
  hoopGroup = new THREE.Group();
  // Pole at back (z+ side = toward player at z=5)
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08,0.08,8,8),
    new THREE.MeshStandardMaterial({ color:0x0a0030, emissive:C_CYAN, emissiveIntensity:.5 })
  );
  pole.position.set(0, 4, -2.2);
  hoopGroup.add(pole);

  // Backboard behind rim (z- = further from player)
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 2.1, 0.12),
    new THREE.MeshStandardMaterial({ color:0x0d0030, emissive:C_CYAN, emissiveIntensity:.08 })
  );
  board.position.set(0, HOOP_Y + 0.6, -2.1);
  hoopGroup.add(board);
  neonRect(hoopGroup, 0, HOOP_Y+0.6, -2.14, 3.22, 2.12, C_CYAN, 1.0);
  neonRect(hoopGroup, 0, HOOP_Y+0.35, -2.14, 1.1, 0.8, C_PINK, 0.8);

  // Support arm
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 2.3),
    new THREE.MeshStandardMaterial({ color:0x050018, emissive:C_PURPLE, emissiveIntensity:.5 })
  );
  arm.position.set(0, HOOP_Y+0.05, -1.05);
  hoopGroup.add(arm);

  // Rim
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(RIM_RADIUS, 0.06, 10, 40),
    new THREE.MeshStandardMaterial({ color:0x3a0010, emissive:C_PINK, emissiveIntensity:1.0, roughness:.3 })
  );
  rim.position.set(0, HOOP_Y, 0);
  rim.rotation.x = Math.PI/2;
  hoopGroup.add(rim);

  const rimLight = new THREE.PointLight(C_PINK, 1.0, 5);
  rimLight.position.set(0, HOOP_Y, 0);
  hoopGroup.add(rimLight);

  buildNet(hoopGroup, 0, HOOP_Y, 0, RIM_RADIUS, 1.1);

  hoopGroup.position.set(HOOP_X, 0, HOOP_Z);
  scene.add(hoopGroup);
}

function neonRect(parent, x, y, z, w, h, col, op){
  const hw=w/2,hh=h/2;
  const pts=[
    new THREE.Vector3(-hw,hh,0), new THREE.Vector3(hw,hh,0),
    new THREE.Vector3(hw,-hh,0), new THREE.Vector3(-hw,-hh,0),
    new THREE.Vector3(-hw,hh,0)
  ];
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color:col, opacity:op, transparent:true })
  );
  line.position.set(x,y,z);
  parent.add(line);
}

function buildNet(parent, cx, cy, cz, r, depth){
  const segs=10, rings=5;
  for(let s=0;s<segs;s++){
    const pts=[];
    for(let rr=0;rr<=rings;rr++){
      const t=rr/rings, a=(s/segs)*Math.PI*2, narrow=1-t*0.55;
      pts.push(new THREE.Vector3(cx+Math.cos(a)*r*narrow, cy-t*depth, cz+Math.sin(a)*r*narrow));
    }
    parent.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color:C_PINK, opacity:.35, transparent:true })));
  }
  for(let rr=1;rr<=rings;rr++){
    const t=rr/rings, narrow=1-t*0.55, pts=[];
    for(let s=0;s<=segs;s++){
      const a=(s/segs)*Math.PI*2;
      pts.push(new THREE.Vector3(cx+Math.cos(a)*r*narrow, cy-t*depth, cz+Math.sin(a)*r*narrow));
    }
    parent.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color:C_PINK, opacity:.2, transparent:true })));
  }
}

// ─── Player (smoother silhouette with CylinderGeometry limbs) ─
function buildPlayer(){
  playerGroup = new THREE.Group();

  const buildScale = [0.85, 1.0, 1.15, 1.0][custom.build];
  const buildH     = [1.0,  1.0, 1.0,  1.2][custom.build];

  const skinCol   = SKIN_COLORS[custom.skin];
  const jerseyCol = JERSEY_COLORS[custom.jersey];
  const shoeCol   = SHOE_COLORS[custom.shoes];

  skinMeshes   = [];
  jerseyMeshes = [];
  shoeMeshes   = [];

  const jMat  = () => new THREE.MeshStandardMaterial({ color:jerseyCol, emissive:jerseyCol, emissiveIntensity:.22, roughness:.55, metalness:.05 });
  const sMat  = () => new THREE.MeshStandardMaterial({ color:skinCol,   roughness:.65, metalness:.0 });
  const shMat = () => new THREE.MeshStandardMaterial({ color:shoeCol,   emissive:shoeCol, emissiveIntensity:.35, roughness:.45, metalness:.1 });
  const dkMat = () => new THREE.MeshStandardMaterial({ color:darken(jerseyCol,.38), roughness:.7 });

  // ── Pelvis base (anchors legs, gives hips)
  const pelvis = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32*buildScale, 0.28*buildScale, 0.22*buildH, 16),
    dkMat()
  );
  pelvis.position.y = 0.88*buildH;
  pelvis.castShadow = true;
  playerGroup.add(pelvis);

  // ── Torso — more segments, athletic V-taper
  const torsoGeo = new THREE.CylinderGeometry(0.40*buildScale, 0.28*buildScale, 1.0*buildH, 16);
  pBody = new THREE.Mesh(torsoGeo, jMat());
  pBody.position.y = 1.38*buildH;
  pBody.castShadow = true;
  playerGroup.add(pBody);
  jerseyMeshes.push(pBody);

  // Jersey side stripe (thin box on front face)
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.44*buildScale, 0.13, 0.42*buildScale),
    new THREE.MeshBasicMaterial({ color:C_CYAN })
  );
  stripe.position.set(0, 1.38*buildH, 0.01);
  playerGroup.add(stripe);

  // ── Shorts — slightly flared
  const shortsGeo = new THREE.CylinderGeometry(0.36*buildScale, 0.33*buildScale, 0.44*buildH, 16);
  shortsRef = new THREE.Mesh(shortsGeo, dkMat());
  shortsRef.position.y = 0.68*buildH;
  playerGroup.add(shortsRef);
  jerseyMeshes.push(shortsRef);

  // ── Head — rounder sphere, more segments
  const headGeo = new THREE.SphereGeometry(0.295, 20, 16);
  pHead = new THREE.Mesh(headGeo, sMat());
  pHead.position.y = 2.0*buildH;
  pHead.castShadow = true;
  playerGroup.add(pHead);
  skinMeshes.push(pHead);

  // Neck — short smooth cylinder
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.13, 0.2, 12),
    sMat()
  );
  neck.position.y = 1.78*buildH;
  playerGroup.add(neck);
  skinMeshes.push(neck);

  // ── Face
  buildFace(buildH);

  // ── Hair
  buildHairMesh(buildH);

  // ── Hat
  buildHatMesh(buildH);

  // ── Shoe factory (used inside leg groups)
  function makeShoe(){
    const g = new THREE.Group();
    const sole = new THREE.Mesh(new THREE.CylinderGeometry(0.12*buildScale,0.13*buildScale,0.1,14), shMat());
    sole.position.y = 0.05; g.add(sole);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.13*buildScale,14,10), shMat());
    toe.scale.set(1,0.6,1.4); toe.position.set(0,0.06,0.1*buildScale); g.add(toe);
    const heel = new THREE.Mesh(new THREE.SphereGeometry(0.115*buildScale,10,8), shMat());
    heel.scale.set(1,0.65,1.0); heel.position.set(0,0.05,-0.08*buildScale); g.add(heel);
    shoeMeshes.push(sole,toe,heel);
    return g;
  }

  // ── Legs — thigh group pivoting at hip, knee sub-group pivoting mid-leg
  const thighGeo = new THREE.CylinderGeometry(0.145*buildScale, 0.125*buildScale, 0.42*buildH, 12);
  const shinGeo  = new THREE.CylinderGeometry(0.115*buildScale, 0.095*buildScale, 0.38*buildH, 12);
  const legColMat = dkMat;
  const kneeSphGeo = new THREE.SphereGeometry(0.11*buildScale, 10, 8);

  // Left leg
  pLegL = new THREE.Group();
  const thighL = new THREE.Mesh(thighGeo, legColMat());
  thighL.position.y = -0.21*buildH; pLegL.add(thighL);
  pKneeL = new THREE.Group();
  pKneeL.position.y = -0.43*buildH;
  pKneeL.add(new THREE.Mesh(kneeSphGeo, sMat()));
  const shinL = new THREE.Mesh(shinGeo, legColMat());
  shinL.position.y = -0.20*buildH; pKneeL.add(shinL);
  pShoeL = makeShoe();
  pShoeL.position.set(0,-0.40*buildH,0.02); pKneeL.add(pShoeL);
  pLegL.add(pKneeL);
  pLegL.position.set(-0.19*buildScale, 0.78*buildH, 0);
  playerGroup.add(pLegL);

  // Right leg
  pLegR = new THREE.Group();
  const thighR = new THREE.Mesh(thighGeo.clone(), legColMat());
  thighR.position.y = -0.21*buildH; pLegR.add(thighR);
  pKneeR = new THREE.Group();
  pKneeR.position.y = -0.43*buildH;
  pKneeR.add(new THREE.Mesh(kneeSphGeo.clone(), sMat()));
  const shinR = new THREE.Mesh(shinGeo.clone(), legColMat());
  shinR.position.y = -0.20*buildH; pKneeR.add(shinR);
  pShoeR = makeShoe();
  pShoeR.position.set(0,-0.40*buildH,0.02); pKneeR.add(pShoeR);
  pLegR.add(pKneeR);
  pLegR.position.set(0.19*buildScale, 0.78*buildH, 0);
  playerGroup.add(pLegR);

  // ── Arms — shoulder group (upper arm) + elbow pivot (forearm+hand)
  function makeArm(isLeft){
    const g = new THREE.Group();  // shoulder pivot
    // Shoulder sphere
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.115*buildScale,12,10), jMat());
    cap.position.y = 0; g.add(cap); jerseyMeshes.push(cap);
    // Upper arm
    const upper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105*buildScale,0.095*buildScale,0.42*buildH,12), jMat());
    upper.position.y = -0.22*buildH; g.add(upper); jerseyMeshes.push(upper);
    // Elbow pivot group
    const elbowGrp = new THREE.Group();
    elbowGrp.position.y = -0.44*buildH;
    const elbowSph = new THREE.Mesh(new THREE.SphereGeometry(0.095*buildScale,10,8), sMat());
    elbowGrp.add(elbowSph); skinMeshes.push(elbowSph);
    const fore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.090*buildScale,0.075*buildScale,0.38*buildH,12), sMat());
    fore.position.y = -0.20*buildH; elbowGrp.add(fore); skinMeshes.push(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.078*buildScale,10,8), sMat());
    hand.position.y = -0.40*buildH; elbowGrp.add(hand); skinMeshes.push(hand);
    g.add(elbowGrp);
    if(isLeft) pElbowL = elbowGrp; else pElbowR = elbowGrp;
    return g;
  }

  pArmL = makeArm(true);
  pArmL.position.set(-0.50*buildScale, 1.60*buildH, 0);
  playerGroup.add(pArmL);

  pArmR = makeArm(false);
  pArmR.position.set(0.50*buildScale, 1.60*buildH, 0);
  playerGroup.add(pArmR);

  // Ball anchor points — at hip level, pushed well outside body and forward
  playerBallAnchorR = new THREE.Object3D();
  playerBallAnchorR.position.set(0.78*buildScale, 0.82*buildH, 0.28);
  playerGroup.add(playerBallAnchorR);

  playerBallAnchorL = new THREE.Object3D();
  playerBallAnchorL.position.set(-0.78*buildScale, 0.82*buildH, 0.28);
  playerGroup.add(playerBallAnchorL);

  playerGroup.position.set(playerPos.x, playerPos.y, playerPos.z);
  scene.add(playerGroup);
}

function buildFace(buildH){
  // Remove old face mesh
  if(pFaceEl){ playerGroup.remove(pFaceEl); }
  const faceGroup = new THREE.Group();

  const faceConfigs = [
    // 0: neutral — flat eyes
    ()=>{ addEyes(faceGroup, 0, buildH, 0.04, false); },
    // 1: intense — angled brows
    ()=>{ addEyes(faceGroup, 0, buildH, 0.04, true); addBrow(faceGroup, buildH, -0.05); },
    // 2: cool — visor line
    ()=>{
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.07, 0.03),
        new THREE.MeshBasicMaterial({ color:C_CYAN })
      );
      visor.position.set(0, 1.90*buildH, 0.27);
      faceGroup.add(visor);
    },
    // 3: happy — curved mouth
    ()=>{ addEyes(faceGroup, 0, buildH, 0.05, false); addSmile(faceGroup, buildH); },
    // 4: mean mug — heavy brow
    ()=>{ addEyes(faceGroup, 0, buildH, 0.04, false); addBrow(faceGroup, buildH, -0.09); }
  ];

  faceConfigs[custom.face]();
  pFaceEl = faceGroup;
  playerGroup.add(pFaceEl);
}

function addEyes(group, ox, bH, r, squint){
  const mat = new THREE.MeshBasicMaterial({ color:0xffffff });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(r,8,8), mat);
  eyeL.position.set(-0.09, 1.91*bH, 0.26);
  if(squint) eyeL.scale.y = 0.5;
  group.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(r,8,8), mat.clone());
  eyeR.position.set(0.09, 1.91*bH, 0.26);
  if(squint) eyeR.scale.y = 0.5;
  group.add(eyeR);
  // Pupils
  const pMat = new THREE.MeshBasicMaterial({ color:0x111111 });
  const pL = new THREE.Mesh(new THREE.SphereGeometry(r*0.55,6,6), pMat);
  pL.position.set(-0.09, 1.91*bH, 0.295);
  group.add(pL);
  const pR = new THREE.Mesh(new THREE.SphereGeometry(r*0.55,6,6), pMat.clone());
  pR.position.set(0.09, 1.91*bH, 0.295);
  group.add(pR);
}

function addBrow(group, bH, yOff){
  const mat = new THREE.MeshBasicMaterial({ color:0x222222 });
  [-0.09, 0.09].forEach(x=>{
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.03,0.03), mat.clone());
    b.position.set(x, (1.96+yOff)*bH, 0.27);
    b.rotation.z = x < 0 ? 0.3 : -0.3;
    group.add(b);
  });
}

function addSmile(group, bH){
  const mat = new THREE.MeshBasicMaterial({ color:0xffffff });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.07,0.015,6,12,Math.PI), mat);
  smile.position.set(0, 1.82*bH, 0.27);
  smile.rotation.z = Math.PI;
  group.add(smile);
}

function buildHairMesh(buildH){
  if(hairMesh){ playerGroup.remove(hairMesh); hairMesh=null; }
  const headY = 2.0*buildH;  // centre of head sphere
  const headR = 0.295;

  const hairConfigs = [
    null,  // 0: bald
    ()=>{ // 1: afro — dense bumpy sphere sitting on top of head
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color:0x1a0800, roughness:1.0 });
      // Main bulk
      const main = new THREE.Mesh(new THREE.SphereGeometry(0.33,14,12), mat.clone());
      main.scale.set(1.15, 1.05, 1.15);
      main.position.y = headY + 0.08;
      g.add(main);
      // Extra bump clusters for texture
      for(let i=0;i<10;i++){
        const a = (i/10)*Math.PI*2;
        const bump = new THREE.Mesh(new THREE.SphereGeometry(0.10+Math.random()*0.06,8,8), mat.clone());
        bump.position.set(Math.cos(a)*0.22, headY + 0.06 + Math.random()*0.14, Math.sin(a)*0.22);
        g.add(bump);
      }
      return g;
    },
    ()=>{ // 2: dreads — locs hanging from scalp cap
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color:0x2a1200, roughness:.9 });
      // Scalp cap — open-bottom hemisphere sitting on head
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(headR + 0.018, 16, 12, 0, Math.PI*2, 0, Math.PI*0.52),
        mat.clone()
      );
      cap.position.y = headY;
      g.add(cap);
      // Locs: distribute around top hemisphere, hang down
      const locDefs = [
        // [angleAroundHead, polarAngle(0=top, 1=equator), locLength]
        [0,         0.15, 0.42],
        [Math.PI*0.25, 0.35, 0.50],
        [Math.PI*0.5,  0.40, 0.55],
        [Math.PI*0.75, 0.35, 0.48],
        [Math.PI,      0.30, 0.44],
        [Math.PI*1.25, 0.35, 0.52],
        [Math.PI*1.5,  0.40, 0.49],
        [Math.PI*1.75, 0.35, 0.46],
        [Math.PI*0.12, 0.50, 0.58],
        [Math.PI*0.62, 0.50, 0.56],
        [Math.PI*1.12, 0.50, 0.54],
        [Math.PI*1.62, 0.50, 0.57],
      ];
      locDefs.forEach(([azimuth, polar, len])=>{
        // Point on head surface at that angle
        const sx = Math.sin(polar*Math.PI) * Math.cos(azimuth) * (headR + 0.022);
        const sy = Math.cos(polar*Math.PI) * (headR + 0.022);
        const sz = Math.sin(polar*Math.PI) * Math.sin(azimuth) * (headR + 0.022);
        const loc = new THREE.Mesh(
          new THREE.CylinderGeometry(0.030, 0.014, len, 6),
          mat.clone()
        );
        // Place loc so its top is at the scalp attach point
        loc.position.set(sx, headY + sy - len*0.5, sz);
        // Point the loc outward/downward from the head centre
        loc.lookAt(sx*3, headY + sy - len*1.5, sz*3);
        loc.rotateX(Math.PI/2);
        g.add(loc);
      });
      return g;
    },
    ()=>{ // 3: buzz cut — tight shell hugging the head
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(headR + 0.022, 18, 14, 0, Math.PI*2, 0, Math.PI*0.56),
        new THREE.MeshStandardMaterial({ color:0x1a0800, roughness:.95 })
      );
      m.position.y = headY;
      return m;
    },
    ()=>{ // 4: cornrows/braids — ridges draped over the head surface front-to-back
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color:0x2a1200, roughness:.85 });
      // Scalp base
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(headR + 0.016, 16, 12, 0, Math.PI*2, 0, Math.PI*0.54),
        mat.clone()
      );
      cap.position.y = headY;
      g.add(cap);
      // 5 braids: each is a chain of small spheres draped front-to-back over the head
      const braidXOffsets = [-0.20, -0.10, 0, 0.10, 0.20];
      braidXOffsets.forEach(bx=>{
        // Sample 10 points along the arc from front to back of the head
        const steps = 10;
        for(let s=0;s<steps;s++){
          // polar angle goes from ~30° (front) to ~160° (back)
          const polar = 0.30 + (s/(steps-1)) * 0.90; // 0→1 mapped to front→back
          const azimuth = Math.PI * 0.5; // facing front (z+)
          // compute head surface point, but use bx as the x offset
          const pAngle = polar * Math.PI;
          const r = headR + 0.030;
          // Use a simplified arc: x=bx fixed, y and z follow circle
          const arcAngle = lerp(-0.85, 0.85, s/(steps-1)); // -PI/2 to PI/2 arc
          const py = headY + Math.cos(arcAngle) * r;
          const pz = Math.sin(arcAngle) * r;
          // clamp x so bead stays on head surface
          const xMax = Math.sqrt(Math.max(0, r*r - (py-headY)*(py-headY) - pz*pz));
          const cx = clamp(bx, -xMax, xMax);
          const bead = new THREE.Mesh(
            new THREE.SphereGeometry(0.028, 6, 6),
            mat.clone()
          );
          bead.position.set(cx, py, pz);
          g.add(bead);
        }
      });
      return g;
    },
    ()=>{ // 5: mohawk — fin shape sitting dead centre
      const g = new THREE.Group();
      // Base strip
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.06, 0.56),
        new THREE.MeshStandardMaterial({ color:0x1a0800, roughness:.9 })
      );
      base.position.y = headY + headR - 0.01;
      g.add(base);
      // Spiky fin
      const fin = new THREE.Mesh(
        new THREE.CylinderGeometry(0, 0.06, 0.38, 6),
        new THREE.MeshStandardMaterial({ color:C_PINK, emissive:C_PINK, emissiveIntensity:.5 })
      );
      fin.position.y = headY + headR + 0.18;
      fin.scale.z = 2.2; // stretch into a fin shape
      g.add(fin);
      return g;
    }
  ];
  if(custom.hair > 0 && hairConfigs[custom.hair]){
    hairMesh = hairConfigs[custom.hair]();
    if(hairMesh) playerGroup.add(hairMesh);
  }
}

function buildHatMesh(buildH){
  if(hatMesh){ playerGroup.remove(hatMesh); hatMesh=null; }
  const y = 2.12*buildH;
  const hatConfigs = [
    null,
    ()=>{ // 1: top hat
      const g = new THREE.Group();
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,0.06,12), new THREE.MeshStandardMaterial({ color:0x111111 }));
      brim.position.y = y;
      const tall = new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.26,0.5,12), new THREE.MeshStandardMaterial({ color:0x111111 }));
      tall.position.y = y+0.28;
      g.add(brim); g.add(tall); return g;
    },
    ()=>{ // 2: snapback
      const g = new THREE.Group();
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.31,0.29,0.24,12), new THREE.MeshStandardMaterial({ color:JERSEY_COLORS[custom.jersey], emissive:JERSEY_COLORS[custom.jersey], emissiveIntensity:.2 }));
      cap.position.y = y+0.1;
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.52,0.05,0.25), new THREE.MeshStandardMaterial({ color:0x111111 }));
      brim.position.set(0, y, 0.22);
      g.add(cap); g.add(brim); return g;
    },
    ()=>{ // 3: crown
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color:C_YELLOW, emissive:C_YELLOW, emissiveIntensity:.5 });
      for(let i=0;i<5;i++){
        const a=(i/5)*Math.PI*2;
        const spike = new THREE.Mesh(new THREE.CylinderGeometry(0,0.06,0.22,5), mat.clone());
        spike.position.set(Math.cos(a)*0.22, y+0.12, Math.sin(a)*0.22);
        g.add(spike);
      }
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.28,0.12,12), mat.clone());
      base.position.y = y; g.add(base); return g;
    },
    ()=>{ // 4: cowboy
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color:0x8B4513 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.52,0.52,0.05,16), mat.clone());
      brim.position.y = y;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.28,0.36,12), mat.clone());
      top.position.y = y+0.2;
      g.add(brim); g.add(top); return g;
    },
    ()=>{ // 5: grad cap
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color:0x111111 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.06,0.6), mat.clone());
      board.position.y = y+0.3;
      const skull = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.28,0.22,12), mat.clone());
      skull.position.y = y+0.1;
      const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,0.28,6), new THREE.MeshBasicMaterial({ color:C_YELLOW }));
      tassel.position.set(0.28, y+0.18, 0);
      g.add(board); g.add(skull); g.add(tassel); return g;
    }
  ];
  if(custom.hat > 0 && hatConfigs[custom.hat]){
    hatMesh = hatConfigs[custom.hat]();
    if(hatMesh) playerGroup.add(hatMesh);
  }
}

function darken(hexColor, amount){
  const r = ((hexColor >> 16) & 0xff);
  const g = ((hexColor >> 8)  & 0xff);
  const b = ( hexColor        & 0xff);
  return (Math.floor(r*amount)<<16) | (Math.floor(g*amount)<<8) | Math.floor(b*amount);
}

// ─── Ball ───────────────────────────────────────────────────
function buildBall(){
  const geo = new THREE.SphereGeometry(BALL_RADIUS, 20, 20);
  const mat = new THREE.MeshStandardMaterial({
    color:0xc44a00, emissive:C_ORANGE, emissiveIntensity:.8, roughness:.55
  });
  ballMesh = new THREE.Mesh(geo, mat);
  ballMesh.castShadow = true;
  ballLight = new THREE.PointLight(C_ORANGE, 1.2, 4);
  ballMesh.add(ballLight);
  ballMesh.scale.set(1, 1, 1);
  scene.add(ballMesh);
  snapBallToHand();
}

/** Map dribblePhase (floor at 0.5) to height 0→1 with apex hang and fast slam. */
function dribbleHeightFromPhase(phase){
  if(phase < 0.5){
    const u = phase / 0.5;
    return 1 - Math.pow(u, 2.35);
  }
  const u = (phase - 0.5) / 0.5;
  return Math.pow(Math.sin(u * Math.PI * 0.5), 0.58);
}

/** True when player should use deep on-ball athletic crouch. */
function isOnBallGrounded(){
  return ballState === 'held' && playerOnGround && animState !== 'jump'
      && !shotCharging && !dunkActive && !playerStealActive;
}

/** True when player should use lighter off-ball ready stance. */
function isOffBallGrounded(){
  return ballState !== 'held' && ballState !== 'dunking' && playerOnGround && animState !== 'jump';
}

/** Dribble arm piston + off-hand protective guard. */
function applyDribbleArmPose(heightNorm, phase){
  const isRight = dribbleHand === 'right';
  const dribbleArm = isRight ? pArmR : pArmL;
  const offArm     = isRight ? pArmL : pArmR;
  const dribbleElb = isRight ? pElbowR : pElbowL;
  const offElb     = isRight ? pElbowL : pElbowR;

  const falling = phase < 0.5;
  const fallSnatch = falling ? Math.pow(1 - heightNorm, 1.6) * 0.32 : 0;
  const pistonX = lerp(-0.68, 0.42, heightNorm) + fallSnatch;

  if(dribbleArm){
    dribbleArm.rotation.x = pistonX;
    dribbleArm.rotation.z = isRight ? -0.26 : 0.26;
  }
  if(dribbleElb) dribbleElb.rotation.x = lerp(-0.78, -0.10, heightNorm);

  if(offArm){
    offArm.rotation.x = -0.52;
    offArm.rotation.z = isRight ? 0.72 : -0.72;
  }
  if(offElb) offElb.rotation.x = -1.18;
}

/** Thighs forward + knee counter-bend for weighted on-ball crouch. */
function applyOnBallLegPose(blend, driving){
  if(blend <= 0.001) return;
  const thigh = lerp(0.24, 0.42, driving ? 1 : 0) * blend;
  const knee  = lerp(-0.46, -0.58, driving ? 1 : 0) * blend;
  if(pLegL) pLegL.rotation.x = thigh;
  if(pLegR) pLegR.rotation.x = thigh;
  if(pKneeL) pKneeL.rotation.x = knee;
  if(pKneeR) pKneeR.rotation.x = knee;
  if(pBody) pBody.rotation.x = lerp(pBody.rotation.x, -0.16 * blend, 0.35);
}

/** Symmetric hands-up guard when waiting off-ball. */
function applyOffBallGuardPose(blend){
  if(blend <= 0.001) return;
  const armUp = -0.42 * blend;
  const elbow = -0.98 * blend;
  const flare = 0.58 * blend;
  if(pArmL){
    pArmL.rotation.x = armUp;
    pArmL.rotation.z = flare;
  }
  if(pArmR){
    pArmR.rotation.x = armUp;
    pArmR.rotation.z = -flare;
  }
  if(pElbowL) pElbowL.rotation.x = elbow;
  if(pElbowR) pElbowR.rotation.x = elbow;
  if(pLegL) pLegL.rotation.x = 0.10 * blend;
  if(pLegR) pLegR.rotation.x = 0.10 * blend;
  if(pKneeL) pKneeL.rotation.x = -0.20 * blend;
  if(pKneeR) pKneeR.rotation.x = -0.20 * blend;
}

/** Physically lower playerGroup root — bypassed entirely during jump/airborne. */
function applyPlayerRootStance(dt){
  if(!playerGroup) return;

  if(animState === 'jump' || !playerOnGround){
    onBallCrouch = lerp(onBallCrouch, 0, clamp(dt * 14, 0, 1));
    offBallCrouch = lerp(offBallCrouch, 0, clamp(dt * 14, 0, 1));
    stanceDropY = lerp(stanceDropY, 0, clamp(dt * 14, 0, 1));
    playerGroup.position.y = playerPos.y;
    return;
  }

  let targetDrop = 0;

  if(isOnBallGrounded()){
    onBallCrouch = lerp(onBallCrouch, 1, clamp(dt * 9, 0, 1));
    offBallCrouch = lerp(offBallCrouch, 0, clamp(dt * 10, 0, 1));
    const base = animState === 'run' ? ON_BALL_CROUCH_RUN : ON_BALL_CROUCH_IDLE;
    targetDrop = base * onBallCrouch;
    applyOnBallLegPose(onBallCrouch, animState === 'run');
  } else if(isOffBallGrounded()){
    onBallCrouch = lerp(onBallCrouch, 0, clamp(dt * 10, 0, 1));
    offBallCrouch = lerp(offBallCrouch, 1, clamp(dt * 7, 0, 1));
    targetDrop = OFF_BALL_CROUCH * offBallCrouch;
    applyOffBallGuardPose(offBallCrouch);
  } else {
    onBallCrouch = lerp(onBallCrouch, 0, clamp(dt * 10, 0, 1));
    offBallCrouch = lerp(offBallCrouch, 0, clamp(dt * 10, 0, 1));
  }

  stanceDropY = lerp(stanceDropY, targetDrop, clamp(dt * 11, 0, 1));
  playerGroup.position.set(playerPos.x, playerPos.y - stanceDropY, playerPos.z);
}

function getHandAnchor(){
  return dribbleHand === 'right' ? playerBallAnchorR : playerBallAnchorL;
}

function snapBallToHand(){
  const wp = new THREE.Vector3();
  getHandAnchor().getWorldPosition(wp);
  ballMesh.position.copy(wp);
  ballPos.x = wp.x; ballPos.y = wp.y; ballPos.z = wp.z;
}

// ─── AI Defender ────────────────────────────────────────────
function buildAI(){
  if(aiGroup){ scene.remove(aiGroup); }
  aiGroup = new THREE.Group();

  const mat = d => new THREE.MeshStandardMaterial({ color:0x001020, emissive:d, emissiveIntensity:.55, roughness:.6 });

  const aiColor = { easy:C_GREEN, medium:C_YELLOW, hard:C_PINK }[aiDifficulty];

  // Body
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.28,0.9,8), mat(aiColor));
  body.position.y = 1.2; aiGroup.add(body);
  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27,12,10), new THREE.MeshStandardMaterial({ color:0x0d0d2b, emissive:aiColor, emissiveIntensity:.3 }));
  head.position.y = 1.88; aiGroup.add(head);
  // Eyes (LED style)
  const eyeMat = new THREE.MeshBasicMaterial({ color:aiColor });
  [-0.09,0.09].forEach(x=>{
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05,6,6), eyeMat.clone());
    e.position.set(x, 1.91, 0.25); aiGroup.add(e);
  });
  // Legs
  const legGeo = new THREE.CylinderGeometry(0.11,0.10,0.6,8);
  const lL = new THREE.Mesh(legGeo, mat(aiColor));
  lL.position.set(-0.18,0.28,0); aiGroup.add(lL);
  const lR = new THREE.Mesh(legGeo.clone(), mat(aiColor));
  lR.position.set(0.18,0.28,0); aiGroup.add(lR);
  // Arms
  const armGeo = new THREE.CylinderGeometry(0.09,0.08,0.7,8);
  const aL = new THREE.Mesh(armGeo, mat(aiColor));
  aL.position.set(-0.50,1.1,0); aL.rotation.z = 0.4; aiGroup.add(aL);
  const aR = new THREE.Mesh(armGeo.clone(), mat(aiColor));
  aR.position.set(0.50,1.1,0); aR.rotation.z = -0.4; aiGroup.add(aR);
  // Glow light
  const glow = new THREE.PointLight(aiColor, 0.8, 4);
  glow.position.y = 1; aiGroup.add(glow);

  aiGroup.position.set(aiPos.x, aiPos.y, aiPos.z);
  scene.add(aiGroup);

  aiState = 'defend';
  aiShootTimer = 0;
  aiStealCooldown = 1.5;
  aiStealWindup = 0;
  aiStunnedTimer = 0;
}

function removeAI(){
  if(aiGroup){ scene.remove(aiGroup); aiGroup=null; }
  aiActive = false;
  aiState = 'idle';
  aiStealWindup = 0;
  aiStunnedTimer = 0;
  playerStealActive = false;
  playerStealPhase = 0;
  if(aiStealWarningEl) aiStealWarningEl.classList.add('hidden');
  if(ballState === 'ai') ballState = 'dead';
}

/** Teleport both players to half court and begin a 1v1 check-up vs the AI. */
function beginAIDuel(difficulty){
  if(!gameActive) startGame();

  aiDifficulty = difficulty;
  playerPos.x = 0;
  playerPos.y = FLOOR_Y;
  playerPos.z = HALF_COURT_Z;
  playerVel = { x:0, y:0, z:0 };
  playerOnGround = true;
  jumpCount = 0;
  if(playerGroup) playerGroup.position.set(playerPos.x, playerPos.y, playerPos.z);

  aiPos.x = 0;
  aiPos.y = FLOOR_Y;
  aiPos.z = AI_DUEL_DEF_Z;
  aiActive = true;
  buildAI();

  ballState = 'held';
  ballVel = { x:0, y:0, z:0 };
  shotCharging = false;
  shotWrapEl.classList.add('hidden');
  playerStealActive = false;
  playerStealPhase = 0;
  snapBallToHand();

  aiZonePromptEl.classList.add('hidden');
  const labels = { easy:'EASY', medium:'MEDIUM', hard:'HARD' };
  showFeedback(`${labels[difficulty]} DEFENDER — HALF COURT!`);
}

function punishAISteal(){
  aiStunnedTimer = STEAL_STUN_DURATION;
  aiState = 'defend';
  aiStealWindup = 0;
  aiStealCooldown = 2.5;
  if(aiStealWarningEl) aiStealWarningEl.classList.add('hidden');
  if(aiGroup) aiGroup.rotation.z = 0;
  showFeedback('ANKLE BREAKER! 🔥');
}

function isAIStealPunishWindow(){
  if(aiState !== 'steal_windup') return false;
  const duration = AI_STEAL_WINDUP[aiDifficulty];
  return aiStealWindup >= duration * STEAL_PUNISH_START;
}

// ─── Starfield ──────────────────────────────────────────────
function buildStarfield(){
  const n=300, pos=new Float32Array(n*3);
  for(let i=0;i<n;i++){
    pos[i*3]   = (Math.random()-.5)*120;
    pos[i*3+1] = Math.random()*40+5;
    pos[i*3+2] = (Math.random()-.5)*120;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color:C_CYAN, size:.15, transparent:true, opacity:.5 })));
}

function isCustomizeOpen(){
  return customScreenEl && !customScreenEl.classList.contains('hidden');
}

// ─── Input ──────────────────────────────────────────────────
function initInput(){
  window.addEventListener('keydown', e=>{
    if(e.code === 'Escape'){
      e.preventDefault();
      if(isCustomizeOpen()){ closeCustomization(); return; }
      if(tutScreenEl && !tutScreenEl.classList.contains('hidden')){ closeTutorial(); return; }
      if(gameActive) openCustomization();
      return;
    }

    if(keys[e.code]) return;
    keys[e.code] = true;

    if(!gameActive || isCustomizeOpen()) return;

    if(e.code==='KeyC'){ switchDribbleHand(); }

    if(e.code==='Space'){
      e.preventDefault();
      handleJumpOrDunk();
    }

    if(e.code==='KeyF'){ tryBlock(); }

    if(e.code==='KeyE'){ startPlayerSteal(); }

    if(inAIZone()){
      if(e.code==='Digit1') beginAIDuel('easy');
      if(e.code==='Digit2') beginAIDuel('medium');
      if(e.code==='Digit3') beginAIDuel('hard');
    }
  });

  window.addEventListener('keyup', e=>{ keys[e.code] = false; });

  // ── LMB = shoot
  window.addEventListener('mousedown', e=>{
    if(isCustomizeOpen()) return;
    if(e.target !== renderer.domElement) return;
    if(!gameActive) return;
    if(e.button === 0 && ballState==='held' && !shotCharging && !playerStealActive) startShotCharge();
  });

  window.addEventListener('mouseup', e=>{
    if(e.button === 0 && shotCharging) releaseShotCharge();
  });

  // Prevent context menu on right-click
  renderer.domElement.addEventListener('contextmenu', e=> e.preventDefault());
}

function handleJumpOrDunk(){
  const rimDist = dist2D(playerPos.x, playerPos.z, HOOP_X, HOOP_Z);

  if(playerOnGround){
    // First jump
    playerVel.y = JUMP_FORCE;
    playerOnGround = false;
    jumpCount = 1;
  } else if(jumpCount === 1 && rimDist < DUNK_DIST && ballState === 'held'){
    // Second jump near hoop = DUNK
    jumpCount = 2;
    startDunk();
  }
}

function switchDribbleHand(){
  if(crossoverActive) return;
  if(isAIStealPunishWindow()){
    punishAISteal();
  }
  crossoverActive = true;
  crossoverPhase  = 0;
  crossoverFrom   = dribbleHand;
  crossoverTo     = dribbleHand === 'right' ? 'left' : 'right';
}

// ─── Shot Meter ─────────────────────────────────────────────
function startShotCharge(){
  shotCharging = true;
  shotPower = 0;
  // Needle always starts in the right half (55-80) moving leftward
  shotNeedle    = 58 + Math.random() * 22;  // 58-80
  shotNeedleDir = -1;  // moving left immediately
  // Zone width shrinks with distance
  const d = dist2D(playerPos.x, playerPos.z, HOOP_X, HOOP_Z);
  const zoneWidth = clamp(32 - d*1.4, 8, 28);
  // Randomise zone position but keep it reachable (30%-70%)
  const padding = zoneWidth / 2 + 8;
  const midPoint = padding + Math.random() * (100 - padding*2);
  shotGreenLo = midPoint - zoneWidth/2;
  shotGreenHi = midPoint + zoneWidth/2;
  shotWrapEl.classList.remove('hidden');
  shotZoneEl.style.left  = shotGreenLo + '%';
  shotZoneEl.style.width = (shotGreenHi - shotGreenLo) + '%';
}

function releaseShotCharge(){
  if(!shotCharging) return;
  shotCharging = false;
  shotWrapEl.classList.add('hidden');
  if(ballState !== 'held') return;

  // Check if needle is in green zone
  const hit = shotNeedle >= shotGreenLo && shotNeedle <= shotGreenHi;
  const accuracy = hit ? 1.0 : Math.max(0, 1 - Math.abs(shotNeedle - (shotGreenLo+shotGreenHi)/2) / 50);
  shootBall(accuracy);
}

function updateShotMeter(dt){
  if(!shotCharging) return;
  // Needle starts fast and accelerates further as power builds
  shotNeedleSpd = 140 + shotPower * 1.4;
  shotNeedle += shotNeedleDir * shotNeedleSpd * dt;
  if(shotNeedle >= 100){ shotNeedle = 100; shotNeedleDir = -1; }
  if(shotNeedle <= 0)  { shotNeedle = 0;   shotNeedleDir =  1; }
  shotPower = Math.min(100, shotPower + dt * 55);

  shotFillEl.style.width    = shotPower + '%';
  shotNeedleEl.style.left   = shotNeedle + '%';
}

// ─── Shooting ───────────────────────────────────────────────
function shootBall(accuracy){
  ballState = 'flying';
  ballBounces = 0;
  ballRimContactTime = 0;

  const wp = new THREE.Vector3();
  getHandAnchor().getWorldPosition(wp);
  ballPos.x = wp.x; ballPos.y = wp.y; ballPos.z = wp.z;

  const rimX = HOOP_X, rimY = HOOP_Y, rimZ = HOOP_Z;
  // Add random offset inversely proportional to accuracy
  const spread = (1 - accuracy) * 1.2;
  const targX = rimX + (Math.random()-.5)*spread;
  const targZ = rimZ + (Math.random()-.5)*spread;

  const dx = targX - ballPos.x;
  const dy = rimY  - ballPos.y;
  const dz = targZ - ballPos.z;
  const horizDist = Math.sqrt(dx*dx+dz*dz);
  const flightTime = clamp(horizDist/9+0.5, 0.65, 1.35);
  const targetY = rimY + 0.3;

  ballVel.y = (targetY - ballPos.y - 0.5*GRAVITY*flightTime*flightTime) / flightTime;
  ballVel.x = dx / flightTime;
  ballVel.z = dz / flightTime;
}

// ─── Dunk ───────────────────────────────────────────────────
function startDunk(){
  dunkActive = true;
  dunkPhase  = 0;
  ballState  = 'dunking';
  // Extra upward boost
  playerVel.y = JUMP_FORCE * 1.3;
}

function updateDunk(dt){
  if(!dunkActive) return;
  dunkPhase += dt * 2.2;
  if(dunkPhase >= 1){
    // Slam!
    dunkActive = false;
    ballState  = 'held';
    jumpCount  = 0;
    registerScore(2);
    showFeedback('DUNK! 💥');
    // Visual: ball stays in rim momentarily
    ballPos.x = HOOP_X; ballPos.y = HOOP_Y; ballPos.z = HOOP_Z;
    ballMesh.position.set(ballPos.x, ballPos.y, ballPos.z);
    setTimeout(()=>{ ballState='dead'; }, 350);
    return;
  }
  // Arc ball toward rim
  const t = dunkPhase;
  const wp = new THREE.Vector3();
  getHandAnchor().getWorldPosition(wp);
  ballPos.x = lerp(wp.x, HOOP_X, t);
  ballPos.y = lerp(wp.y, HOOP_Y+1.2, t) - Math.pow(t-.5,2)*1.5;
  ballPos.z = lerp(wp.z, HOOP_Z, t);
  ballMesh.position.set(ballPos.x, ballPos.y, ballPos.z);

  // Arm animation: raise right arm
  if(pArmR) pArmR.rotation.z = -lerp(0.4, 2.2, t);
}

// ─── Steal ──────────────────────────────────────────────────
function getPlayerStealRange(){
  return { easy:2.6, medium:2.0, hard:1.5 }[aiDifficulty];
}

function startPlayerSteal(){
  if(!aiActive || playerStealActive || stealCooldown > 0) return;
  if(aiState !== 'shoot' || ballState !== 'ai') return;
  const d = dist2D(playerPos.x, playerPos.z, aiPos.x, aiPos.z);
  if(d > getPlayerStealRange()){
    showFeedback('TOO FAR!');
    return;
  }
  playerStealActive = true;
  playerStealPhase = 0;
  stealAnimTimer = PLAYER_STEAL_DURATION;
}

function updatePlayerSteal(dt){
  if(!playerStealActive) return;
  playerStealPhase += dt / PLAYER_STEAL_DURATION;
  stealAnimTimer = Math.max(0, (1 - playerStealPhase) * PLAYER_STEAL_DURATION);
  if(playerStealPhase < 1) return;

  playerStealActive = false;
  playerStealPhase = 0;

  if(!aiActive || aiState !== 'shoot' || ballState !== 'ai'){
    showFeedback('TOO LATE!');
    stealCooldown = 0.8;
    return;
  }

  const d = dist2D(playerPos.x, playerPos.z, aiPos.x, aiPos.z);
  if(d <= getPlayerStealRange()){
    aiState = 'defend';
    ballState = 'held';
    aiShootTimer = 0;
    stealCooldown = 1.5;
    stealAnimTimer = 0.45;
    snapBallToHand();
    showFeedback('STEAL! 🔥');
  } else {
    showFeedback('MISSED STEAL!');
    stealCooldown = 1.0;
  }
}

function tryBlock(){
  if(!aiActive || ballState !== 'ai') return;
  const d = dist2D(playerPos.x, playerPos.z, aiPos.x, aiPos.z);
  const blockRange = { easy:3.0, medium:2.2, hard:1.5 }[aiDifficulty];
  if(d <= blockRange){
    // Successful block!
    aiState = 'defend';
    ballState = 'held';
    aiShootTimer = 0;
    showFeedback('BLOCK! 🛡️');
    // Arm animation
    if(pArmL) pArmL.rotation.z = 1.5;
    setTimeout(()=>{ if(pArmL) pArmL.rotation.z = 0; }, 400);
  } else {
    showFeedback('TOO FAR!');
  }
}

// ─── AI Update ──────────────────────────────────────────────
function updateAI(dt){
  if(!aiActive || !aiGroup) return;

  const speed = AI_SPEED[aiDifficulty];
  const stealR = AI_STEAL_R[aiDifficulty];
  const reactDelay = AI_REACT[aiDifficulty];

  aiStealCooldown = Math.max(0, aiStealCooldown - dt);

  if(aiStunnedTimer > 0){
    aiStunnedTimer = Math.max(0, aiStunnedTimer - dt);
    aiGroup.rotation.z = Math.sin(clock.getElapsedTime() * 18) * 0.12;
    aiGroup.position.set(aiPos.x, aiPos.y, aiPos.z);
    if(aiStunnedTimer <= 0){
      aiGroup.rotation.z = 0;
      aiState = 'defend';
    }
    return;
  }

  if(aiState === 'steal_windup'){
    const duration = AI_STEAL_WINDUP[aiDifficulty];
    aiStealWindup += dt;

    const dx = playerPos.x - aiPos.x;
    const dz = playerPos.z - aiPos.z;
    const d  = Math.sqrt(dx*dx + dz*dz) || 0.001;
    aiPos.x += (dx/d) * speed * 0.35 * dt;
    aiPos.z += (dz/d) * speed * 0.35 * dt;
    aiGroup.position.set(aiPos.x, aiPos.y, aiPos.z);
    aiGroup.rotation.y = Math.atan2(dx, dz);
    aiGroup.rotation.x = -0.25 * Math.min(1, aiStealWindup / duration);

    if(aiStealWarningEl){
      aiStealWarningEl.classList.toggle('hidden', aiStealWindup < duration * STEAL_PUNISH_START);
    }

    if(isAIStealPunishWindow() && crossoverActive){
      punishAISteal();
      return;
    }

    if(aiStealWindup >= duration){
      aiStealWindup = 0;
      aiGroup.rotation.x = 0;
      if(aiStealWarningEl) aiStealWarningEl.classList.add('hidden');

      if(ballState === 'held' && d <= stealR * 1.15){
        ballState = 'ai';
        aiState = 'shoot';
        aiShootTimer = 0;
        aiShootChargeTime = reactDelay + Math.random() * 1.5;
        showFeedback('STOLEN! 😱');
      } else {
        aiState = 'defend';
        aiStealCooldown = 1.2;
        showFeedback('STEAL WHIFF!');
      }
    }
    return;
  }

  if(aiState === 'defend'){
    if(ballState === 'held'){
      // Chase player
      const dx = playerPos.x - aiPos.x;
      const dz = playerPos.z - aiPos.z;
      const d  = Math.sqrt(dx*dx+dz*dz);
      if(d > 0.5){
        aiPos.x += (dx/d)*speed*dt;
        aiPos.z += (dz/d)*speed*dt;
      }
      aiGroup.position.set(aiPos.x, aiPos.y, aiPos.z);
      // Face player
      aiGroup.rotation.y = Math.atan2(dx, dz);

      // Wind-up steal instead of instant grab
      if(d < stealR && aiStealCooldown <= 0 && ballState === 'held'){
        aiState = 'steal_windup';
        aiStealWindup = 0;
        showFeedback('WATCH THE HANDS!');
      }
    } else if(ballState === 'flying' || ballState === 'dead'){
      // Retreat slightly
      const dz = HOOP_Z - aiPos.z;
      if(Math.abs(dz) > 3){
        aiPos.z += Math.sign(dz)*speed*0.5*dt;
        aiGroup.position.set(aiPos.x, aiPos.y, aiPos.z);
      }
    }
  } else if(aiState === 'shoot'){
    // AI has ball — move toward good shooting position
    const targetX = HOOP_X + (Math.random()-.5)*2;
    const targetZ = HOOP_Z + 5;
    const dx = targetX - aiPos.x;
    const dz = targetZ - aiPos.z;
    const d  = Math.sqrt(dx*dx+dz*dz);
    if(d > 0.8){
      aiPos.x += (dx/d)*speed*0.7*dt;
      aiPos.z += (dz/d)*speed*0.7*dt;
      aiGroup.position.set(aiPos.x, aiPos.y, aiPos.z);
    }
    aiGroup.rotation.y = Math.atan2(HOOP_X-aiPos.x, HOOP_Z-aiPos.z);

    // Ball follows AI
    ballPos.x = aiPos.x;
    ballPos.y = aiPos.y + 1.1;
    ballPos.z = aiPos.z;
    ballMesh.position.set(ballPos.x, ballPos.y, ballPos.z);

    aiShootTimer += dt;
    if(aiShootTimer >= aiShootChargeTime){
      // AI shoots!
      aiShootFromPosition();
    }
  }
}

function aiShootFromPosition(){
  aiState   = 'defend';
  ballState = 'flying';
  ballBounces = 0;

  const difficulty = aiDifficulty;
  const spread = difficulty==='easy'?1.4 : difficulty==='medium'?0.7 : 0.2;
  const rimX = HOOP_X + (Math.random()-.5)*spread;
  const rimZ = HOOP_Z + (Math.random()-.5)*spread;
  const rimY = HOOP_Y;

  const dx = rimX - ballPos.x;
  const dy = rimY  - ballPos.y;
  const dz = rimZ  - ballPos.z;
  const horizDist = Math.sqrt(dx*dx+dz*dz);
  const flightTime = clamp(horizDist/9+0.5, 0.65, 1.35);
  const targetY = rimY + 0.3;

  ballVel.y = (targetY - ballPos.y - 0.5*GRAVITY*flightTime*flightTime) / flightTime;
  ballVel.x = dx / flightTime;
  ballVel.z = dz / flightTime;

  aiStealCooldown = 2.0;
}

function inAIZone(){
  return dist2D(playerPos.x, playerPos.z, 0, AI_ZONE_Z) < 3.5;
}

// ─── Ball physics helpers ────────────────────────────────────
function handleBallFloor(){
  if(ballPos.y - BALL_RADIUS <= FLOOR_Y){
    ballPos.y = FLOOR_Y + BALL_RADIUS;
    ballVel.y = -ballVel.y * 0.38;   // less bouncy
    ballVel.x *= 0.72;
    ballVel.z *= 0.72;
    ballBounces++;
    if(ballBounces >= 3 || vecLen(ballVel) < 1.2) ballState = 'dead';
  }
}

function handleBallBackboard(){
  const bz    = HOOP_Z - 2.17;
  const bxMin = HOOP_X - 1.6, bxMax = HOOP_X + 1.6;
  const byMin = HOOP_Y - 0.45, byMax = HOOP_Y + 1.65;
  if(
    ballPos.z - BALL_RADIUS <= bz &&
    ballPos.z + BALL_RADIUS >= bz - 0.18 &&
    ballPos.x >= bxMin && ballPos.x <= bxMax &&
    ballPos.y >= byMin && ballPos.y <= byMax
  ){
    ballVel.z = Math.abs(ballVel.z)*0.50;
    ballPos.z = bz + BALL_RADIUS + 0.01;
  }
}

function handleBallRim(dt){
  const rimX=HOOP_X, rimZ=HOOP_Z, rimY=HOOP_Y;
  const d2 = dist2D(ballPos.x, ballPos.z, rimX, rimZ);
  const distToRimEdge = Math.abs(d2 - RIM_RADIUS);

  if(Math.abs(ballPos.y - rimY) < BALL_RADIUS+0.15 && distToRimEdge < BALL_RADIUS+0.10){
    // Accumulate contact time — if stuck for > 0.4s, kill it
    ballRimContactTime += dt;
    if(ballRimContactTime > 0.4){
      ballRimContactTime = 0;
      ballState = 'dead';
      return;
    }
    const dx=ballPos.x-rimX, dz=ballPos.z-rimZ;
    const len=Math.sqrt(dx*dx+dz*dz)||0.001;
    const nx=dx/len, nz=dz/len;
    const dot=ballVel.x*nx+ballVel.z*nz;
    // Weaker bounce off rim so it doesn't keep orbiting
    ballVel.x=(ballVel.x-2*dot*nx)*0.45;
    ballVel.z=(ballVel.z-2*dot*nz)*0.45;
    ballVel.y=Math.abs(ballVel.y)*0.38;
    ballPos.y=rimY+BALL_RADIUS+0.14;
  } else {
    ballRimContactTime = 0;
  }
}

function checkBasket(){
  const d2 = dist2D(ballPos.x, ballPos.z, HOOP_X, HOOP_Z);
  if(ballPos.y > HOOP_Y + BALL_RADIUS) ballWasAboveRim = true;
  if(
    ballWasAboveRim && ballVel.y < 0 &&
    ballPos.y < HOOP_Y + BALL_RADIUS && ballPos.y > HOOP_Y - 0.55 &&
    d2 < RIM_RADIUS * 0.72
  ){
    ballWasAboveRim = false;
    ballRimContactTime = 0;
    const pd = dist2D(playerPos.x, playerPos.z, HOOP_X, HOOP_Z);
    registerScore(pd > 7.5 ? 3 : 2);
    setTimeout(()=>{ ballState='dead'; }, 200);
  }
}

// ─── Ball position (held dribble + crossover) ─────────────────
function updateBallPosition(dt){
  if(ballState !== 'held'){
    if(ballMesh && ballState !== 'flying' && ballState !== 'dunking'){
      ballMesh.scale.set(1, 1, 1);
    }
    return;
  }

  if(crossoverActive){
    crossoverPhase += dt * 3.5;
    if(crossoverPhase >= 1){
      crossoverActive = false;
      crossoverPhase  = 0;
      dribbleHand     = crossoverTo;
      dribbleLblEl.textContent = dribbleHand === 'right' ? '▶ RIGHT' : '◀ LEFT';
      dribblePhase = 0;
    }
    const fromAnchor = crossoverFrom === 'right' ? playerBallAnchorR : playerBallAnchorL;
    const toAnchor   = crossoverFrom === 'right' ? playerBallAnchorL : playerBallAnchorR;
    const fromWP = new THREE.Vector3();
    const toWP = new THREE.Vector3();
    fromAnchor.getWorldPosition(fromWP);
    toAnchor.getWorldPosition(toWP);
    const t = crossoverPhase;
    const midDip = Math.sin(t * Math.PI);
    const floorY = FLOOR_Y + BALL_RADIUS;
    ballPos.x = lerp(fromWP.x, toWP.x, t);
    ballPos.z = lerp(fromWP.z, toWP.z, t);
    const handY = lerp(fromWP.y, toWP.y, t);
    ballPos.y = lerp(handY, floorY, midDip * 0.88);
    ballMesh.position.set(ballPos.x, ballPos.y, ballPos.z);
    const squash = lerp(1.0, 0.72, midDip);
    ballMesh.scale.set(lerp(1, 1.25, midDip), squash, lerp(1, 1.25, midDip));
    if(pArmR) pArmR.rotation.x = lerp(0.4, -0.1, t);
    if(pArmL) pArmL.rotation.x = lerp(-0.1, 0.4, t);
    if(pBody) pBody.rotation.z = lerp(pBody.rotation.z, (crossoverFrom === 'right' ? 1 : -1) * 0.12 * Math.sin(t * Math.PI), 0.25);
    return;
  }

  const moving = Math.abs(playerVel.x) + Math.abs(playerVel.z) > 0.5;
  const speedMult = moving ? 1.06 : 0.94;
  dribblePhase = (dribblePhase + clamp(dt * dribbleSpeed * speedMult, 0, 0.06)) % 1;

  const heightNorm = dribbleHeightFromPhase(dribblePhase);
  const handPos = new THREE.Vector3();
  getHandAnchor().getWorldPosition(handPos);
  const floorY = FLOOR_Y + BALL_RADIUS;
  const apexY = floorY + DRIBBLE_HEIGHT;
  const handApexY = Math.max(apexY, handPos.y, FLOOR_Y + BALL_STAND_Y * 0.55);

  ballPos.x = handPos.x;
  ballPos.y = lerp(floorY, handApexY, heightNorm);
  ballPos.z = handPos.z;
  ballMesh.position.set(ballPos.x, ballPos.y, ballPos.z);

  const impactDist = Math.abs(dribblePhase - 0.5);
  if(impactDist < 0.06){
    const impactT = 1 - impactDist / 0.06;
    ballMesh.scale.set(
      lerp(1, 1.25, impactT),
      lerp(1, 0.72, impactT),
      lerp(1, 1.25, impactT)
    );
  } else {
    ballMesh.scale.set(1, 1, 1);
  }

  if(isOnBallGrounded()){
    applyDribbleArmPose(heightNorm, dribblePhase);
  }
}

// ─── Score / Feedback ────────────────────────────────────────
function registerScore(pts){
  score += pts;
  scoreEl.textContent = padNum(score);
  const labels = { 2:'2 PTS! 🏀', 3:'3 PTS! 🔥' };
  showFeedback(labels[pts] || pts+' PTS!');
}

function showFeedback(msg){
  if(feedbackTimeout) clearTimeout(feedbackTimeout);
  feedbackEl.textContent = msg;
  feedbackEl.classList.remove('show');
  void feedbackEl.offsetWidth;
  feedbackEl.classList.add('show');
  feedbackTimeout = setTimeout(()=> feedbackEl.classList.remove('show'), 1300);
}

// ─── Camera ─────────────────────────────────────────────────
function updateCamera(dt){
  // Stay directly behind and above the player, looking toward the hoop
  const camOffsetX = playerPos.x;           // track player X fully
  const camOffsetZ = playerPos.z + 13;      // fixed distance behind
  const camOffsetY = playerPos.y + 7;

  camTargetPos.set(camOffsetX, camOffsetY, camOffsetZ);
  camCurrentPos.lerp(camTargetPos, clamp(dt * 6, 0, 1));
  camera.position.copy(camCurrentPos);

  // Look at the player (slightly above feet), drifting a bit toward hoop
  camera.lookAt(
    lerp(playerPos.x, HOOP_X, 0.15),
    playerPos.y + 1.2 - stanceDropY * 0.85,
    lerp(playerPos.z, HOOP_Z, 0.25)
  );
}

// ─── Physics Step ────────────────────────────────────────────
function physicsStep(dt){
  if(!gameActive || isCustomizeOpen()) return;

  let mx=0, mz=0;
  if(keys['KeyW']||keys['ArrowUp'])    mz=-1;
  if(keys['KeyS']||keys['ArrowDown'])  mz= 1;
  if(keys['KeyA']||keys['ArrowLeft'])  mx=-1;
  if(keys['KeyD']||keys['ArrowRight']) mx= 1;
  const mLen = Math.sqrt(mx*mx+mz*mz);
  if(mLen > 0 && !playerStealActive){ mx /= mLen; mz /= mLen; }

  if(playerStealActive){
    playerVel.x = 0;
    playerVel.z = 0;
  } else {
    playerVel.x = mx * PLAYER_SPEED;
    playerVel.z = mz * PLAYER_SPEED;
  }

  if(!playerOnGround) playerVel.y += GRAVITY*dt;

  playerPos.x += playerVel.x*dt;
  playerPos.y += playerVel.y*dt;
  playerPos.z += playerVel.z*dt;

  playerPos.x = clamp(playerPos.x, -18, 18);
  playerPos.z = clamp(playerPos.z, -28, 14);

  if(playerPos.y <= FLOOR_Y){
    playerPos.y = FLOOR_Y;
    playerVel.y = 0;
    playerOnGround = true;
    jumpCount = 0;
  }

  playerGroup.position.set(playerPos.x, playerPos.y, playerPos.z);

  // Player always faces the hoop
  const toHoop = Math.atan2(HOOP_X - playerPos.x, HOOP_Z - playerPos.z);
  const diff   = ((toHoop - playerFacing + Math.PI) % (Math.PI*2)) - Math.PI;
  playerFacing += diff * clamp(dt*10, 0, 1);
  playerGroup.rotation.y = playerFacing;

  // ── Animation state machine
  animTimer += dt;
  const moving = mLen > 0.1;

  // Transition logic
  if(dunkActive){
    animState = 'dunk';
  } else if(shotCharging){
    animState = 'shoot';
  } else if(playerStealActive || stealAnimTimer > 0){
    animState = 'steal';
    if(!playerStealActive) stealAnimTimer = Math.max(0, stealAnimTimer - dt);
  } else if(!playerOnGround){
    animState = 'jump';
  } else if(moving){
    animState = 'run';
  } else {
    animState = 'idle';
  }

  // ── Target pose per state  (all angles in radians)
  let tgt = { torsoX:0, torsoZ:0, headX:0, headZ:0,
              armLX:0, armLZ:0.28, armRX:0, armRZ:-0.28,
              elbLX:0, elbRX:0,
              legLX:0, legRX:0, kneeLX:0, kneeRX:0 };
  const T = animTimer;

  if(animState === 'idle'){
    const breathe = Math.sin(T * 1.2) * 0.022;
    const sway = Math.sin(T * 0.75) * 0.035;
    const crouch = onBallCrouch;
    const ready = offBallCrouch;
    tgt.torsoX  = breathe - 0.12 * crouch - 0.04 * ready;
    tgt.torsoZ  = sway;
    tgt.headZ   = -sway * 0.45;
    tgt.kneeLX  = -0.06 - 0.28 * crouch - 0.14 * ready;
    tgt.kneeRX  = -0.06 - 0.28 * crouch - 0.14 * ready;
    if(ballState !== 'held'){
      tgt.armLX   = -0.38 - 0.08 * ready;
      tgt.armLZ   =  0.50 + 0.06 * ready;
      tgt.armRX   = -0.38 - 0.08 * ready;
      tgt.armRZ   = -0.50 - 0.06 * ready;
      tgt.elbLX   = -0.88 * ready - 0.18 * (1 - ready);
      tgt.elbRX   = -0.88 * ready - 0.18 * (1 - ready);
    }
  }

  if(animState === 'run'){
    const speed = Math.sqrt(playerVel.x * playerVel.x + playerVel.z * playerVel.z);
    const cycle = T * (5.5 + speed * 0.45);
    const legSwing = 0.62, kneeSwing = 0.52;
    const contactL = Math.max(0, Math.sin(cycle));
    const contactR = Math.max(0, Math.sin(cycle + Math.PI));
    const crouch = onBallCrouch;
    const ready = offBallCrouch;
    tgt.legLX  =  Math.sin(cycle) * legSwing + 0.08 * crouch + 0.04 * ready;
    tgt.legRX  =  Math.sin(cycle + Math.PI) * legSwing + 0.08 * crouch + 0.04 * ready;
    tgt.kneeLX = -Math.abs(Math.sin(cycle)) * kneeSwing - contactL * 0.08 - 0.24 * crouch - 0.12 * ready;
    tgt.kneeRX = -Math.abs(Math.sin(cycle + Math.PI)) * kneeSwing - contactR * 0.08 - 0.24 * crouch - 0.12 * ready;
    if(ballState !== 'held'){
      tgt.armLX = -0.40 - 0.06 * ready;
      tgt.armLZ =  0.48 + 0.05 * ready;
      tgt.armRX = -0.40 - 0.06 * ready;
      tgt.armRZ = -0.48 - 0.05 * ready;
      tgt.elbLX = -0.85 * ready - 0.20 * (1 - ready);
      tgt.elbRX = -0.85 * ready - 0.20 * (1 - ready);
    }
    tgt.torsoX  = -0.14 - Math.max(contactL, contactR) * 0.05 - 0.12 * crouch - 0.04 * ready;
    tgt.torsoZ  = Math.sin(cycle) * 0.06;
    tgt.headX   = Math.sin(cycle * 2) * 0.04;
    tgt.headZ   = -tgt.torsoZ * 0.35;
  }

  if(animState === 'jump'){
    const airT = clamp(-playerVel.y / JUMP_FORCE, -1, 1); // -1 = rising, +1 = falling
    if(airT < 0){
      // Rising: tuck knees up, arms raise
      const tuck = clamp(-airT, 0, 1);
      tgt.legLX  = -0.45 * tuck;
      tgt.legRX  = -0.45 * tuck;
      tgt.kneeLX = -0.55 * tuck;
      tgt.kneeRX = -0.55 * tuck;
      tgt.armLX  = -0.8 * tuck;
      tgt.armRX  = -0.8 * tuck;
      tgt.armLZ  =  0.15;
      tgt.armRZ  = -0.15;
      tgt.torsoX = -0.12 * tuck;
    } else {
      // Falling: extend legs to land
      const ext = clamp(airT, 0, 1);
      tgt.legLX  =  0.20 * ext;
      tgt.legRX  =  0.20 * ext;
      tgt.kneeLX = -0.20 * ext;
      tgt.kneeRX = -0.20 * ext;
      tgt.armLX  = -0.20;
      tgt.armRX  = -0.20;
      tgt.torsoX =  0.06 * ext;
    }
    // On just landing — brief squat
    if(playerOnGround && animTimer < 0.18){
      tgt.kneeLX = -0.5;
      tgt.kneeRX = -0.5;
      tgt.torsoX =  0.12;
    }
  }

  if(animState === 'shoot'){
    // Wind-up: gather ball hand up, weight shifts back then forward
    const charge = clamp(shotPower/100, 0, 1);
    const shootSide = dribbleHand === 'right' ? 1 : -1;
    // Shooting arm: wind back at low charge, raise fully at release
    tgt.armRX  = -0.30 - charge*1.0;
    tgt.elbRX  = -0.30 - charge*0.6;
    tgt.armLX  = -0.15;
    tgt.elbLX  =  0.20;  // guide hand
    tgt.armLZ  =  0.40;
    tgt.armRZ  = -0.20;
    tgt.torsoX = -0.10 - charge*0.12;  // lean forward into shot
    tgt.legLX  = -0.10;
    tgt.legRX  = -0.10;
    tgt.kneeLX = -0.25 - charge*0.15;
    tgt.kneeRX = -0.25 - charge*0.15;
  }

  if(animState === 'dunk'){
    // Both arms sweep up and over — dunkPhase 0→1
    const dp = dunkPhase;
    const reach = Math.sin(dp*Math.PI);
    tgt.armLX  = -1.2 * reach - 0.4*(1-reach);
    tgt.armRX  = -2.0 * dp;           // shooting arm fully extends
    tgt.elbRX  = -0.6 * reach;
    tgt.elbLX  = -0.4 * reach;
    tgt.armLZ  = 0.20;
    tgt.armRZ  = -0.20;
    tgt.torsoX = -0.20 - dp*0.25;     // lean over the rim
    tgt.legLX  = -0.40 * Math.sin(dp*Math.PI*0.8);
    tgt.legRX  = -0.30 * Math.sin(dp*Math.PI*0.8);
    tgt.kneeLX = -0.40;
    tgt.kneeRX = -0.35;
  }

  if(animState === 'steal'){
    if(playerStealActive){
      const t = clamp(playerStealPhase, 0, 1);
      const reach = Math.sin(t * Math.PI * 0.95);
      tgt.torsoX = 0.18 + t * 0.14;
      tgt.torsoZ = -0.08;
      tgt.kneeLX = -0.42 - t * 0.28;
      tgt.kneeRX = -0.38 - t * 0.22;
      tgt.armRX  = -0.15 - reach * 1.05;
      tgt.elbRX  = -0.08 - reach * 0.85;
      tgt.armRZ  = -0.35 - reach * 0.55;
      tgt.armLX  = 0.25;
      tgt.elbLX  = -0.35;
    } else {
      const swipeT = stealAnimTimer > 0 ? 1 - stealAnimTimer / 0.45 : 1;
      const swipe = Math.sin(clamp(swipeT, 0, 1) * Math.PI);
      tgt.armRX  = -0.6 * swipe;
      tgt.elbRX  = -0.55 * swipe;
      tgt.armRZ  = -0.65 * swipe;
      tgt.torsoZ = -0.18 * swipe;
      tgt.kneeLX = -0.25 * swipe;
      tgt.kneeRX = -0.22 * swipe;
    }
  }

  // ── Smooth joint rotations toward target (spring-like lerp)
  const spd = 14 * dt;

  function jLerp(key, val){ jRot[key] = lerp(jRot[key], val, clamp(spd, 0, 1)); }
  jLerp('torsoX', tgt.torsoX); jLerp('torsoZ', tgt.torsoZ);
  jLerp('headX',  tgt.headX);  jLerp('headZ',  tgt.headZ);
  jLerp('armLX',  tgt.armLX);  jLerp('armLZ',  tgt.armLZ);
  jLerp('armRX',  tgt.armRX);  jLerp('armRZ',  tgt.armRZ);
  jLerp('elbLX',  tgt.elbLX);  jLerp('elbRX',  tgt.elbRX);
  jLerp('legLX',  tgt.legLX);  jLerp('legRX',  tgt.legRX);

  const kSpd = clamp(18 * dt, 0, 1);
  jRot.legLZ = lerp(jRot.legLZ, tgt.kneeLX, kSpd);
  jRot.legRZ = lerp(jRot.legRZ, tgt.kneeRX, kSpd);

  if(pBody){
    pBody.rotation.x = jRot.torsoX;
    pBody.rotation.z = jRot.torsoZ;
  }
  if(pHead){
    pHead.rotation.x = lerp(pHead.rotation.x, -jRot.torsoX * 0.35 - 0.04 + jRot.headX, clamp(10 * dt, 0, 1));
    pHead.rotation.z = lerp(pHead.rotation.z, jRot.headZ, clamp(10 * dt, 0, 1));
  }
  if(pArmL){
    pArmL.rotation.x = jRot.armLX;
    pArmL.rotation.z = jRot.armLZ;
  }
  if(pArmR){
    pArmR.rotation.x = jRot.armRX;
    pArmR.rotation.z = jRot.armRZ;
  }
  if(pElbowL) pElbowL.rotation.x = jRot.elbLX;
  if(pElbowR) pElbowR.rotation.x = jRot.elbRX;
  if(pLegL){ pLegL.rotation.x = jRot.legLX; }
  if(pLegR){ pLegR.rotation.x = jRot.legRX; }
  if(pKneeL) pKneeL.rotation.x = jRot.legLZ;
  if(pKneeR) pKneeR.rotation.x = jRot.legRZ;

  stealCooldown = Math.max(0, stealCooldown - dt);

  updatePlayerSteal(dt);
  updateBallPosition(dt);
  applyPlayerRootStance(dt);
  updateDunk(dt);
  updateAI(dt);
  updateShotMeter(dt);

  // Ball physics when flying
  if(ballState === 'flying'){
    ballVel.y += GRAVITY*dt;
    ballPos.x += ballVel.x*dt;
    ballPos.y += ballVel.y*dt;
    ballPos.z += ballVel.z*dt;
    ballMesh.rotation.x += dt*4;
    ballMesh.rotation.z += dt*1.5;
    ballMesh.scale.set(1,1,1);
    handleBallFloor();
    handleBallBackboard();
    handleBallRim(dt);
    checkBasket();
    if(Math.abs(ballPos.x)>22||Math.abs(ballPos.z)>32||ballPos.y<FLOOR_Y-2) ballState='dead';
    ballMesh.position.set(ballPos.x,ballPos.y,ballPos.z);
  } else if(ballState === 'dead'){
    const wp = new THREE.Vector3();
    getHandAnchor().getWorldPosition(wp);
    // Fast magnetic return
    const returnSpeed = clamp(dt*14, 0, 1);
    ballPos.x = lerp(ballPos.x, wp.x, returnSpeed);
    ballPos.y = lerp(ballPos.y, wp.y, returnSpeed);
    ballPos.z = lerp(ballPos.z, wp.z, returnSpeed);
    ballMesh.position.set(ballPos.x,ballPos.y,ballPos.z);
    ballMesh.scale.set(1,1,1);
    const rd = vecLen({x:ballPos.x-wp.x,y:ballPos.y-wp.y,z:ballPos.z-wp.z});
    if(rd<0.25){ ballState='held'; ballVel={x:0,y:0,z:0}; ballWasAboveRim=false; ballRimContactTime=0; }
  }

  // AI zone prompt
  if(inAIZone() && !aiActive){
    aiZonePromptEl.classList.remove('hidden');
  } else {
    aiZonePromptEl.classList.add('hidden');
  }

  // AI zone mesh pulse
  if(aiZoneMesh){
    aiZoneMesh.material.opacity = 0.12 + Math.sin(clock.getElapsedTime()*2)*0.06;
  }

  // Copy prev keys
  prevKeys = Object.assign({}, keys);
}

// ─── Timer ──────────────────────────────────────────────────
function updateTimer(dt){
  if(!gameActive) return;
  timerAccum += dt;
  if(timerAccum >= 1){
    timerAccum -= 1;
    timeLeft = Math.max(0, timeLeft-1);
    timerEl.textContent = padNum(timeLeft);
    if(timeLeft<=10) timerEl.classList.add('warning');
    if(timeLeft<=0)  endGame();
  }
}

// ─── Customization ──────────────────────────────────────────
function openCustomization(){
  if(shotCharging){
    shotCharging = false;
    shotWrapEl.classList.add('hidden');
  }
  customScreenEl.classList.remove('hidden');
}

function closeCustomization(){
  customScreenEl.classList.add('hidden');
}

function applyCustomization(){
  // Remove old player
  if(playerGroup) scene.remove(playerGroup);
  skinMeshes=[]; jerseyMeshes=[]; shoeMeshes=[];
  hairMesh=null; hatMesh=null; pFaceEl=null;
  buildPlayer();
  // Remove old ball mesh from scene before rebuilding
  if(ballMesh) scene.remove(ballMesh);
  ballMesh = null;
  buildBall();
  // Keep ball in held state, snap to hand immediately
  ballState = 'held';
  ballVel = {x:0,y:0,z:0};
  ballWasAboveRim = false;
  ballRimContactTime = 0;
  snapBallToHand();
}

function initCustomizationUI(){
  document.querySelectorAll('.swatch, .opt-btn').forEach(el=>{
    el.addEventListener('click', ()=>{
      const cat = el.dataset.cat;
      const val = parseInt(el.dataset.val, 10);
      if(!cat || Number.isNaN(val)) return;
      custom[cat] = val;
      const group = el.closest('[id]');
      if(group){
        group.querySelectorAll('[data-cat="'+cat+'"]').forEach(s=> s.classList.remove('active'));
      }
      el.classList.add('active');
      applyCustomization();
    });
  });
  document.getElementById('custom-close').addEventListener('click', closeCustomization);
}

// ─── Tutorial ───────────────────────────────────────────────
let tutStep = 0;
function initTutorialUI(){
  const steps    = document.querySelectorAll('.tut-step');
  const dots     = document.querySelectorAll('.tut-dot');
  const prevBtn  = document.getElementById('tut-prev');
  const nextBtn  = document.getElementById('tut-next');
  const closeBtn = document.getElementById('tut-close');

  function goTo(n){
    tutStep = clamp(n, 0, steps.length-1);
    steps.forEach((s,i)=> s.classList.toggle('active', i===tutStep));
    dots.forEach((d,i)=>  d.classList.toggle('active', i===tutStep));
    prevBtn.disabled = tutStep===0;
    nextBtn.textContent = tutStep===steps.length-1 ? 'DONE ▶' : 'NEXT ▶';
  }

  prevBtn.addEventListener('click', ()=> goTo(tutStep-1));
  nextBtn.addEventListener('click', ()=>{
    if(tutStep < steps.length-1) goTo(tutStep+1);
    else finishTutorial();
  });
  closeBtn.addEventListener('click', finishTutorial);
  goTo(0);
}

function openTutorial(){
  tutScreenEl.classList.remove('hidden');
  startScreenEl.classList.add('hidden');
}

function closeTutorial(){
  tutScreenEl.classList.add('hidden');
  startScreenEl.classList.remove('hidden');
}

function finishTutorial(){
  tutScreenEl.classList.add('hidden');
  startScreenEl.classList.add('hidden');
  startGame();
}

// ─── Game State ─────────────────────────────────────────────
function startGame(){
  score=0; timeLeft=GAME_DURATION; timerAccum=0;
  gameActive=true; lastTimestamp=null;
  playerPos={x:0,y:FLOOR_Y,z:5};
  playerVel={x:0,y:0,z:0};
  playerOnGround=true; jumpCount=0;
  playerFacing=0;
  ballState='held'; ballVel={x:0,y:0,z:0};
  ballWasAboveRim=false; ballBounces=0;
  dunkActive=false; dunkPhase=0;
  shotCharging=false;
  shotWrapEl.classList.add('hidden');
  playerStealActive=false;
  playerStealPhase=0;
  stealAnimTimer=0;
  dribbleHand='right';
  dribblePhase=0;
  onBallCrouch=0;
  offBallCrouch=0;
  stanceDropY=0;
  dribbleLblEl.textContent='▶ RIGHT';
  removeAI();
  scoreEl.textContent='00';
  timerEl.textContent=padNum(GAME_DURATION);
  timerEl.classList.remove('warning');
  feedbackEl.classList.remove('show');
  startScreenEl.classList.add('hidden');
  gameoverEl.classList.add('hidden');
  customScreenEl.classList.add('hidden');
}

function endGame(){
  gameActive=false;
  if(shotCharging){ shotCharging=false; shotWrapEl.classList.add('hidden'); }
  removeAI();
  finalScoreEl.textContent=padNum(score);
  let rank='';
  if(score===0)       rank='GAME ZERO...';
  else if(score<4)    rank='ROOKIE';
  else if(score<8)    rank='BALLER';
  else if(score<14)   rank='ALL-STAR ⭐';
  else if(score<20)   rank='MVP 🏆';
  else                rank='LEGEND 🔥🔥🔥';
  rankEl.textContent=rank;
  gameoverEl.classList.remove('hidden');
}

// ─── Game Loop ───────────────────────────────────────────────
let gameLoopStarted = false;

function ensureGameLoop(){
  if(gameLoopStarted) return;
  gameLoopStarted = true;
  requestAnimationFrame(gameLoop);
}

function gameLoop(ts){
  requestAnimationFrame(gameLoop);
  if(!gameActive){
    renderer.render(scene,camera);
    return;
  }
  if(!lastTimestamp) lastTimestamp=ts;
  let dt = Math.min((ts-lastTimestamp)/1000, 0.05);
  lastTimestamp=ts;
  physicsStep(dt);
  updateTimer(dt);
  updateCamera(dt);
  renderer.render(scene,camera);
}

// ─── Bootstrap ───────────────────────────────────────────────
function init(){
  initThree();
  buildLighting();
  buildCourt();
  buildHoop();
  buildPlayer();
  buildBall();
  buildStarfield();
  initInput();
  initCustomizationUI();
  initTutorialUI();

  camera.position.set(0,10,20);
  camera.lookAt(0,HOOP_Y,HOOP_Z);
  renderer.render(scene,camera);

  ensureGameLoop();

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);
  document.getElementById('tutorial-btn').addEventListener('click', openTutorial);
}

window.addEventListener('DOMContentLoaded', init);
