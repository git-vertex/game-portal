async function cleanOldUsers() {
    if (!db || !firebaseReady) {
        console.log('Подожди, Firebase не готов');
        return;
    }
    const snapshot = await db.ref('users').once('value');
    const users = snapshot.val() || {};
    let count = 0;
    for (const [key, user] of Object.entries(users)) {
        if (!user.stats || user.stats.billiard?.frp === 1000 || user.stats.billiard?.frp === undefined) {
            await db.ref('users/' + key).remove();
            console.log('Удалён:', key);
            count++;
        }
    }
    console.log('Удалено пользователей:', count);
    if (typeof loadLeaderboard === 'function') loadLeaderboard();
}
window.cleanOldUsers = cleanOldUsers;

let gameState = null;
let pongState = null;
let lobbyCode = null;
let isHost = false;
let isOnline = false;
let isSpectator = false;
let isPrivateLobby = false;
let isBotMode = false;
let myPlayer = 0;
let myNickname = '';
let mySessionId = generateSessionId();
let gameStarted = false;
let maxPlayers = 2;
let playersInfo = {};
let spectatorCount = 0;
let chatHidden = false;
let anglePrecision = 0.6;
let disconnectedPlayers = new Set();
let currentGame = 'billiard';
let backgammonState = null;
let currentAvatar = '';
let currentNickname = '';
let isLoggedIn = false;
let mouse = { x: 0, y: 0 };
let isAiming = false;
let power = 0;
let aimAngle = 0;
let wheelAngleOffset = 0;
let opponentAim = null;
let playerStats = { billiard: { games: 0, wins: 0, frp: 0 }, history: [] };

function loadAccount() {
    const saved = localStorage.getItem('billiardAccount');
    if (saved) { const data = JSON.parse(saved); currentNickname = data.nickname; currentAvatar = data.avatar; isLoggedIn = true; }
    loadStats(); updateAccountDisplay();
}

function loadStats() {
    const saved = localStorage.getItem('playerStats');
    if (saved) {
        playerStats = JSON.parse(saved);
        if (!playerStats.billiard) playerStats.billiard = { games: 0, wins: 0, frp: 0 };
        if (!playerStats.history) playerStats.history = [];
    }
}
function saveStats() { localStorage.setItem('playerStats', JSON.stringify(playerStats)); }

function updateAccountDisplay() {
    const avatarBtn = document.getElementById('avatarBtn');
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.placeholder = isLoggedIn ? 'Сообщение...' : 'Войдите чтобы писать...';
        chatInput.disabled = !isLoggedIn;
    }
    if (isLoggedIn && currentAvatar) {
        document.getElementById('displayNick').textContent = currentNickname;
        document.getElementById('accountStatus').textContent = 'Профиль';
        avatarBtn.innerHTML = `<img src="${currentAvatar}" alt="">`;
        avatarBtn.classList.add('has-avatar');
    } else if (isLoggedIn) {
        document.getElementById('displayNick').textContent = currentNickname;
        document.getElementById('accountStatus').textContent = 'Профиль';
        avatarBtn.innerHTML = `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
        avatarBtn.classList.remove('has-avatar');
    } else {
        document.getElementById('displayNick').textContent = 'Гость';
        document.getElementById('accountStatus').textContent = 'Войти';
        avatarBtn.innerHTML = `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
        avatarBtn.classList.remove('has-avatar');
    }
}

function getNickname() { return isLoggedIn ? currentNickname : 'Гость'; }
function getAvatar() { return isLoggedIn ? currentAvatar : ''; }

function openAuthModal() {
    const modal = document.getElementById('authModal');
    customAvatarData = '';
    if (isLoggedIn) {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('profileForm').style.display = 'block';
        document.getElementById('authTabs').style.display = 'none';
        document.getElementById('authTitle').textContent = 'Профиль';
        document.getElementById('profileNick').value = currentNickname;
        document.getElementById('profileSuccess').textContent = '';
        document.getElementById('profileUploadText').textContent = 'Загрузить';
        const preview = document.getElementById('profileAvatarPreview');
        preview.innerHTML = currentAvatar ? `<img src="${currentAvatar}" alt="">` : `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
    } else {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('profileForm').style.display = 'none';
        document.getElementById('authTabs').style.display = 'flex';
        document.getElementById('authTitle').textContent = 'Вход';
        document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('[data-auth="login"]').classList.add('active');
        document.getElementById('loginError').textContent = '';
        document.getElementById('regError').textContent = '';
        document.getElementById('regAvatarPreview').innerHTML = `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
        document.getElementById('uploadText').textContent = 'Загрузить';
    }
    modal.classList.add('show');
}

function closeAuthModal() { document.getElementById('authModal').classList.remove('show'); }

async function register() {
    if (!db || !firebaseReady) { document.getElementById('regError').textContent = 'Нет подключения к серверу'; return; }
    const nick = document.getElementById('regNick').value.trim();
    const pass = document.getElementById('regPassword').value;
    const passRepeat = document.getElementById('regPasswordRepeat').value;
    const errorEl = document.getElementById('regError');
    if (!nick || nick.length < 2) { errorEl.textContent = 'Никнейм минимум 2 символа'; return; }
    if (!pass || pass.length < 4) { errorEl.textContent = 'Пароль минимум 4 символа'; return; }
    if (pass !== passRepeat) { errorEl.textContent = 'Пароли не совпадают'; return; }
    try {
        const userRef = db.ref('users/' + nick.toLowerCase());
        const snapshot = await userRef.once('value');
        if (snapshot.exists()) { errorEl.textContent = 'Никнейм уже занят'; return; }
        const freshStats = { billiard: { games: 0, wins: 0, frp: 0 }, history: [] };
        await userRef.set({ nickname: nick, password: simpleHash(pass), avatar: customAvatarData || '', created: Date.now(), stats: freshStats });
        playerStats = freshStats;
        currentNickname = nick; currentAvatar = customAvatarData || ''; isLoggedIn = true;
        localStorage.setItem('billiardAccount', JSON.stringify({ nickname: nick, avatar: currentAvatar }));
        updateAccountDisplay(); closeAuthModal();
    } catch (e) { errorEl.textContent = 'Ошибка регистрации'; }
}

async function login() {
    if (!db || !firebaseReady) { document.getElementById('loginError').textContent = 'Нет подключения к серверу'; return; }
    const nick = document.getElementById('loginNick').value.trim();
    const pass = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    if (!nick || !pass) { errorEl.textContent = 'Заполните все поля'; return; }
    try {
        const userRef = db.ref('users/' + nick.toLowerCase());
        const snapshot = await userRef.once('value');
        if (!snapshot.exists()) { errorEl.textContent = 'Пользователь не найден'; return; }
        const data = snapshot.val();
        if (data.password !== simpleHash(pass)) { errorEl.textContent = 'Неверный пароль'; return; }
        currentNickname = data.nickname; currentAvatar = data.avatar || ''; isLoggedIn = true;
        if (data.stats) { playerStats = data.stats; saveStats(); }
        localStorage.setItem('billiardAccount', JSON.stringify({ nickname: data.nickname, avatar: currentAvatar }));
        updateAccountDisplay(); closeAuthModal();
    } catch (e) { errorEl.textContent = 'Ошибка входа'; }
}

async function saveProfile() {
    if (!db || !firebaseReady) return;
    if (customAvatarData) {
        try {
            currentAvatar = customAvatarData;
            await db.ref('users/' + currentNickname.toLowerCase() + '/avatar').set(currentAvatar);
            localStorage.setItem('billiardAccount', JSON.stringify({ nickname: currentNickname, avatar: currentAvatar }));
            updateAccountDisplay();
            document.getElementById('profileSuccess').textContent = 'Сохранено!';
            setTimeout(() => document.getElementById('profileSuccess').textContent = '', 2000);
        } catch (e) { console.error(e); }
    }
}

async function logout() {
    // Удаляем ВСЁ из Firebase
    if (db && firebaseReady && currentNickname) {
        const username = currentNickname.toLowerCase();
        // Удаляем пользователя
        await db.ref('users/' + username).remove();
        // Удаляем из лидерборда если там есть
        const snapshot = await db.ref('users').once('value');
        // Пользователь уже удалён, лидерборд обновится автоматически
    }

    isLoggedIn = false;
    currentNickname = '';
    currentAvatar = '';
    playerStats = { billiard: { games: 0, wins: 0, frp: 0 }, history: [] };
    localStorage.removeItem('billiardAccount');
    localStorage.removeItem('playerStats');
    updateAccountDisplay();
    closeAuthModal();

    // Перезагружаем лидерборд
    loadLeaderboard();
}

function resetState() {
    document.getElementById('gameControls').style.display = 'none';
    stopTurnTimer();
    if (lobbyRef) { lobbyRef.off(); lobbyRef = null; }
    removePublicLobby();
    gameState = null; pongState = null; backgammonState = null; lobbyCode = null; isHost = false; isOnline = false; isSpectator = false; isBotMode = false; myPlayer = 0; gameStarted = false; maxPlayers = 2; playersInfo = {}; spectatorCount = 0; opponentAim = null; isAiming = false; power = 0; wheelAngleOffset = 0; disconnectedPlayers.clear();
    document.getElementById('foulMessage').textContent = '';
    document.getElementById('spectatorBadge').style.display = 'none';
    document.getElementById('gameContent').classList.remove('game-ended');
}

function createLobby() {
    if (!db || !firebaseReady) return;
    resetState();
    myNickname = getNickname();
    maxPlayers = currentGame === 'backgammon' ? 2 : parseInt(document.getElementById('playerCount').value);
    isPrivateLobby = document.getElementById('privateLobby').checked;
    lobbyCode = generateCode();
    document.getElementById('lobbyCode').textContent = lobbyCode;
    showLobbyUI();
    isHost = true; myPlayer = 1;
    document.getElementById('startGameBtn').style.display = '';
    document.getElementById('startGameBtn').disabled = true;
    playersInfo = { 1: { nick: myNickname, sessionId: mySessionId, avatar: getAvatar(), frp: playerStats[currentGame]?.frp || 0 } };
    lobbyRef = db.ref('lobbies/' + lobbyCode);
    if (currentGame === 'billiard') {
        initGameState();
        gameState.totalPlayers = maxPlayers;
        gameState.playerNicks = { 1: myNickname };
        gameState.playerAvatars = { 1: getAvatar() };
        lobbyRef.set({ state: gameState, maxPlayers, players: playersInfo, spectators: 0, private: isPrivateLobby, hostSessionId: mySessionId, game: 'billiard', shot: null, aim: null, lastUpdate: Date.now() });
    } else if (currentGame === 'backgammon') {
        initBackgammonState();
        backgammonState.playerNicks = { 1: myNickname };
        backgammonState.playerAvatars = { 1: getAvatar() };
        lobbyRef.set({ backgammonState: backgammonState, maxPlayers: 2, players: playersInfo, spectators: 0, private: isPrivateLobby, hostSessionId: mySessionId, game: 'backgammon', lastUpdate: Date.now() });
    } else {
        initPongState();
        pongState.playerNicks = { 1: myNickname };
        pongState.playerAvatars = { 1: getAvatar() };
        lobbyRef.set({ pongState: pongState, maxPlayers: 2, players: playersInfo, spectators: 0, private: isPrivateLobby, hostSessionId: mySessionId, game: 'pong', paddleMove: null, lastUpdate: Date.now() });
    }
    setupLobbyListeners(); updatePublicLobby();
    sendGlobalChat(`${myNickname} создал лобби`, true);
    setInterval(() => { if (lobbyRef && isHost) { lobbyRef.child('lastUpdate').set(Date.now()); updatePublicLobby(); } }, 5000);
}

function playWithBot() {
    resetState();
    myNickname = getNickname(); isBotMode = true; isHost = true; myPlayer = 1; maxPlayers = 2;
    playersInfo = {
        1: { nick: myNickname, sessionId: mySessionId, avatar: getAvatar(), frp: playerStats[currentGame]?.frp || 0 },
        2: { nick: 'Бот', sessionId: 'bot', avatar: '', frp: 0 }
    };
    if (currentGame === 'billiard') {
        initGameState();
        gameState.totalPlayers = 2;
        gameState.playerNicks = { 1: myNickname, 2: 'Бот' };
        gameState.playerAvatars = { 1: getAvatar(), 2: '' };
        gameState.gameStarted = true;
        gameState.currentPlayer = 2;
        initBalls(); startBilliardGame();
        setTimeout(botBilliardMove, 1500);
    } else if (currentGame === 'backgammon') {
        initBackgammonState();
        backgammonState.playerNicks = { 1: myNickname, 2: 'Бот' };
        backgammonState.playerAvatars = { 1: getAvatar(), 2: '' };
        backgammonState.gameStarted = true;
        backgammonState.currentPlayer = 1;
        startBackgammonGame();
    } else {
        initPongState();
        pongState.playerNicks = { 1: myNickname, 2: 'Бот' };
        pongState.playerAvatars = { 1: getAvatar(), 2: '' };
        pongState.gameStarted = true;
        startPongGame();
    }
}

function joinLobby() {
    if (!db || !firebaseReady) return;
    const code = document.getElementById('joinCode').value.toUpperCase().trim();
    if (code.length !== 6 || code === lobbyCode) return;
    resetState();
    myNickname = getNickname();
    const templobbyRef = db.ref('lobbies/' + code);
    templobbyRef.once('value').then(snapshot => {
        if (!snapshot.exists()) { return; }
        const data = snapshot.val();
        const gameType = data.game || 'billiard';
        if (currentGame !== gameType) {
            currentGame = gameType;
            document.querySelectorAll('.gameBtn').forEach(b => b.classList.remove('active'));
            document.getElementById(gameType === 'billiard' ? 'billiardBtn' : 'pongBtn')?.classList.add('active');
            document.getElementById('gameTitle').textContent = gameType === 'billiard' ? 'БИЛЬЯРД' : 'ПИНГ-ПОНГ';
        }
        lobbyCode = code;
        lobbyRef = templobbyRef;
        maxPlayers = data.maxPlayers || 2;
        playersInfo = data.players || {};
        const playerCount = Object.keys(playersInfo).length;
        const gameAlreadyStarted = data.state?.gameStarted || data.pongState?.gameStarted;
        if (playerCount >= maxPlayers || gameAlreadyStarted) {
            isSpectator = true; isOnline = true; myPlayer = 0;
            lobbyRef.child('spectators').transaction(c => (c || 0) + 1);
            sendGlobalChat(`${myNickname} наблюдает`, true);
            setupSpectatorListeners();
            if (gameAlreadyStarted) {
                if (data.game === 'billiard' && data.state) { gameState = data.state; startBilliardGame(); }
                else if (data.game === 'backgammon' && data.backgammonState) { backgammonState = data.backgammonState; startBackgammonGame(); }
                else if (data.pongState) { pongState = data.pongState; startPongGame(); }
            }
        } else {
            myPlayer = playerCount + 1; isOnline = true; isSpectator = false;

            playersInfo[myPlayer] = { nick: myNickname, sessionId: mySessionId, avatar: getAvatar(), frp: playerStats[currentGame]?.frp || 0 }; lobbyRef.child('players').set(playersInfo);
            document.querySelector('[data-tab="create"]').click();
            showLobbyUI();
            document.getElementById('lobbyCode').textContent = lobbyCode;
            document.getElementById('startGameBtn').style.display = 'none';
            document.getElementById('startGameBtn').disabled = true;
            sendGlobalChat(`${myNickname} присоединился`, true);
            setupPlayerListeners();
        }
    });
}

function setupLobbyListeners() {
    lobbyRef.child('kicked/' + mySessionId).on('value', snapshot => {
        if (snapshot.val()) {
            alert('Вы были кикнуты из лобби');
            resetState();
            showMenu();
        }
    });
    lobbyRef.child('players').on('value', snapshot => {
        const newPlayersInfo = snapshot.val() || {};
        if (Object.keys(newPlayersInfo).length === 0 && !isHost) { leaveLobby(); return; }
        const playerCount = Object.keys(newPlayersInfo).length;
        const startBtn = document.getElementById('startGameBtn');
        if (startBtn) {
            startBtn.disabled = playerCount < 2;
            if (isHost) {
                startBtn.style.display = '';
            }
        }
        if (gameStarted) {
            const currentIds = new Set(Object.values(newPlayersInfo).map(p => p.sessionId));
            for (const [num, info] of Object.entries(playersInfo)) { if (!currentIds.has(info.sessionId)) disconnectedPlayers.add(parseInt(num)); }
            if (disconnectedPlayers.size > 0) document.getElementById('gameContent').classList.add('game-ended');
            if (currentGame === 'billiard') updateScorePanel();
        }
        playersInfo = newPlayersInfo;
        updatePlayersList(); updateViewersCount();
    });
    lobbyRef.child('spectators').on('value', snapshot => { spectatorCount = snapshot.val() || 0; updateViewersCount(); });
}

function setupSpectatorListeners() {
    setupLobbyListeners();
    if (currentGame === 'backgammon') {
        lobbyRef.child('backgammonState').on('value', snapshot => {
            if (!snapshot.val()) return;
            backgammonState = snapshot.val();
            if (backgammonState.gameStarted && !gameStarted) startBackgammonGame();
            updateBackgammonInfo();
            updateDiceDisplay();
        });
    } else if (currentGame === 'billiard') {
        lobbyRef.child('state').on('value', snapshot => { if (!snapshot.val()) return; gameState = snapshot.val(); ensureGameStateArrays(); if (gameState.gameStarted && !gameStarted) startBilliardGame(); if (gameStarted) updateScorePanel(); });
        lobbyRef.child('aim').on('value', snapshot => { opponentAim = snapshot.val(); });
    } else {
        lobbyRef.child('pongState').on('value', snapshot => { if (!snapshot.val()) return; pongState = snapshot.val(); if (pongState.gameStarted && !gameStarted) startPongGame(); });
    }
}

function setupPlayerListeners() {
    setupLobbyListeners();
    if (currentGame === 'backgammon') {
        lobbyRef.child('backgammonState').on('value', snapshot => {
            if (!snapshot.val()) return;
            backgammonState = snapshot.val();
            if (backgammonState.gameStarted && !gameStarted) startBackgammonGame();
            updateBackgammonInfo();
            updateDiceDisplay();
        });
    } else if (currentGame === 'billiard') {
        lobbyRef.child('state').on('value', snapshot => { if (!snapshot.val()) return; gameState = snapshot.val(); ensureGameStateArrays(); if (gameState.gameStarted && !gameStarted) startBilliardGame(); if (gameStarted) updateScorePanel(); });
        lobbyRef.child('shot').on('value', snapshot => {
            const shot = snapshot.val();
            if (shot && shot.player !== myPlayer && !gameState?.isMoving) {
                performShot(shot.vx, shot.vy, shot.spinX || 0, shot.spinY || 0);
            }
        });
        lobbyRef.child('aim').on('value', snapshot => { const aim = snapshot.val(); opponentAim = (aim && aim.player !== myPlayer) ? aim : null; });
    } else {
        lobbyRef.child('pongState').on('value', snapshot => { if (!snapshot.val()) return; pongState = snapshot.val(); if (pongState.gameStarted && !gameStarted) startPongGame(); });
        lobbyRef.child('paddleMove').on('value', snapshot => { const move = snapshot.val(); if (move && move.player !== myPlayer && pongState) pongState.paddles[move.player - 1].y = move.y; });
    }
}

function leaveLobby() {
    const wasInLobby = lobbyCode;
    const wasNick = myNickname;
    if (lobbyRef) {
        if (isSpectator) lobbyRef.child('spectators').transaction(c => Math.max(0, (c || 0) - 1));
        else if (isHost) { removePublicLobby(); lobbyRef.remove(); }
        else if (myPlayer > 0) { delete playersInfo[myPlayer]; lobbyRef.child('players').set(playersInfo); }
    }
    if (wasInLobby) sendGlobalChat(`${wasNick} вышел`, true);
    resetState(); showMenu();
}

function kickPlayer(playerNum) {
    if (!isHost || !lobbyRef) return;
    const playerInfo = playersInfo[playerNum];
    if (!playerInfo) return;
    
    lobbyRef.child('kicked/' + playerInfo.sessionId).set(true);
    delete playersInfo[playerNum];
    
    const reordered = {};
    let newNum = 1;
    for (const [num, info] of Object.entries(playersInfo).sort((a, b) => a[0] - b[0])) {
        reordered[newNum] = info;
        newNum++;
    }
    playersInfo = reordered;
    lobbyRef.child('players').set(playersInfo);
    sendGlobalChat(`${playerInfo.nick} был кикнут`, true);
}

function startOnlineGame() {
    const count = Object.keys(playersInfo).length;
    if (count < 2) return;
    if (currentGame === 'billiard') {
        initBalls();
        gameState.totalPlayers = count; gameState.gameStarted = true;
        for (const [num, info] of Object.entries(playersInfo)) { gameState.playerNicks[num] = info.nick; gameState.playerAvatars[num] = info.avatar || ''; }
        isOnline = true;
        lobbyRef.child('state').set(gameState);
        updatePublicLobby(); startBilliardGame();
    } else if (currentGame === 'backgammon') {
        backgammonState.gameStarted = true;
        for (const [num, info] of Object.entries(playersInfo)) { backgammonState.playerNicks[num] = info.nick; backgammonState.playerAvatars[num] = info.avatar || ''; }
        isOnline = true;
        lobbyRef.child('backgammonState').set(backgammonState);
        updatePublicLobby(); startBackgammonGame();
    } else {
        pongState.gameStarted = true; pongState.paused = false;
        for (const [num, info] of Object.entries(playersInfo)) { pongState.playerNicks[num] = info.nick; pongState.playerAvatars[num] = info.avatar || ''; }
        isOnline = true;
        lobbyRef.child('pongState').set(pongState);
        updatePublicLobby(); startPongGame();
    }
    sendGlobalChat(`Игра началась!`, true);
}

function startBilliardGame() {
    gameStarted = true; initAudio(); showGame();
    if (isSpectator) document.getElementById('spectatorBadge').style.display = 'block';
    createScorePanels(); updateScorePanel(); startTurnTimer();
    if (isHost && lobbyRef) {
        lobbyRef.child('shot').on('value', snapshot => { const shot = snapshot.val(); if (shot && shot.player !== myPlayer && !gameState?.isMoving) performShot(shot.vx, shot.vy); });
        lobbyRef.child('aim').on('value', snapshot => { const aim = snapshot.val(); opponentAim = (aim && aim.player !== myPlayer) ? aim : null; });
    }
}

function startPongGame() {
    gameStarted = true; initAudio(); showGame();
    if (isSpectator) document.getElementById('pongSpectatorBadge').style.display = 'block';
    document.getElementById('pongPlayer1Name').textContent = pongState.playerNicks[1] || 'Игрок 1';
    document.getElementById('pongPlayer2Name').textContent = pongState.playerNicks[2] || 'Игрок 2';
    if (isBotMode) pongState.paused = false;
}

// Event Listeners
document.addEventListener('mousedown', e => {
    if (!gameStarted || currentGame !== 'billiard') return;
    if (!gameState || gameState.isMoving || gameState.winner || !isMyTurn()) return;
    if (e.target.closest('#controlsPanel') || e.target.closest('button') || e.target.closest('input')) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;
    initAudio();
    mouse.x = x * (canvas.width / rect.width);
    mouse.y = y * (canvas.height / rect.height);
    isAiming = true; power = 0; wheelAngleOffset = 0;
    const cue = gameState.balls[0];
    if (cue) aimAngle = Math.atan2(mouse.y - cue.y, mouse.x - cue.x) + Math.PI;
});

document.addEventListener('mousemove', e => {
    if (!gameStarted || currentGame !== 'billiard') return;
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
    if (isAiming && isMyTurn() && gameState?.balls[0]) {
        const cue = gameState.balls[0];
        aimAngle = Math.atan2(mouse.y - cue.y, mouse.x - cue.x) + Math.PI;
        power = Math.min(Math.sqrt((cue.x - mouse.x) ** 2 + (cue.y - mouse.y) ** 2), 200);
        document.getElementById('powerFill').style.width = (power / 200 * 100) + '%';
        if (isOnline) syncAim();
    }
});

document.addEventListener('mouseup', () => {
    if (!isAiming) return;
    if (power > 10 && isMyTurn()) shoot();
    isAiming = false; power = 0; wheelAngleOffset = 0;
    document.getElementById('powerFill').style.width = '0%';
    document.getElementById('angleValue').textContent = '0.00°';
    if (isOnline) clearAim();
});

canvas.addEventListener('wheel', e => {
    if (!isAiming || !isMyTurn()) return;
    e.preventDefault();
    wheelAngleOffset += (e.deltaY > 0 ? 1 : -1) * anglePrecision * (Math.PI / 180);
    if (isOnline) syncAim();
}, { passive: false });

document.getElementById('precisionSlider').addEventListener('input', e => {
    anglePrecision = parseFloat(e.target.value);
    document.getElementById('precisionValue').textContent = anglePrecision.toFixed(3) + '°';
});

document.getElementById('toggleChatBtn').addEventListener('click', () => {
    chatHidden = !chatHidden;
    document.getElementById('chatPanel').classList.toggle('hidden', chatHidden);
    document.getElementById('toggleChatBtn').classList.toggle('chat-hidden', chatHidden);
});

document.querySelectorAll('.menuTab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.menuTab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.menuContent').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)).classList.add('active');
    });
});

document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const isLogin = tab.dataset.auth === 'login';
        document.getElementById('loginForm').style.display = isLogin ? 'block' : 'none';
        document.getElementById('registerForm').style.display = isLogin ? 'none' : 'block';
        document.getElementById('authTitle').textContent = isLogin ? 'Вход' : 'Регистрация';
    });
});

document.querySelectorAll('.stats-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.stats-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const tabName = tab.dataset.stats;
        const contentId = 'stats' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
        document.getElementById(contentId).classList.add('active');
        if (tabName === 'leaderboard') {
            loadLeaderboard();
        }
    });
});

document.getElementById('authModal').addEventListener('click', e => { if (e.target.id === 'authModal') closeAuthModal(); });
document.getElementById('statsModal').addEventListener('click', e => { if (e.target.id === 'statsModal') closeStatsModal(); });

document.getElementById('createLobbyBtn').addEventListener('click', createLobby);
document.getElementById('joinLobbyBtn').addEventListener('click', joinLobby);
document.getElementById('startGameBtn').addEventListener('click', startOnlineGame);
document.getElementById('leaveLobbyBtn').addEventListener('click', leaveLobby);
document.getElementById('refreshServers').addEventListener('click', loadPublicServers);
document.getElementById('playWithBotBtn').addEventListener('click', playWithBot);

document.getElementById('copyBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(lobbyCode);
    const btn = document.getElementById('copyBtn');
    btn.innerHTML = `<svg class="icon-svg" viewBox="0 0 24 24" style="width:16px;height:16px;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    setTimeout(() => { btn.innerHTML = `<svg class="icon-svg" viewBox="0 0 24 24" style="width:16px;height:16px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`; }, 1500);
});

document.getElementById('joinCode').addEventListener('keypress', e => { if (e.key === 'Enter') joinLobby(); });

document.getElementById('chatInput').addEventListener('keypress', e => {
    if (e.key === 'Enter') {
        if (!isLoggedIn) { alert('Войдите в аккаунт чтобы писать в чат'); return; }
        const text = document.getElementById('chatInput').value.trim();
        if (text) { sendGlobalChat(text); document.getElementById('chatInput').value = ''; }
    }
});

document.getElementById('chatSendBtn').addEventListener('click', () => {
    if (!isLoggedIn) { alert('Войдите в аккаунт чтобы писать в чат'); return; }
    const text = document.getElementById('chatInput').value.trim();
    if (text) { sendGlobalChat(text); document.getElementById('chatInput').value = ''; }
});

document.addEventListener('keydown', e => {
    if (document.activeElement.tagName === 'INPUT') return;
    if ((e.key === 'r' || e.key === 'R') && gameStarted && !isSpectator) {
        if (currentGame === 'billiard' && !gameState?.isMoving) {
            if (isOnline && isHost) { initBalls(); gameState.gameStarted = true; syncState(); createScorePanels(); updateScorePanel(); startTurnTimer(); sendGlobalChat(`Рестарт`, true); }
            else if (!isOnline || isBotMode) { initBalls(); createScorePanels(); updateScorePanel(); startTurnTimer(); document.getElementById('foulMessage').textContent = ''; }
        } else if (currentGame === 'pong') {
            if (isBotMode || (isOnline && isHost)) {
                initPongState(); pongState.gameStarted = true; pongState.paused = false;
                pongState.playerNicks = { 1: myNickname, 2: isBotMode ? 'Бот' : playersInfo[2]?.nick || 'Игрок 2' };
                if (isOnline && lobbyRef) lobbyRef.child('pongState').set(pongState);
            }
        }
    }
    if (e.key === 'Escape' && (gameStarted || lobbyCode)) { if (confirm('Выйти?')) leaveLobby(); }
});

document.addEventListener('keyup', e => {
});

// Init
handleAvatarUpload('avatarUpload', 'uploadText', 'regAvatarPreview');
handleAvatarUpload('profileAvatarUpload', 'profileUploadText', 'profileAvatarPreview');
loadAccount();
initFirebase();

// Функция для очистки всех пользователей с 1000 FRP
async function cleanOldUsers() {
    if (!db || !firebaseReady) return;
    const snapshot = await db.ref('users').once('value');
    const users = snapshot.val() || {};
    for (const [key, user] of Object.entries(users)) {
        // Удаляем всех у кого FRP = 1000 или нет статистики
        if (!user.stats || user.stats.billiard?.frp === 1000 || user.stats.billiard?.frp === undefined) {
            await db.ref('users/' + key).remove();
            console.log('Удалён:', key);
        }
    }
    console.log('Очистка завершена');
    loadLeaderboard();
}

// Раскомментируй эту строку ОДИН РАЗ чтобы очистить базу:
// setTimeout(cleanOldUsers, 3000);
setTimeout(() => { hideLoading(); }, 5000);

// Game Loop
(function gameLoop() {
    if (currentGame === 'billiard') {
        updateBilliard();
        drawBilliard();
    } else if (currentGame === 'backgammon') {
        drawBackgammon();
    }
    requestAnimationFrame(gameLoop);
})();
