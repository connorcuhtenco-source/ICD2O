const ArcadeMeta = (() => {
    const STORAGE_KEY = 'arcadeMeta';
    const PLAY_REWARD_SECONDS = 300;
    const PLAY_REWARD_TOKENS = 25;

    const TRAIL_STYLES = {
        'trail-cyan': { fill: 'rgba(0, 255, 204, {a})', stroke: 'rgba(255, 77, 141, {a})', preview: 'preview-trail-cyan' },
        'trail-pink': { fill: 'rgba(255, 77, 141, {a})', stroke: 'rgba(255, 230, 109, {a})', preview: 'preview-trail-pink' },
        'trail-gold': { fill: 'rgba(255, 230, 109, {a})', stroke: 'rgba(255, 140, 40, {a})', preview: 'preview-trail-gold' },
        'trail-purple': { fill: 'rgba(180, 100, 255, {a})', stroke: 'rgba(0, 255, 204, {a})', preview: 'preview-trail-purple' },
        'trail-green': { fill: 'rgba(100, 255, 120, {a})', stroke: 'rgba(74, 210, 255, {a})', preview: 'preview-trail-green' }
    };

    const SHOP_ITEMS = [
        { id: 'tag-time-accel', category: 'upgrade', name: 'Time Acceleration', price: 250, desc: 'Move faster while the level timer speeds up until the wave ends.', preview: 'preview-time-accel', icon: '⏩' },
        { id: 'space-shield', category: 'upgrade', name: 'Neon Shield', price: 300, desc: 'Smash through 10 asteroids with a neon barrier.', preview: 'preview-space-shield', icon: '🛡' },
        { id: 'kill-overclock-core', category: 'upgrade', name: 'Overclock Core', price: 150, desc: '+25% move and projectile speed in Neon Kill.', icon: '⚡' },
        { id: 'kill-siphon-nanites', category: 'upgrade', name: 'Siphon Nanites', price: 175, desc: 'Double health restored from defeat particles in Neon Kill.', icon: '💚' },
        { id: 'kill-slam-module', category: 'upgrade', name: 'Slam Module', price: 200, desc: 'Mid-air Space slams down with a shockwave in Neon Kill.', icon: '💥' },
        { id: 'trail-cyan', category: 'trail', name: 'Neon Cyan Trail', price: 0, desc: 'Classic cyan and pink neon mouse trail.', preview: 'preview-trail-cyan' },
        { id: 'trail-pink', category: 'trail', name: 'Hot Pink Trail', price: 75, desc: 'Magenta streaks with gold sparks.', preview: 'preview-trail-pink' },
        { id: 'trail-gold', category: 'trail', name: 'Gold Rush Trail', price: 100, desc: 'Golden arcade streaks behind your cursor.', preview: 'preview-trail-gold' },
        { id: 'trail-purple', category: 'trail', name: 'Violet Pulse Trail', price: 100, desc: 'Purple glow with cyan accents.', preview: 'preview-trail-purple' },
        { id: 'trail-green', category: 'trail', name: 'Toxic Green Trail', price: 90, desc: 'Radioactive green neon trail.', preview: 'preview-trail-green' },
        { id: 'theme-default', category: 'theme', name: 'Aurora Default', price: 0, desc: 'The classic Arcade Arena aurora look.', preview: 'preview-theme-default' },
        { id: 'theme-sunset', category: 'theme', name: 'Neon Sunset', price: 120, desc: 'Warm orange and magenta skies.', preview: 'preview-theme-sunset' },
        { id: 'theme-ocean', category: 'theme', name: 'Deep Ocean', price: 120, desc: 'Cool blue underwater neon vibes.', preview: 'preview-theme-ocean' },
        { id: 'theme-void', category: 'theme', name: 'Void Purple', price: 150, desc: 'Dark cosmic purple background.', preview: 'preview-theme-void' }
    ];

    const PROMO_CODES = {
        'FREECOINS!': 300
    };

    const DAILY_QUEST_POOL = [
        { id: 'tag-survive-120', text: 'Survive 2 minutes in Tag Zone', goal: 120, reward: 30, track: 'tagSurvivalRun' },
        { id: 'fast-eagle-50', text: 'Score 50 in Fast Eagle', goal: 50, reward: 25, track: 'fastEagleScore' },
        { id: 'tag-level-3', text: 'Reach level 3 in Tag Zone', goal: 3, reward: 35, track: 'tagLevel' },
        { id: 'play-180', text: 'Play any game for 3 minutes', goal: 180, reward: 20, track: 'playTime' },
        { id: 'space-score-30k', text: 'Score 30,000 in Space Runner', goal: 30000, reward: 40, track: 'spaceScore' }
    ];

    let state = null;
    let glitchPlaying = false;

    function todayKey() {
        return new Date().toISOString().slice(0, 10);
    }

    function defaultState() {
        return {
            tokens: 0,
            owned: ['trail-cyan', 'theme-default'],
            equipped: {
                trail: 'trail-cyan',
                theme: 'theme-default',
                tagTimeAccel: false,
                spaceShield: false,
                killOverclock: false,
                killSiphon: false,
                killSlam: false
            },
            daily: { date: '', quests: [] },
            playTimeAccumulator: 0,
            tagMatchCount: 0,
            redeemedPromoCodes: []
        };
    }

    function load() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            state = { ...defaultState(), ...saved };
            state.equipped = { ...defaultState().equipped, ...saved?.equipped };
            state.redeemedPromoCodes = Array.isArray(saved?.redeemedPromoCodes) ? saved.redeemedPromoCodes : [];
            ensureDailyQuests();
        } catch {
            state = defaultState();
            ensureDailyQuests();
        }
        syncOwnedUpgrades();
        applyTheme();
    }

    function syncOwnedUpgrades() {
        if (isOwned('tag-time-accel')) state.equipped.tagTimeAccel = true;
        if (isOwned('space-shield')) state.equipped.spaceShield = true;
        if (isOwned('kill-overclock-core')) state.equipped.killOverclock = true;
        if (isOwned('kill-siphon-nanites')) state.equipped.killSiphon = true;
        if (isOwned('kill-slam-module')) state.equipped.killSlam = true;
    }

    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function ensureDailyQuests() {
        if (state.daily.date === todayKey() && state.daily.quests.length) return;

        const shuffled = [...DAILY_QUEST_POOL].sort(() => Math.random() - 0.5);
        state.daily = {
            date: todayKey(),
            quests: shuffled.slice(0, 2).map(q => ({
                id: q.id,
                progress: 0,
                completed: false
            }))
        };
        save();
    }

    function getQuestDef(id) {
        return DAILY_QUEST_POOL.find(q => q.id === id);
    }

    function addTokens(amount, reason) {
        if (amount <= 0) return;
        state.tokens += amount;
        save();
        updateTokenDisplays();
        if (reason) showTokenToast(`+${amount} Arcade Tokens — ${reason}`);
    }

    function showTokenToast(message) {
        const host = document.getElementById('tokenToastHost');
        if (!host) return;
        const toast = document.createElement('div');
        toast.className = 'token-toast';
        toast.textContent = message;
        host.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('visible'));
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 2800);
    }

    function updateTokenDisplays() {
        document.querySelectorAll('.token-count').forEach(el => {
            el.textContent = String(state.tokens);
        });
    }

    function applyTheme() {
        document.body.classList.remove('theme-sunset', 'theme-ocean', 'theme-void');
        const theme = state.equipped.theme || 'theme-default';
        if (theme !== 'theme-default') {
            document.body.classList.add(theme);
        }
    }

    function getTrailStyle(alpha) {
        const id = state.equipped.trail || 'trail-cyan';
        const style = TRAIL_STYLES[id] || TRAIL_STYLES['trail-cyan'];
        const a = typeof alpha === 'number' ? alpha : 0.35;
        return {
            fill: style.fill.replace('{a}', String(a)),
            stroke: style.stroke.replace('{a}', String(Math.max(0.15, a * 0.7)))
        };
    }

    function isOwned(id) {
        return state.owned.includes(id);
    }

    function isEquipped(id) {
        const item = SHOP_ITEMS.find(i => i.id === id);
        if (!item) return false;
        if (item.category === 'trail') return state.equipped.trail === id;
        if (item.category === 'theme') return state.equipped.theme === id;
        if (id === 'tag-time-accel') return state.equipped.tagTimeAccel;
        if (id === 'space-shield') return state.equipped.spaceShield;
        if (id === 'kill-overclock-core') return state.equipped.killOverclock;
        if (id === 'kill-siphon-nanites') return state.equipped.killSiphon;
        if (id === 'kill-slam-module') return state.equipped.killSlam;
        return false;
    }

    function getItemsByCategory(category) {
        return SHOP_ITEMS.filter(item => item.category === category);
    }

    function getPowerUpItems() {
        return SHOP_ITEMS.filter(item => item.category === 'upgrade');
    }

    function renderPreview(item) {
        if (item.icon) {
            return `<span class="shop-preview-icon">${item.icon}</span>`;
        }
        return `<div class="shop-preview-art ${item.preview}"></div>`;
    }

    function renderShopAction(item) {
        const owned = isOwned(item.id);
        const equipped = isEquipped(item.id);

        if (owned && (item.category === 'trail' || item.category === 'theme')) {
            return equipped
                ? '<button class="shop-price-btn equipped" disabled>EQUIPPED</button>'
                : `<button class="shop-price-btn equip" data-equip="${item.id}">EQUIP</button>`;
        }

        if (owned && item.category === 'upgrade') {
            return equipped
                ? '<button class="shop-price-btn equipped" disabled>ENABLED</button>'
                : `<button class="shop-price-btn equip" data-equip="${item.id}">ENABLE</button>`;
        }

        if (owned || item.price === 0) {
            return '<button class="shop-price-btn owned" disabled>OWNED</button>';
        }

        const canBuy = state.tokens >= item.price;
        return `<button class="shop-price-btn buy" data-buy="${item.id}" ${canBuy ? '' : 'disabled'}><span class="shop-coin">🪙</span>${item.price}</button>`;
    }

    function renderInventoryAction(item) {
        const equipped = isEquipped(item.id);

        if (item.category === 'trail' || item.category === 'theme') {
            return equipped
                ? '<button class="shop-price-btn equipped" disabled>EQUIPPED</button>'
                : `<button class="shop-price-btn equip" data-equip="${item.id}">EQUIP</button>`;
        }

        return equipped
            ? `<button class="shop-price-btn unequip" data-unequip="${item.id}">DISABLE</button>`
            : `<button class="shop-price-btn equip" data-equip="${item.id}">ENABLE</button>`;
    }

    function renderShopCard(item) {
        return `
            <article class="shop-card ${isOwned(item.id) ? 'owned' : ''} ${isEquipped(item.id) ? 'equipped' : ''}">
                <h4 class="shop-card-name">${item.name.toUpperCase()}</h4>
                <div class="shop-card-preview">${renderPreview(item)}</div>
                <p class="shop-card-desc">${item.desc}</p>
                ${renderShopAction(item)}
            </article>
        `;
    }

    function renderInventoryCard(item) {
        return `
            <article class="shop-card owned ${isEquipped(item.id) ? 'equipped' : ''}">
                <h4 class="shop-card-name">${item.name.toUpperCase()}</h4>
                <div class="shop-card-preview">${renderPreview(item)}</div>
                <p class="shop-card-desc">${item.desc}</p>
                ${renderInventoryAction(item)}
            </article>
        `;
    }

    function bindShopActions(container) {
        container.querySelectorAll('[data-buy]').forEach(btn => {
            btn.addEventListener('click', () => buyItem(btn.dataset.buy));
        });
        container.querySelectorAll('[data-equip]').forEach(btn => {
            btn.addEventListener('click', () => equipItem(btn.dataset.equip));
        });
        container.querySelectorAll('[data-unequip]').forEach(btn => {
            btn.addEventListener('click', () => unequipUpgrade(btn.dataset.unequip));
        });
    }

    function renderShopPowerUps() {
        const container = document.getElementById('shopPowerUps');
        if (!container) return;
        container.innerHTML = getPowerUpItems().map(renderShopCard).join('');
        bindShopActions(container);
    }

    function renderInventoryPowerUps() {
        const container = document.getElementById('inventoryPowerUps');
        if (!container) return;

        const items = getPowerUpItems().filter(item => isOwned(item.id) && item.price > 0);

        if (!items.length) {
            container.innerHTML = '<p class="shop-empty-section">Nothing has been bought yet</p>';
            return;
        }

        container.innerHTML = items.map(renderInventoryCard).join('');
        bindShopActions(container);
    }

    function renderShopSection(containerId, category) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const items = getItemsByCategory(category);
        container.innerHTML = items.map(renderShopCard).join('');
        bindShopActions(container);
    }

    function renderInventorySection(containerId, category) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const items = getItemsByCategory(category).filter(item => isOwned(item.id) && item.price > 0);

        if (!items.length) {
            container.innerHTML = '<p class="shop-empty-section">Nothing has been bought yet</p>';
            return;
        }

        container.innerHTML = items.map(renderInventoryCard).join('');
        bindShopActions(container);
    }

    function renderShop() {
        renderShopPowerUps();
        renderShopSection('shopTrails', 'trail');
        renderShopSection('shopBackgrounds', 'theme');
        updateTokenDisplays();
    }

    function renderInventory() {
        renderInventoryPowerUps();
        renderInventorySection('inventoryTrails', 'trail');
        renderInventorySection('inventoryBackgrounds', 'theme');
    }

    function buyItem(id) {
        const item = SHOP_ITEMS.find(i => i.id === id);
        if (!item || isOwned(id)) return false;
        if (state.tokens < item.price) return false;

        state.tokens -= item.price;
        state.owned.push(id);
        if (item.category === 'upgrade') {
            if (id === 'tag-time-accel') state.equipped.tagTimeAccel = true;
            else if (id === 'space-shield') state.equipped.spaceShield = true;
            else if (id === 'kill-overclock-core') state.equipped.killOverclock = true;
            else if (id === 'kill-siphon-nanites') state.equipped.killSiphon = true;
            else if (id === 'kill-slam-module') state.equipped.killSlam = true;
        }
        save();
        renderShop();
        renderInventory();
        window.ArcadeSettings?.playSound('collect');
        return true;
    }

    function equipItem(id) {
        if (!isOwned(id)) return false;
        const item = SHOP_ITEMS.find(i => i.id === id);
        if (!item) return false;

        if (item.category === 'trail') state.equipped.trail = id;
        else if (item.category === 'theme') {
            state.equipped.theme = id;
            applyTheme();
        } else if (id === 'tag-time-accel') state.equipped.tagTimeAccel = true;
        else if (id === 'space-shield') state.equipped.spaceShield = true;
        else if (id === 'kill-overclock-core') state.equipped.killOverclock = true;
        else if (id === 'kill-siphon-nanites') state.equipped.killSiphon = true;
        else if (id === 'kill-slam-module') state.equipped.killSlam = true;

        save();
        renderShop();
        renderInventory();
        window.ArcadeSettings?.playSound('click');
        return true;
    }

    function unequipUpgrade(id) {
        if (id === 'tag-time-accel') state.equipped.tagTimeAccel = false;
        if (id === 'space-shield') state.equipped.spaceShield = false;
        if (id === 'kill-overclock-core') state.equipped.killOverclock = false;
        if (id === 'kill-siphon-nanites') state.equipped.killSiphon = false;
        if (id === 'kill-slam-module') state.equipped.killSlam = false;
        save();
        renderInventory();
        renderShop();
    }

    function hideAllHubPages() {
        document.getElementById('menu')?.classList.add('hidden');
        document.getElementById('gamesPage')?.classList.add('hidden');
        document.getElementById('shopPage')?.classList.add('hidden');
        document.getElementById('inventoryPage')?.classList.add('hidden');
    }

    function showShopPage() {
        hideAllHubPages();
        document.getElementById('shopPage')?.classList.remove('hidden');
        renderShop();
    }

    function showInventoryPage() {
        hideAllHubPages();
        document.getElementById('inventoryPage')?.classList.remove('hidden');
        renderInventory();
    }

    function hideMetaPages() {
        document.getElementById('shopPage')?.classList.add('hidden');
        document.getElementById('inventoryPage')?.classList.add('hidden');
    }

    function playGlitchTransition(onMidpoint) {
        if (glitchPlaying) return;
        glitchPlaying = true;

        const overlay = document.getElementById('glitchTransition');
        if (!overlay) {
            onMidpoint();
            glitchPlaying = false;
            return;
        }

        overlay.classList.remove('hidden');
        overlay.classList.add('active');
        window.ArcadeSettings?.playSound('powerOn');

        window.setTimeout(() => {
            onMidpoint();
            window.setTimeout(() => {
                overlay.classList.remove('active');
                window.setTimeout(() => {
                    overlay.classList.add('hidden');
                    glitchPlaying = false;
                }, 350);
            }, 180);
        }, 620);
    }

    function updateDailyProgress(track, value) {
        let changed = false;
        state.daily.quests.forEach(quest => {
            if (quest.completed) return;
            const def = getQuestDef(quest.id);
            if (!def || def.track !== track) return;

            if (track === 'playTime' || track === 'tagSurvivalRun') {
                quest.progress = Math.min(def.goal, quest.progress + value);
            } else {
                quest.progress = Math.max(quest.progress, value);
            }

            if (quest.progress >= def.goal) {
                quest.completed = true;
                quest.progress = def.goal;
                addTokens(def.reward, `Daily: ${def.text}`);
                changed = true;
            } else {
                changed = true;
            }
        });

        if (changed) save();
    }

    function tickPlayTime(deltaSeconds) {
        state.playTimeAccumulator += deltaSeconds;

        while (state.playTimeAccumulator >= PLAY_REWARD_SECONDS) {
            state.playTimeAccumulator -= PLAY_REWARD_SECONDS;
            addTokens(PLAY_REWARD_TOKENS, '5 minutes played');
        }

        updateDailyProgress('playTime', deltaSeconds);
        save();
    }

    function onTagZoneStart() {
        state.tagMatchCount += 1;
        save();
        return {
            activateTimeAccel: state.equipped.tagTimeAccel && Math.random() < 0.25
        };
    }

    function onNeonKillEnd(runScore, endWave) {
        if (runScore >= 500) addTokens(8, 'Neon Kill run');
        if (endWave >= 4) addTokens(12, 'Neon Kill waves');
    }

    function onTagZoneUpdate(survivalTime, level) {
        let changed = false;
        state.daily.quests.forEach(quest => {
            if (quest.completed) return;
            const def = getQuestDef(quest.id);
            if (!def) return;
            const before = quest.progress;
            if (def.track === 'tagSurvivalRun') quest.progress = Math.min(def.goal, survivalTime);
            if (def.track === 'tagLevel') quest.progress = Math.max(quest.progress, level);
            if (quest.progress !== before) changed = true;
            if (quest.progress >= def.goal && !quest.completed) {
                quest.completed = true;
                quest.progress = def.goal;
                addTokens(def.reward, `Daily: ${def.text}`);
            }
        });
        if (changed) save();
    }

    function onTagLevelSurvived() {
        addTokens(5, 'Tag Zone level cleared');
    }

    function onFastEagleEnd(runScore) {
        updateDailyProgress('fastEagleScore', runScore);
        if (runScore >= 50) addTokens(10, 'Fast Eagle high score');
        if (runScore >= 99) addTokens(15, 'Epic Fast Eagle run');
    }

    function onSpaceRunnerEnd(runScore) {
        updateDailyProgress('spaceScore', runScore);
        if (runScore >= 10000) addTokens(8, 'Space Runner run');
        if (runScore >= 50000) addTokens(20, 'Big Space Runner score');
    }

    function setPromoMessage(message, type = '') {
        const el = document.getElementById('promoCodeMessage');
        if (!el) return;
        el.textContent = message;
        el.className = `shop-promo-message ${type}`.trim();
    }

    function normalizePromoCode(code) {
        return code.trim().toUpperCase();
    }

    function redeemPromoCode() {
        const input = document.getElementById('promoCodeInput');
        if (!input) return;

        const raw = input.value.trim();
        if (!raw) {
            setPromoMessage('Enter a promo code first.', 'error');
            return;
        }

        const code = normalizePromoCode(raw);
        const reward = PROMO_CODES[code];

        if (!reward) {
            setPromoMessage('Invalid promo code.', 'error');
            window.ArcadeSettings?.playSound('hit');
            return;
        }

        if (state.redeemedPromoCodes.includes(code)) {
            setPromoMessage('You already redeemed this code.', 'error');
            return;
        }

        state.redeemedPromoCodes.push(code);
        save();
        addTokens(reward, `Promo code ${code}`);
        input.value = '';
        setPromoMessage(`Redeemed! +${reward} Arcade Tokens added.`, 'success');
        window.ArcadeSettings?.playSound('collect');
    }

    function hasEquippedUpgrade(id) {
        if (id === 'tag-time-accel') return state.equipped.tagTimeAccel;
        if (id === 'space-shield') return state.equipped.spaceShield;
        if (id === 'kill-overclock-core') return state.equipped.killOverclock;
        if (id === 'kill-siphon-nanites') return state.equipped.killSiphon;
        if (id === 'kill-slam-module') return state.equipped.killSlam;
        return false;
    }

    function setupControls() {
        document.getElementById('shopBtn')?.addEventListener('click', () => {
            playGlitchTransition(showShopPage);
        });

        document.getElementById('inventoryBtn')?.addEventListener('click', () => {
            playGlitchTransition(showInventoryPage);
        });

        document.getElementById('backFromShopBtn')?.addEventListener('click', () => {
            hideMetaPages();
            document.getElementById('menu')?.classList.remove('hidden');
            window.ArcadeSettings?.playSound('click');
        });

        document.getElementById('backFromInventoryBtn')?.addEventListener('click', () => {
            hideMetaPages();
            document.getElementById('menu')?.classList.remove('hidden');
            window.ArcadeSettings?.playSound('click');
        });

        document.getElementById('redeemPromoBtn')?.addEventListener('click', redeemPromoCode);
        document.getElementById('promoCodeInput')?.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                redeemPromoCode();
            }
        });
    }

    function init() {
        load();
        setupControls();
        updateTokenDisplays();
    }

    return {
        init,
        hideMetaPages,
        playGlitchTransition,
        tickPlayTime,
        onTagZoneStart,
        onTagZoneUpdate,
        onTagLevelSurvived,
        onFastEagleEnd,
        onSpaceRunnerEnd,
        onNeonKillEnd,
        getTrailStyle,
        hasEquippedUpgrade
    };
})();
