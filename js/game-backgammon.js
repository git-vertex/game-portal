// ========== BACKGAMMON GAME ==========

const BG_BOARD = { x: 50, y: 50, w: 700, h: 400 };
const BG_POINT_WIDTH = 50;
const BG_CHECKER_R = 18;

function initBackgammonState() {
    backgammonState = {
        points: Array(24).fill(null).map(() => ({ color: null, count: 0 })),
        bar: { white: 0, black: 0 },
        home: { white: 0, black: 0 },
        currentPlayer: 1,
        dice: [0, 0],
        diceRolled: false,
        movesLeft: [],
        selectedPoint: -1,
        playerNicks: {},
        playerAvatars: {},
        winner: null,
        gameStarted: false
    };
    setupBackgammonBoard();
}

function setupBackgammonBoard() {
    if (!backgammonState) return;
    for (let i = 0; i < 24; i++) {
        backgammonState.points[i] = { color: null, count: 0 };
    }
    backgammonState.points[0] = { color: 'white', count: 2 };
    backgammonState.points[11] = { color: 'white', count: 5 };
    backgammonState.points[16] = { color: 'white', count: 3 };
    backgammonState.points[18] = { color: 'white', count: 5 };
    backgammonState.points[23] = { color: 'black', count: 2 };
    backgammonState.points[12] = { color: 'black', count: 5 };
    backgammonState.points[7] = { color: 'black', count: 3 };
    backgammonState.points[5] = { color: 'black', count: 5 };
}

function rollDice() {
    if (!backgammonState || backgammonState.diceRolled) return;
    if (!isMyTurnBackgammon()) return;
    
    backgammonState.dice[0] = Math.floor(Math.random() * 6) + 1;
    backgammonState.dice[1] = Math.floor(Math.random() * 6) + 1;
    backgammonState.diceRolled = true;
    
    if (backgammonState.dice[0] === backgammonState.dice[1]) {
        backgammonState.movesLeft = [backgammonState.dice[0], backgammonState.dice[0], backgammonState.dice[0], backgammonState.dice[0]];
    } else {
        backgammonState.movesLeft = [backgammonState.dice[0], backgammonState.dice[1]];
    }
    
    updateDiceDisplay();
    playSound('hit');
    
    if (isOnline && lobbyRef) {
        lobbyRef.child('backgammonState').set(backgammonState);
    }
}

function updateDiceDisplay() {
    const d1 = document.getElementById('dice1');
    const d2 = document.getElementById('dice2');
    const rollBtn = document.getElementById('rollDiceBtn');
    
    if (!backgammonState || !d1 || !d2) return;
    
    d1.textContent = backgammonState.dice[0] || '-';
    d2.textContent = backgammonState.dice[1] || '-';
    d1.classList.toggle('rolled', backgammonState.diceRolled && backgammonState.dice[0] > 0);
    d2.classList.toggle('rolled', backgammonState.diceRolled && backgammonState.dice[1] > 0);
    
    if (rollBtn) {
        rollBtn.disabled = backgammonState.diceRolled || !isMyTurnBackgammon();
    }
}

function isMyTurnBackgammon() {
    if (!backgammonState) return false;
    if (isSpectator) return false;
    if (isBotMode) return backgammonState.currentPlayer === 1;
    if (isOnline) return backgammonState.currentPlayer === myPlayer;
    return true;
}

function getPointPosition(index) {
    let x, y;
    if (index < 6) {
        x = BG_BOARD.x + BG_BOARD.w - (index + 0.5) * BG_POINT_WIDTH;
        y = BG_BOARD.y + BG_BOARD.h - BG_CHECKER_R - 10;
    } else if (index < 12) {
        x = BG_BOARD.x + (11 - index + 0.5) * BG_POINT_WIDTH;
        y = BG_BOARD.y + BG_BOARD.h - BG_CHECKER_R - 10;
    } else if (index < 18) {
        x = BG_BOARD.x + (index - 12 + 0.5) * BG_POINT_WIDTH;
        y = BG_BOARD.y + BG_CHECKER_R + 10;
    } else {
        x = BG_BOARD.x + BG_BOARD.w - (index - 18 + 0.5) * BG_POINT_WIDTH;
        y = BG_BOARD.y + BG_CHECKER_R + 10;
    }
    return { x, y };
}

function drawBackgammon() {
    if (!gameStarted || currentGame !== 'backgammon' || !backgammonState) return;
    
    const canvas = document.getElementById('backgammonCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#5c3d2e';
    ctx.fillRect(BG_BOARD.x, BG_BOARD.y, BG_BOARD.w, BG_BOARD.h);
    
    ctx.fillStyle = '#3d2817';
    ctx.fillRect(BG_BOARD.x + BG_BOARD.w/2 - 25, BG_BOARD.y, 50, BG_BOARD.h);
    
    for (let i = 0; i < 12; i++) {
        let x;
        if (i < 6) {
            x = BG_BOARD.x + BG_BOARD.w - (i + 1) * BG_POINT_WIDTH;
        } else {
            x = BG_BOARD.x + (11 - i) * BG_POINT_WIDTH;
        }
        
        ctx.beginPath();
        ctx.moveTo(x, BG_BOARD.y + BG_BOARD.h);
        ctx.lineTo(x + BG_POINT_WIDTH/2, BG_BOARD.y + BG_BOARD.h/2 + 30);
        ctx.lineTo(x + BG_POINT_WIDTH, BG_BOARD.y + BG_BOARD.h);
        ctx.fillStyle = i % 2 === 0 ? '#8b5a2b' : '#d4a574';
        ctx.fill();
        
        let xTop;
        if (i < 6) {
            xTop = BG_BOARD.x + (i) * BG_POINT_WIDTH;
        } else {
            xTop = BG_BOARD.x + BG_BOARD.w - (12 - i) * BG_POINT_WIDTH;
        }
        
        ctx.beginPath();
        ctx.moveTo(xTop, BG_BOARD.y);
        ctx.lineTo(xTop + BG_POINT_WIDTH/2, BG_BOARD.y + BG_BOARD.h/2 - 30);
        ctx.lineTo(xTop + BG_POINT_WIDTH, BG_BOARD.y);
        ctx.fillStyle = i % 2 === 0 ? '#d4a574' : '#8b5a2b';
        ctx.fill();
    }
    
    for (let i = 0; i < 24; i++) {
        const point = backgammonState.points[i];
        if (!point || point.count === 0) continue;
        
        const pos = getPointPosition(i);
        const isTop = i >= 12;
        
        for (let j = 0; j < Math.min(point.count, 5); j++) {
            const yOffset = j * (BG_CHECKER_R * 2 + 4);
            const y = isTop ? pos.y + yOffset : pos.y - yOffset;
            
            ctx.beginPath();
            ctx.arc(pos.x + 2, y + 2, BG_CHECKER_R, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(pos.x, y, BG_CHECKER_R, 0, Math.PI * 2);
            
            const gradient = ctx.createRadialGradient(pos.x - 5, y - 5, 0, pos.x, y, BG_CHECKER_R);
            if (point.color === 'white') {
                gradient.addColorStop(0, '#ffffff');
                gradient.addColorStop(1, '#cccccc');
            } else {
                gradient.addColorStop(0, '#444444');
                gradient.addColorStop(1, '#1a1a1a');
            }
            ctx.fillStyle = gradient;
            ctx.fill();
            
            ctx.strokeStyle = point.color === 'white' ? '#aaa' : '#000';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        if (point.count > 5) {
            const yOffset = 4 * (BG_CHECKER_R * 2 + 4);
            const y = isTop ? pos.y + yOffset : pos.y - yOffset;
            ctx.fillStyle = point.color === 'white' ? '#000' : '#fff';
            ctx.font = 'bold 14px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(point.count.toString(), pos.x, y);
        }
    }
    
    if (backgammonState.selectedPoint >= 0) {
        const pos = getPointPosition(backgammonState.selectedPoint);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, BG_CHECKER_R + 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    
    ctx.strokeStyle = '#2d1a0a';
    ctx.lineWidth = 8;
    ctx.strokeRect(BG_BOARD.x - 4, BG_BOARD.y - 4, BG_BOARD.w + 8, BG_BOARD.h + 8);
}

function startBackgammonGame() {
    gameStarted = true;
    initAudio();
    document.getElementById('menuPanel').style.display = 'none';
    document.getElementById('gameControls').style.display = 'block';
    document.getElementById('gameArea').style.display = 'none';
    document.getElementById('backgammonArea').style.display = 'flex';
    
    if (isSpectator) {
        document.getElementById('bgSpectatorBadge').style.display = 'block';
    }
    
    updateBackgammonInfo();
    updateDiceDisplay();
}

function updateBackgammonInfo() {
    const el = document.getElementById('bgInfo');
    if (!el || !backgammonState) return;
    
    const nick = backgammonState.playerNicks[backgammonState.currentPlayer] || `Игрок ${backgammonState.currentPlayer}`;
    
    if (backgammonState.winner) {
        const winnerNick = backgammonState.playerNicks[backgammonState.winner] || `Игрок ${backgammonState.winner}`;
        el.textContent = isMyTurnBackgammon() && backgammonState.winner === (isBotMode ? 1 : myPlayer) ? 'ПОБЕДА!' : `${winnerNick} победил`;
        el.style.color = PLAYER_COLORS[backgammonState.winner - 1];
    } else if (!backgammonState.diceRolled) {
        el.textContent = isMyTurnBackgammon() ? 'БРОСЬТЕ КОСТИ' : `${nick} бросает`;
        el.style.color = PLAYER_COLORS[backgammonState.currentPlayer - 1];
    } else {
        el.textContent = isMyTurnBackgammon() ? 'ВАШ ХОД' : nick;
        el.style.color = PLAYER_COLORS[backgammonState.currentPlayer - 1];
    }
    
    const p1Nick = document.getElementById('bgPlayer1Nick');
    const p2Nick = document.getElementById('bgPlayer2Nick');
    if (p1Nick) p1Nick.textContent = backgammonState.playerNicks[1] || 'Игрок 1';
    if (p2Nick) p2Nick.textContent = backgammonState.playerNicks[2] || 'Игрок 2';
    
    const p1Panel = document.getElementById('bgPlayer1Panel');
    const p2Panel = document.getElementById('bgPlayer2Panel');
    if (p1Panel) p1Panel.classList.toggle('active', backgammonState.currentPlayer === 1);
    if (p2Panel) p2Panel.classList.toggle('active', backgammonState.currentPlayer === 2);
}

function endBackgammonTurn() {
    if (!backgammonState) return;
    
    backgammonState.currentPlayer = backgammonState.currentPlayer === 1 ? 2 : 1;
    backgammonState.diceRolled = false;
    backgammonState.dice = [0, 0];
    backgammonState.movesLeft = [];
    backgammonState.selectedPoint = -1;
    
    updateBackgammonInfo();
    updateDiceDisplay();
    
    if (isOnline && lobbyRef) {
        lobbyRef.child('backgammonState').set(backgammonState);
    }
    
    if (isBotMode && backgammonState.currentPlayer === 2 && !backgammonState.winner) {
        setTimeout(botBackgammonMove, 1000);
    }
}

function botBackgammonMove() {
    if (!backgammonState || backgammonState.currentPlayer !== 2) return;
    
    backgammonState.dice[0] = Math.floor(Math.random() * 6) + 1;
    backgammonState.dice[1] = Math.floor(Math.random() * 6) + 1;
    backgammonState.diceRolled = true;
    
    if (backgammonState.dice[0] === backgammonState.dice[1]) {
        backgammonState.movesLeft = [backgammonState.dice[0], backgammonState.dice[0], backgammonState.dice[0], backgammonState.dice[0]];
    } else {
        backgammonState.movesLeft = [backgammonState.dice[0], backgammonState.dice[1]];
    }
    
    updateDiceDisplay();
    playSound('hit');
    
    setTimeout(() => {
        endBackgammonTurn();
    }, 2000);
}

function handleBackgammonClick(e) {
    if (!backgammonState || !isMyTurnBackgammon() || !backgammonState.diceRolled) return;
    
    const canvas = document.getElementById('backgammonCanvas');
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const clickedPoint = getClickedPoint(x, y);
    
    if (clickedPoint >= 0) {
        const point = backgammonState.points[clickedPoint];
        const myColor = backgammonState.currentPlayer === 1 ? 'white' : 'black';
        
        if (backgammonState.selectedPoint === -1) {
            if (point && point.color === myColor && point.count > 0) {
                backgammonState.selectedPoint = clickedPoint;
            }
        } else {
            backgammonState.selectedPoint = -1;
        }
    }
}

function getClickedPoint(x, y) {
    for (let i = 0; i < 24; i++) {
        const pos = getPointPosition(i);
        const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
        if (dist < BG_POINT_WIDTH / 2) {
            return i;
        }
    }
    return -1;
}

setTimeout(function() {
    const rollBtn = document.getElementById('rollDiceBtn');
    if (rollBtn) {
        rollBtn.addEventListener('click', rollDice);
    }
    
    const bgCanvas = document.getElementById('backgammonCanvas');
    if (bgCanvas) {
        bgCanvas.addEventListener('click', handleBackgammonClick);
    }
    
    const confirmBtn = document.getElementById('bgConfirmBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
            if (backgammonState && backgammonState.diceRolled) {
                endBackgammonTurn();
            }
        });
    }
}, 1000);