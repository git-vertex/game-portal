// ========== CHECKERS GAME ==========

const CHK_BOARD_SIZE = 560;
const CHK_CELL_SIZE = 70;
const CHK_PIECE_R = 28;

function initCheckersState() {
    checkersState = {
        board: [],
        currentPlayer: 1,
        selectedPiece: null,
        validMoves: [],
        mustCapture: false,
        playerNicks: {},
        playerAvatars: {},
        winner: null,
        gameStarted: false
    };
    setupCheckersBoard();
}

function setupCheckersBoard() {
    if (!checkersState) return;
    
    checkersState.board = [];
    for (let row = 0; row < 8; row++) {
        checkersState.board[row] = [];
        for (let col = 0; col < 8; col++) {
            checkersState.board[row][col] = null;
            
            if ((row + col) % 2 === 1) {
                if (row < 3) {
                    checkersState.board[row][col] = { player: 2, isKing: false };
                } else if (row > 4) {
                    checkersState.board[row][col] = { player: 1, isKing: false };
                }
            }
        }
    }
}

function drawCheckers() {
    if (!gameStarted || currentGame !== 'checkers' || !checkersState) return;
    
    const canvas = document.getElementById('checkersCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const x = col * CHK_CELL_SIZE;
            const y = row * CHK_CELL_SIZE;
            
            if ((row + col) % 2 === 0) {
                ctx.fillStyle = '#f0d9b5';
            } else {
                ctx.fillStyle = '#b58863';
            }
            ctx.fillRect(x, y, CHK_CELL_SIZE, CHK_CELL_SIZE);
            
            if (checkersState.selectedPiece && 
                checkersState.selectedPiece.row === row && 
                checkersState.selectedPiece.col === col) {
                ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
                ctx.fillRect(x, y, CHK_CELL_SIZE, CHK_CELL_SIZE);
            }
        }
    }
    
    for (const move of checkersState.validMoves) {
        const x = move.col * CHK_CELL_SIZE + CHK_CELL_SIZE / 2;
        const y = move.row * CHK_CELL_SIZE + CHK_CELL_SIZE / 2;
        
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fillStyle = move.isCapture ? 'rgba(239, 68, 68, 0.6)' : 'rgba(34, 197, 94, 0.6)';
        ctx.fill();
    }
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = checkersState.board[row][col];
            if (!piece) continue;
            
            const x = col * CHK_CELL_SIZE + CHK_CELL_SIZE / 2;
            const y = row * CHK_CELL_SIZE + CHK_CELL_SIZE / 2;
            
            ctx.beginPath();
            ctx.arc(x + 3, y + 3, CHK_PIECE_R, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(x, y, CHK_PIECE_R, 0, Math.PI * 2);
            
            const gradient = ctx.createRadialGradient(x - 8, y - 8, 0, x, y, CHK_PIECE_R);
            if (piece.player === 1) {
                gradient.addColorStop(0, '#ffffff');
                gradient.addColorStop(1, '#cccccc');
            } else {
                gradient.addColorStop(0, '#4a4a4a');
                gradient.addColorStop(1, '#1a1a1a');
            }
            ctx.fillStyle = gradient;
            ctx.fill();
            
            ctx.strokeStyle = piece.player === 1 ? '#999' : '#000';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            if (piece.isKing) {
                ctx.beginPath();
                ctx.arc(x, y, CHK_PIECE_R - 10, 0, Math.PI * 2);
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 3;
                ctx.stroke();
                
                ctx.fillStyle = '#ffd700';
                ctx.font = 'bold 20px serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('♔', x, y + 2);
            }
        }
    }
    
    ctx.strokeStyle = '#3d2817';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, CHK_BOARD_SIZE, CHK_BOARD_SIZE);
}

function handleCheckersClick(e) {
    if (!checkersState || !isMyTurnCheckers()) return;
    
    const canvas = document.getElementById('checkersCanvas');
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const col = Math.floor(x / CHK_CELL_SIZE);
    const row = Math.floor(y / CHK_CELL_SIZE);
    
    if (row < 0 || row > 7 || col < 0 || col > 7) return;
    
    const clickedPiece = checkersState.board[row][col];
    const myPlayer = isBotMode ? 1 : myPlayer;
    
    if (checkersState.selectedPiece) {
        const move = checkersState.validMoves.find(m => m.row === row && m.col === col);
        
        if (move) {
            makeCheckersMove(move);
            return;
        }
    }
    
    if (clickedPiece && clickedPiece.player === checkersState.currentPlayer) {
        if (isBotMode && checkersState.currentPlayer !== 1) return;
        if (isOnline && checkersState.currentPlayer !== myPlayer) return;
        
        checkersState.selectedPiece = { row, col };
        checkersState.validMoves = getValidMoves(row, col);
        playSound('hit');
    } else {
        checkersState.selectedPiece = null;
        checkersState.validMoves = [];
    }
}

function getValidMoves(row, col) {
    const moves = [];
    const piece = checkersState.board[row][col];
    if (!piece) return moves;
    
    const directions = [];
    if (piece.player === 1 || piece.isKing) {
        directions.push([-1, -1], [-1, 1]);
    }
    if (piece.player === 2 || piece.isKing) {
        directions.push([1, -1], [1, 1]);
    }
    
    const captures = [];
    const regularMoves = [];
    
    for (const [dr, dc] of directions) {
        const newRow = row + dr;
        const newCol = col + dc;
        
        if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
            const target = checkersState.board[newRow][newCol];
            
            if (!target) {
                regularMoves.push({ row: newRow, col: newCol, isCapture: false });
            } else if (target.player !== piece.player) {
                const jumpRow = newRow + dr;
                const jumpCol = newCol + dc;
                
                if (jumpRow >= 0 && jumpRow < 8 && jumpCol >= 0 && jumpCol < 8) {
                    if (!checkersState.board[jumpRow][jumpCol]) {
                        captures.push({ 
                            row: jumpRow, 
                            col: jumpCol, 
                            isCapture: true, 
                            capturedRow: newRow, 
                            capturedCol: newCol 
                        });
                    }
                }
            }
        }
    }
    
    if (captures.length > 0) {
        checkersState.mustCapture = true;
        return captures;
    }
    
    checkersState.mustCapture = false;
    return regularMoves;
}

function makeCheckersMove(move) {
    const from = checkersState.selectedPiece;
    const piece = checkersState.board[from.row][from.col];
    
    checkersState.board[from.row][from.col] = null;
    checkersState.board[move.row][move.col] = piece;
    
    if (move.isCapture) {
        checkersState.board[move.capturedRow][move.capturedCol] = null;
        playSound('pocket');
        
        checkersState.selectedPiece = { row: move.row, col: move.col };
        const moreCapturesArr = [];
        const directions = [];
        if (piece.player === 1 || piece.isKing) {
            directions.push([-1, -1], [-1, 1]);
        }
        if (piece.player === 2 || piece.isKing) {
            directions.push([1, -1], [1, 1]);
        }
        
        for (const [dr, dc] of directions) {
            const newRow = move.row + dr;
            const newCol = move.col + dc;
            
            if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
                const target = checkersState.board[newRow][newCol];
                if (target && target.player !== piece.player) {
                    const jumpRow = newRow + dr;
                    const jumpCol = newCol + dc;
                    if (jumpRow >= 0 && jumpRow < 8 && jumpCol >= 0 && jumpCol < 8) {
                        if (!checkersState.board[jumpRow][jumpCol]) {
                            moreCapturesArr.push({ 
                                row: jumpRow, 
                                col: jumpCol, 
                                isCapture: true, 
                                capturedRow: newRow, 
                                capturedCol: newCol 
                            });
                        }
                    }
                }
            }
        }
        
        if (moreCapturesArr.length > 0) {
            checkersState.validMoves = moreCapturesArr;
            syncCheckersState();
            return;
        }
    }
    
    if ((piece.player === 1 && move.row === 0) || (piece.player === 2 && move.row === 7)) {
        piece.isKing = true;
        playSound('win');
    }
    
    checkWinner();
    
    if (!checkersState.winner) {
        checkersState.currentPlayer = checkersState.currentPlayer === 1 ? 2 : 1;
    }
    
    checkersState.selectedPiece = null;
    checkersState.validMoves = [];
    
    updateCheckersInfo();
    syncCheckersState();
    
    if (isBotMode && checkersState.currentPlayer === 2 && !checkersState.winner) {
        setTimeout(botCheckersMove, 800);
    }
}

function checkWinner() {
    let player1Pieces = 0;
    let player2Pieces = 0;
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = checkersState.board[row][col];
            if (piece) {
                if (piece.player === 1) player1Pieces++;
                else player2Pieces++;
            }
        }
    }
    
    const p1El = document.getElementById('chkPlayer1Count');
    const p2El = document.getElementById('chkPlayer2Count');
    if (p1El) p1El.textContent = `Шашек: ${player1Pieces}`;
    if (p2El) p2El.textContent = `Шашек: ${player2Pieces}`;
    
    if (player1Pieces === 0) {
        checkersState.winner = 2;
        playSound('foul');
    } else if (player2Pieces === 0) {
        checkersState.winner = 1;
        playSound('win');
    }
}

function botCheckersMove() {
    if (!checkersState || checkersState.currentPlayer !== 2 || checkersState.winner) return;
    
    const allMoves = [];
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = checkersState.board[row][col];
            if (piece && piece.player === 2) {
                const moves = getValidMoves(row, col);
                for (const move of moves) {
                    allMoves.push({ from: { row, col }, to: move, piece });
                }
            }
        }
    }
    
    const captures = allMoves.filter(m => m.to.isCapture);
    const movesToUse = captures.length > 0 ? captures : allMoves;
    
    if (movesToUse.length === 0) {
        checkersState.winner = 1;
        updateCheckersInfo();
        return;
    }
    
    // Умный выбор хода
    let bestMove = null;
    let bestScore = -9999;
    
    for (const move of movesToUse) {
        let score = 0;
        
        // Взятие - приоритет
        if (move.to.isCapture) {
            score += 100;
        }
        
        // Продвижение к дамке (ближе к краю)
        if (!move.piece.isKing) {
            score += move.to.row * 5; // Чем ближе к низу, тем лучше для чёрных
        }
        
        // Бонус за становление дамкой
        if (move.to.row === 7 && !move.piece.isKing) {
            score += 80;
        }
        
        // Держаться центра
        const centerDist = Math.abs(3.5 - move.to.col);
        score -= centerDist * 3;
        
        // Защита задней линии в начале
        if (move.from.row === 0 && !move.piece.isKing) {
            score -= 20;
        }
        
        // Дамки ценнее - двигать активнее
        if (move.piece.isKing) {
            score += 15;
        }
        
        // Небольшая случайность
        score += Math.random() * 10;
        
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }
    
    if (!bestMove) {
        bestMove = movesToUse[Math.floor(Math.random() * movesToUse.length)];
    }
    
    checkersState.selectedPiece = bestMove.from;
    checkersState.validMoves = [bestMove.to];
    
    makeCheckersMove(bestMove.to);
}

function isMyTurnCheckers() {
    if (!checkersState) return false;
    if (isSpectator) return false;
    if (isBotMode) return checkersState.currentPlayer === 1;
    if (isOnline) return checkersState.currentPlayer === myPlayer;
    return true;
}

function startCheckersGame() {
    gameStarted = true;
    initAudio();
    document.getElementById('menuPanel').style.display = 'none';
    document.getElementById('gameControls').style.display = 'block';
    document.getElementById('gameArea').style.display = 'none';
    document.getElementById('checkersArea').style.display = 'flex';
    
    if (isSpectator) {
        document.getElementById('chkSpectatorBadge').style.display = 'block';
    }
    
    createCheckersScorePanels();
    updateCheckersInfo();
}

function createCheckersScorePanels() {
    const panel = document.getElementById('checkersScorePanel');
    if (!panel) return;
    
    panel.innerHTML = '';
    
    const totalPlayers = Object.keys(checkersState.playerNicks).length || 2;
    
    for (let i = 1; i <= totalPlayers; i++) {
        const div = document.createElement('div');
        div.className = 'playerPanel';
        div.id = `chkPlayer${i}Panel`;
        div.style.setProperty('--player-color', PLAYER_COLORS[i - 1]);
        
        const isMe = isOnline && i === myPlayer && !isSpectator;
        const nick = checkersState.playerNicks[i] || `Игрок ${i}`;
        const isPlaying = i <= 2;
        
        div.innerHTML = `
            <div class="playerHeader">
                <span class="playerNick" style="color:${PLAYER_COLORS[i - 1]}">${nick}</span>
                ${isMe ? '<span class="playerYou">вы</span>' : ''}
                ${!isPlaying ? '<span class="playerYou">наблюдает</span>' : ''}
            </div>
            <div class="playerInfo">
                <span class="playerType" id="chkPlayer${i}Count">${isPlaying ? 'Шашек: 12' : ''}</span>
            </div>
        `;
        panel.appendChild(div);
    }
}

function updateCheckersInfo() {
    const el = document.getElementById('chkInfo');
    if (!el || !checkersState) return;
    
    const nick = checkersState.playerNicks[checkersState.currentPlayer] || `Игрок ${checkersState.currentPlayer}`;
    
    if (checkersState.winner) {
        const winnerNick = checkersState.playerNicks[checkersState.winner] || `Игрок ${checkersState.winner}`;
        const isMe = (isBotMode && checkersState.winner === 1) || (isOnline && checkersState.winner === myPlayer);
        el.textContent = isMe ? 'ПОБЕДА!' : `${winnerNick} победил`;
        el.style.color = PLAYER_COLORS[checkersState.winner - 1];
    } else {
        el.textContent = isMyTurnCheckers() ? 'ВАШ ХОД' : nick;
        el.style.color = PLAYER_COLORS[checkersState.currentPlayer - 1];
    }
    
    // Обновить все панели игроков
    const totalPlayers = Object.keys(checkersState.playerNicks).length || 2;
    for (let i = 1; i <= totalPlayers; i++) {
        const panel = document.getElementById(`chkPlayer${i}Panel`);
        if (panel) {
            panel.classList.toggle('active', checkersState.currentPlayer === i && i <= 2);
        }
    }
}

function syncCheckersState() {
    if (isOnline && lobbyRef && checkersState) {
        lobbyRef.child('checkersState').set(checkersState);
    }
}

setTimeout(function() {
    const chkCanvas = document.getElementById('checkersCanvas');
    if (chkCanvas) {
        chkCanvas.addEventListener('click', handleCheckersClick);
    }
}, 1000);