const firebaseConfig = {
    apiKey: "AIzaSyDWSZUyDTPLkjjPSzBRMAA973EUmB8HOUc",
    authDomain: "billiard-game-new.firebaseapp.com",
    databaseURL: "https://billiard-game-new-default-rtdb.firebaseio.com",
    projectId: "billiard-game-new",
    storageBucket: "billiard-game-new.firebasestorage.app",
    messagingSenderId: "464169721589",
    appId: "1:464169721589:web:204d1130fd534c37c1afbc"
};

const TABLE = { x: 50, y: 50, w: 900, h: 400 };
const BALL_R = 12;
const POCKET_R = 22;
const BALL_MASS = 1;
const RESTITUTION = 0.96;
const WALL_RESTITUTION = 0.75;
const MIN_VELOCITY = 0.002;
const PHYSICS_STEPS = 4;
const TURN_TIME = 20;

const BALL_COLORS = {
    1: '#f4d03f', 2: '#3498db', 3: '#e74c3c', 4: '#9b59b6',
    5: '#e67e22', 6: '#27ae60', 7: '#922b21', 8: '#1a1a1a',
    9: '#f4d03f', 10: '#3498db', 11: '#e74c3c', 12: '#9b59b6',
    13: '#e67e22', 14: '#27ae60', 15: '#922b21'
};

const BALL_TYPES = ['solid', 'stripe', 'dot', 'ring', 'half', 'diamond'];

const PLAYER_COLORS = ['#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#a855f7', '#06b6d4'];

const POCKETS = [
    { x: TABLE.x + 5, y: TABLE.y + 5 },
    { x: TABLE.x + TABLE.w / 2, y: TABLE.y - 3 },
    { x: TABLE.x + TABLE.w - 5, y: TABLE.y + 5 },
    { x: TABLE.x + 5, y: TABLE.y + TABLE.h - 5 },
    { x: TABLE.x + TABLE.w / 2, y: TABLE.y + TABLE.h + 3 },
    { x: TABLE.x + TABLE.w - 5, y: TABLE.y + TABLE.h - 5 }
];

const TENNIS = {
    width: 500,
    height: 700,
    racketW: 70,
    racketH: 8,
    ballR: 6,
    racketSpeed: 6,
    ballSpeed: 4,
    winScore: 11,
    tableColor: '#1a5c2e',
    netHeight: 6
};

// Spin physics constants
// Spin physics constants - REALISTIC
const SPIN_FRICTION = 0.994;           // Как быстро spin угасает (медленнее = дольше крутится)
const SPIN_TRANSFER = 0.25;            // Сколько spin передаётся при столкновении
const SPIN_TO_VELOCITY = 0.12;         // Конверсия spin в скорость при откате
const MAX_SPIN = 1.0;                  // Максимальное значение spin
const SPIN_CURVE_FACTOR = 0.06;        // Как сильно side spin искривляет траекторию
const TOPSPIN_ACCELERATION = 0.025;    // Ускорение при top spin
const BACKSPIN_GRIP_SPEED = 0.5;       // Скорость при которой backspin "цепляет" сукно