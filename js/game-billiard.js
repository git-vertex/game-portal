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

// ==================== УЛЬТРА БОТ ====================

function botBilliardMove() {
    if (!gameState || gameState.isMoving || gameState.winner) return;
    
    const cue = gameState.balls[0];
    if (!cue || cue.pocketed) return;
    
    const botType = gameState.playerTypes[2];
    const isBreakShot = !botType && gameState.balls.filter(b => b.pocketed && b.type !== 'cue').length === 0;
    
    let bestShot = null;
    
    if (isBreakShot) {
        // ИДЕАЛЬНЫЙ РАЗБОЙ
        bestShot = calculatePerfectBreak(cue);
    } else {
        // ПОИСК ЛУЧШЕГО УДАРА
        bestShot = findBestShot(cue, botType);
    }
    
    if (bestShot) {
        // Небольшая случайность чтобы не было подозрительно идеально (можно убрать)
        // bestShot.vx += (Math.random() - 0.5) * 0.1;
        // bestShot.vy += (Math.random() - 0.5) * 0.1;
        performShot(bestShot.vx, bestShot.vy);
    }
}

// Идеальный разбой пирамиды
function calculatePerfectBreak(cue) {
    const pyramidX = TABLE.x + 650;
    const pyramidY = TABLE.y + TABLE.h / 2;
    
    // Бьём в переднюю точку пирамиды с максимальной силой
    const dx = pyramidX - cue.x;
    const dy = pyramidY - cue.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Сила и направление для максимального разброса
    const power = 24;
    
    return {
        vx: (dx / dist) * power,
        vy: (dy / dist) * power,
        score: 1000
    };
}

// Главная функция поиска лучшего удара
function findBestShot(cue, botType) {
    let allShots = [];
    
    // Получаем все целевые шары
    const targetBalls = getTargetBalls(botType);
    
    // 1. ПРЯМЫЕ УДАРЫ В ЛУЗЫ
    for (const ball of targetBalls) {
        for (const pocket of POCKETS) {
            const shot = calculatePerfectDirectShot(cue, ball, pocket);
            if (shot) allShots.push(shot);
        }
    }
    
    // 2. УДАРЫ С ОДНИМ ОТСКОКОМ ОТ БОРТА (биток)
    for (const ball of targetBalls) {
        for (const pocket of POCKETS) {
            const shots = calculateCushionShots(cue, ball, pocket);
            allShots = allShots.concat(shots);
        }
    }
    
    // 3. КОМБИНАЦИИ (через другой шар)
    for (const ball of targetBalls) {
        for (const pocket of POCKETS) {
            const shot = calculateComboShot(cue, ball, pocket);
            if (shot) allShots.push(shot);
        }
    }
    
    // 4. КАРАМБОЛЬ (отскок целевого шара от борта в лузу)
    for (const ball of targetBalls) {
        for (const pocket of POCKETS) {
            const shot = calculateCaromShot(cue, ball, pocket);
            if (shot) allShots.push(shot);
        }
    }
    
    // Симулируем топ-10 ударов и выбираем лучший
    allShots.sort((a, b) => b.score - a.score);
    
    let bestShot = null;
    let bestResult = -Infinity;
    
    for (const shot of allShots.slice(0, 15)) {
        const result = fullSimulation(shot.vx, shot.vy, botType);
        const totalScore = shot.score + result.score;
        
        if (totalScore > bestResult) {
            bestResult = totalScore;
            bestShot = { ...shot, finalScore: totalScore };
        }
    }
    
    // Если ничего хорошего не нашли - бьём в ближайший свой шар
    if (!bestShot || bestResult < 100) {
        bestShot = calculateSafeShot(cue, botType);
    }
    
    return bestShot;
}

// Получить целевые шары
function getTargetBalls(botType) {
    return gameState.balls.filter(b => {
        if (b.pocketed || b.type === 'cue') return false;
        if (b.type === 'eight') {
            const remaining = gameState.balls.filter(x => !x.pocketed && x.type === botType).length;
            return remaining === 0 && botType;
        }
        if (botType && b.type !== botType) return false;
        return true;
    });
}

// ИДЕАЛЬНЫЙ ПРЯМОЙ УДАР
function calculatePerfectDirectShot(cue, ball, pocket) {
    // Вектор от шара к лузе
    const ballToPocketX = pocket.x - ball.x;
    const ballToPocketY = pocket.y - ball.y;
    const ballToPocketDist = Math.sqrt(ballToPocketX ** 2 + ballToPocketY ** 2);
    
    // Направление
    const dirX = ballToPocketX / ballToPocketDist;
    const dirY = ballToPocketY / ballToPocketDist;
    
    // Точка удара - ровно позади шара на линии к лузе
    const hitX = ball.x - dirX * BALL_R * 2;
    const hitY = ball.y - dirY * BALL_R * 2;
    
    // Проверка что точка на столе
    if (!isOnTable(hitX, hitY)) return null;
    
    // Вектор от битка к точке удара
    const cueToHitX = hitX - cue.x;
    const cueToHitY = hitY - cue.y;
    const cueToHitDist = Math.sqrt(cueToHitX ** 2 + cueToHitY ** 2);
    
    if (cueToHitDist < BALL_R * 3) return null;
    
    // ПРОВЕРКА ПРЕПЯТСТВИЙ
    if (isPathBlockedPrecise(cue.x, cue.y, hitX, hitY, [0])) return null;
    if (isPathBlockedPrecise(ball.x, ball.y, pocket.x, pocket.y, [ball.id])) return null;
    
    // Направление удара
    const shotDirX = cueToHitX / cueToHitDist;
    const shotDirY = cueToHitY / cueToHitDist;
    
    // Угол между направлением удара и нужным направлением
    const hitAngle = Math.acos(Math.max(-1, Math.min(1, 
        -(shotDirX * dirX + shotDirY * dirY)
    )));
    
    // Чем меньше угол - тем лучше (прямой удар)
    if (hitAngle > Math.PI / 3) return null; // Угол больше 60° - не реально
    
    // Идеальная сила
    const power = calculatePerfectPower(cueToHitDist, ballToPocketDist, hitAngle);
    
    // Оценка удара
    const angleScore = Math.cos(hitAngle); // 1 = идеально прямо
    const distScore = 1 - (ballToPocketDist / 500);
    const score = 1000 * angleScore + 500 * distScore;
    
    return {
        vx: shotDirX * power,
        vy: shotDirY * power,
        score: score,
        type: 'direct',
        targetBall: ball.id,
        pocket: pocket
    };
}

// Рассчёт идеальной силы
function calculatePerfectPower(cueToBallDist, ballToPocketDist, angle) {
    // Учитываем потерю энергии при ударе и трение
    const energyTransfer = Math.cos(angle) * 0.95;
    const frictionLoss = (cueToBallDist + ballToPocketDist) * 0.001;
    
    const basePower = 10;
    const distancePower = (cueToBallDist + ballToPocketDist * 1.2) * 0.015;
    const anglePower = (1 - Math.cos(angle)) * 5;
    
    return Math.min(24, Math.max(8, basePower + distancePower + anglePower + frictionLoss));
}

// УДАРЫ С ОТСКОКОМ ОТ БОРТА
function calculateCushionShots(cue, ball, pocket) {
    const shots = [];
    
    // 4 борта
    const cushions = [
        { name: 'top', y: TABLE.y, normalY: 1 },
        { name: 'bottom', y: TABLE.y + TABLE.h, normalY: -1 },
        { name: 'left', x: TABLE.x, normalX: 1 },
        { name: 'right', x: TABLE.x + TABLE.w, normalX: -1 }
    ];
    
    for (const cushion of cushions) {
        const shot = calculateSingleCushionShot(cue, ball, pocket, cushion);
        if (shot) shots.push(shot);
    }
    
    return shots;
}

function calculateSingleCushionShot(cue, ball, pocket, cushion) {
    // Отражаем точку удара относительно борта
    let mirrorHitX, mirrorHitY;
    
    // Точка куда нужно попасть в шар
    const ballToPocketX = pocket.x - ball.x;
    const ballToPocketY = pocket.y - ball.y;
    const ballToPocketDist = Math.sqrt(ballToPocketX ** 2 + ballToPocketY ** 2);
    const dirX = ballToPocketX / ballToPocketDist;
    const dirY = ballToPocketY / ballToPocketDist;
    const hitX = ball.x - dirX * BALL_R * 2;
    const hitY = ball.y - dirY * BALL_R * 2;
    
    if (cushion.y !== undefined) {
        // Горизонтальный борт
        mirrorHitY = 2 * cushion.y - hitY;
        mirrorHitX = hitX;
        
        // Точка отскока
        const t = (cushion.y - cue.y) / (mirrorHitY - cue.y);
        if (t <= 0.1 || t >= 0.9) return null;
        
        const bounceX = cue.x + (mirrorHitX - cue.x) * t;
        const bounceY = cushion.y;
        
        if (bounceX < TABLE.x + 30 || bounceX > TABLE.x + TABLE.w - 30) return null;
        
        // Проверка путей
        if (isPathBlockedPrecise(cue.x, cue.y, bounceX, bounceY, [0])) return null;
        if (isPathBlockedPrecise(bounceX, bounceY, hitX, hitY, [0, ball.id])) return null;
        if (isPathBlockedPrecise(ball.x, ball.y, pocket.x, pocket.y, [ball.id])) return null;
        
        const totalDist = Math.sqrt((bounceX - cue.x) ** 2 + (bounceY - cue.y) ** 2) +
                          Math.sqrt((hitX - bounceX) ** 2 + (hitY - bounceY) ** 2);
        
        const dx = bounceX - cue.x;
        const dy = bounceY - cue.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const power = Math.min(22, Math.max(12, totalDist * 0.018 + 12));
        
        return {
            vx: (dx / dist) * power,
            vy: (dy / dist) * power,
            score: 600 - totalDist * 0.3,
            type: 'cushion'
        };
    } else {
        // Вертикальный борт
        mirrorHitX = 2 * cushion.x - hitX;
        mirrorHitY = hitY;
        
        const t = (cushion.x - cue.x) / (mirrorHitX - cue.x);
        if (t <= 0.1 || t >= 0.9) return null;
        
        const bounceX = cushion.x;
        const bounceY = cue.y + (mirrorHitY - cue.y) * t;
        
        if (bounceY < TABLE.y + 30 || bounceY > TABLE.y + TABLE.h - 30) return null;
        
        if (isPathBlockedPrecise(cue.x, cue.y, bounceX, bounceY, [0])) return null;
        if (isPathBlockedPrecise(bounceX, bounceY, hitX, hitY, [0, ball.id])) return null;
        if (isPathBlockedPrecise(ball.x, ball.y, pocket.x, pocket.y, [ball.id])) return null;
        
        const totalDist = Math.sqrt((bounceX - cue.x) ** 2 + (bounceY - cue.y) ** 2) +
                          Math.sqrt((hitX - bounceX) ** 2 + (hitY - bounceY) ** 2);
        
        const dx = bounceX - cue.x;
        const dy = bounceY - cue.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const power = Math.min(22, Math.max(12, totalDist * 0.018 + 12));
        
        return {
            vx: (dx / dist) * power,
            vy: (dy / dist) * power,
            score: 600 - totalDist * 0.3,
            type: 'cushion'
        };
    }
}

// КОМБО УДАР (через промежуточный шар)
function calculateComboShot(cue, targetBall, pocket) {
    let bestCombo = null;
    let bestScore = -Infinity;
    
    for (const middleBall of gameState.balls) {
        if (middleBall.pocketed || middleBall.type === 'cue') continue;
        if (middleBall.id === targetBall.id) continue;
        
        // Вектор куда должен полететь средний шар чтобы ударить целевой в лузу
        const targetToPocket = normalize(pocket.x - targetBall.x, pocket.y - targetBall.y);
        const hitTargetX = targetBall.x - targetToPocket.x * BALL_R * 2;
        const hitTargetY = targetBall.y - targetToPocket.y * BALL_R * 2;
        
        // Вектор для удара среднего шара
        const middleToHit = normalize(hitTargetX - middleBall.x, hitTargetY - middleBall.y);
        const hitMiddleX = middleBall.x - middleToHit.x * BALL_R * 2;
        const hitMiddleY = middleBall.y - middleToHit.y * BALL_R * 2;
        
        if (!isOnTable(hitMiddleX, hitMiddleY)) continue;
        
        // Вектор от битка
        const cueToMiddle = normalize(hitMiddleX - cue.x, hitMiddleY - cue.y);
        const cueToMiddleDist = distance(cue.x, cue.y, hitMiddleX, hitMiddleY);
        
        if (cueToMiddleDist < BALL_R * 3) continue;
        
        // Проверка всех путей
        if (isPathBlockedPrecise(cue.x, cue.y, hitMiddleX, hitMiddleY, [0])) continue;
        if (isPathBlockedPrecise(middleBall.x, middleBall.y, hitTargetX, hitTargetY, [middleBall.id])) continue;
        if (isPathBlockedPrecise(targetBall.x, targetBall.y, pocket.x, pocket.y, [targetBall.id])) continue;
        
        // Угол удара
        const angle = Math.acos(Math.max(-1, Math.min(1, 
            -(cueToMiddle.x * middleToHit.x + cueToMiddle.y * middleToHit.y)
        )));
        
        if (angle > Math.PI / 4) continue; // Слишком большой угол
        
        const totalDist = cueToMiddleDist + 
                          distance(middleBall.x, middleBall.y, targetBall.x, targetBall.y) +
                          distance(targetBall.x, targetBall.y, pocket.x, pocket.y);
        
        const power = Math.min(24, Math.max(14, totalDist * 0.015 + 15));
        const score = 500 * Math.cos(angle) - totalDist * 0.2;
        
        if (score > bestScore) {
            bestScore = score;
            bestCombo = {
                vx: cueToMiddle.x * power,
                vy: cueToMiddle.y * power,
                score: score,
                type: 'combo'
            };
        }
    }
    
    return bestCombo;
}

// КАРАМБОЛЬ (шар отскакивает от борта в лузу)
function calculateCaromShot(cue, ball, pocket) {
    // Проверяем можно ли забить шар отскоком от борта
    const cushions = [
        { y: TABLE.y },
        { y: TABLE.y + TABLE.h },
        { x: TABLE.x },
        { x: TABLE.x + TABLE.w }
    ];
    
    for (const cushion of cushions) {
        let mirrorPocketX, mirrorPocketY;
        
        if (cushion.y !== undefined) {
            mirrorPocketY = 2 * cushion.y - pocket.y;
            mirrorPocketX = pocket.x;
        } else {
            mirrorPocketX = 2 * cushion.x - pocket.x;
            mirrorPocketY = pocket.y;
        }
        
        // Направление от шара к зеркальной лузе
        const toMirror = normalize(mirrorPocketX - ball.x, mirrorPocketY - ball.y);
        const hitBallX = ball.x - toMirror.x * BALL_R * 2;
        const hitBallY = ball.y - toMirror.y * BALL_R * 2;
        
        if (!isOnTable(hitBallX, hitBallY)) continue;
        
        // От битка к точке удара
        const cueToBall = normalize(hitBallX - cue.x, hitBallY - cue.y);
        const cueToBallDist = distance(cue.x, cue.y, hitBallX, hitBallY);
        
        if (cueToBallDist < BALL_R * 3) continue;
        
        // Проверка пути
        if (isPathBlockedPrecise(cue.x, cue.y, hitBallX, hitBallY, [0])) continue;
        
        // Угол
        const angle = Math.acos(Math.max(-1, Math.min(1, 
            -(cueToBall.x * toMirror.x + cueToBall.y * toMirror.y)
        )));
        
        if (angle > Math.PI / 3) continue;
        
        const power = Math.min(22, Math.max(12, cueToBallDist * 0.02 + 14));
        const score = 400 * Math.cos(angle);
        
        return {
            vx: cueToBall.x * power,
            vy: cueToBall.y * power,
            score: score,
            type: 'carom'
        };
    }
    
    return null;
}

// Безопасный удар если ничего не получается
function calculateSafeShot(cue, botType) {
    const targetBalls = botType ? 
        gameState.balls.filter(b => !b.pocketed && b.type === botType) :
        gameState.balls.filter(b => !b.pocketed && b.type !== 'cue' && b.type !== 'eight');
    
    if (targetBalls.length === 0) {
        // Бьём в любой шар
        const anyBall = gameState.balls.find(b => !b.pocketed && b.type !== 'cue');
        if (anyBall) {
            const dir = normalize(anyBall.x - cue.x, anyBall.y - cue.y);
            return { vx: dir.x * 12, vy: dir.y * 12, score: 0 };
        }
        return null;
    }
    
    // Находим ближайший свой шар
    let closest = null;
    let closestDist = Infinity;
    
    for (const ball of targetBalls) {
        const dist = distance(cue.x, cue.y, ball.x, ball.y);
        if (dist < closestDist && !isPathBlockedPrecise(cue.x, cue.y, ball.x, ball.y, [0])) {
            closestDist = dist;
            closest = ball;
        }
    }
    
    if (closest) {
        const dir = normalize(closest.x - cue.x, closest.y - cue.y);
        return { vx: dir.x * 15, vy: dir.y * 15, score: 50 };
    }
    
    return { vx: 10, vy: 0, score: 0 };
}

// ПОЛНАЯ СИМУЛЯЦИЯ УДАРА
function fullSimulation(vx, vy, botType) {
    const simBalls = gameState.balls.map(b => ({
        id: b.id,
        x: b.x,
        y: b.y,
        vx: 0,
        vy: 0,
        pocketed: b.pocketed,
        type: b.type,
        number: b.number
    }));
    
    simBalls[0].vx = vx;
    simBalls[0].vy = vy;
    
    let ownPocketed = 0;
    let opponentPocketed = 0;
    let eightPocketed = false;
    let cuePocketed = false;
    
    const maxSteps = 800;
    
    for (let step = 0; step < maxSteps; step++) {
        let anyMoving = false;
        
        // Движение
        for (const ball of simBalls) {
            if (ball.pocketed) continue;
            const speed = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
            if (speed > 0.05) {
                anyMoving = true;
                ball.x += ball.vx;
                ball.y += ball.vy;
                ball.vx *= 0.992;
                ball.vy *= 0.992;
            } else {
                ball.vx = 0;
                ball.vy = 0;
            }
        }
        
        // Борта
        for (const ball of simBalls) {
            if (ball.pocketed) continue;
            if (ball.x - BALL_R < TABLE.x) { ball.x = TABLE.x + BALL_R; ball.vx = -ball.vx * 0.8; }
            if (ball.x + BALL_R > TABLE.x + TABLE.w) { ball.x = TABLE.x + TABLE.w - BALL_R; ball.vx = -ball.vx * 0.8; }
            if (ball.y - BALL_R < TABLE.y) { ball.y = TABLE.y + BALL_R; ball.vy = -ball.vy * 0.8; }
            if (ball.y + BALL_R > TABLE.y + TABLE.h) { ball.y = TABLE.y + TABLE.h - BALL_R; ball.vy = -ball.vy * 0.8; }
        }
        
        // Столкновения
        for (let i = 0; i < simBalls.length; i++) {
            for (let j = i + 1; j < simBalls.length; j++) {
                const a = simBalls[i], b = simBalls[j];
                if (a.pocketed || b.pocketed) continue;
                
                const dx = b.x - a.x, dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < BALL_R * 2 && dist > 0.1) {
                    const nx = dx / dist, ny = dy / dist;
                    const overlap = BALL_R * 2 - dist;
                    a.x -= overlap * nx / 2;
                    a.y -= overlap * ny / 2;
                    b.x += overlap * nx / 2;
                    b.y += overlap * ny / 2;
                    
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
        
        // Лузы
        for (const ball of simBalls) {
            if (ball.pocketed) continue;
            for (const p of POCKETS) {
                if (Math.sqrt((ball.x - p.x) ** 2 + (ball.y - p.y) ** 2) < POCKET_R) {
                    ball.pocketed = true;
                    ball.vx = 0;
                    ball.vy = 0;
                    
                    if (ball.type === 'cue') {
                        cuePocketed = true;
                    } else if (ball.type === 'eight') {
                        eightPocketed = true;
                    } else if (ball.type === botType || !botType) {
                        ownPocketed++;
                    } else {
                        opponentPocketed++;
                    }
                }
            }
        }
        
        if (!anyMoving) break;
    }
    
    // Расчёт очков
    let score = ownPocketed * 1000;
    score -= opponentPocketed * 300;
    if (cuePocketed) score -= 800;
    if (eightPocketed) {
        const remaining = gameState.balls.filter(b => !b.pocketed && b.type === botType).length;
        if (remaining > 0) {
            score -= 5000; // Проиграли
        } else {
            score += 3000; // Выиграли
        }
    }
    
    return { score, ownPocketed, cuePocketed };
}

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

function normalize(x, y) {
    const len = Math.sqrt(x * x + y * y);
    return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
}

function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function isOnTable(x, y) {
    const margin = BALL_R + 2;
    return x >= TABLE.x + margin && x <= TABLE.x + TABLE.w - margin &&
           y >= TABLE.y + margin && y <= TABLE.y + TABLE.h - margin;
}

function isPathBlockedPrecise(x1, y1, x2, y2, excludeIds) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return false;
    
    const dirX = dx / dist;
    const dirY = dy / dist;
    
    for (const ball of gameState.balls) {
        if (ball.pocketed) continue;
        if (excludeIds.includes(ball.id)) continue;
        
        // Расстояние от центра шара до линии
        const toBallX = ball.x - x1;
        const toBallY = ball.y - y1;
        
        // Проекция на линию
        const proj = toBallX * dirX + toBallY * dirY;
        
        // Шар до или после отрезка
        if (proj < BALL_R * 0.5 || proj > dist - BALL_R * 0.5) continue;
        
        // Ближайшая точка на линии
        const closestX = x1 + dirX * proj;
        const closestY = y1 + dirY * proj;
        
        // Расстояние от шара до линии
        const distToLine = Math.sqrt((closestX - ball.x) ** 2 + (closestY - ball.y) ** 2);
        
        // Блокирует если расстояние меньше диаметра шаров
        if (distToLine < BALL_R * 2.05) return true;
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