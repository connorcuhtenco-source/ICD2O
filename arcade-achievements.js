(function () {
    const STORAGE_KEY = 'arcadeAchievements';

    const DETAILS = {
        tank: {
            id: 'tank',
            name: 'Tank',
            description: 'Kill 5 brawlers without dying as Juggernaut in Water Royale.',
            icon: '🛡️'
        },
        untouchable: {
            id: 'untouchable',
            name: 'Untouchable',
            description: 'Defeat a boss without taking damage in Neon Kill.',
            icon: '✨'
        }
    };

    function loadUnlocked() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return new Set(Array.isArray(saved) ? saved : []);
        } catch {
            return new Set();
        }
    }

    function saveUnlocked(unlocked) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...unlocked]));
    }

    function ensureToastStyles() {
        if (document.getElementById('arcadeAchievementToastStyles')) return;
        const style = document.createElement('style');
        style.id = 'arcadeAchievementToastStyles';
        style.textContent = `
            .achievement-toast-host {
                position: fixed;
                top: 24px;
                right: 24px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 12px;
                pointer-events: none;
            }
            .achievement-toast {
                min-width: 260px;
                max-width: 360px;
                padding: 14px 16px;
                border: 1px solid rgba(126, 231, 255, 0.45);
                background: rgba(8, 16, 28, 0.92);
                color: #eef8ff;
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
                opacity: 0;
                transform: translateY(-8px);
                transition: opacity 0.28s ease, transform 0.28s ease;
                font-family: 'Courier New', Courier, monospace;
            }
            .achievement-toast.visible {
                opacity: 1;
                transform: translateY(0);
            }
            .achievement-toast h4 {
                margin: 0 0 6px;
                font-size: 0.78rem;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: #7ee7ff;
            }
            .achievement-toast p {
                margin: 0;
                font-size: 0.92rem;
                line-height: 1.35;
            }
        `;
        document.head.appendChild(style);
    }

    function ensureToastHost() {
        ensureToastStyles();
        let host = document.getElementById('achievementToastHost');
        if (host) return host;

        host = document.createElement('div');
        host.id = 'achievementToastHost';
        host.className = 'achievement-toast-host';
        document.body.appendChild(host);
        return host;
    }

    function showToast(achievement) {
        const host = ensureToastHost();
        const toast = document.createElement('div');
        toast.className = 'achievement-toast';
        toast.innerHTML = `
            <h4>${achievement.icon} Achievement Unlocked</h4>
            <p><strong>${achievement.name}</strong> — ${achievement.description}</p>
        `;
        host.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('visible'));
        window.setTimeout(() => {
            toast.classList.remove('visible');
            window.setTimeout(() => toast.remove(), 320);
        }, 3800);
    }

    function unlock(id) {
        const unlocked = loadUnlocked();
        if (unlocked.has(id)) return false;
        unlocked.add(id);
        saveUnlocked(unlocked);

        const achievement = DETAILS[id];
        if (achievement) showToast(achievement);
        return true;
    }

    function has(id) {
        return loadUnlocked().has(id);
    }

    const api = window.ArcadeAchievements || {};
    api.unlock = unlock;
    api.has = has;
    window.ArcadeAchievements = api;
})();
