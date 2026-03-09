// game-pong.js - Настольный теннис (вертикальный вид сверху)

const pongKeys = { left: false, right: false, a: false, d: false };

function initPongState() {
    pongState = {
        ball: { 
            x: TENNIS.width / 2, 
            y: TENNIS.height / 2, 
            vx: 0, 
            vy: TENNIS.ballSpeed,
            spin: 0,
            visible: true
        },
        rackets: [
            { x: TENNIS.width / 2 - TENNIS.racketW / 2, vx: 0 },
            { x: TENNIS.width / 2 - TENNIS.racketW / 2, vx: 0 }
        ],
        scores: [0, 0],
        serving: 1,
        rally: 0,
        playerNicks: {},
        playerAvatars: {},
        winner: null,
        gameStarted: false,
        paused: true
    };
}

function resetTennisBall(server) {
    pongState.ball.x = TENNIS.width / 2;
    pongState.ball.y = server === 1 ? TENNIS.height - 80 : 80;
    pongState.ball.vx = (Math.random() - 0.5) * 2;
    pongState.ball.vy = server === 1 ? -TENNIS.ballSpeed : TENNIS.ballSpeed;
    pongState.ball.spin = 0;
    pongState.ball.visible = true;
    pongState.rally = 0;
    pongState.serving = server;
}

function updatePongPaddle() {
    if (!gameStarted || !pongState || pongState.winner) return;
    const racketIndex = isBotMode ? 0 : (myPlayer - 1);
    if (racketIndex < 0 || isSpectator) return;
    
    const racket = pongState.rackets[racketIndex];
    const oldX = racket.x;
    
    if (pongKeys.a || pongKeys.left) { 
        racket.x -= TENNIS.racketSpeed; 
    }
    if (pongKeys.d || pongKeys.right) { 
        racket.x += TENNIS.racketSpeed; 
    }
    
    racket.x = Math.max(20, Math.min(TENNIS.width - TENNIS.racketW - 20, racket.x));
    racket.vx = racket.x - oldX;
    
    if (isOnline && lobbyRef) {
        lobbyRef.child('paddleMove').set({ 
            player: myPlayer, 
            x: racket.x, 
            vx: racket.vx,
            time: Date.now() 
        });
    }
}

function updatePong() {
    if (!gameStarted || !pongState || pongState.paused) return;
    
    const ball = pongState.ball;
    
    // Спин влияет на траекторию
    ball.vx += ball.spin * 0.02;
    ball.spin *= 0.995;
    
    ball.x += ball.vx;
    ball.y += ball.vy;
    
    // Ускорение по ходу розыгрыша
    const speedMult = 1 + pongState.rally * 0.01;
    
    // Отскок от боковых стенок
    if (ball.x - TENNIS.ballR < 20 || ball.x + TENNIS.ballR > TENNIS.width - 20) {
        ball.vx = -ball.vx * 0.9;
        ball.x = Math.max(20 + TENNIS.ballR, Math.min(TENNIS.width - 20 - TENNIS.ballR, ball.x));
        playSound('wall');
    }
    
    // Ракетка игрока 1 (внизу)
    const r1 = pongState.rackets[0];
    const r1y = TENNIS.height - 50;
    
    if (ball.vy > 0 && 
        ball.y + TENNIS.ballR > r1y - TENNIS.racketH / 2 && 
        ball.y - TENNIS.ballR < r1y + TENNIS.racketH / 2 &&
        ball.x > r1.x && ball.x < r1.x + TENNIS.racketW) {
        
        ball.vy = -Math.abs(ball.vy) * 1.02;
        ball.spin = r1.vx * 0.5;
        
        const hitPos = (ball.x - r1.x - TENNIS.racketW / 2) / (TENNIS.racketW / 2);
        ball.vx += hitPos * 3 + r1.vx * 0.3;
        
        pongState.rally++;
        playSound('pong');
    }
    
    // Ракетка игрока 2 (вверху)
    const r2 = pongState.rackets[1];
    const r2y = 50;
    
    if (ball.vy < 0 && 
        ball.y - TENNIS.ballR < r2y + TENNIS.racketH / 2 && 
        ball.y + TENNIS.ballR > r2y - TENNIS.racketH / 2 &&
        ball.x > r2.x && ball.x < r2.x + TENNIS.racketW) {
        
        ball.vy = Math.abs(ball.vy) * 1.02;
        ball.spin = -r2.vx * 0.5;
        
        const hitPos = (ball.x - r2.x - TENNIS.racketW / 2) / (TENNIS.racketW / 2);
        ball.vx += hitPos * 3 + r2.vx * 0.3;
        
        pongState.rally++;
        playSound('pong');
    }
    
    // Ограничение скорости
    const maxSpeed = 12;
    ball.vx = Math.max(-maxSpeed, Math.min(maxSpeed, ball.vx));
    ball.vy = Math.max(-maxSpeed, Math.min(maxSpeed, ball.vy));
    if (ball.vy > 0 && ball.vy < 3) ball.vy = 3;
    if (ball.vy < 0 && ball.vy > -3) ball.vy = -3;
    
    // Очки
    if (ball.y > TENNIS.height + 20) {
        pongState.scores[1]++;
        playSound('score');
        resetTennisBall(2);
    } else if (ball.y < -20) {
        pongState.scores[0]++;
        playSound('score');
        resetTennisBall(1);
    }
    
    // Победа
    const maxScore = Math.max(pongState.scores[0], pongState.scores[1]);
    const minScore = Math.min(pongState.scores[0], pongState.scores[1]);
    
    if (maxScore >= TENNIS.winScore && maxScore - minScore >= 2) {
        pongState.winner = pongState.scores[0] > pongState.scores[1] ? 1 : 2;
        pongState.paused = true;
        if (!isBotMode) recordMatch('pong', myPlayer === pongState.winner);
    }
    
    // Бот
    if (isBotMode && !pongState.winner) {
        const botRacket = pongState.rackets[1];
        const oldBotX = botRacket.x;
        const targetX = ball.x - TENNIS.racketW / 2;
        
        if (ball.vy < 0) {
            const diff = targetX - botRacket.x;
            const speed = TENNIS.racketSpeed * 0.7;
            
            if (Math.abs(diff) > 5) {
                botRacket.x += Math.sign(diff) * Math.min(Math.abs(diff) * 0.1, speed);
            }
        } else {
            const centerX = TENNIS.width / 2 - TENNIS.racketW / 2;
            const diff = centerX - botRacket.x;
            if (Math.abs(diff) > 10) botRacket.x += Math.sign(diff) * 2;
        }
        
        botRacket.x = Math.max(20, Math.min(TENNIS.width - TENNIS.racketW - 20, botRacket.x));
        botRacket.vx = botRacket.x - oldBotX;
    }
    
    if (isOnline && isHost && lobbyRef) lobbyRef.child('pongState').set(pongState);
    
    document.getElementById('pongScore1').textContent = pongState.scores[0];
    document.getElementById('pongScore2').textContent = pongState.scores[1];
    
    if (pongState.winner) {
        const isWin = pongState.winner === myPlayer || (isBotMode && pongState.winner === 1);
        document.getElementById('pongStatus').textContent = isWin ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ';
        document.getElementById('pongStatus').style.color = pongState.winner === 1 ? PLAYER_COLORS[0] : PLAYER_COLORS[1];
    } else {
        document.getElementById('pongStatus').textContent = `Розыгрыш: ${pongState.rally}`;
        document.getElementById('pongStatus').style.color = '';
    }
}

function drawPong() {
    if (!gameStarted || !pongState) return;
    
    const ctx = pongCtx;
    const W = TENNIS.width;
    const H = TENNIS.height;
    
    // Фон комнаты
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, H);
    
    // Тень стола
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(W / 2 + 10, H / 2 + 10, W / 2 - 10, H / 2 - 30, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Стол
    ctx.fillStyle = TENNIS.tableColor;
    ctx.fillRect(15, 25, W - 30, H - 50);
    
    // Рамка стола
    ctx.strokeStyle = '#0a3d1a';
    ctx.lineWidth = 4;
    ctx.strokeRect(15, 25, W - 30, H - 50);
    
    // Белые линии
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    
    // Контур
    ctx.strokeRect(20, 30, W - 40, H - 60);
    
    // Центральная линия
    ctx.beginPath();
    ctx.moveTo(20, H / 2);
    ctx.lineTo(W - 20, H / 2);
    ctx.stroke();
    
    // Вертикальная линия
    ctx.beginPath();
    ctx.moveTo(W / 2, 30);
    ctx.lineTo(W / 2, H - 30);
    ctx.stroke();
    
    // Сетка
    ctx.fillStyle = '#333';
    ctx.fillRect(10, H / 2 - 3, W - 20, 6);
    
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 8) {
        ctx.beginPath();
        ctx.moveTo(10 + i, H / 2 - 3);
        ctx.lineTo(10 + i, H / 2 + 3);
        ctx.stroke();
    }
    
    // Опоры сетки
    ctx.fillStyle = '#222';
    ctx.fillRect(5, H / 2 - 8, 12, 16);
    ctx.fillRect(W - 17, H / 2 - 8, 12, 16);
    
    // Ракетки
    drawTennisRacket(ctx, pongState.rackets[0], TENNIS.height - 50, PLAYER_COLORS[0], false);
    drawTennisRacket(ctx, pongState.rackets[1], 50, PLAYER_COLORS[1], true);
    
    // Мяч
    if (pongState.ball.visible) {
        drawTennisBall(ctx, pongState.ball);
    }
    
       // Индикатор подачи (только в онлайн режиме)
    if (!isBotMode) {
        ctx.fillStyle = '#fff';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        const servingPlayer = pongState.serving === 1 ? 
            (pongState.playerNicks[1] || 'Игрок 1') : 
            (pongState.playerNicks[2] || 'Игрок 2');
        ctx.fillText(`Подача: ${servingPlayer}`, W / 2, H / 2 + 25);
    }
}

function drawTennisRacket(ctx, racket, y, color, flipped) {
    const x = racket.x;
    const w = TENNIS.racketW;
    const h = TENNIS.racketH;
    
    ctx.save();
    ctx.translate(x + w / 2, y);
    
    // Наклон от движения
    const tilt = Math.max(-0.2, Math.min(0.2, (racket.vx || 0) * 0.03));
    ctx.rotate(tilt);
    
    // Тень
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(3, 3, w / 2 + 2, h / 2 + 4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Головка ракетки
    const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    grad.addColorStop(0, color);
    grad.addColorStop(0.5, lightenColor(color, 30));
    grad.addColorStop(1, color);
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2 + 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Обод
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Накладка
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2 - 3, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Ручка
    const handleDir = flipped ? -1 : 1;
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-4, handleDir * (h / 2 + 2), 8, handleDir * 15);
    
    ctx.restore();
}

function drawTennisRacket(ctx, racket, y, color, flipped) {
    const x = racket.x;
    const w = TENNIS.racketW;
    
    ctx.save();
    ctx.translate(x + w / 2, y);
    
    // Наклон от движения
    const tilt = Math.max(-0.15, Math.min(0.15, (racket.vx || 0) * 0.02));
    ctx.rotate(tilt);
    
    const headW = w;
    const headH = 14;
    const handleW = 8;
    const handleH = 20;
    const handleDir = flipped ? -1 : 1;
    
    // Тень ракетки
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.roundRect(-headW / 2 + 3, -headH / 2 + 3, headW, headH, 6);
    ctx.fill();
    
    // Ручка ракетки
    ctx.fillStyle = '#5d3a1a';
    ctx.beginPath();
    ctx.roundRect(-handleW / 2, handleDir * (headH / 2), handleW, handleDir * handleH, 2);
    ctx.fill();
    
    // Обмотка ручки
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        const yOff = handleDir * (headH / 2 + 4 + i * 4);
        ctx.beginPath();
        ctx.moveTo(-handleW / 2, yOff);
        ctx.lineTo(handleW / 2, yOff + handleDir * 2);
        ctx.stroke();
    }
    
    // Основание ручки
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.roundRect(-handleW / 2 - 1, handleDir * (headH / 2 + handleH - 3), handleW + 2, handleDir * 5, 2);
    ctx.fill();
    
    // Рамка ракетки (обод)
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.roundRect(-headW / 2, -headH / 2, headW, headH, 6);
    ctx.fill();
    
    // Накладка ракетки (красная/черная резина)
    const rubberGrad = ctx.createLinearGradient(-headW / 2, 0, headW / 2, 0);
    rubberGrad.addColorStop(0, darkenColor(color, 20));
    rubberGrad.addColorStop(0.5, color);
    rubberGrad.addColorStop(1, darkenColor(color, 20));
    
    ctx.fillStyle = rubberGrad;
    ctx.beginPath();
    ctx.roundRect(-headW / 2 + 3, -headH / 2 + 2, headW - 6, headH - 4, 4);
    ctx.fill();
    
    // Текстура накладки (пупырышки)
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let px = -headW / 2 + 8; px < headW / 2 - 5; px += 6) {
        for (let py = -headH / 2 + 5; py < headH / 2 - 3; py += 4) {
            ctx.beginPath();
            ctx.arc(px, py, 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Блик на накладке
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.roundRect(-headW / 2 + 5, -headH / 2 + 3, headW / 3, 3, 1);
    ctx.fill();
    
    ctx.restore();
}

function darkenColor(c, p) {
    if (!c?.startsWith('#')) return c;
    const n = parseInt(c.slice(1), 16);
    return `rgb(${Math.max(0,(n>>16)-p)},${Math.max(0,((n>>8)&0xFF)-p)},${Math.max(0,(n&0xFF)-p)})`;
}