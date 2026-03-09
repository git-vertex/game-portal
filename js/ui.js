// ui.js

// ВАЖНО: Объявления переменных В САМОМ НАЧАЛЕ
let turnTimerInterval = null;
let turnTimeLeft = 20;
let historySortMode = 'recent';
let leaderboardData = [];

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function startTurnTimer() {
    stopTurnTimer();
    if (!gameState || gameState.winner) return;
    turnTimeLeft = TURN_TIME;
    updateTimerDisplay();
    turnTimerInterval = setInterval(() => {
        if (!gameState || gameState.winner || gameState.isMoving) return;
        turnTimeLeft--;
        updateTimerDisplay();
        if (turnTimeLeft <= 0) {
            stopTurnTimer();
            if (isBotMode || isHost || (!isOnline && !isBotMode)) {
                gameState.foul = true;
                gameState.currentPlayer = gameState.currentPlayer % gameState.totalPlayers + 1;
                gameState.turnPocketedOwn = false;
                if (isOnline && isHost) syncState();
                updateScorePanel();
                document.getElementById('foulMessage').textContent = 'ФОЛ';
                startTurnTimer();
                if (isBotMode && gameState.currentPlayer === 2) {
                    setTimeout(botBilliardMove, 1000);
                }
            }
        }
    }, 1000);
}

function stopTurnTimer() {
    if (turnTimerInterval) { 
        clearInterval(turnTimerInterval); 
        turnTimerInterval = null; 
    }
}

function updateTimerDisplay() {
    const el = document.getElementById('turnTimer');
    if (el) {
        el.textContent = turnTimeLeft;
        el.classList.toggle('warning', turnTimeLeft <= 5);
    }
}

function switchGame(game) {
    currentGame = 'billiard';
}

function showMenu() {
    document.getElementById('menuPanel').style.display = 'flex';
    document.getElementById('gameArea').style.display = 'none';
    document.getElementById('gameControls').style.display = 'none';
    document.getElementById('lobbyInfo').style.display = 'none';
    document.getElementById('createSection').style.display = 'block';
    gameStarted = false;
    startAutoRefresh();
}

function showLobbyUI() {
    document.getElementById('lobbyInfo').style.display = 'flex';
    document.getElementById('createSection').style.display = 'none';
}

function showGame() {
    document.getElementById('menuPanel').style.display = 'none';
    document.getElementById('gameControls').style.display = 'block';
    document.getElementById('gameArea').style.display = 'flex';
}

function updateViewersCount() {
    const el = document.getElementById('viewersCount');
    if (el) {
        el.textContent = lobbyCode ? `${lobbyCode}` : '';
    }
}

function updatePlayersList() {
    const container = document.getElementById('playersList');
    if (!container) return;
    
    container.innerHTML = '';
    
    const table = document.createElement('table');
    table.className = 'players-table';
    
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr><th style="width: 50%;">Игрок</th><th style="width: 25%;">Рейтинг</th><th style="width: 25%;">Статус</th></tr>`;
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    
    for (const [num, info] of Object.entries(playersInfo)) {
        const color = PLAYER_COLORS[parseInt(num) - 1];
        const isMe = info.sessionId === mySessionId;
        const isHostPlayer = parseInt(num) === 1;
        
        const row = document.createElement('tr');
        
        const avatarHtml = info.avatar 
            ? `<img src="${info.avatar}" alt="">` 
            : `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
        
        let badges = '';
        if (isHostPlayer) badges += '<span class="badge badge-host">ХОСТ</span>';
        if (isMe) badges += '<span class="badge badge-you">ВЫ</span>';
        
        const isCurrentUser = info.sessionId === mySessionId;
        const rating = isCurrentUser ? (playerStats[currentGame]?.frp || 1000) : (info.frp || 1000);
        
        row.innerHTML = `
            <td>
                <div class="player-cell">
                    <div class="player-avatar" style="border-color: ${color}">${avatarHtml}</div>
                    <div>
                        <div class="player-name" style="color: ${color}">${info.nick}</div>
                        <div class="player-badges">${badges}</div>
                    </div>
                </div>
            </td>
            <td><span style="color: var(--accent-green); font-weight: 600;">${rating}</span></td>
            <td><span class="status-ready">Готов</span></td>
        `;
        tbody.appendChild(row);
    }
    
    // Пустые слоты
    const count = Object.keys(playersInfo).length;
    for (let i = count; i < maxPlayers; i++) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="player-cell">
                    <div class="player-avatar">
                        <svg class="icon-svg" viewBox="0 0 24 24">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    </div>
                    <div>
                        <div class="player-name" style="color: var(--text-muted)">Ожидание...</div>
                    </div>
                </div>
            </td>
            <td><span style="color: var(--text-muted);">-</span></td>
            <td><span class="status-waiting">Пусто</span></td>
        `;
        tbody.appendChild(row);
    }
    
    table.appendChild(tbody);
    container.appendChild(table);
    
    document.getElementById('status').textContent = `Игроки: ${count}/${maxPlayers}`;
    document.getElementById('startGameBtn').disabled = count < 2 && !isBotMode;
    
    updatePublicLobby();
}

function createScorePanels() {
    const panel = document.getElementById('scorePanel');
    if (!panel) return;
    
    panel.innerHTML = '';
    
    for (let i = 1; i <= gameState.totalPlayers; i++) {
        const div = document.createElement('div');
        div.className = 'playerPanel';
        div.id = `player${i}Panel`;
        div.style.setProperty('--player-color', PLAYER_COLORS[i - 1]);
        
        const isMe = isOnline && i === myPlayer && !isSpectator;
        const nick = gameState.playerNicks[i] || `Игрок ${i}`;
        
        div.innerHTML = `
            <div class="playerHeader">
                <span class="playerNick" style="color:${PLAYER_COLORS[i-1]}">${nick}</span>
                ${isMe ? '<span class="playerYou">вы</span>' : ''}
                <span class="playerDisconnected" id="p${i}Disconnected" style="display:none;">ВЫШЕЛ</span>
            </div>
            <div class="playerInfo">
                <canvas id="p${i}TypeIcon" width="20" height="20" style="display:none;"></canvas>
                <span class="playerType" id="p${i}Type">-</span>
                <div class="pocketedBalls" id="p${i}Balls"></div>
            </div>
        `;
        panel.appendChild(div);
    }
}

function updateScorePanel() {
    for (let i = 1; i <= gameState.totalPlayers; i++) {
        const panel = document.getElementById(`player${i}Panel`);
        if (!panel) continue;
        
        const typeEl = document.getElementById(`p${i}Type`);
        const ballsEl = document.getElementById(`p${i}Balls`);
        const disconnectedEl = document.getElementById(`p${i}Disconnected`);
        
        const pType = gameState.playerTypes[i];
        if (typeEl) {
                    const typeNames = {
                'solid': 'Сплошные',
                'stripe': 'Полосатые', 
                'dot': 'Точечные',
                'ring': 'Кольцевые',
                'half': 'Половинчатые',
                'diamond': 'Ромбовые'
            };
            typeEl.textContent = pType ? (typeNames[pType] || pType) : '-';
            
            const iconCanvas = document.getElementById(`p${i}TypeIcon`);
            if (iconCanvas && pType) {
                iconCanvas.style.display = 'inline-block';
                drawBallTypeIcon(iconCanvas, pType);
            } else if (iconCanvas) {
                iconCanvas.style.display = 'none';
            }
        }
        
        if (ballsEl) {
            ballsEl.innerHTML = '';
            (gameState.playerPocketed[i] || []).forEach(num => {
                const ball = document.createElement('div');
                ball.className = 'miniBall' + (num > 8 ? ' stripe' : '');
                ball.style.setProperty('--ball-color', BALL_COLORS[num]);
                if (num <= 8) ball.style.background = BALL_COLORS[num];
                ball.style.color = (num === 1 || num === 9) ? '#000' : '#fff';
                ball.textContent = num;
                ballsEl.appendChild(ball);
            });
        }
        
        panel.classList.toggle('active', gameState.currentPlayer === i);
        
        const isDisconnected = disconnectedPlayers.has(i);
        panel.classList.toggle('disconnected', isDisconnected);
        if (disconnectedEl) {
            disconnectedEl.style.display = isDisconnected ? 'inline' : 'none';
        }
    }
}
function drawBallTypeIcon(canvas, type) {
    const ctx = canvas.getContext('2d');
    const size = 20;
    const r = 8;
    const cx = size / 2;
    const cy = size / 2;
    
    ctx.clearRect(0, 0, size, size);
    
    // Базовый шар
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#e67e22';
    ctx.fill();
    
    // Тип
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    
    if (type === 'stripe') {
        ctx.fillRect(cx - r, cy - 2, r * 2, 4);
    } else if (type === 'dot') {
        ctx.beginPath();
        ctx.arc(cx - 3, cy, 2, 0, Math.PI * 2);
        ctx.arc(cx + 3, cy, 2, 0, Math.PI * 2);
        ctx.fill();
    } else if (type === 'ring') {
        ctx.beginPath();
        ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
        ctx.stroke();
    } else if (type === 'half') {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI);
        ctx.fill();
    } else if (type === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(cx, cy - 5);
        ctx.lineTo(cx + 4, cy);
        ctx.lineTo(cx, cy + 5);
        ctx.lineTo(cx - 4, cy);
        ctx.closePath();
        ctx.fill();
    }
}
function isMyTurn() {
    if (isSpectator) return false;
    if (!isOnline && !isBotMode) return true;
    if (isBotMode) return gameState.currentPlayer === 1;
    return gameState.currentPlayer === myPlayer;
}

function toggleLeftPanel() {
    document.getElementById('leftPanel').classList.toggle('collapsed');
}

function toggleChat() {
    const chatPanel = document.getElementById('chatPanel');
    const toggleBtn = document.getElementById('toggleChatBtn');
    
    chatPanel.classList.toggle('hidden');
    toggleBtn.classList.toggle('chat-hidden');
}

function openStatsModal() {
    document.getElementById('statsModal').classList.add('show');
    
    // Для гостей показываем только лидерборд
    const statsTabs = document.querySelectorAll('.stats-tab');
    const statsContents = document.querySelectorAll('.stats-content');
    
    if (!isLoggedIn) {
        statsTabs.forEach(tab => {
            if (tab.dataset.stats !== 'leaderboard') {
                tab.style.display = 'none';
            } else {
                tab.classList.add('active');
            }
        });
        statsContents.forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById('statsLeaderboard').classList.add('active');
        loadLeaderboard();
    } else {
        statsTabs.forEach(tab => {
            tab.style.display = '';
        });
        updateStatsDisplay();
        loadLeaderboard();
    }
}

function closeStatsModal() {
    document.getElementById('statsModal').classList.remove('show');
}

function updateStatsDisplay() {
    const totalGames = playerStats.billiard?.games || 0;
    const totalWins = playerStats.billiard?.wins || 0;
    const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
    const totalRating = playerStats.billiard?.frp || 0;

    // Диаграмма винрейта
    const circumference = 2 * Math.PI * 54;
    const offset = circumference - (winRate / 100) * circumference;
    
    const chartFill = document.getElementById('statsChartFill');
    if (chartFill) {
        chartFill.style.strokeDasharray = circumference;
        chartFill.style.strokeDashoffset = offset;
    }
    
    const winrateEl = document.getElementById('statsWinrateValue');
    if (winrateEl) winrateEl.textContent = winRate + '%';
    
    const totalGamesEl = document.getElementById('statsTotalGames');
    if (totalGamesEl) totalGamesEl.textContent = totalGames;
    
    const totalWinsEl = document.getElementById('statsTotalWins');
    if (totalWinsEl) totalWinsEl.textContent = totalWins;
    
    const totalLossesEl = document.getElementById('statsTotalLosses');
    if (totalLossesEl) totalLossesEl.textContent = totalGames - totalWins;
    
    const ratingEl = document.getElementById('statsRatingValue');
    if (ratingEl) ratingEl.textContent = totalRating;
    
        // Статистика по играм
    document.getElementById('billiardGames').textContent = playerStats.billiard?.games || 0;
    document.getElementById('billiardWins').textContent = playerStats.billiard?.wins || 0;
    document.getElementById('billiardRating').textContent = playerStats.billiard?.frp || 0;
    // Диаграммы по играм
    updateGameCharts();
    updateMatchHistory();
}

function updateGameCharts() {
    // Бильярд
    const billiardGames = playerStats.billiard?.games || 0;
    const billiardWins = playerStats.billiard?.wins || 0;
    const billiardWinRate = billiardGames > 0 
        ? Math.round((billiardWins / billiardGames) * 100) 
        : 0;
    
    const billiardBar = document.getElementById('billiardWinBar');
    if (billiardBar) {
        billiardBar.style.width = billiardWinRate + '%';
    }
    const billiardPercent = document.getElementById('billiardWinPercent');
    if (billiardPercent) {
        billiardPercent.textContent = billiardWinRate + '%';
    }
}

function setHistorySort(mode) {
    historySortMode = mode;
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sort === mode);
    });
    updateMatchHistory();
}

function updateMatchHistory() {
    const historyContainer = document.getElementById('matchHistory');
    if (!historyContainer) return;
    
    if (!playerStats.history || playerStats.history.length === 0) { 
        historyContainer.innerHTML = '<div class="noServers">Нет истории матчей</div>'; 
        return; 
    }
    
    let sorted = [...playerStats.history];
    switch (historySortMode) {
        case 'wins': sorted = sorted.filter(m => m.won); break;
        case 'losses': sorted = sorted.filter(m => !m.won); break;
    }
    
    if (sorted.length === 0) { 
        historyContainer.innerHTML = `<div class="noServers">Нет ${historySortMode === 'wins' ? 'побед' : 'поражений'}</div>`; 
        return; 
    }
    
    historyContainer.innerHTML = '';
    sorted.slice(0, 20).forEach((match) => {
        const date = new Date(match.date);
        const dateStr = date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        const item = document.createElement('div');
        item.className = 'match-item';
        item.innerHTML = `
            <div class="match-result ${match.won ? 'win' : 'loss'}">${match.won ? 'WIN' : 'LOSS'}</div>
            <div class="match-info">
                <div class="match-game">${match.game === 'billiard' ? 'Бильярд' : 'Пинг-понг'} vs ${match.opponent}</div>
                <div class="match-date">${dateStr}</div>
                <div class="match-rating">${match.ratingChange > 0 ? '+' : ''}${match.ratingChange || 0} FRP</div>
            </div>
        `;
        historyContainer.appendChild(item);
    });
}

// Лидерборд
async function loadLeaderboard() {
    if (!db || !firebaseReady) return;
    
    try {
        const snapshot = await db.ref('users').orderByChild('stats/billiard/frp').limitToLast(50).once('value');
        const users = snapshot.val() || {};
        
        leaderboardData = [];
        for (const [key, user] of Object.entries(users)) {
            const totalRating = Math.round(((user.stats?.billiard?.frp || 1000) + (user.stats?.pong?.frp || 1000)) / 2);
            leaderboardData.push({
                nickname: user.nickname,
                avatar: user.avatar || '',
                country: user.country || 'XX',
                rating: totalRating,
                games: (user.stats?.billiard?.games || 0) + (user.stats?.pong?.games || 0),
                wins: (user.stats?.billiard?.wins || 0) + (user.stats?.pong?.wins || 0)
            });
        }
        
        leaderboardData.sort((a, b) => b.rating - a.rating);
        updateLeaderboardDisplay();
    } catch (e) {
        console.error('Error loading leaderboard:', e);
    }
}

function updateLeaderboardDisplay() {
    const container = document.getElementById('leaderboardList');
    if (!container) return;
    
    if (leaderboardData.length === 0) {
        container.innerHTML = '<div class="noServers">Нет данных</div>';
        return;
    }
    
    container.innerHTML = '';
    
    leaderboardData.slice(0, 20).forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item' + (player.nickname === currentNickname ? ' is-me' : '');
        
        const avatarHtml = player.avatar 
            ? `<img src="${player.avatar}" alt="">` 
            : `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
        
        const flagEmoji = getCountryFlag(player.country);
        
        item.innerHTML = `
            <div class="lb-rank">${index + 1}</div>
            <div class="lb-avatar">${avatarHtml}</div>
            <div class="lb-info">
                <div class="lb-name">
                    <span class="lb-country">${flagEmoji} ${player.country.toUpperCase()}</span>
                    ${player.nickname}
                </div>
                <div class="lb-stats">${player.wins}W / ${player.games - player.wins}L</div>
            </div>
            <div class="lb-rating">${player.rating} <span style="font-size: 12px; opacity: 0.7;">FRP</span></div>
        `;
        container.appendChild(item);
    });
}

function getCountryFlag(countryCode) {
    const code = countryCode.toUpperCase();
    if (code.length !== 2) return '';
    
    // Преобразуем буквы в региональные индикаторы
    const offset = 127397;
    const chars = [...code].map(c => String.fromCodePoint(c.charCodeAt(0) + offset));
    return chars.join('');
}

// Улучшенная система рейтинга
function recordMatch(game, won, pocketedCount = 0) {
    if (isBotMode) return;
    if (!isLoggedIn) return;
    if (!playerStats[game]) playerStats[game] = { games: 0, wins: 0, frp: 1000 };
    
    playerStats[game].games++;
    if (won) playerStats[game].wins++;
    
    let ratingChange;
    const maxBalls = game === 'billiard' ? 7 : 5;
    
    if (won) {
        const baseWin = 15;
        const maxBonus = 20;
        const ballBonus = Math.round((pocketedCount / maxBalls) * maxBonus);
        ratingChange = baseWin + ballBonus;
    } else {
        const baseLoss = -20;
        const maxReduction = 15;
        const reduction = Math.round((pocketedCount / maxBalls) * maxReduction);
        ratingChange = baseLoss + reduction;
    }
    
    playerStats[game].frp = Math.max(0, playerStats[game].frp + ratingChange);
    
    // Определяем оппонента
    let opponent = 'Unknown';
    if (game === 'billiard' && gameState) {
        const oppPlayer = myPlayer === 1 ? 2 : 1;
        opponent = gameState.playerNicks[oppPlayer] || 'Unknown';
    } else if (game === 'pong' && pongState) {
        const oppPlayer = myPlayer === 1 ? 2 : 1;
        opponent = pongState.playerNicks[oppPlayer] || 'Unknown';
    }
    
    playerStats.history.unshift({
        game, 
        won, 
        date: Date.now(),
        opponent,
        ratingChange,
        pocketed: pocketedCount
    });
    
    if (playerStats.history.length > 50) {
        playerStats.history = playerStats.history.slice(0, 50);
    }
    
    saveStats();
    
    if (db && firebaseReady && isLoggedIn) {
        db.ref('users/' + currentNickname.toLowerCase() + '/stats').set(playerStats);
    }
}