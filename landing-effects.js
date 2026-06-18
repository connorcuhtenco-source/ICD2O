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
    let animationId = null;
    let playSound = () => {};
    let bootPlayed = false;
    let mouse = { x: -1000, y: -1000 };

    const stars = [];
    const particles = [];
    const trail = [];

    function isLandingVisible() {
        const menu = document.getElementById('menu');
        return menu && !menu.classList.contains('hidden');
    }

    function resizeCanvases() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = window.innerWidth;
        const height = window.innerHeight;

        [landingCanvas, trailCanvas].forEach(canvas => {
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            const context = canvas.getContext('2d');
            context.setTransform(dpr, 0, 0, dpr, 0, 0);
        });
    }

    function initStars() {
        stars.length = 0;
        const count = Math.floor((window.innerWidth * window.innerHeight) / 9000);

        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                size: Math.random() * 1.8 + 0.4,
                speed: Math.random() * 0.18 + 0.04,
                alpha: Math.random() * 0.5 + 0.2,
                twinkle: Math.random() * Math.PI * 2
            });
        }
    }

    function initParticles() {
        particles.length = 0;
        const count = 42;

        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                vx: (Math.random() - 0.5) * 0.35,
                vy: (Math.random() - 0.5) * 0.35,
                radius: Math.random() * 2.2 + 1,
                hue: Math.random() < 0.5 ? 168 : 330
            });
        }
    }

    function buildTitleLetters() {
        landingTitle.innerHTML = '';

        [...TITLE_TEXT].forEach((char, index) => {
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

    function runBootSequence() {
        if (bootPlayed) return;
        bootPlayed = true;

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (reducedMotion) {
            landingTitle.querySelectorAll('.title-letter').forEach(letter => letter.classList.add('powered-on'));
            document.querySelectorAll('.landing-reveal').forEach((element, index) => {
                revealElement(element, index * 60);
            });
            bootOverlay.classList.add('boot-done');
            bootOverlay.classList.remove('active');
            return;
        }

        bootOverlay.classList.add('active');
        bootOverlay.classList.remove('boot-done');

        window.setTimeout(() => {
            bootOverlay.classList.add('boot-sweeping');
            playSound('powerOn');
        }, 350);

        const letters = landingTitle.querySelectorAll('.title-letter');

        letters.forEach((letter, index) => {
            window.setTimeout(() => {
                letter.classList.add('powered-on');
            }, 700 + index * LETTER_STAGGER_MS);
        });

        const lettersDone = 700 + letters.length * LETTER_STAGGER_MS + 200;

        window.setTimeout(() => {
            bootOverlay.classList.remove('boot-sweeping');
            bootOverlay.classList.add('boot-done');
            bootOverlay.classList.remove('active');
        }, lettersDone);

        document.querySelectorAll('.landing-reveal').forEach((element, index) => {
            revealElement(element, lettersDone + 150 + index * REVEAL_STAGGER_MS);
        });
    }

    function drawStars(time) {
        stars.forEach(star => {
            star.y += star.speed;
            if (star.y > window.innerHeight + 4) {
                star.y = -4;
                star.x = Math.random() * window.innerWidth;
            }

            const twinkle = 0.45 + Math.sin(time * 0.002 + star.twinkle) * 0.35;
            landingCtx.fillStyle = `rgba(220, 245, 255, ${star.alpha * twinkle})`;
            landingCtx.beginPath();
            landingCtx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            landingCtx.fill();
        });
    }

    function drawParticles() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const linkDistance = 130;

        particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;

            if (particle.x < 0 || particle.x > width) particle.vx *= -1;
            if (particle.y < 0 || particle.y > height) particle.vy *= -1;

            const dx = mouse.x - particle.x;
            const dy = mouse.y - particle.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 140 && dist > 0) {
                particle.x += (dx / dist) * 0.08;
                particle.y += (dy / dist) * 0.08;
            }
        });

        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const a = particles[i];
                const b = particles[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const distance = Math.hypot(dx, dy);

                if (distance < linkDistance) {
                    const alpha = (1 - distance / linkDistance) * 0.28;
                    landingCtx.strokeStyle = `rgba(0, 255, 204, ${alpha})`;
                    landingCtx.lineWidth = 1;
                    landingCtx.beginPath();
                    landingCtx.moveTo(a.x, a.y);
                    landingCtx.lineTo(b.x, b.y);
                    landingCtx.stroke();
                }
            }
        }

        particles.forEach(particle => {
            landingCtx.fillStyle = `hsla(${particle.hue}, 90%, 68%, 0.75)`;
            landingCtx.shadowColor = `hsla(${particle.hue}, 90%, 60%, 0.8)`;
            landingCtx.shadowBlur = 10;
            landingCtx.beginPath();
            landingCtx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            landingCtx.fill();
            landingCtx.shadowBlur = 0;
        });
    }

    function drawMouseTrail() {
        trailCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        if (mouse.x < 0) return;

        trail.push({ x: mouse.x, y: mouse.y, life: 1 });

        if (trail.length > 24) {
            trail.shift();
        }

        for (let i = trail.length - 1; i >= 0; i--) {
            const point = trail[i];
            point.life -= 0.06;

            if (point.life <= 0) {
                trail.splice(i, 1);
                continue;
            }

            const radius = 3 + (1 - point.life) * 8;
            trailCtx.fillStyle = `rgba(0, 255, 204, ${point.life * 0.35})`;
            trailCtx.beginPath();
            trailCtx.arc(point.x, point.y, radius, 0, Math.PI * 2);
            trailCtx.fill();

            if (i > 0) {
                const prev = trail[i - 1];
                trailCtx.strokeStyle = `rgba(255, 77, 141, ${point.life * 0.25})`;
                trailCtx.lineWidth = 2;
                trailCtx.beginPath();
                trailCtx.moveTo(prev.x, prev.y);
                trailCtx.lineTo(point.x, point.y);
                trailCtx.stroke();
            }
        }
    }

    function animate(time) {
        if (!isLandingVisible()) {
            animationId = requestAnimationFrame(animate);
            return;
        }

        landingCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        drawStars(time);
        drawParticles();
        drawMouseTrail();

        animationId = requestAnimationFrame(animate);
    }

    function setupButtonHovers() {
        let lastHoverSound = 0;

        document.querySelectorAll('.landing-btn').forEach(button => {
            button.addEventListener('mouseenter', () => {
                const now = Date.now();
                if (now - lastHoverSound > 120) {
                    playSound('hover');
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

        if (!landingCanvas || !trailCanvas || !bootOverlay || !landingTitle) return;

        playSound = soundFn || playSound;
        landingCtx = landingCanvas.getContext('2d');
        trailCtx = trailCanvas.getContext('2d');

        buildTitleLetters();
        resizeCanvases();
        initStars();
        initParticles();
        setupButtonHovers();
        runBootSequence();

        window.addEventListener('resize', () => {
            resizeCanvases();
            initStars();
            initParticles();
        });

        window.addEventListener('mousemove', event => {
            if (!isLandingVisible()) return;
            mouse.x = event.clientX;
            mouse.y = event.clientY;
        });

        window.addEventListener('mouseleave', () => {
            mouse.x = -1000;
            mouse.y = -1000;
        });

        if (!animationId) {
            animationId = requestAnimationFrame(animate);
        }
    }

    return { init };
})();
