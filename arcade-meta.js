const ArcadeMeta = (() => {
    const STORAGE_KEY = 'arcadeMeta';
    const PLAY_REWARD_SECONDS = 300;
    const PLAY_REWARD_TOKENS = 25;

    const TRAIL_STYLES = {
        'trail-cyan': { fill: 'rgba(0, 255, 204, {a})', stroke: 'rgba(255, 77, 141, {a})' },
        'trail-pink': { fill: 'rgba(255, 77, 141, {a})', stroke: 'rgba(255, 230, 109, {a})' },
        'trail-gold': { fill: 'rgba(255, 230, 109, {a})', stroke: 'rgba(255, 140, 40, {a})' },
        'trail-purple': { fill: 'rgba(180, 100, 255, {a})', stroke: 'rgba(0, 255, 204, {a})' },
        'trail-green': { fill: 'rgba(100, 255, 120, {a})', stroke: 'rgba(74, 210, 255, {a})' }
    };

    const SHOP_ITEMS = [
        { id: 'trail-cyan', category: 'trail', name: 'Neon Cyan Trail', price: 0, desc: 'Classic hub trail (included free).' },
        { id: 'trail-pink', category: 'trail', name: 'Hot Pink Trail', price: 75, desc: 'Magenta neon with gold sparks.' },
        { id: 'trail-gold', category: 'trail', name: 'Gold Rush Trail', price: 100, desc: 'Golden streaks across the hub.' },
        { id: 'trail-purple', category: 'trail', name: 'Violet Pulse Trail', price: 100, desc: 'Purple glow with cyan accents.' },
        { id: 'trail-green', category: 'trail', name: 'Toxic Green Trail', price: 90, desc: 'Radioactive green neon trail.' },
        { id: 'theme-default', category: 'theme', name: 'Aurora Default', price: 0, desc: 'The classic Arcade Arena look.' },
        { id: 'theme-sunset', category: 'theme', name: 'Neon Sunset', price: 120, desc: 'Warm orange and magenta skies.' },
        { id: 'theme-ocean', category: 'theme', name: 'Deep Ocean', price: 120, desc: 'Cool blue underwater neon vibes.' },
        { id: 'theme-void', category: 'theme', name: 'Void Purple', price: 150, desc: 'Dark purple cosmic background.' },
        { id: 'tag-stop-time', category: 'upgrade', name: 'Stop Time', price: 200, desc: 'Tag Zone: 25% chance to spawn. Freezes enemies and the timer briefly.' },
        { id: 'tag-time-accel', category: 'upgrade', name: 'Time Acceleration', price: 250, desc: 'Tag Zone: 15% chance every 2 matches. You move faster and the level timer ticks down faster until the wave ends.' },
        { id: 'space-shield', category: 'upgrade', name: 'Neon Shield', price: 300, desc: 'Space Runner: 20% chance every 20s for a shield pickup. Smash through 10 asteroids.' }
    ];

    const DAILY_QUEST_POOL = [
        { id: 'tag-survive-120', text: 'Survive 2 minutes in Tag Zone', goal: 120, reward: 30, track: 'tagSurvivalRun' },
        { id: 'fast-eagle-50', text: 'Score 50 in Fast Eagle', goal: 50, reward: 25, track: 'fastEagleScore' },
        { id: 'tag-level-3', text: 'Reach level 3 in Tag Zone', goal: 3, reward: 35, track: 'tagLevel' },
        { id: 'play-180', text: 'Play any game for 3 minutes', goal: 180, reward: 20, track: 'playTime' },
        { id: 'space-score-30k', text: 'Score 30,000 in Space Runner', goal: 30000, reward: 40, track: 'spaceScore' }
    ];

    let state = null;
    let playSessionSeconds = 0;
    let tagRunSurvival = 0;
    let tagRunLevel = 1;

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
                tagStopTime: false,
                tagTimeAccel: false,
                spaceShield: false
            },
            daily: { date: '', quests: [] },
            playTimeAccumulator: 0,
            tagMatchCount: 0
        };
    }

    function load() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            state = { ...defaultState(), ...saved };
            state.equipped = { ...defaultState().equipped, ...saved?.equipped };
            ensureDailyQuests();
        } catch {
            state = defaultState();
            ensureDailyQuests();
        }
        applyTheme();
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
        if (id === 'tag-stop-time') return state.equipped.tagStopTime;
        if (id === 'tag-time-accel') return state.equipped.tagTimeAccel;
        if (id === 'space-shield') return state.equipped.spaceShield;
        return false;
    }

    function buyItem(id) {
        const item = SHOP_ITEMS.find(i => i.id === id);
        if (!item || isOwned(id)) return false;
        if (state.tokens < item.price) return false;
        state.tokens -= item.price;
        state.owned.push(id);
        save();
        updateTokenDisplays();
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
        } else if (id === 'tag-stop-time') state.equipped.tagStopTime = true;
        else if (id === 'tag-time-accel') state.equipped.tagTimeAccel = true;
        else if (id === 'space-shield') state.equipped.spaceShield = true;

        save();
        renderShop();
        renderInventory();
        window.ArcadeSettings?.playSound('click');
        return true;
    }

    function unequipUpgrade(id) {
        if (id === 'tag-stop-time') state.equipped.tagStopTime = false;
        if (id === 'tag-time-accel') state.equipped.tagTimeAccel = false;
        if (id === 'space-shield') state.equipped.spaceShield = false;
        save();
        renderInventory();
    }

    function tickPlayTime(deltaSeconds) {
        playSessionSeconds += deltaSeconds;
        state.playTimeAccumulator += deltaSeconds;

        while (state.playTimeAccumulator >= PLAY_REWARD_SECONDS) {
            state.playTimeAccumulator -= PLAY_REWARD_SECONDS;
            addTokens(PLAY_REWARD_TOKENS, '5 minutes played');
        }

        updateDailyProgress('playTime', deltaSeconds);
        save();
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

        if (changed) {
            save();
            renderDailyBoard();
        }
    }

    function onTagZoneStart() {
        state.tagMatchCount += 1;
        tagRunSurvival = 0;
        tagRunLevel = 1;
        save();
        return {
            spawnStopTime: state.equipped.tagStopTime && Math.random() < 0.25,
            activateTimeAccel: state.equipped.tagTimeAccel && state.tagMatchCount % 2 === 0 && Math.random() < 0.15
        };
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
        if (changed) {
            save();
            renderDailyBoard();
        }
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

    function hasEquippedUpgrade(id) {
        if (id === 'tag-stop-time') return state.equipped.tagStopTime;
        if (id === 'tag-time-accel') return state.equipped.tagTimeAccel;
        if (id === 'space-shield') return state.equipped.spaceShield;
        return false;
    }

    function renderDailyBoard() {
        const board = document.getElementById('dailyQuestBoard');
        if (!board) return;
        ensureDailyQuests();

        board.innerHTML = state.daily.quests.map(quest => {
            const def = getQuestDef(quest.id);
            if (!def) return '';
            const pct = Math.min(100, Math.round((quest.progress / def.goal) * 100));
            return `
                <article class="daily-quest-card ${quest.completed ? 'completed' : ''}">
                    <p class="daily-quest-text">${def.text}</p>
                    <div class="daily-quest-bar"><span style="width:${pct}%"></span></div>
                    <p class="daily-quest-reward">${quest.completed ? 'Complete!' : `Reward: ${def.reward} tokens`}</p>
                </article>
            `;
        }).join('');
    }

    function renderShop() {
        const list = document.getElementById('shopList');
        if (!list) return;

        list.innerHTML = SHOP_ITEMS.map(item => {
            const owned = isOwned(item.id);
            const equipped = isEquipped(item.id);
            const canBuy = !owned && state.tokens >= item.price;

            let action = '';
            if (owned && (item.category === 'trail' || item.category === 'theme')) {
                action = equipped
                    ? '<span class="shop-tag equipped">Equipped</span>'
                    : `<button class="menuBtn shop-equip-btn" data-equip="${item.id}">Equip</button>`;
            } else if (owned && item.category === 'upgrade') {
                action = equipped
                    ? '<span class="shop-tag equipped">Active in Inventory</span>'
                    : `<button class="menuBtn shop-equip-btn" data-equip="${item.id}">Enable</button>`;
            } else if (owned) {
                action = '<span class="shop-tag owned">Owned</span>';
            } else if (item.price === 0) {
                action = '<span class="shop-tag owned">Free</span>';
            } else {
                action = `<button class="menuBtn shop-buy-btn" data-buy="${item.id}" ${canBuy ? '' : 'disabled'}>Buy — ${item.price} 🪙</button>`;
            }

            return `
                <article class="shop-item ${owned ? 'owned' : ''}">
                    <h4>${item.name}</h4>
                    <p>${item.desc}</p>
                    ${action}
                </article>
            `;
        }).join('');

        list.querySelectorAll('[data-buy]').forEach(btn => {
            btn.addEventListener('click', () => buyItem(btn.dataset.buy));
        });
        list.querySelectorAll('[data-equip]').forEach(btn => {
            btn.addEventListener('click', () => equipItem(btn.dataset.equip));
        });
    }

    function renderInventory() {
        const list = document.getElementById('inventoryList');
        if (!list) return;

        const ownedItems = SHOP_ITEMS.filter(i => isOwned(i.id));

        list.innerHTML = ownedItems.map(item => {
            const equipped = isEquipped(item.id);
            let controls = '';

            if (item.category === 'trail' || item.category === 'theme') {
                controls = equipped
                    ? '<span class="shop-tag equipped">Equipped</span>'
                    : `<button class="menuBtn shop-equip-btn" data-equip="${item.id}">Equip</button>`;
            } else if (item.category === 'upgrade') {
                controls = equipped
                    ? `<button class="menuBtn shop-unequip-btn" data-unequip="${item.id}">Disable</button>`
                    : `<button class="menuBtn shop-equip-btn" data-equip="${item.id}">Enable</button>`;
            }

            return `
                <article class="inventory-item ${equipped ? 'equipped' : ''}">
                    <h4>${item.name}</h4>
                    <p>${item.desc}</p>
                    ${controls}
                </article>
            `;
        }).join('') || '<p class="empty-inventory">Play and visit the Neon Shop to collect items.</p>';

        list.querySelectorAll('[data-equip]').forEach(btn => {
            btn.addEventListener('click', () => equipItem(btn.dataset.equip));
        });
        list.querySelectorAll('[data-unequip]').forEach(btn => {
            btn.addEventListener('click', () => unequipUpgrade(btn.dataset.unequip));
        });
    }

    function showShopPage() {
        document.getElementById('menu')?.classList.add('hidden');
        document.getElementById('gamesPage')?.classList.add('hidden');
        document.getElementById('inventoryPage')?.classList.add('hidden');
        document.getElementById('shopPage')?.classList.remove('hidden');
        renderShop();
        updateTokenDisplays();
    }

    function showInventoryPage() {
        document.getElementById('menu')?.classList.add('hidden');
        document.getElementById('gamesPage')?.classList.add('hidden');
        document.getElementById('shopPage')?.classList.add('hidden');
        document.getElementById('inventoryPage')?.classList.remove('hidden');
        renderInventory();
    }

    function hideMetaPages() {
        document.getElementById('shopPage')?.classList.add('hidden');
        document.getElementById('inventoryPage')?.classList.add('hidden');
    }

    function setupControls() {
        document.getElementById('neonShopBtn')?.addEventListener('click', () => {
            showShopPage();
            window.ArcadeSettings?.playSound('click');
        });
        document.getElementById('inventoryBtn')?.addEventListener('click', () => {
            showInventoryPage();
            window.ArcadeSettings?.playSound('click');
        });
        document.getElementById('backFromShopBtn')?.addEventListener('click', () => {
            hideMetaPages();
            document.getElementById('gamesPage')?.classList.remove('hidden');
            window.ArcadeSettings?.playSound('click');
        });
        document.getElementById('backFromInventoryBtn')?.addEventListener('click', () => {
            hideMetaPages();
            document.getElementById('menu')?.classList.remove('hidden');
            window.ArcadeSettings?.playSound('click');
        });
        document.getElementById('shopInventoryLink')?.addEventListener('click', showInventoryPage);
    }

    function init() {
        load();
        setupControls();
        renderDailyBoard();
        updateTokenDisplays();
    }

    function resetTagRunTracking() {
        tagRunSurvival = 0;
        tagRunLevel = 1;
    }

    return {
        init,
        hideMetaPages,
        tickPlayTime,
        onTagZoneStart,
        onTagZoneUpdate,
        onTagLevelSurvived,
        onFastEagleEnd,
        onSpaceRunnerEnd,
        getTrailStyle,
        hasEquippedUpgrade,
        resetTagRunTracking
    };
})();
