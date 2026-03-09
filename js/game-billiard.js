// game-billiard.js
// Константы уже определены в config.js

let lastCollisionTime = {};
let lastWallHit = 0;
let cueBallRestoring = false;

function initGameState() {
    gameState = {
        balls: [],
        currentPlayer: 1,
        totalPlayers: 2,
        playerTypes: {},
        playerPocketed: {},
        playerNicks: {},
        playerAvatars: {},
        winner: null,
        isMoving: false,
        foul: false,
        turnPocketedOwn: false,
        gameStarted: false
    };
}

function initBalls() {
    gameState.balls = [];
    gameState.currentPlayer = 1;
    gameState.playerTypes = {};
    gameState.playerPocketed = {};
    gameState.winner = null;
    gameState.isMoving = false;
    gameState.foul = false;
    gameState.turnPocketedOwn = false;
    cueBallRestoring = false;
    
    for (let i = 1; i <= 6; i++) gameState.playerPocketed[i] = [];
    
    // Белый шар
    gameState.balls.push({ 
        id: 0, 
        x: TABLE.x + 200, 
        y: TABLE.y + TABLE.h / 2, 
        vx: 0, 
        vy: 0, 
        type: 'cue', 
        pocketed: false, 
        number: 0, 
        mass: BALL_MASS 
    });
    
    const startX = TABLE.x + 650, startY = TABLE.y + TABLE.h / 2;
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const eight = numbers.splice(numbers.indexOf(8), 1)[0];
    
    for (let i = numbers.length - 1; i > 0; i--) { 
        const j = Math.floor(Math.random() * (i + 1)); 
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]]; 
    }
    numbers.splice(4, 0, eight);
    
    let idx = 0;
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col <= row; col++) {
            const x = startX + row * (BALL_R * 2 + 0.5);
            const y = startY + (col - row / 2) * (BALL_R * 2 + 0.5);
            const num = numbers[idx];
                        let ballType;
            const numPlayers = gameState.totalPlayers || 2;
            const types = ['solid', 'stripe', 'dot', 'ring', 'half', 'diamond'];
            const ballsPerType = Math.floor(14 / numPlayers);
            
            if (num === 8) {
                ballType = 'eight';
            } else {
                const adjustedNum = num > 8 ? num - 1 : num;
                const typeIndex = Math.floor((adjustedNum - 1) / ballsPerType);
                ballType = types[Math.min(typeIndex, numPlayers - 1)];
            }
            gameState.balls.push({ 
                id: idx + 1, 
                x, y, 
                vx: 0, vy: 0, 
                type: ballType, 
                pocketed: false, 
                number: num, 
                mass: BALL_MASS 
            });
            idx++;
        }
    }
}

function ensureGameStateArrays() {
    if (!gameState.playerPocketed) gameState.playerPocketed = {};
    if (!gameState.playerTypes) gameState.playerTypes = {};
    if (!gameState.playerNicks) gameState.playerNicks = {};
    if (!gameState.playerAvatars) gameState.playerAvatars = {};
    if (!gameState.balls) gameState.balls = [];
    for (let i = 1; i <= 6; i++) {
        if (!gameState.playerPocketed[i]) gameState.playerPocketed[i] = [];
    }
}

function getSpeed(b) { 
    return Math.sqrt(b.vx * b.vx + b.vy * b.vy); 
}

function resolveBallCollision(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0 || dist >= BALL_R * 2) return;
    
    const nx = dx / dist, ny = dy / dist, overlap = BALL_R * 2 - dist;
    a.x -= (overlap / 2 + 0.1) * nx; 
    a.y -= (overlap / 2 + 0.1) * ny;
    b.x += (overlap / 2 + 0.1) * nx; 
    b.y += (overlap / 2 + 0.1) * ny;
    
    const dvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (dvn <= 0) return;
    
    const impulse = (2 * dvn * RESTITUTION) / (a.mass + b.mass);
    a.vx -= impulse * b.mass * nx; 
    a.vy -= impulse * b.mass * ny;
    b.vx += impulse * a.mass * nx; 
    b.vy += impulse * a.mass * ny;
    
    const key = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`;
    if (!lastCollisionTime[key] || Date.now() - lastCollisionTime[key] > 50) { 
        lastCollisionTime[key] = Date.now(); 
        playSound('collision'); 
    }
}

function resolveWallCollision(ball) {
    let hit = false; 
    const c = 3;
    
    if (ball.x - BALL_R < TABLE.x + c) { 
        ball.x = TABLE.x + BALL_R + c; 
        ball.vx = -ball.vx * WALL_RESTITUTION; 
        hit = true; 
    }
    if (ball.x + BALL_R > TABLE.x + TABLE.w - c) { 
        ball.x = TABLE.x + TABLE.w - BALL_R - c; 
        ball.vx = -ball.vx * WALL_RESTITUTION; 
        hit = true; 
    }
    if (ball.y - BALL_R < TABLE.y + c) { 
        ball.y = TABLE.y + BALL_R + c; 
        ball.vy = -ball.vy * WALL_RESTITUTION; 
        hit = true; 
    }
    if (ball.y + BALL_R > TABLE.y + TABLE.h - c) { 
        ball.y = TABLE.y + TABLE.h - BALL_R - c; 
        ball.vy = -ball.vy * WALL_RESTITUTION; 
        hit = true; 
    }
    
    if (hit && Date.now() - lastWallHit > 50) { 
        lastWallHit = Date.now(); 
        playSound('wall'); 
    }
}

function checkPockets(ball) {
    for (const p of POCKETS) {
        if (Math.sqrt((ball.x - p.x) ** 2 + (ball.y - p.y) ** 2) < POCKET_R) {
            ball.pocketed = true; 
            ball.vx = 0; 
            ball.vy = 0;
            handlePocketed(ball);
            return true;
        }
    }
    return false;
}

// Исправленная функция восстановления белого шара
function restoreCueBall() {
if (!gameState || !gameState.balls || !gameState.balls[0]) return;

const cue = gameState.balls[0];
if (!cue.pocketed) return;

cueBallRestoring = true;

let newX = TABLE.x + 200;
let newY = TABLE.y + TABLE.h / 2;

let attempts = 0;
let foundPosition = false;

while (!foundPosition && attempts < 100) {
    let collision = false;
    
    for (let i = 1; i < gameState.balls.length; i++) {
        const ball = gameState.balls[i];
        if (ball.pocketed) continue;
        const dist = Math.sqrt((newX - ball.x) ** 2 + (newY - ball.y) ** 2);
        if (dist < BALL_R * 3) {
            collision = true;
            break;
        }
    }
    
    if (!collision) {
        foundPosition = true;
    } else {
        newX += 20;
        if (newX > TABLE.x + TABLE.w / 2) {
            newX = TABLE.x + 80;
            newY += 25;
        }
        if (newY > TABLE.y + TABLE.h - 30) {
            newY = TABLE.y + 30;
            newX = TABLE.x + 80;
        }
    }
    attempts++;
}

cue.pocketed = false;
cue.x = newX;
cue.y = newY;
cue.vx = 0;
cue.vy = 0;

cueBallRestoring = false;

if (isOnline && isHost) {
    setTimeout(() => syncState(), 100);
}
}

function handlePocketed(ball) {
    playSound('pocket');
    
    if (ball.type === 'cue') {
        gameState.foul = true; 
        playSound('foul');
        
        // Восстанавливаем белый шар через небольшую задержку
        setTimeout(() => {
            restoreCueBall();
        }, 800);
        
    } else if (ball.type === 'eight') {
        const pt = gameState.playerTypes[gameState.currentPlayer];
        const rem = gameState.balls.filter(b => !b.pocketed && b.type === pt).length;
        
        if (rem === 0 && pt) { 
        gameState.winner = gameState.currentPlayer; 
        playSound('win'); 
        if (!isSpectator && myPlayer === gameState.currentPlayer) {
            const pocketed = gameState.playerPocketed[myPlayer]?.length || 0;
            recordMatch('billiard', true, pocketed);
        } else if (!isSpectator && myPlayer > 0) {
            const pocketed = gameState.playerPocketed[myPlayer]?.length || 0;
            recordMatch('billiard', false, pocketed);
        }
    } else { 
        const otherPlayer = gameState.currentPlayer % gameState.totalPlayers + 1;
        gameState.winner = otherPlayer;
        playSound('foul');
        if (!isSpectator && myPlayer === otherPlayer) {
            const pocketed = gameState.playerPocketed[myPlayer]?.length || 0;
            recordMatch('billiard', true, pocketed);
        } else if (!isSpectator && myPlayer > 0) {
            const pocketed = gameState.playerPocketed[myPlayer]?.length || 0;
            recordMatch('billiard', false, pocketed);
        }
    }
    } else {
        const cp = gameState.currentPlayer;
        
        if (!gameState.playerTypes[cp] && ball.type !== 'eight') {
            gameState.playerTypes[cp] = ball.type;
        }
        
        if (ball.type === gameState.playerTypes[cp]) { 
            gameState.turnPocketedOwn = true; 
            gameState.playerPocketed[cp].push(ball.number); 
        } else {
            let target = null;
            for (let p = 1; p <= gameState.totalPlayers; p++) { 
                if (gameState.playerTypes[p] === ball.type) { 
                    target = p; 
                    break; 
                } 
            }
            if (!target) { 
                for (let p = 1; p <= gameState.totalPlayers; p++) { 
                    if (!gameState.playerTypes[p] && p !== cp) { 
                        gameState.playerTypes[p] = ball.type; 
                        target = p; 
                        break; 
                    } 
                } 
            }
            if (target) {
                gameState.playerPocketed[target].push(ball.number);
            }
        }
        updateScorePanel();
    }
}

function endTurn() {
    if (gameState.winner) { 
        stopTurnTimer();
        if (isOnline && isHost) syncState(); 
        return; 
    }
    
    document.getElementById('foulMessage').textContent = gameState.foul ? 'ФОЛ' : '';
    
    if (gameState.foul || !gameState.turnPocketedOwn) {
        gameState.currentPlayer = gameState.currentPlayer % gameState.totalPlayers + 1;
    }
    
    gameState.foul = false; 
    gameState.turnPocketedOwn = false;
    
    if (isOnline && isHost) syncState();
    updateScorePanel();
    startTurnTimer();
    
    if (isBotMode && gameState.currentPlayer === 2 && !gameState.winner) {
        setTimeout(botBilliardMove, 1000);
    }
}

function botBilliardMove() {
    if (!gameState || gameState.isMoving || gameState.winner) return;
    
    const cue = gameState.balls[0];
    if (!cue || cue.pocketed) return;
    
    const botType = gameState.playerTypes[2];
    
    // Находим лучший шар и лузу
    let bestShot = null;
    let bestScore = -Infinity;
    
    for (const ball of gameState.balls) {
        if (ball.pocketed || ball.type === 'cue') continue;
        if (ball.type === 'eight') {
            const remaining = gameState.balls.filter(b => !b.pocketed && b.type === botType).length;
            if (remaining > 0) continue;
        }
        if (botType && ball.type !== botType && ball.type !== 'eight') continue;
        
        // Проверяем каждую лузу
        for (const pocket of POCKETS) {
            const shot = calculatePerfectShot(cue, ball, pocket);
            if (shot && shot.score > bestScore) {
                bestScore = shot.score;
                bestShot = shot;
            }
        }
    }
    
    // Если не нашли хороший шар, бьём любой доступный
    if (!bestShot) {
        for (const ball of gameState.balls) {
            if (ball.pocketed || ball.type === 'cue' || ball.type === 'eight') continue;
            for (const pocket of POCKETS) {
                const shot = calculatePerfectShot(cue, ball, pocket);
                if (shot && (!bestShot || shot.score > bestScore)) {
                    bestScore = shot.score;
                    bestShot = shot;
                }
            }
        }
    }
    
    if (bestShot) {
        performShot(bestShot.vx, bestShot.vy);
    }
}

function calculatePerfectShot(cue, ball, pocket) {
    // Вектор от шара к лузе
    const ballToPocketX = pocket.x - ball.x;
    const ballToPocketY = pocket.y - ball.y;
    const ballToPocketDist = Math.sqrt(ballToPocketX ** 2 + ballToPocketY ** 2);
    
    // Нормализуем
    const dirX = ballToPocketX / ballToPocketDist;
    const dirY = ballToPocketY / ballToPocketDist;
    
    // Точка удара - позади шара относительно лузы
    const hitX = ball.x - dirX * BALL_R * 2;
    const hitY = ball.y - dirY * BALL_R * 2;
    
    // Вектор от битка к точке удара
    const cueToHitX = hitX - cue.x;
    const cueToHitY = hitY - cue.y;
    const cueToHitDist = Math.sqrt(cueToHitX ** 2 + cueToHitY ** 2);
    
    // Проверяем есть ли препятствия на пути
    const blocked = isPathBlocked(cue.x, cue.y, hitX, hitY, ball.id);
    if (blocked) return null;
    
    // Проверяем путь шара к лузе
    const ballBlocked = isPathBlocked(ball.x, ball.y, pocket.x, pocket.y, ball.id);
    if (ballBlocked) return null;
    
    // Направление удара
    const shotDirX = cueToHitX / cueToHitDist;
    const shotDirY = cueToHitY / cueToHitDist;
    
    // Рассчитываем оптимальную силу
    const power = Math.min(20, 8 + cueToHitDist * 0.02 + ballToPocketDist * 0.01);
    
    // Оценка выстрела (чем прямее траектория и ближе луза, тем лучше)
    const angle = Math.abs(Math.atan2(dirY, dirX) - Math.atan2(shotDirY, shotDirX));
    const score = 1000 - angle * 100 - ballToPocketDist * 0.5 - cueToHitDist * 0.3;
    
    return {
        vx: shotDirX * power,
        vy: shotDirY * power,
        score: score
    };
}

function isPathBlocked(x1, y1, x2, y2, excludeId) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dirX = dx / dist;
    const dirY = dy / dist;
    
    for (const ball of gameState.balls) {
        if (ball.pocketed || ball.id === excludeId || ball.id === 0) continue;
        
        // Проекция центра шара на линию
        const toBallX = ball.x - x1;
        const toBallY = ball.y - y1;
        const proj = toBallX * dirX + toBallY * dirY;
        
        if (proj < 0 || proj > dist) continue;
        
        const closestX = x1 + dirX * proj;
        const closestY = y1 + dirY * proj;
        const distToLine = Math.sqrt((closestX - ball.x) ** 2 + (closestY - ball.y) ** 2);
        
        if (distToLine < BALL_R * 2.2) return true;
    }
    return false;
}

function updateBilliard() {
    if (!gameStarted || !gameState?.balls || cueBallRestoring) return;
    
    for (let step = 0; step < PHYSICS_STEPS; step++) {
        for (const ball of gameState.balls) { 
            if (!ball.pocketed && getSpeed(ball) > 0) { 
                ball.x += ball.vx / PHYSICS_STEPS; 
                ball.y += ball.vy / PHYSICS_STEPS; 
            } 
        }
        
        for (let iter = 0; iter < 3; iter++) { 
            for (let i = 0; i < gameState.balls.length; i++) { 
                for (let j = i + 1; j < gameState.balls.length; j++) { 
                    const a = gameState.balls[i], b = gameState.balls[j]; 
                    if (!a.pocketed && !b.pocketed) resolveBallCollision(a, b); 
                } 
            } 
        }
        
        for (const ball of gameState.balls) { 
            if (!ball.pocketed) { 
                resolveWallCollision(ball); 
                checkPockets(ball); 
            } 
        }
    }
    
    let anyMoving = false;
    for (const ball of gameState.balls) {
        if (ball.pocketed) continue;
        const speed = getSpeed(ball);
        if (speed > 0) { 
            const f = speed > 10 ? 0.9992 : speed > 5 ? 0.9985 : speed > 2 ? 0.997 : speed > 0.5 ? 0.994 : speed > 0.1 ? 0.99 : 0.98; 
            ball.vx *= f; 
            ball.vy *= f; 
            if (getSpeed(ball) < MIN_VELOCITY) { 
                ball.vx = 0; 
                ball.vy = 0; 
            } else {
                anyMoving = true; 
            }
        }
    }
    
    const wasMoving = gameState.isMoving; 
    gameState.isMoving = anyMoving;
    
    if (wasMoving && !anyMoving) {
        // Проверяем что белый шар на месте перед завершением хода
        const cue = gameState.balls[0];
        if (cue && cue.pocketed && !cueBallRestoring) {
            // Ждем восстановления
            return;
        }
        endTurn();
    }
    
    updateBilliardInfo();
}

function updateBilliardInfo() {
    const el = document.getElementById('info');
    if (!el) return;
    
    if (gameState.winner) { 
        const nick = gameState.playerNicks[gameState.winner]; 
        el.textContent = (isOnline && !isSpectator && gameState.winner === myPlayer) || (isBotMode && gameState.winner === 1) ? 'ПОБЕДА!' : `${nick} победил`; 
        el.style.color = PLAYER_COLORS[gameState.winner - 1]; 
    } else if (gameState.isMoving) { 
        el.textContent = '...'; 
        el.style.color = '#666'; 
    } else { 
        const nick = gameState.playerNicks[gameState.currentPlayer]; 
        el.textContent = (isOnline && !isSpectator) ? (isMyTurn() ? 'ВАШ ХОД' : nick) : (isBotMode ? (gameState.currentPlayer === 1 ? 'ВАШ ХОД' : 'ХОД БОТА') : nick); 
        el.style.color = PLAYER_COLORS[gameState.currentPlayer - 1]; 
    }
}

function predictTrajectory(cueX, cueY, dirX, dirY) {
    let closest = null, closestDist = Infinity, hitPoint = null;
    
    for (const ball of gameState.balls) {
        if (ball.pocketed || ball.type === 'cue') continue;
        const toBallX = ball.x - cueX, toBallY = ball.y - cueY;
        const proj = toBallX * dirX + toBallY * dirY;
        if (proj < 0) continue;
        
        const cx = cueX + dirX * proj, cy = cueY + dirY * proj;
        const d = Math.sqrt((cx - ball.x) ** 2 + (cy - ball.y) ** 2);
        
        if (d < BALL_R * 2) { 
            const offset = Math.sqrt((BALL_R * 2) ** 2 - d ** 2);
            const hitDist = proj - offset; 
            if (hitDist > 0 && hitDist < closestDist) { 
                closestDist = hitDist; 
                closest = ball; 
                hitPoint = { x: cueX + dirX * hitDist, y: cueY + dirY * hitDist }; 
            } 
        }
    }
    
    if (closest && hitPoint) { 
        const nx = closest.x - hitPoint.x, ny = closest.y - hitPoint.y;
        const len = Math.sqrt(nx * nx + ny * ny); 
        if (len > 0) return { ball: closest, hitPoint, direction: { x: nx / len, y: ny / len } }; 
    }
    return null;
}

function performShot(vx, vy) {
    if (!gameState?.balls[0] || gameState.balls[0].pocketed) return;
    
    const cue = gameState.balls[0]; 
    cue.vx = vx; 
    cue.vy = vy;
    gameState.isMoving = true; 
    gameState.foul = false; 
    gameState.turnPocketedOwn = false;
    document.getElementById('foulMessage').textContent = ''; 
    opponentAim = null; 
    playSound('hit');
    stopTurnTimer();
}

function shoot() {
    if (gameState.isMoving || !isMyTurn() || gameState.winner) return;
    
    const cue = gameState.balls[0];
    if (!cue || cue.pocketed) return;
    
    const a = aimAngle + wheelAngleOffset;
    const f = Math.min(power, 200) * 0.12;
    
    performShot(Math.cos(a) * f, Math.sin(a) * f);
    
    if (isOnline) sendShot(Math.cos(a) * f, Math.sin(a) * f);
}

function drawBilliard() {
    if (!gameStarted || !gameState?.balls) return;
    
    ctx.fillStyle = '#080808'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Стол
    ctx.fillStyle = '#0d5c2e'; 
    ctx.fillRect(TABLE.x, TABLE.y, TABLE.w, TABLE.h);
    ctx.strokeStyle = '#3d2817'; 
    ctx.lineWidth = 14; 
    ctx.strokeRect(TABLE.x - 7, TABLE.y - 7, TABLE.w + 14, TABLE.h + 14);
    ctx.strokeStyle = '#1a1a1a'; 
    ctx.lineWidth = 2; 
    ctx.strokeRect(TABLE.x, TABLE.y, TABLE.w, TABLE.h);
    
    // Лузы
    ctx.fillStyle = '#000'; 
    for (const p of POCKETS) { 
        ctx.beginPath(); 
        ctx.arc(p.x, p.y, POCKET_R, 0, Math.PI * 2); 
        ctx.fill(); 
    }
    
    // Линия
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; 
    ctx.lineWidth = 1; 
    ctx.beginPath(); 
    ctx.moveTo(TABLE.x + 250, TABLE.y); 
    ctx.lineTo(TABLE.x + 250, TABLE.y + TABLE.h); 
    ctx.stroke();

    // Шары
    for (const ball of gameState.balls) {
        if (ball.pocketed) continue;
        
        // Тень
        ctx.beginPath(); 
        ctx.arc(ball.x + 2, ball.y + 2, BALL_R, 0, Math.PI * 2); 
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; 
        ctx.fill();
        
        ctx.beginPath(); 
        ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
        
        if (ball.type === 'cue') { 
            const g = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 0, ball.x, ball.y, BALL_R); 
            g.addColorStop(0, '#fff'); 
            g.addColorStop(1, '#ddd'); 
            ctx.fillStyle = g; 
        } else { 
            const c = BALL_COLORS[ball.number];
            const g = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 0, ball.x, ball.y, BALL_R); 
            g.addColorStop(0, lightenColor(c, 40)); 
            g.addColorStop(1, c); 
            ctx.fillStyle = g; 
        }
        ctx.fill();
        
        // Разные типы шаров
        if (ball.type === 'stripe') { 
            ctx.save(); 
            ctx.beginPath(); 
            ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2); 
            ctx.clip(); 
            ctx.fillStyle = '#fff'; 
            ctx.fillRect(ball.x - BALL_R, ball.y - 4, BALL_R * 2, 8); 
            ctx.restore(); 
        } else if (ball.type === 'dot') {
            ctx.beginPath();
            ctx.arc(ball.x - 4, ball.y, 3, 0, Math.PI * 2);
            ctx.arc(ball.x + 4, ball.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        } else if (ball.type === 'ring') {
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_R - 3, 0, Math.PI * 2);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (ball.type === 'half') {
            ctx.save();
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
            ctx.clip();
            ctx.fillStyle = '#fff';
            ctx.fillRect(ball.x - BALL_R, ball.y, BALL_R * 2, BALL_R);
            ctx.restore();
        } else if (ball.type === 'diamond') {
            ctx.save();
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
            ctx.clip();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(ball.x, ball.y - 6);
            ctx.lineTo(ball.x + 5, ball.y);
            ctx.lineTo(ball.x, ball.y + 6);
            ctx.lineTo(ball.x - 5, ball.y);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        
        // Номер
        if (ball.number > 0) { 
            ctx.beginPath(); 
            ctx.arc(ball.x, ball.y, 5, 0, Math.PI * 2); 
            ctx.fillStyle = '#fff'; 
            ctx.fill(); 
            ctx.fillStyle = '#000'; 
            ctx.font = '600 7px Inter'; 
            ctx.textAlign = 'center'; 
            ctx.textBaseline = 'middle'; 
            ctx.fillText(ball.number, ball.x, ball.y); 
        }
        
        // Блик
        ctx.beginPath(); 
        ctx.arc(ball.x - 4, ball.y - 4, 2, 0, Math.PI * 2); 
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; 
        ctx.fill();
    }

    // Прицел оппонента
    if (opponentAim && !gameState.isMoving && !isMyTurn()) {
        const cue = gameState.balls[0];
        if (cue && !cue.pocketed && opponentAim.angle !== undefined) {
            const nx = Math.cos(opponentAim.angle), ny = Math.sin(opponentAim.angle);
            const color = PLAYER_COLORS[gameState.currentPlayer - 1];
            
            ctx.beginPath(); 
            ctx.moveTo(cue.x, cue.y); 
            ctx.lineTo(cue.x + nx * 300, cue.y + ny * 300); 
            ctx.strokeStyle = color + '44'; 
            ctx.lineWidth = 1; 
            ctx.setLineDash([8, 8]); 
            ctx.stroke(); 
            ctx.setLineDash([]);
            
            const off = 20 + (opponentAim.power || 0) * 0.5; 
            ctx.beginPath(); 
            ctx.moveTo(cue.x - nx * off, cue.y - ny * off); 
            ctx.lineTo(cue.x - nx * (off + 140), cue.y - ny * (off + 140)); 
            ctx.strokeStyle = color; 
            ctx.lineWidth = 5; 
            ctx.lineCap = 'round'; 
            ctx.stroke();
        }
    }

    // Мой прицел
    const cue = gameState.balls[0];
    if (cue && !cue.pocketed && isAiming && !gameState.isMoving && isMyTurn()) {
        const totalAngle = aimAngle + wheelAngleOffset;
        const nx = Math.cos(totalAngle), ny = Math.sin(totalAngle);
        
        // Линия прицела
        ctx.beginPath(); 
        ctx.moveTo(cue.x, cue.y); 
        ctx.lineTo(cue.x + nx * 500, cue.y + ny * 500); 
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'; 
        ctx.lineWidth = 1; 
        ctx.stroke();
        
        // Предсказание
        const pred = predictTrajectory(cue.x, cue.y, nx, ny);
        if (pred) {
            ctx.beginPath(); 
            ctx.arc(pred.hitPoint.x, pred.hitPoint.y, BALL_R, 0, Math.PI * 2); 
            ctx.strokeStyle = 'rgba(255,255,255,0.2)'; 
            ctx.lineWidth = 1; 
            ctx.stroke();
            
            ctx.beginPath(); 
            ctx.moveTo(pred.ball.x, pred.ball.y); 
            ctx.lineTo(pred.ball.x + pred.direction.x * 70, pred.ball.y + pred.direction.y * 70); 
            ctx.strokeStyle = 'rgba(255,200,100,0.5)'; 
            ctx.lineWidth = 2; 
            ctx.stroke();
            
            ctx.beginPath(); 
            ctx.arc(pred.ball.x + pred.direction.x * 70, pred.ball.y + pred.direction.y * 70, 3, 0, Math.PI * 2); 
            ctx.fillStyle = 'rgba(255,200,100,0.5)'; 
            ctx.fill();
        }
        
        // Кий
        const off = 20 + power * 0.8; 
        ctx.beginPath(); 
        ctx.moveTo(cue.x - nx * off, cue.y - ny * off); 
        ctx.lineTo(cue.x - nx * (off + 140), cue.y - ny * (off + 140));
        
        const g = ctx.createLinearGradient(cue.x - nx * off, cue.y - ny * off, cue.x - nx * (off + 140), cue.y - ny * (off + 140)); 
        g.addColorStop(0, '#f4d03f'); 
        g.addColorStop(0.15, '#8B4513'); 
        g.addColorStop(1, '#2d1a0a');
        
        ctx.strokeStyle = g; 
        ctx.lineWidth = 7; 
        ctx.lineCap = 'round'; 
        ctx.stroke();
        
        document.getElementById('angleValue').textContent = (wheelAngleOffset * 180 / Math.PI).toFixed(2) + '°';
    }
}