let db = null;
let firebaseReady = false;
let globalChatRef = null;
let lobbyRef = null;
let autoRefreshInterval = null;
let lastChatId = 0;
let lastAimSync = 0;

async function initFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        firebaseReady = true;
        setConnectionStatus(true);
        hideLoading();
        setupGlobalChat();
        loadPublicServers();
        startAutoRefresh();
        startLobbyCleanup();
        db.ref('.info/connected').on('value', (snap) => {
            setConnectionStatus(snap.val() === true);
        });
    } catch (e) {
        console.error('Firebase error:', e);
        hideLoading();
        setConnectionStatus(false);
    }
}

function startLobbyCleanup() {
    setInterval(() => {
        if (!db || !firebaseReady) return;
        db.ref('publicLobbies').once('value').then(snapshot => {
            const lobbies = snapshot.val() || {};
            const now = Date.now();
            for (const [code, data] of Object.entries(lobbies)) {
                if (data.lastUpdate && now - data.lastUpdate > 30000) {
                    db.ref('publicLobbies/' + code).remove();
                    db.ref('lobbies/' + code).remove();
                }
            }
        });
    }, 10000);
}

function setupGlobalChat() {
    if (!db || !firebaseReady) return;
    if (globalChatRef) globalChatRef.off();
    globalChatRef = db.ref('globalChat');
    globalChatRef.orderByChild('time').limitToLast(50).on('child_added', snapshot => {
        const msg = snapshot.val();
        if (msg && msg.time > lastChatId) {
            lastChatId = msg.time;
            addChatMessage(msg.nick, msg.text, msg.system, msg.color, msg.avatar);
        }
    });
}

function sendGlobalChat(text, system = false) {
    if (!db || !firebaseReady) return;
    if (!system && !isLoggedIn) return;
    const color = myPlayer > 0 ? PLAYER_COLORS[myPlayer - 1] : '#888';
    const nick = isLoggedIn ? currentNickname : 'Система';
    db.ref('globalChat').push({
        time: Date.now(),
        nick: system ? '' : nick,
        text,
        system,
        color,
        avatar: system ? '' : (isLoggedIn ? currentAvatar : '')
    });
}

function addChatMessage(nick, text, system, color, avatar) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = 'chatMessage' + (system ? ' system' : '');
    const codePattern = /^[A-Z0-9]{6}$/;
    const hasCode = codePattern.test(text.trim());
    if (system) {
        div.innerHTML = text;
    } else {
        const avatarHtml = avatar ?
            `<div class="avatar" style="background-image: url(${avatar})"></div>` :
            `<div class="avatar" style="display:flex;align-items:center;justify-content:center;border:1px solid var(--border);"><svg style="width:14px;height:14px;stroke:var(--text-muted);fill:none;stroke-width:2;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>`;
        let codeBtn = '';
        if (hasCode) {
            codeBtn = `<button class="chat-code-btn sm" onclick="copyCode('${text.trim()}')" title="Копировать код"><svg class="icon-svg" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>`;
        }
        div.innerHTML = `${avatarHtml}<div class="content"><div class="text-content"><span class="nick" style="color:${color}">${nick}:</span><span class="text">${text}</span></div>${codeBtn}</div>`;
    }
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    while (container.children.length > 100) container.removeChild(container.firstChild);
}

function copyCode(code) {
    navigator.clipboard.writeText(code);
}

function loadPublicServers() {
    if (!db || !firebaseReady) {
        document.getElementById('serverList').innerHTML = '<div class="noServers">Нет подключения</div>';
        document.getElementById('serversCount').textContent = '0 серверов';
        return;
    }
    const list = document.getElementById('serverList');
    db.ref('publicLobbies').once('value').then(snapshot => {
        const lobbies = snapshot.val() || {};
        list.innerHTML = '';
        let count = 0;
        for (const [code, data] of Object.entries(lobbies)) {
            if (data.game !== currentGame) continue;
            if (data.gameStarted) continue;
            if (data.players >= data.maxPlayers) continue;
            const isOwn = code === lobbyCode;
            const item = document.createElement('div');
            item.className = 'serverItem' + (isOwn ? ' own-server' : '');
            item.innerHTML = `<div class="serverName">${data.hostName}${isOwn ? '<span class="own-badge">ВАШ</span>' : ''}</div><div class="serverInfo"><span class="serverPlayers">${data.players}/${data.maxPlayers} игроков</span><span>${code}</span></div>`;
            if (!isOwn) {
                item.onclick = () => {
                    document.getElementById('joinCode').value = code;
                    document.querySelector('[data-tab="join"]').click();
                    joinLobby();
                };
            }
            list.appendChild(item);
            count++;
        }
        document.getElementById('serversCount').textContent = count + ' ' + (count === 1 ? 'сервер' : (count < 5 ? 'сервера' : 'серверов'));
        if (count === 0) {
            list.innerHTML = '<div class="noServers">Нет доступных серверов<br><small style="color:var(--text-muted)">Создайте свой или подождите</small></div>';
        }
    });
}

function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(loadPublicServers, 3000);
}

function updatePublicLobby() {
    if (!db || !firebaseReady || !lobbyCode || isPrivateLobby || isBotMode) return;
    db.ref('publicLobbies/' + lobbyCode).set({
        hostName: isLoggedIn ? currentNickname : 'Гость',
        players: Object.keys(playersInfo).length,
        maxPlayers: maxPlayers,
        gameStarted: gameState?.gameStarted || pongState?.gameStarted || false,
        game: currentGame,
        sessionId: mySessionId,
        lastUpdate: Date.now()
    });
}

function removePublicLobby() {
    if (db && firebaseReady && lobbyCode) {
        db.ref('publicLobbies/' + lobbyCode).remove();
    }
}

function syncState() {
    if (isHost && lobbyRef && gameState) lobbyRef.child('state').set(gameState);
}

function sendShot(vx, vy, spinX, spinY) {
    if (lobbyRef) {
        lobbyRef.child('shot').set({
            vx, vy,
            spinX: spinX || 0,
            spinY: spinY || 0,
            player: myPlayer,
            time: Date.now()
        });
        lobbyRef.child('aim').set(null);
    }
}

function syncAim() {
    if (!lobbyRef || Date.now() - lastAimSync < 50) return;
    lastAimSync = Date.now();
    lobbyRef.child('aim').set({ angle: aimAngle + wheelAngleOffset, power, player: myPlayer });
}

function clearAim() {
    if (lobbyRef) lobbyRef.child('aim').set(null);
    opponentAim = null;
}