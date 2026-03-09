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
    
    // НЕВОЗМОЖНЫЙ БОТ: Полная симуляция всех возможных ударов
    let bestShot = null;
    let bestScore = -Infinity;
    
    // Получаем целевые шары
    const targetBalls = gameState.balls.filter(b => {
        if (b.pocketed || b.type === 'cue') return false;
        if (b.type === 'eight') {
            const remaining = gameState.balls.filter(x => !x.pocketed && x.type === botType).length;
            return remaining === 0 && botType;
        }
        if (botType && b.type !== botType) return false;
        return true;
    });
    
    // Пробуем прямые удары
    for (const ball of targetBalls) {
        for (const pocket of POCKETS) {
            const shot = calculateDirectShot(cue, ball, pocket);
            if (shot && shot.score > bestScore) {
                bestScore = shot.score;
                bestShot = shot;
            }
        }
    }
    
    // Пробуем удары с отскоком от борта
    for (const ball of targetBalls) {
        for (const pocket of POCKETS) {
            const shot = calculateCushionShot(cue, ball, pocket);
            if (shot && shot.score > bestScore) {
                bestScore = shot.score;
                bestShot = shot;
            }
        }
    }
    
    // Пробуем комбинации (удар через другой шар)
    for (const ball of targetBalls) {
        for (const pocket of POCKETS) {
            const shot = calculateComboShot(cue, ball, pocket);
            if (shot && shot.score > bestScore) {
                bestScore = shot.score;
                bestShot = shot;
            }
        }
    }
    
    // Симулируем лучшие удары для проверки
    if (bestShot) {
        const simResult = simulateShot(bestShot.vx, bestShot.vy);
        if (simResult.pocketed > 0) {
            bestShot.score += simResult.pocketed * 500;
        }
    }
    
    // Если ничего не нашли, бьём в любой шар
    if (!bestShot) {
        for (const ball of gameState.balls) {
            if (ball.pocketed || ball.type === 'cue') continue;
            const dx = ball.x - cue.x;
            const dy = ball.y - cue.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            bestShot = { vx: (dx / dist) * 15, vy: (dy / dist) * 15, score: 0 };
            break;
        }
    }
    
    if (bestShot) {
        performShot(bestShot.vx, bestShot.vy);
    }
}

// Прямой удар в шар -> луза
function calculateDirectShot(cue, ball, pocket) {
    const ballToPocketX = pocket.x - ball.x;
    const ballToPocketY = pocket.y - ball.y;
    const ballToPocketDist = Math.sqrt(ballToPocketX ** 2 + ballToPocketY ** 2);
    
    const dirX = ballToPocketX / ballToPocketDist;
    const dirY = ballToPocketY / ballToPocketDist;
    
    // Точка удара - позади шара
    const hitX = ball.x - dirX * BALL_R * 2;
    const hitY = ball.y - dirY * BALL_R * 2;
    
    // Проверка на столе
    if (hitX < TABLE.x || hitX > TABLE.x + TABLE.w || hitY < TABLE.y || hitY > TABLE.y + TABLE.h) {
        return null;
    }
    
    const cueToHitX = hitX - cue.x;
    const cueToHitY = hitY - cue.y;
    const cueToHitDist = Math.sqrt(cueToHitX ** 2 + cueToHitY ** 2);
    
    if (cueToHitDist < BALL_R * 2) return null;
    
    // Проверка препятствий
    if (isPathBlocked(cue.x, cue.y, hitX, hitY, ball.id, 0)) return null;
    if (isPathBlocked(ball.x, ball.y, pocket.x, pocket.y, ball.id, ball.id)) return null;
    
    const shotDirX = cueToHitX / cueToHitDist;
    const shotDirY = cueToHitY / cueToHitDist;
    
    // Идеальная сила для забития
    const totalDist = cueToHitDist + ballToPocketDist;
    const power = Math.min(22, Math.max(8, totalDist * 0.025 + 10));
    
    // Оценка: чем прямее угол, тем лучше
    const hitAngle = Math.abs(Math.atan2(dirY, dirX) - Math.atan2(shotDirY, shotDirX));
    const angleScore = Math.max(0, 1 - hitAngle / (Math.PI / 4));
    
    const score = 1000 * angleScore - ballToPocketDist * 0.3 - cueToHitDist * 0.2;
    
    return { vx: shotDirX * power, vy: shotDirY * power, score };
}

// Удар с отскоком от борта
function calculateCushionShot(cue, ball, pocket) {
    let bestCushionShot = null;
    let bestScore = -Infinity;
    
    // Пробуем отскок от каждого борта
    const cushions = [
        { axis: 'y', value: TABLE.y, normal: 1 },           // верх
        { axis: 'y', value: TABLE.y + TABLE.h, normal: -1 }, // низ
        { axis: 'x', value: TABLE.x, normal: 1 },           // лево
        { axis: 'x', value: TABLE.x + TABLE.w, normal: -1 }  // право
    ];
    
    for (const cushion of cushions) {
        // Рассчитываем точку отскока для попадания в шар
        let bouncePoint;
        
        if (cushion.axis === 'y') {
            // Отражаем шар относительно борта
            const mirrorY = 2 * cushion.value - ball.y;
            const dx = ball.x - cue.x;
            const dy = mirrorY - cue.y;
            const t = (cushion.value - cue.y) / dy;
            
            if (t <= 0 || t >= 1) continue;
            
            bouncePoint = { x: cue.x + dx * t, y: cushion.value };
        } else {
            const mirrorX = 2 * cushion.value - ball.x;
            const dx = mirrorX - cue.x;
            const dy = ball.y - cue.y;
            const t = (cushion.value - cue.x) / dx;
            
            if (t <= 0 || t >= 1) continue;
            
            bouncePoint = { x: cushion.value, y: cue.y + dy * t };
        }
        
        // Проверяем точка на столе
        if (bouncePoint.x < TABLE.x + 5 || bouncePoint.x > TABLE.x + TABLE.w - 5) continue;
        if (bouncePoint.y < TABLE.y + 5 || bouncePoint.y > TABLE.y + TABLE.h - 5) continue;
        
        // Проверяем путь до отскока
        if (isPathBlocked(cue.x, cue.y, bouncePoint.x, bouncePoint.y, -1, 0)) continue;
        
        // Проверяем путь от отскока до шара
        const hitX = ball.x - (pocket.x - ball.x) / Math.sqrt((pocket.x - ball.x) ** 2 + (pocket.y - ball.y) ** 2) * BALL_R * 2;
        const hitY = ball.y - (pocket.y - ball.y) / Math.sqrt((pocket.x - ball.x) ** 2 + (pocket.y - ball.y) ** 2) * BALL_R * 2;
        
        if (isPathBlocked(bouncePoint.x, bouncePoint.y, hitX, hitY, ball.id, 0)) continue;
        
        // Рассчитываем удар
        const dx = bouncePoint.x - cue.x;
        const dy = bouncePoint.y - cue.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const totalDist = dist + Math.sqrt((hitX - bouncePoint.x) ** 2 + (hitY - bouncePoint.y) ** 2);
        const power = Math.min(20, Math.max(10, totalDist * 0.02 + 12));
        
        const score = 600 - totalDist * 0.5; // Отскоки менее приоритетны
        
        if (score > bestScore) {
            bestScore = score;
            bestCushionShot = { vx: (dx / dist) * power, vy: (dy / dist) * power, score };
        }
    }
    
    return bestCushionShot;
}

// Комбо удар (через другой шар)
function calculateComboShot(cue, targetBall, pocket) {
    let bestCombo = null;
    let bestScore = -Infinity;
    
    // Ищем промежуточный шар
    for (const middleBall of gameState.balls) {
        if (middleBall.pocketed || middleBall.type === 'cue' || middleBall.id === targetBall.id) continue;
        
        // Вектор от промежуточного шара к целевому
        const midToTargetX = targetBall.x - middleBall.x;
        const midToTargetY = targetBall.y - middleBall.y;
        const midToTargetDist = Math.sqrt(midToTargetX ** 2 + midToTargetY ** 2);
        
        if (midToTargetDist > 200) continue; // Слишком далеко
        
        // Направление удара промежуточного в целевой
        const dirX = midToTargetX / midToTargetDist;
        const dirY = midToTargetY / midToTargetDist;
        
        // Проверяем что целевой попадёт в лузу
        const targetToPocketX = pocket.x - targetBall.x;
        const targetToPocketY = pocket.y - targetBall.y;
        const targetToPocketDist = Math.sqrt(targetToPocketX ** 2 + targetToPocketY ** 2);
        
        const pocketDirX = targetToPocketX / targetToPocketDist;
        const pocketDirY = targetToPocketY / targetToPocketDist;
        
        // Угол между направлением удара и направлением к лузе
        const dot = dirX * pocketDirX + dirY * pocketDirY;
        if (dot < 0.7) continue; // Угол слишком большой
        
        // Точка удара в промежуточный шар
        const hitMidX = middleBall.x - dirX * BALL_R * 2;
        const hitMidY = middleBall.y - dirY * BALL_R * 2;
        
        // Путь битка к промежуточному
        const cueToMidX = hitMidX - cue.x;
        const cueToMidY = hitMidY - cue.y;
        const cueToMidDist = Math.sqrt(cueToMidX ** 2 + cueToMidY ** 2);
        
        if (isPathBlocked(cue.x, cue.y, hitMidX, hitMidY, middleBall.id, 0)) continue;
        if (isPathBlocked(middleBall.x, middleBall.y, targetBall.x, targetBall.y, targetBall.id, middleBall.id)) continue;
        if (isPathBlocked(targetBall.x, targetBall.y, pocket.x, pocket.y, targetBall.id, targetBall.id)) continue;
        
        const shotDirX = cueToMidX / cueToMidDist;
        const shotDirY = cueToMidY / cueToMidDist;
        
        const power = Math.min(22, Math.max(12, (cueToMidDist + midToTargetDist + targetToPocketDist) * 0.02 + 14));
        const score = 400 * dot - cueToMidDist * 0.2;
        
        if (score > bestScore) {
            bestScore = score;
            bestCombo = { vx: shotDirX * power, vy: shotDirY * power, score };
        }
    }
    
    return bestCombo;
}

// Симуляция удара для проверки результата
function simulateShot(vx, vy) {
    // Копируем состояние шаров
    const simBalls = gameState.balls.map(b => ({
        ...b,
        x: b.x, y: b.y, vx: 0, vy: 0, pocketed: b.pocketed
    }));
    
    // Применяем удар
    simBalls[0].vx = vx;
    simBalls[0].vy = vy;
    
    let pocketed = 0;
    let steps = 0;
    const maxSteps = 500;
    
    while (steps < maxSteps) {
        let anyMoving = false;
        
        // Обновляем позиции
        for (const ball of simBalls) {
            if (ball.pocketed) continue;
            if (Math.abs(ball.vx) > 0.01 || Math.abs(ball.vy) > 0.01) {
                anyMoving = true;
                ball.x += ball.vx;
                ball.y += ball.vy;
                ball.vx *= 0.99;
                ball.vy *= 0.99;
                
                // Столкновения с бортами
                if (ball.x - BALL_R < TABLE.x) { ball.x = TABLE.x + BALL_R; ball.vx *= -0.8; }
                if (ball.x + BALL_R > TABLE.x + TABLE.w) { ball.x = TABLE.x + TABLE.w - BALL_R; ball.vx *= -0.8; }
                if (ball.y - BALL_R < TABLE.y) { ball.y = TABLE.y + BALL_R; ball.vy *= -0.8; }
                if (ball.y + BALL_R > TABLE.y + TABLE.h) { ball.y = TABLE.y + TABLE.h - BALL_R; ball.vy *= -0.8; }
                
                // Проверка луз
                for (const p of POCKETS) {
                    if (Math.sqrt((ball.x - p.x) ** 2 + (ball.y - p.y) ** 2) < POCKET_R) {
                        if (!ball.pocketed && ball.type !== 'cue') pocketed++;
                        ball.pocketed = true;
                        ball.vx = 0;
                        ball.vy = 0;
                    }
                }
            }
        }
        
        // Столкновения между шарами
        for (let i = 0; i < simBalls.length; i++) {
            for (let j = i + 1; j < simBalls.length; j++) {
                const a = simBalls[i], b = simBalls[j];
                if (a.pocketed || b.pocketed) continue;
                
                const dx = b.x - a.x, dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < BALL_R * 2 && dist > 0) {
                    const nx = dx / dist, ny = dy / dist;
                    const dvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
                    if (dvn > 0) {
                        a.vx -= dvn * nx * 0.95;
                        a.vy -= dvn * ny * 0.95;
                        b.vx += dvn * nx * 0.95;
                        b.vy += dvn * ny * 0.95;
                    }
                }
            }
        }
        
        if (!anyMoving) break;
        steps++;
    }
    
    return { pocketed };
}

// Проверка препятствий с улучшенной точностью
function isPathBlocked(x1, y1, x2, y2, excludeId, excludeId2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return false;
    
    const dirX = dx / dist;
    const dirY = dy / dist;
    
    for (const ball of gameState.balls) {
        if (ball.pocketed) continue;
        if (ball.id === excludeId || ball.id === excludeId2) continue;
        
        const toBallX = ball.x - x1;
        const toBallY = ball.y - y1;
        const proj = toBallX * dirX + toBallY * dirY;
        
        if (proj < BALL_R || proj > dist - BALL_R) continue;
        
        const closestX = x1 + dirX * proj;
        const closestY = y1 + dirY * proj;
        const distToLine = Math.sqrt((closestX - ball.x) ** 2 + (closestY - ball.y) ** 2);
        
        if (distToLine < BALL_R * 2.1) return true;
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