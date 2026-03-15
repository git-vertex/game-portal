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
    
    document.getElementById('chkPlayer1Count').textContent = `Шашек: ${player1Pieces}`;
    document.getElementById('chkPlayer2Count').textContent = `Шашек: ${player2Pieces}`;
    
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
                    allMoves.push({ from: { row, col }, to: move });
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
    
    const randomMove = movesToUse[Math.floor(Math.random() * movesToUse.length)];
    
    checkersState.selectedPiece = randomMove.from;
    checkersState.validMoves = [randomMove.to];
    
    makeCheckersMove(randomMove.to);
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
    
    updateCheckersInfo();
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
    
    const p1Nick = document.getElementById('chkPlayer1Nick');
    const p2Nick = document.getElementById('chkPlayer2Nick');
    if (p1Nick) p1Nick.textContent = checkersState.playerNicks[1] || 'Игрок 1';
    if (p2Nick) p2Nick.textContent = checkersState.playerNicks[2] || 'Игрок 2';
    
    const p1Panel = document.getElementById('chkPlayer1Panel');
    const p2Panel = document.getElementById('chkPlayer2Panel');
    if (p1Panel) p1Panel.classList.toggle('active', checkersState.currentPlayer === 1);
    if (p2Panel) p2Panel.classList.toggle('active', checkersState.currentPlayer === 2);
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