const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const menu = document.getElementById("menu");
const playBtn = document.getElementById("playBtn");

const gameOverScreen = document.getElementById("gameOver");
const restartBtn = document.getElementById("restartBtn");
const finalScore = document.getElementById("finalScore");
const highScoreText = document.getElementById("highScore");
const bestScore = document.getElementById("bestScore");

let gameRunning = false;
let audioCtx;
let highScore = 0;

let bird, pipes, score, gravity, lift, clouds;

function initGame() {
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
    score = 0;
    clouds = Array.from({ length: 5 }, (_, i) => ({
        x: Math.random() * canvas.width,
        y: 40 + Math.random() * 140,
        size: 18 + Math.random() * 22,
        speed: 0.2 + Math.random() * 0.4,
        alpha: 0.55 + Math.random() * 0.15
    }));

    gravity = 0.3;
    lift = -6.5;

    gameOverScreen.style.display = "none";
}

function loadHighScore() {
    highScore = 0;
    if (highScoreText) {
        highScoreText.textContent = "High Score: " + highScore;
    }
}

function saveHighScore() {
    // High score persistence disabled; score resets whenever the game is opened.
}

function playDeathSound() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioCtx) {
        audioCtx = new AudioCtx();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "triangle";
    osc.frequency.value = 180;
    gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
}

function startGame() {
    menu.style.display = "none";
    initGame();
    gameRunning = true;
    loop();
}

function spawnPipe() {
    const gap = 140;
    const top = Math.random() * (canvas.height - gap - 100) + 50;

    pipes.push({
        x: canvas.width,
        width: 50,
        top: top,
        gap: gap,
        passed: false
    });
}

function update() {
    bird.velocity += gravity;
    bird.y += bird.velocity;
    bird.wingAngle += 0.25;
    bird.rotation = Math.max(Math.min(bird.velocity * 0.08, 0.6), -0.6);

    clouds.forEach(cloud => {
        cloud.x -= cloud.speed;
        if (cloud.x + cloud.size * 3 < 0) {
            cloud.x = canvas.width + 30;
            cloud.y = 30 + Math.random() * 140;
        }
    });

    // floor / ceiling collision
    if (bird.y + bird.height > canvas.height || bird.y < 0) {
        gameOver();
    }

    // pipes movement
    for (let p of pipes) {
        p.x -= 2;

        // scoring
        if (!p.passed && p.x + p.width < bird.x) {
            score++;
            p.passed = true;
        }

        // collision detection
        if (
            bird.x < p.x + p.width &&
            bird.x + bird.width > p.x &&
            (bird.y < p.top || bird.y + bird.height > p.top + p.gap)
        ) {
            gameOver();
        }
    }

    // remove offscreen pipes
    pipes = pipes.filter(p => p.x + p.width > 0);

    // spawn pipes
    if (pipes.length === 0 || pipes[pipes.length - 1].x < 200) {
        spawnPipe();
    }
}

function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, "#8be8ff");
    sky.addColorStop(0.45, "#b7efff");
    sky.addColorStop(0.75, "#ffe8b8");
    sky.addColorStop(1, "#ffd6a5");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    for (let i = 0; i < 4; i++) {
        ctx.fillRect(i * 95, 110 + (i % 2) * 25, 70, 18);
    }
}

function drawClouds() {
    clouds.forEach(cloud => {
        ctx.save();
        ctx.globalAlpha = cloud.alpha;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.size * 0.9, cloud.y - cloud.size * 0.4, cloud.size * 0.8, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.size * 1.8, cloud.y, cloud.size * 0.9, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    });
}

function drawPipes() {
    for (let p of pipes) {
        ctx.fillStyle = "#56c93f";
        ctx.fillRect(p.x, 0, p.width, p.top);
        ctx.fillRect(p.x, p.top + p.gap, p.width, canvas.height - (p.top + p.gap));

        ctx.fillStyle = "#2f9b36";
        ctx.fillRect(p.x - 4, p.top - 18, p.width + 8, 18);
        ctx.fillRect(p.x - 4, p.top + p.gap, p.width + 8, 18);

        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(p.x + 6, 6, 8, p.top - 24);
        ctx.fillRect(p.x + 6, p.top + p.gap + 24, 8, canvas.height - p.top - p.gap - 24);
    }
}

function drawBird() {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rotation);

    const wingFlap = Math.sin(bird.wingAngle) * 4;

    // body
    ctx.fillStyle = "#f2c94c";
    ctx.beginPath();
    ctx.ellipse(10, 10, 12, 9, -0.25, 0, Math.PI * 2);
    ctx.fill();

    // wing
    ctx.fillStyle = "#d8a52d";
    ctx.beginPath();
    ctx.moveTo(6, 10);
    ctx.lineTo(-2, 3 + wingFlap);
    ctx.lineTo(5, -3 + wingFlap);
    ctx.closePath();
    ctx.fill();

    // tail
    ctx.fillStyle = "#8b5e34";
    ctx.fillRect(-10, 8, 8, 4);

    // head
    ctx.fillStyle = "#ffe08a";
    ctx.beginPath();
    ctx.arc(18, 5, 5, 0, Math.PI * 2);
    ctx.fill();

    // beak
    ctx.fillStyle = "#ff8c42";
    ctx.beginPath();
    ctx.moveTo(22, 6);
    ctx.lineTo(32, 8);
    ctx.lineTo(22, 11);
    ctx.closePath();
    ctx.fill();

    // eye
    ctx.fillStyle = "#000";
    ctx.fillRect(20, 3, 2, 2);

    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawSky();
    drawClouds();
    drawPipes();
    drawBird();

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, "#ff5f6d");
    gradient.addColorStop(0.25, "#ffbe4c");
    gradient.addColorStop(0.5, "#6fd1ff");
    gradient.addColorStop(0.75, "#c576ff");
    gradient.addColorStop(1, "#ff5f6d");

    ctx.fillStyle = gradient;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 2;
    ctx.font = "22px Arial";
    ctx.textBaseline = "top";
    ctx.strokeText("Score: " + score, 10, 30);
    ctx.fillText("Score: " + score, 10, 30);
    ctx.strokeText("High: " + highScore, canvas.width - 128, 30);
    ctx.fillText("High: " + highScore, canvas.width - 128, 30);
}

function loop() {
    if (!gameRunning) return;
    update();
    draw();
    requestAnimationFrame(loop);
}

function flap() {
    bird.velocity = lift;
}

function gameOver() {
    gameRunning = false;
    if (score > highScore) {
        highScore = score;
        saveHighScore();
    }
    if (highScoreText) {
        highScoreText.textContent = "High Score: " + highScore;
    }
    if (bestScore) {
        bestScore.textContent = "Best: " + highScore;
    }
    playDeathSound();
    gameOverScreen.style.display = "flex";
    finalScore.textContent = "Score: " + score;
}

// controls
document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && gameRunning) flap();
});

canvas.addEventListener("click", () => {
    if (gameRunning) flap();
});

// buttons
playBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);

// show menu initially
menu.style.display = "flex";
loadHighScore();
initGame();
draw();