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
let gameTime = 0;
let lightningStrikes = [];

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
let colors = {};

const themeStorm = {
    platform: '#1f2833', 
    platformBorder: '#45a29e', 
    hazard: '#c5c6c7', 
    enemy: '#f05454', 
    goal: '#66fcf1', 
    bg: '#0b0c10', 
    particle: '#45a29e',
    player: '#ffffff'
};

const themeForest = {
    platform: '#2d382d', // Mossy dark green
    platformBorder: '#658b54', // Leafy green
    hazard: '#6b3e3e', // Thorny brown
    enemy: '#2e7d32', // Dark leafy green pinecone base
    enemyLeaf: '#4ade80', // Bright leafy green top
    goal: '#ffd700', // Golden sunlight
    bg: '#050805', // Deep dark forest
    particle: '#658b54', // Falling leaves
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
            isAmbient: true,
            seed: Math.random() * 100 // for flutter
        });
    }
}
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        if (currentLevelIndex >= 5 && p.isAmbient) {
            // Leafy flutter
            p.x += p.vx + Math.sin(gameTime * 0.05 + p.seed) * 1.5;
        } else {
            p.x += p.vx;
        }
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
        if (currentLevelIndex >= 5 && p.isAmbient) {
            // Draw leaf oval
            ctx.ellipse(p.x, p.y, 4, 8, Math.sin(gameTime * 0.05 + p.seed), 0, Math.PI * 2);
        } else {
            ctx.arc(p.x, p.y, p.isAmbient ? 2 : 4, 0, Math.PI * 2);
        }
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;
}

// Levels
let currentLevelIndex = 0;
let activeEnemies = [];

const levels = [
    { // Level 1: Basic mechanics
        title: "Jump. That's literally it.",
        platforms: [
            {x: 0, y: 500, w: 1000, h: 20},
            {x: 300, y: 350, w: 200, h: 20},
            {x: 800, y: 200, w: 200, h: 20}
        ],
        hazards: [],
        enemies: [
            { x: 500, y: 400, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 800 }
        ],
        goal: {x: 850, y: 100, w: 50, h: 50}, 
        spawn: {x: 100, y: 400}
    },
    { // Level 2: Gravity is a harsh mistress
        title: "Gravity is a harsh mistress.",
        platforms: [
            {x: 0, y: 500, w: 300, h: 20},
            {x: 400, y: 400, w: 300, h: 20},
            {x: 800, y: 300, w: 300, h: 20},
            {x: 400, y: 200, w: 300, h: 20},
            {x: 0, y: 100, w: 300, h: 20}
        ],
        hazards: [],
        enemies: [
            { x: 500, y: 350, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 800 },
            { x: 900, y: 250, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 800 }
        ],
        goal: {x: 50, y: 0, w: 50, h: 50}, 
        spawn: {x: 100, y: 400}
    },
    { // Level 3: Don't look down
        title: "Don't look down. Or do, I'm not your dad.",
        platforms: [
            {x: 0, y: 400, w: 200, h: 20},
            {x: 400, y: 500, w: 150, h: 20},
            {x: 800, y: 400, w: 150, h: 20},
            {x: 1200, y: 500, w: 150, h: 20},
            {x: 1600, y: 400, w: 200, h: 20}
        ],
        hazards: [],
        enemies: [
            { x: 450, y: 300, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 800 },
            { x: 1250, y: 300, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 800 }
        ],
        goal: {x: 1650, y: 300, w: 50, h: 50}, 
        spawn: {x: 100, y: 300}
    },
    { // Level 4: Parkour
        title: "Floor is lava, but only metaphorically.",
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
            { x: 600, y: 450, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1500 },
            { x: 900, y: 350, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1500 }
        ],
        goal: {x: 1600, y: 100, w: 50, h: 50},
        spawn: {x: 100, y: 400}
    },
    { // Level 5: Boss Fight
        title: "It's a boss. Try not to die immediately.",
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
    },
    { // Level 6: Introduction to Smart AI (Forest Green)
        title: "These ones actually went to college.",
        platforms: [
            {x: 0, y: 500, w: 300, h: 20},
            {x: 400, y: 500, w: 400, h: 20}, // Enemy patrols here and doesn't fall off!
            {x: 900, y: 500, w: 300, h: 20}
        ],
        hazards: [],
        enemies: [
            { x: 550, y: 400, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1000 }
        ],
        goal: {x: 1100, y: 400, w: 50, h: 50},
        spawn: {x: 100, y: 400}
    },
    { // Level 7: Multiple smart enemies
        title: "They won't fall for the old 'jump over the pit' trick anymore.",
        platforms: [
            {x: 0, y: 600, w: 200, h: 20},
            {x: 300, y: 500, w: 300, h: 20},
            {x: 700, y: 400, w: 300, h: 20},
            {x: 1100, y: 500, w: 300, h: 20},
            {x: 1500, y: 600, w: 200, h: 20}
        ],
        hazards: [],
        enemies: [
            { x: 450, y: 400, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1500 },
            { x: 850, y: 300, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1500 },
            { x: 1250, y: 400, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1500 }
        ],
        goal: {x: 1600, y: 500, w: 50, h: 50},
        spawn: {x: 50, y: 500}
    },
    { // Level 8: Vertical Tree Climbing
        title: "Tree climbing 101.",
        platforms: [
            {x: 0, y: 600, w: 200, h: 20},
            {x: 300, y: 450, w: 100, h: 20},
            {x: 100, y: 300, w: 100, h: 20},
            {x: 300, y: 150, w: 100, h: 20},
            {x: 500, y: 50, w: 300, h: 20}, // Top platform with enemy
            {x: 700, y: 250, w: 100, h: 20},
            {x: 900, y: 400, w: 200, h: 20}
        ],
        hazards: [],
        enemies: [
            { x: 600, y: -50, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1500 }
        ],
        goal: {x: 1000, y: 300, w: 50, h: 50},
        spawn: {x: 50, y: 500}
    },
    { // Level 9: Tight quarters
        title: "Personal space is a myth.",
        platforms: [
            {x: 0, y: 500, w: 150, h: 20},
            {x: 250, y: 500, w: 800, h: 20}, // Long corridor
            {x: 250, y: 350, w: 800, h: 20}, // Roof
            {x: 1150, y: 500, w: 150, h: 20}
        ],
        hazards: [],
        enemies: [
            { x: 400, y: 450, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1000 },
            { x: 700, y: 450, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1000 }
        ],
        goal: {x: 1200, y: 400, w: 50, h: 50},
        spawn: {x: 50, y: 400}
    },
    { // Level 10: Forest Boss
        title: "The big angry salad.",
        platforms: [
            {x: -500, y: 600, w: 3000, h: 200}, // Huge arena floor
            {x: 200, y: 450, w: 200, h: 20},
            {x: 600, y: 350, w: 200, h: 20},
            {x: 1000, y: 450, w: 200, h: 20},
        ],
        hazards: [],
        enemies: [
            { x: 700, y: 400, width: 100, height: 100, vx: 0, vy: 0, speed: 14, aggro: 3000, isBoss: true, jumpTimer: 0 }
        ],
        goal: {x: 1800, y: 550, w: 50, h: 50},
        spawn: {x: 100, y: 500}
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

    // Switch Themes
    colors = (index < 5) ? { ...themeStorm } : { ...themeForest };
    
    // Set UI Title
    levelTitle.innerHTML = `Level ${index + 1}<br><span style="font-size: 0.4em; font-style: italic; color: #ccc;">${level.title}</span>`;

    player.x = level.spawn.x;
    player.y = level.spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.renderW = player.width;
    player.renderH = player.height;
    player.touchWallDir = 0;
    
    playerHasMoved = false; // Reset movement flag
    lightningStrikes = []; // Reset lightning
    
    camera.x = player.x - canvas.width / 2;
    activeEnemies = level.enemies.map(e => {
        let puffs = [];
        // All circles the exact same size (puffSize)
        let puffSize = 0.28;
        puffs.push({ x: 0.5, y: 0.5, r: puffSize }); // Center mass
        
        // Massive randomization range to make them visibly unique, but they still overlap the center
        puffs.push({ x: 0.15 + Math.random()*0.3, y: 0.15 + Math.random()*0.3, r: puffSize }); // Top left
        puffs.push({ x: 0.55 + Math.random()*0.3, y: 0.15 + Math.random()*0.3, r: puffSize }); // Top right
        puffs.push({ x: 0.15 + Math.random()*0.3, y: 0.55 + Math.random()*0.3, r: puffSize }); // Bottom left
        puffs.push({ x: 0.55 + Math.random()*0.3, y: 0.55 + Math.random()*0.3, r: puffSize }); // Bottom right

        return { 
            ...e, 
            isGrounded: false, 
            jumpsLeft: 1, 
            touchWallDir: 0,
            renderW: e.width,
            renderH: e.height,
            jumpCooldown: 0,
            puffs: puffs
        };
    });
    
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
                        // Use a fixed pixel delta for squash so larger enemies don't stretch out of control
                        entity.renderW = entity.width + 14.4;
                        entity.renderH = Math.max(entity.height - 14.4, 4);
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
            
            let atLedge = false;
            let moveLeft = (player.x < enemy.x - 10);
            let moveRight = (player.x > enemy.x + 10);
            
            // Forest Enemies: Look ahead and release movement to stop naturally using friction
            if (currentLevelIndex >= 5 && enemy.isGrounded) {
                let stopDist = 45; // Distance needed to stop using friction
                
                if (moveLeft) {
                    let lookAheadX = enemy.x - stopDist;
                    let isSafe = false;
                    for (const plat of level.platforms) {
                        if (lookAheadX >= plat.x && lookAheadX <= plat.x + plat.w &&
                            enemy.y + enemy.height + 5 >= plat.y && enemy.y + enemy.height + 5 <= plat.y + plat.h + 20) {
                            isSafe = true; break;
                        }
                    }
                    if (!isSafe) { moveLeft = false; atLedge = true; }
                }
                
                if (moveRight) {
                    let lookAheadX = enemy.x + enemy.width + stopDist;
                    let isSafe = false;
                    for (const plat of level.platforms) {
                        if (lookAheadX >= plat.x && lookAheadX <= plat.x + plat.w &&
                            enemy.y + enemy.height + 5 >= plat.y && enemy.y + enemy.height + 5 <= plat.y + plat.h + 20) {
                            isSafe = true; break;
                        }
                    }
                    if (!isSafe) { moveRight = false; atLedge = true; }
                }
            }
            
            // Apply physics identically to the player
            if (moveLeft) enemy.vx -= ACCEL;
            if (moveRight) enemy.vx += ACCEL;
            
            enemy.vx *= FRICTION;
            
            if (enemy.vx > MAX_SPEED) enemy.vx = MAX_SPEED;
            if (enemy.vx < -MAX_SPEED) enemy.vx = -MAX_SPEED;

            if (enemy.jumpCooldown > 0) {
                enemy.jumpCooldown--;
            }

            // Clumsier Platforming Logic (Worse AI for Levels 1-5)
            // If they are on the ground and moving into a wall, or they want to jump towards player, or they are at a ledge
            if (enemy.isGrounded && enemy.jumpCooldown <= 0 && !enemy.isBoss) {
                if (enemy.touchWallDir !== 0 || (player.y < enemy.y - 40 && Math.abs(player.x - enemy.x) < 200) || atLedge) {
                    if (Math.random() < 0.1) { 
                        enemy.vy = JUMP_FORCE;
                        if (atLedge) {
                            // Give them forward momentum to clear the gap!
                            enemy.vx = (player.x > enemy.x ? MAX_SPEED : -MAX_SPEED);
                        }
                        enemy.isGrounded = false;
                        enemy.jumpCooldown = 60; // 1 second cooldown
                    }
                }
            }
            
            if (enemy.jumpCooldown <= 0 && !enemy.isBoss) {
                if (enemy.touchWallDir !== 0 && !enemy.isGrounded) {
                    // Wall jump
                    enemy.vy = JUMP_FORCE;
                    enemy.vx = -enemy.touchWallDir * MAX_SPEED * 1.5;
                    enemy.jumpsLeft = 1;
                    enemy.jumpCooldown = 20;
                    enemy.renderW = enemy.width - 14.4;
                    enemy.renderH = enemy.height + 14.4;
                    spawnParticles(enemy.x + (enemy.touchWallDir === 1 ? enemy.width : 0), enemy.y + enemy.height / 2, colors.enemy, 10, 1);
                } else if (enemy.isGrounded && player.y < enemy.y - 80) {
                    // Ground Jump
                    enemy.vy = JUMP_FORCE;
                    enemy.jumpsLeft = 1;
                    enemy.isGrounded = false;
                    enemy.jumpCooldown = 15;
                    enemy.renderW = enemy.width - 12;
                    enemy.renderH = enemy.height + 12;
                } else if (!enemy.isGrounded && enemy.jumpsLeft > 0 && enemy.vy > 5 && player.y < enemy.y - 20) {
                    // Double jump
                    enemy.vy = JUMP_FORCE * 0.9;
                    enemy.jumpsLeft--;
                    enemy.jumpCooldown = 20;
                    enemy.renderW = enemy.width - 9.6;
                    enemy.renderH = enemy.height + 9.6;
                } else if (enemy.isGrounded && enemy.touchWallDir !== 0) {
                    // Jump over a block
                    enemy.vy = JUMP_FORCE;
                    enemy.isGrounded = false;
                    enemy.jumpCooldown = 15;
                    enemy.renderW = enemy.width - 12;
                    enemy.renderH = enemy.height + 12;
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
        
        // Enemy Squash and Stretch (recovery lerp matches player exactly)
        enemy.renderW += (enemy.width - enemy.renderW) * 0.2;
        enemy.renderH += (enemy.height - enemy.renderH) * 0.2;
        
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
    
    // Boss Lightning Mechanic
    if (level && level.enemies.some(e => e.isBoss) && state === 'playing') {
        if (gameTime % 120 === 0) { // Every 2 seconds
            lightningStrikes.push({
                x: player.x + (Math.random() * 300 - 150),
                timer: 60 // 1 second indicator
            });
        }
    }
    
    for (let i = lightningStrikes.length - 1; i >= 0; i--) {
        let strike = lightningStrikes[i];
        strike.timer--;
        
        if (strike.timer === 0) {
            let strikeRect = { x: strike.x - 20, y: -2000, w: 40, h: 4000 };
            spawnParticles(strike.x, player.y, '#ffd700', 30, 2);
            
            if (checkRectOverlap(player, strikeRect)) {
                die();
                return;
            }
        }
        
        if (strike.timer < -15) {
            lightningStrikes.splice(i, 1);
        }
    }
    
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

function drawStormcloud(ctx, x, y, width, height, puffs) {
    ctx.fillStyle = colors.enemy;
    ctx.shadowBlur = 15;
    ctx.shadowColor = colors.enemy;
    
    ctx.beginPath();
    
    if (puffs && puffs.length > 0) {
        for (let p of puffs) {
            ctx.moveTo(x + width*p.x + width*p.r, y + height*p.y);
            ctx.arc(x + width*p.x, y + height*p.y, width*p.r, 0, Math.PI*2);
        }
    } else {
        // Fallback identical cloud
        ctx.moveTo(x + width*0.35 + width*0.28, y + height*0.6);
        ctx.arc(x + width*0.35, y + height*0.6, width*0.28, 0, Math.PI*2); 
        ctx.moveTo(x + width*0.65 + width*0.28, y + height*0.6);
        ctx.arc(x + width*0.65, y + height*0.6, width*0.28, 0, Math.PI*2); 
        ctx.moveTo(x + width*0.4 + width*0.22, y + height*0.4);
        ctx.arc(x + width*0.4,  y + height*0.4, width*0.22, 0, Math.PI*2); 
        ctx.moveTo(x + width*0.6 + width*0.22, y + height*0.4);
        ctx.arc(x + width*0.6,  y + height*0.4, width*0.22, 0, Math.PI*2); 
    }
    
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawBossStormcloud(ctx, x, y, width, height) {
    drawStormcloud(ctx, x, y, width, height);
}

function drawLeafEnemy(ctx, x, y, width, height) {
    ctx.fillStyle = colors.enemyLeaf;
    ctx.shadowBlur = 15;
    ctx.shadowColor = colors.enemyLeaf;
    
    ctx.beginPath();
    // A clean, minimal leaf shape using quadratic curves
    ctx.moveTo(x + width/2, y); // Top tip
    ctx.quadraticCurveTo(x + width, y + height/2, x + width/2, y + height); // Right side
    ctx.quadraticCurveTo(x, y + height/2, x + width/2, y); // Left side
    ctx.fill();
    
    ctx.shadowBlur = 0;
}

function drawBossLeaf(ctx, x, y, width, height) {
    drawLeafEnemy(ctx, x, y, width, height);
    // Add glowing red eyes for the boss
    ctx.fillStyle = '#ff0000';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff0000';
    ctx.beginPath();
    ctx.arc(x + width*0.35, y + height*0.6, width*0.08, 0, Math.PI*2);
    ctx.arc(x + width*0.65, y + height*0.6, width*0.08, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
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
        let cx = enemy.x + enemy.width / 2;
        let cy = enemy.y + enemy.height;
        let drawX = cx - enemy.renderW / 2;
        let drawY = cy - enemy.renderH;
        
        if (currentLevelIndex >= 5) {
            if (enemy.isBoss) {
                drawBossLeaf(ctx, drawX, drawY, enemy.renderW, enemy.renderH);
            } else {
                drawLeafEnemy(ctx, drawX, drawY, enemy.renderW, enemy.renderH);
            }
        } else {
            if (enemy.isBoss) {
                drawBossStormcloud(ctx, drawX, drawY, enemy.renderW, enemy.renderH, enemy.puffs);
            } else {
                drawStormcloud(ctx, drawX, drawY, enemy.renderW, enemy.renderH, enemy.puffs);
            }
        }
    }
    
    // Draw Lightning Strikes
    for (let strike of lightningStrikes) {
        if (strike.timer > 0) {
            // Smooth Cyan Warning Indicator
            ctx.fillStyle = 'rgba(102, 252, 241, 0.2)';
            ctx.fillRect(strike.x - 20, -2000, 40, 4000);
            
            // Pulsing core line
            let alpha = (Math.sin(gameTime * 0.2) + 1) / 2;
            ctx.fillStyle = `rgba(102, 252, 241, ${0.4 + alpha * 0.6})`;
            ctx.fillRect(strike.x - 2, -2000, 4, 4000);
        } else {
            // Smooth, Clean, Cool Bright Cyan Lightning Bolt
            ctx.strokeStyle = '#ffffff'; // Solid white core
            ctx.lineWidth = 8;
            ctx.shadowBlur = 30; // Massive cyan glow
            ctx.shadowColor = '#66fcf1';
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            
            ctx.beginPath();
            let currentX = strike.x;
            ctx.moveTo(currentX, -2000);
            // Draw clean zig-zags with large steps for a sharp lightning look
            for(let ly = -1900; ly <= 2000; ly += 120) {
                currentX = strike.x + (Math.random() * 60 - 30);
                ctx.lineTo(currentX, ly);
            }
            ctx.stroke();
            
            // Draw a thinner inner core to make it look searing hot
            ctx.lineWidth = 3;
            ctx.shadowBlur = 10;
            ctx.stroke();
            
            ctx.shadowBlur = 0;
        }
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
    gameTime++;
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
