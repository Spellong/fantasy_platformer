const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const fadeLayer = document.getElementById('fade-layer');
const uiLayer = document.getElementById('ui-layer');
const levelTitle = document.getElementById('level-title');

// Resize handling
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize(); // Init size

// Game constants
const GRAVITY = 0.6;
const FRICTION = 0.82; 
const MAX_SPEED = 14; 
const ACCEL = 2.0;
const JUMP_FORCE = -15;
const CAMERA_LERP = 0.15;

// Input handling
const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// Global Game State
let playerHasMoved = false;

// Player state
let player = {
    x: 100, y: 100, width: 24, height: 24,
    vx: 0, vy: 0,
    renderW: 24, renderH: 24, 
    isGrounded: false,
    jumpsLeft: 1,
    touchWallDir: 0, 
    jumpProcessed: false
};

// Camera state
let camera = { x: 0, y: 0 };

// Colors
const colors = {
    platform: '#1f2833', 
    platformBorder: '#45a29e', 
    hazard: '#c5c6c7', 
    enemy: '#f05454', 
    goal: '#66fcf1', 
    bg: '#0b0c10', 
    particle: '#45a29e',
    player: '#ffffff'
};

// Particles
let particles = [];
function spawnParticles(x, y, color, count, speedMult = 1) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 6 * speedMult,
            vy: (Math.random() - 0.5) * 6 * speedMult,
            life: 1.0,
            color: color,
            isAmbient: false
        });
    }
}
function spawnAmbientParticle() {
    if (Math.random() < 0.15) {
        particles.push({
            x: camera.x + Math.random() * canvas.width,
            y: camera.y + canvas.height + 50,
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random() * 3 - 1,
            life: 2.0,
            color: colors.particle,
            isAmbient: true
        });
    }
}
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.isAmbient ? 0.005 : 0.02;
        if (p.life <= 0) particles.splice(i, 1);
    }
}
function drawParticles() {
    for (let p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.isAmbient ? 2 : 4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;
}

// Levels
let currentLevelIndex = 0;
let activeEnemies = [];

const levels = [
    { // Level 1: Intro enemies
        platforms: [
            {x: 0, y: 500, w: 1000, h: 20},
            {x: 300, y: 350, w: 200, h: 20},
            {x: 800, y: 200, w: 200, h: 20}
        ],
        hazards: [],
        enemies: [
            { x: 500, y: 400, width: 24, height: 24, vx: 0, vy: 0, speed: 14, aggro: 800 }
        ],
        goal: {x: 850, y: 100, w: 50, h: 50}, 
        spawn: {x: 100, y: 400}
    },
    { // Level 2: Goal is far left
        platforms: [
            {x: 0, y: 500, w: 300, h: 20},
            {x: 400, y: 400, w: 300, h: 20},
            {x: 800, y: 300, w: 300, h: 20},
            {x: 400, y: 200, w: 300, h: 20},
            {x: 0, y: 100, w: 300, h: 20}
        ],
        hazards: [],
        enemies: [
            { x: 500, y: 350, width: 24, height: 24, vx: 0, vy: 0, speed: 14, aggro: 800 },
            { x: 900, y: 250, width: 24, height: 24, vx: 0, vy: 0, speed: 14, aggro: 800 }
        ],
        goal: {x: 50, y: 0, w: 50, h: 50}, 
        spawn: {x: 100, y: 400}
    },
    { // Level 3: Floating Islands
        platforms: [
            {x: 0, y: 400, w: 200, h: 20},
            {x: 400, y: 500, w: 150, h: 20},
            {x: 800, y: 400, w: 150, h: 20},
            {x: 1200, y: 500, w: 150, h: 20},
            {x: 1600, y: 400, w: 200, h: 20}
        ],
        hazards: [],
        enemies: [
            { x: 450, y: 300, width: 24, height: 24, vx: 0, vy: 0, speed: 14, aggro: 800 },
            { x: 1250, y: 300, width: 24, height: 24, vx: 0, vy: 0, speed: 14, aggro: 800 }
        ],
        goal: {x: 1650, y: 300, w: 50, h: 50}, 
        spawn: {x: 100, y: 300}
    },
    { // Level 4: Parkour with fast enemies
        platforms: [
            {x: 0, y: 500, w: 200, h: 20},
            {x: 300, y: 600, w: 150, h: 20},
            {x: 600, y: 500, w: 150, h: 20},
            {x: 900, y: 400, w: 150, h: 20},
            {x: 1200, y: 300, w: 150, h: 20},
            {x: 1500, y: 200, w: 200, h: 20}
        ],
        hazards: [],
        enemies: [
            { x: 600, y: 450, width: 24, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1500 },
            { x: 900, y: 350, width: 24, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1500 }
        ],
        goal: {x: 1600, y: 100, w: 50, h: 50},
        spawn: {x: 100, y: 400}
    },
    { // Level 5: Boss Fight
        platforms: [
            {x: -500, y: 600, w: 3000, h: 200}, // Huge arena floor
            {x: 400, y: 450, w: 200, h: 20},
            {x: 1000, y: 450, w: 200, h: 20},
            {x: 700, y: 300, w: 200, h: 20},
        ],
        hazards: [],
        enemies: [
            { x: 1000, y: 400, width: 100, height: 100, vx: 0, vy: 0, speed: 14, aggro: 3000, isBoss: true, jumpTimer: 0 }
        ],
        goal: {x: 1800, y: 550, w: 50, h: 50}, // Far right
        spawn: {x: 100, y: 500} // Far left
    }
];

let level = null;
let state = 'transition'; 

function loadLevel(index) {
    if (index >= levels.length) {
        levelTitle.innerText = "You Win!";
        uiLayer.classList.remove('hidden');
        state = 'complete';
        return;
    }
    level = levels[index];
    player.x = level.spawn.x;
    player.y = level.spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.renderW = player.width;
    player.renderH = player.height;
    player.touchWallDir = 0;
    
    playerHasMoved = false; // Reset movement flag
    
    activeEnemies = level.enemies.map(e => ({ 
        ...e, 
        isGrounded: false, 
        jumpsLeft: 1, 
        touchWallDir: 0,
        renderW: e.width,
        renderH: e.height,
        jumpCooldown: 0 // Added jump cooldown for 'clumsier' AI
    }));
    
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;
    
    levelTitle.innerText = `Level ${index + 1}`;
    uiLayer.classList.remove('hidden');
    
    fadeLayer.classList.add('transparent');
    state = 'transition';
    
    setTimeout(() => {
        uiLayer.classList.add('hidden');
        state = 'playing';
    }, 2000);
}

function toggleMenu() {
    const list = document.getElementById('level-list');
    list.classList.toggle('hidden');
}

function selectLevel(index) {
    if (state === 'transition') return;
    document.getElementById('level-list').classList.add('hidden');
    currentLevelIndex = index;
    state = 'transition';
    fadeLayer.classList.remove('transparent'); 
    setTimeout(() => {
        loadLevel(currentLevelIndex); 
    }, 1500);
}

function handleEntityCollisions(entity, isAxisX) {
    for (const plat of level.platforms) {
        if (checkRectOverlap(entity, plat)) {
            if (isAxisX) {
                if (entity.vx > 0) {
                    entity.x = plat.x - entity.width;
                    entity.touchWallDir = 1;
                } else if (entity.vx < 0) {
                    entity.x = plat.x + plat.w;
                    entity.touchWallDir = -1;
                }
                entity.vx = 0;
            } else {
                if (entity.vy > 0) {
                    entity.y = plat.y - entity.height;
                    
                    if (!entity.isGrounded && entity.vy > 2.0) {
                        entity.renderW = entity.width * 1.6;
                        entity.renderH = entity.height * 0.4;
                    }
                    
                    entity.isGrounded = true;
                    entity.jumpsLeft = 1;
                } else if (entity.vy < 0) {
                    entity.y = plat.y + plat.h;
                }
                entity.vy = 0;
            }
        }
    }
}

function updateEnemies() {
    if (!playerHasMoved) return;

    for (let enemy of activeEnemies) {
        // AI Logic
        let dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (dist < enemy.aggro) {
            
            if (player.x < enemy.x - 10) enemy.vx -= ACCEL;
            if (player.x > enemy.x + 10) enemy.vx += ACCEL;
            
            enemy.vx *= FRICTION;
            
            if (enemy.vx > MAX_SPEED) enemy.vx = MAX_SPEED;
            if (enemy.vx < -MAX_SPEED) enemy.vx = -MAX_SPEED;

            if (enemy.jumpCooldown > 0) {
                enemy.jumpCooldown--;
            }

            // Clumsier Platforming Logic (Worse AI for Levels 1-5)
            // They have the abilities but hesitate and execute them weakly
            if (enemy.jumpCooldown <= 0 && !enemy.isBoss) {
                if (enemy.touchWallDir !== 0 && !enemy.isGrounded) {
                    // Clumsy wall jump
                    enemy.vy = JUMP_FORCE * 0.9;
                    enemy.vx = -enemy.touchWallDir * MAX_SPEED * 1.2;
                    enemy.jumpsLeft = 1;
                    enemy.jumpCooldown = 20; // Takes time to recover
                    enemy.renderW = enemy.width * 0.4;
                    enemy.renderH = enemy.height * 1.6;
                    spawnParticles(enemy.x + (enemy.touchWallDir === 1 ? enemy.width : 0), enemy.y + enemy.height / 2, colors.enemy, 10, 1);
                } else if (enemy.isGrounded && player.y < enemy.y - 80) {
                    // Hesitant Ground Jump (only if player is very high above)
                    enemy.vy = JUMP_FORCE * 0.9;
                    enemy.jumpsLeft = 1;
                    enemy.isGrounded = false;
                    enemy.jumpCooldown = 15;
                    enemy.renderW = enemy.width * 0.5;
                    enemy.renderH = enemy.height * 1.5;
                } else if (!enemy.isGrounded && enemy.jumpsLeft > 0 && enemy.vy > 5 && player.y < enemy.y - 20) {
                    // Panic double jump only if falling fast
                    enemy.vy = JUMP_FORCE * 0.8;
                    enemy.jumpsLeft--;
                    enemy.jumpCooldown = 20;
                    enemy.renderW = enemy.width * 0.6;
                    enemy.renderH = enemy.height * 1.4;
                } else if (enemy.isGrounded && enemy.touchWallDir !== 0) {
                    // Clumsy jump over a block
                    enemy.vy = JUMP_FORCE * 0.9;
                    enemy.isGrounded = false;
                    enemy.jumpCooldown = 15;
                    enemy.renderW = enemy.width * 0.5;
                    enemy.renderH = enemy.height * 1.5;
                }
            }
        } else {
            enemy.vx *= FRICTION;
        }

        // Boss jump timer
        if (enemy.isBoss) {
            enemy.jumpTimer++;
            if (enemy.isGrounded && enemy.jumpTimer > 100) { 
                enemy.vy = JUMP_FORCE * 1.2;
                enemy.jumpTimer = 0;
            }
        }

        enemy.vy += GRAVITY;

        // Enemy Wall slide
        let isWallSliding = false;
        if (enemy.touchWallDir !== 0 && !enemy.isGrounded && enemy.vy > 0) {
            if ((enemy.touchWallDir === 1 && enemy.vx > 0) || 
                (enemy.touchWallDir === -1 && enemy.vx < 0)) {
                isWallSliding = true;
            }
        }

        if (isWallSliding) {
            enemy.vy = Math.min(enemy.vy, 3); 
        }

        // X Physics
        enemy.x += enemy.vx;
        enemy.touchWallDir = 0;
        handleEntityCollisions(enemy, true);

        // Y Physics
        enemy.y += enemy.vy;
        enemy.isGrounded = false;
        handleEntityCollisions(enemy, false);
        
        // Enemy Squash and Stretch
        enemy.renderW += (enemy.width - enemy.renderW) * 0.3;
        enemy.renderH += (enemy.height - enemy.renderH) * 0.3;
        
        // Kill player on touch
        if (checkRectOverlap(player, enemy)) {
            die();
            return;
        }
    }
}

function updatePhysics() {
    if (state !== 'playing') return;

    let jumpPressed = (keys['ArrowUp'] || keys['KeyW'] || keys['Space']);
    let jumpJustPressed = jumpPressed && !player.jumpProcessed;
    if (jumpPressed) player.jumpProcessed = true;
    else player.jumpProcessed = false;

    // Wake up enemies when player moves
    if (jumpPressed || keys['ArrowLeft'] || keys['KeyA'] || keys['ArrowRight'] || keys['KeyD']) {
        playerHasMoved = true;
    }

    // Horizontal movement
    if (keys['ArrowLeft'] || keys['KeyA']) player.vx -= ACCEL;
    if (keys['ArrowRight'] || keys['KeyD']) player.vx += ACCEL;
    
    player.vx *= FRICTION;
    
    if (player.vx > MAX_SPEED) player.vx = MAX_SPEED;
    if (player.vx < -MAX_SPEED) player.vx = -MAX_SPEED;

    // Jump Logic
    if (jumpJustPressed) {
        if (player.touchWallDir !== 0 && !player.isGrounded) {
            // Wall Jump
            player.vy = JUMP_FORCE;
            player.vx = -player.touchWallDir * MAX_SPEED * 1.5;
            player.jumpsLeft = 1;
            player.renderW = player.width * 0.4;
            player.renderH = player.height * 1.6;
            spawnParticles(player.x + (player.touchWallDir === 1 ? player.width : 0), player.y + player.height / 2, colors.player, 15, 1);
        } else if (player.isGrounded) {
            // Ground Jump
            player.vy = JUMP_FORCE;
            player.jumpsLeft = 1; 
            player.isGrounded = false;
            player.renderW = player.width * 0.5;
            player.renderH = player.height * 1.5;
            spawnParticles(player.x + player.width / 2, player.y + player.height, colors.player, 10, 0.5);
        } else if (player.jumpsLeft > 0) {
            // Double Jump
            player.vy = JUMP_FORCE * 0.9;
            player.jumpsLeft--;
            player.renderW = player.width * 0.6;
            player.renderH = player.height * 1.4;
            spawnParticles(player.x + player.width / 2, player.y + player.height, colors.goal, 15, 0.8);
        }
    }

    player.vy += GRAVITY;

    // Wall slide
    let isWallSliding = false;
    if (player.touchWallDir !== 0 && !player.isGrounded && player.vy > 0) {
        if ((player.touchWallDir === 1 && (keys['ArrowRight'] || keys['KeyD'])) || 
            (player.touchWallDir === -1 && (keys['ArrowLeft'] || keys['KeyA']))) {
            isWallSliding = true;
        }
    }

    if (isWallSliding) {
        player.vy = Math.min(player.vy, 3); 
        if (Math.random() < 0.2) {
            spawnParticles(player.x + (player.touchWallDir === 1 ? player.width : 0), player.y + player.height, colors.player, 1, 0.2);
        }
    }

    // Move X
    player.x += player.vx;
    player.touchWallDir = 0; 
    handleEntityCollisions(player, true);

    // Move Y
    player.y += player.vy;
    player.isGrounded = false;
    handleEntityCollisions(player, false);

    // Update Enemies
    updateEnemies();
    
    // Death by falling off screen
    if (player.y > camera.y + canvas.height + 200) {
        die();
        return;
    }

    // Goal check
    if (checkRectOverlap(player, level.goal)) {
        winLevel();
    }
    
    // Trail particles
    if (!player.isGrounded && (Math.abs(player.vx) > 3 || Math.abs(player.vy) > 3)) {
        if (Math.random() < 0.3) {
            spawnParticles(player.x + player.width/2, player.y + player.height/2, colors.player, 1, 0.2);
        }
    }

    // Squash and stretch easing
    player.renderW += (player.width - player.renderW) * 0.3;
    player.renderH += (player.height - player.renderH) * 0.3;
}

function die() {
    if (state === 'transition') return;
    state = 'transition';
    spawnParticles(player.x + player.width/2, player.y + player.height/2, colors.enemy, 30, 2);
    fadeLayer.classList.remove('transparent'); 
    setTimeout(() => {
        loadLevel(currentLevelIndex); 
    }, 1500);
}

function winLevel() {
    if (state === 'transition') return;
    state = 'transition';
    spawnParticles(player.x + player.width/2, player.y + player.height/2, colors.goal, 50, 2);
    fadeLayer.classList.remove('transparent');
    currentLevelIndex++;
    setTimeout(() => {
        loadLevel(currentLevelIndex);
    }, 1500);
}

function checkRectOverlap(r1, r2) {
    let r2w = r2.w || r2.width;
    let r2h = r2.h || r2.height;
    return r1.x < r2.x + r2w &&
           r1.x + r1.width > r2.x &&
           r1.y < r2.y + r2h &&
           r1.y + r1.height > r2.y;
}

function updateCamera() {
    const targetX = player.x - canvas.width / 2;
    const targetY = player.y - canvas.height / 2;
    
    camera.x += (targetX - camera.x) * CAMERA_LERP;
    camera.y += (targetY - camera.y) * CAMERA_LERP;
}

function draw() {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!level) return;

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    drawParticles();

    // Draw Platforms
    for (const plat of level.platforms) {
        ctx.fillStyle = colors.platform;
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        
        ctx.strokeStyle = colors.platformBorder;
        ctx.lineWidth = 2;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
    }

    // Draw Enemies
    for (const enemy of activeEnemies) {
        ctx.fillStyle = colors.enemy;
        ctx.shadowBlur = 15;
        ctx.shadowColor = colors.enemy;
        
        let cx = enemy.x + enemy.width / 2;
        let cy = enemy.y + enemy.height;
        ctx.fillRect(cx - enemy.renderW / 2, cy - enemy.renderH, enemy.renderW, enemy.renderH);

        ctx.shadowBlur = 0;
    }

    // Draw Goal Beacon
    ctx.fillStyle = colors.goal;
    ctx.shadowBlur = 25;
    ctx.shadowColor = colors.goal;
    ctx.fillRect(level.goal.x, level.goal.y, level.goal.w, level.goal.h);
    
    // Beacon Light Beam
    let gradient = ctx.createLinearGradient(0, level.goal.y, 0, level.goal.y - 800);
    gradient.addColorStop(0, "rgba(102, 252, 241, 0.4)");
    gradient.addColorStop(1, "rgba(102, 252, 241, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(level.goal.x, level.goal.y - 800, level.goal.w, 800);
    
    if (Math.random() < 0.2) {
        spawnParticles(level.goal.x + Math.random() * level.goal.w, level.goal.y + level.goal.h, colors.goal, 1, 0.5);
    }
    ctx.shadowBlur = 0;

    // Draw Player
    if (state !== 'complete' && !(state === 'transition' && fadeLayer.classList.contains('transparent') === false)) {
        ctx.fillStyle = colors.player;
        ctx.shadowBlur = 25;
        ctx.shadowColor = colors.player;
        
        let cx = player.x + player.width / 2;
        let cy = player.y + player.height;
        ctx.fillRect(cx - player.renderW / 2, cy - player.renderH, player.renderW, player.renderH);
        
        ctx.shadowBlur = 0;
    }
    
    ctx.restore();
}

function gameLoop() {
    spawnAmbientParticle();
    updateParticles();
    updatePhysics();
    updateCamera();
    draw();
    requestAnimationFrame(gameLoop);
}

// Init
window.onload = () => {
    loadLevel(currentLevelIndex);
    gameLoop();
};
