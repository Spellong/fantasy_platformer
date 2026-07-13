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
const CAMERA_LERP = 0.08; // Smoother camera panning

// Input handling
const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// Global Game State
let playerHasMoved = false;
let gameTime = 0;
let lightningStrikes = [];
let fallingLeaves = [];
let fallingIcicles = [];
let snowflakes = [];
let fireballs = []; // Fire boss projectiles

window.playerSpeedMult = 1.0;
window.playerJumpMult = 1.0;
window.updateCheats = function() {
    window.playerSpeedMult = parseFloat(document.getElementById('speed-slider').value);
    window.playerJumpMult = parseFloat(document.getElementById('jump-slider').value);
    document.getElementById('speed-display').innerText = window.playerSpeedMult.toFixed(1);
    document.getElementById('jump-display').innerText = window.playerJumpMult.toFixed(1);
};

// Player state
let player = {
    x: 100, y: 100, width: 24, height: 24,
    vx: 0, vy: 0,
    renderW: 24, renderH: 24, 
    isGrounded: false,
    jumpsLeft: 2,
    touchWallDir: 0, 
    jumpProcessed: false,
    jumpBufferTimer: 0,
    coyoteTimer: 0,
    wallCoyoteTimer: 0,
    lastWallDir: 0
};

// Sound System removed per user request


// Camera state
let camera = { x: 0, y: 0 };

// Colors
let colors = {};

const themeStorm = {
    platform: '#1f2833', 
    platformBorder: '#45a29e', 
    hazard: '#c5c6c7', 
    enemy: '#00ffff', 
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
    bg: '#0a100a', // Deep dark forest (slightly lighter)
    particle: '#658b54', // Falling leaves
    player: '#ffffff'
};

const themeIce = {
    platform: '#30485c', 
    platformBorder: '#bde0fe', 
    hazard: '#8ecae6', 
    enemy: '#00ffff', 
    goal: '#caf0f8', 
    bg: '#02040a', 
    particle: '#caf0f8',
    player: '#ffffff'
};

const themeFire = {
    platform: '#3d1c00', // Dark scorched earth
    platformBorder: '#ff5500', // Glowing orange lava
    hazard: '#ff0000', // Bright red lava/spikes
    enemy: '#ffaa00', // Core of the blaze
    goal: '#ffdd00', // Blazing sun portal
    bg: '#0a0200', // Deep dark ash background
    particle: '#ff5500', // Embers
    player: '#ffffff'
};

const themeVoid = {
    platform: '#180a22', // Deep void purple
    platformBorder: '#6a0dad', // Neon purple glow
    hazard: '#ff00ff', // Magenta spikes
    enemy: '#bd00ff', // Intense black hole purple glow
    goal: '#ffffff', // White hole portal
    bg: '#05000a', // Almost pure black
    particle: '#bd00ff', // Void dust
    player: '#ffffff'
};


const themeCelestial = {
    platform: '#f0f8ff', // Bright Alice Blue / White Marble
    platformBorder: '#ffffff', // Pure white glowing trim
    hazard: '#00ccff', // Bright blue deadly light
    enemy: '#ff66d9', // Glowing bright pink
    goal: '#ffffff', // Pure white light portal
    bg: '#1a0b2e', // Fantasy space dark
    particle: '#ff66d9', // Pink magic dust
    player: '#ffffff'
};

Object.assign(colors, themeStorm); // Default for menu background

// Background globals
let ambientLightningFlash = 0;

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
    // Only spawn ambient embers for the Fire levels (15-19) and Celestial (25+) to keep Void clean
    if (currentLevelIndex >= 15 && !(currentLevelIndex >= 20 && currentLevelIndex < 25)) {
        // Subtle magical background atmosphere
        for (let i = 0; i < 2; i++) {
            if (Math.random() < 0.25) {
                let isForest = (currentLevelIndex >= 5 && currentLevelIndex < 10);
                let isFire = (currentLevelIndex >= 15);
                
                let startY = camera.y + canvas.height + 50;
                if (isForest) startY = camera.y - 50;
                
                let baseVy = -Math.random() * 2 - 0.5;
                if (isForest) baseVy = Math.random() * 1.5 + 0.5;
                if (isFire) baseVy = -Math.random() * 4 - 2; // Fast rising embers

                particles.push({
                    x: camera.x + Math.random() * canvas.width,
                    y: startY,
                    vx: isFire ? (Math.random() - 0.5) * 4 : (Math.random() - 0.5) * 2,
                    vy: baseVy,
                    life: isFire ? 1.0 + Math.random() : 2.0 + Math.random() * 2.0,
                    color: Math.random() < 0.5 ? colors.particle : '#ffffff',
                    isAmbient: true,
                    seed: Math.random() * 100 // for flutter
                });
            }
        }
    }
}
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        if ((currentLevelIndex >= 5 && currentLevelIndex < 10) && p.isAmbient) {
            // Leafy flutter
            p.x += p.vx + Math.sin(gameTime * 0.05 + p.seed) * 1.5;
            p.y += p.vy;
            p.life -= 0.005;
        } else {
            // Apply friction to magical explosions so they burst and then linger smoothly
            if (!p.isAmbient) {
                p.vx *= 0.92;
                p.vy *= 0.92;
            }
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.isAmbient ? 0.005 : 0.01; // Slower fade out
        }
        if (p.life <= 0) particles.splice(i, 1);
    }
}
function drawParticles() {
    ctx.globalCompositeOperation = 'lighter'; // Magical glowing additive blending
    for (let p of particles) {
        ctx.fillStyle = p.color;
        
        let isFire = (currentLevelIndex >= 15);
        
        // Keep ambient particles slightly faint (max 0.4 opacity)
        ctx.globalAlpha = p.isAmbient ? Math.max(0, Math.min(isFire ? 0.6 : 0.4, p.life * (isFire ? 0.8 : 0.4))) : Math.max(0, Math.min(1, p.life));
        
        ctx.beginPath();
        if ((currentLevelIndex >= 5 && currentLevelIndex < 10) && p.isAmbient) {
            // Faint background leaf
            ctx.ellipse(p.x, p.y, 3, 6, Math.sin(gameTime * 0.05 + p.seed), 0, Math.PI * 2);
        } else {
            // Pulsing magical orb / Ember
            let pulse = p.isAmbient ? Math.sin(gameTime * 0.1 + p.seed) * 1.5 : 0;
            ctx.arc(p.x, p.y, Math.max(1, (p.isAmbient ? (isFire ? 2 : 3) : 4) + pulse), 0, Math.PI * 2);
        }
        ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
}

// Levels
let currentLevelIndex = 0;
let activeEnemies = [];

const levels = [
        { // Level 1: Basic mechanics
        title: "Tutorial: The Basics.",
        quote: "Move with arrows. Jump with space. They will hunt you.",
        platforms: [
            {x: 0, y: 500, w: 400, h: 20},
            {x: 450, y: 600, w: 100, h: 20},
            {x: 600, y: 500, w: 600, h: 20},
            {x: 1400, y: 400, w: 200, h: 20},
            {x: 1800, y: 300, w: 200, h: 20},
            {x: 2200, y: 500, w: 800, h: 20},
            {x: 3200, y: 400, w: 300, h: 20}
        ],
        checkpoints: [
            {x: 1500, y: 350, w: 40, h: 50},
            {x: 2500, y: 450, w: 40, h: 50}
        ],
        hazards: [
            {x: -100, y: 800, w: 5000, h: 50} // Pit
        ],
        enemies: [
            { x: 500, y: 550, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 800 },
            { x: 2600, y: 400, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 800 }
        ],
        goal: {x: 3400, y: 350, w: 50, h: 50}, 
        spawn: {x: 100, y: 400}
    },
    { // Level 2: Gravity is a harsh mistress
        title: "Gravity is a harsh mistress.",
        quote: "A long climb up.",
        platforms: [
            // Floor 1
            {x: 0, y: 600, w: 1000, h: 20},
            {x: 1200, y: 600, w: 1000, h: 20},
            // Staircase up
            {x: 2300, y: 500, w: 200, h: 20},
            {x: 2600, y: 400, w: 200, h: 20},
            {x: 2900, y: 300, w: 200, h: 20},
            // Floor 2 (going backwards)
            {x: 2000, y: 200, w: 800, h: 20},
            {x: 1000, y: 200, w: 800, h: 20},
            // Final ascend
            {x: 700, y: 100, w: 200, h: 20},
            {x: 400, y: 0, w: 200, h: 20},
            {x: 0, y: -100, w: 300, h: 20}
        ],
        checkpoints: [
            {x: 1600, y: 550, w: 40, h: 50}, // Floor 1 mid
            {x: 2400, y: 150, w: 40, h: 50}  // Floor 2 start
        ],
        hazards: [
            {x: -100, y: 800, w: 4000, h: 50}
        ],
                enemies: [
            { x: 1500, y: 500, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 800 }
        ],
        goal: {x: 50, y: -150, w: 50, h: 50}, 
        spawn: {x: 100, y: 500}
    },
    { // Level 3: Don't look down
        title: "Don't look down.",
        quote: "Leap of faith.",
        platforms: [
            {x: 0, y: 400, w: 400, h: 20},
            {x: 700, y: 500, w: 150, h: 20},
            {x: 1100, y: 400, w: 150, h: 20},
            {x: 1600, y: 500, w: 200, h: 20}, // CP 1
            {x: 2100, y: 600, w: 150, h: 20},
            {x: 2500, y: 400, w: 150, h: 20},
            {x: 3000, y: 300, w: 200, h: 20}, // CP 2
            {x: 3500, y: 200, w: 100, h: 20},
            {x: 3900, y: 400, w: 100, h: 20},
            {x: 4300, y: 500, w: 300, h: 20}
        ],
        checkpoints: [
            {x: 1650, y: 450, w: 40, h: 50},
            {x: 3050, y: 250, w: 40, h: 50}
        ],
        hazards: [
            {x: -100, y: 1000, w: 6000, h: 50}
        ],
                enemies: [
            { x: 1900, y: 300, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 800 }
        ],
        goal: {x: 4500, y: 450, w: 50, h: 50}, 
        spawn: {x: 100, y: 300}
    },
    { // Level 4: Parkour
        title: "The Wall Jump Cavern.",
        quote: "Hug the walls. They won't hurt you... much.",
        platforms: [
            {x: 0, y: 500, w: 400, h: 20}, // Start platform
            // Pit 1
            {x: 400, y: -300, w: 20, h: 900},
            {x: 700, y: -300, w: 20, h: 900},
            {x: 420, y: 600, w: 280, h: 20},
            // CP 1 platform
            {x: 720, y: -300, w: 300, h: 20},
            // Corridor
            {x: 1020, y: -300, w: 800, h: 20},
            // Pit 2
            {x: 1820, y: -1000, w: 20, h: 700},
            {x: 2120, y: -1000, w: 20, h: 700},
            {x: 1840, y: -300, w: 280, h: 20},
            // CP 2 platform
            {x: 2140, y: -1000, w: 400, h: 20},
            // Pit 3 (downwards)
            {x: 2540, y: -1000, w: 20, h: 1200},
            {x: 2840, y: -1000, w: 20, h: 1200},
            // Goal area
            {x: 2860, y: 200, w: 500, h: 20}
        ],
        checkpoints: [
            {x: 800, y: -350, w: 40, h: 50},
            {x: 2200, y: -1050, w: 40, h: 50}
        ],
        hazards: [
            {x: -100, y: 1500, w: 4000, h: 50}
        ],
        enemies: [],
        goal: {x: 3200, y: 150, w: 50, h: 50},
        spawn: {x: 100, y: 400}
    },
    { // Level 5: Boss Fight
        title: "The Midnight Storm.",
        quote: "Run left. Fast.",
        platforms: [
            // Spawn area (Far right)
            {x: 4800, y: 500, w: 400, h: 20},
            // Sequence going left
            {x: 4400, y: 400, w: 200, h: 20},
            {x: 4000, y: 300, w: 200, h: 20},
            {x: 3500, y: 400, w: 300, h: 20},
            {x: 3000, y: 500, w: 300, h: 20},
            {x: 2400, y: 400, w: 400, h: 20},
            {x: 1800, y: 300, w: 400, h: 20},
            {x: 1200, y: 400, w: 400, h: 20},
            // Boss arena floor (Far left)
            {x: -1000, y: 600, w: 2000, h: 200}, // Boss arena floor from -1000 to 1000
            // Boss arena elevated platforms
            {x: -600, y: 450, w: 200, h: 20},
            {x: 0, y: 450, w: 200, h: 20},
            {x: -300, y: 300, w: 200, h: 20},
            {x: 400, y: 300, w: 200, h: 20}
        ],
        checkpoints: [
            {x: 3650, y: 350, w: 40, h: 50},
            {x: 2000, y: 250, w: 40, h: 50}
        ],
        hazards: [
            {x: 1000, y: 900, w: 5000, h: 50} // Pit only in the scrolling section
        ],
        enemies: [
            // Boss
            { x: -500, y: 400, width: 120, height: 120, vx: 0, vy: 0, speed: 14, aggro: 3000, isBoss: true, jumpTimer: 0 },
            // 3 Minions scattered across the boss arena
            { x: -400, y: 400, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 3000 },
            { x: 100, y: 400, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 3000 },
            { x: -200, y: 200, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 3000 }
        ],
        goal: {x: -900, y: 550, w: 50, h: 50}, // Far left
        spawn: {x: 5000, y: 450} // Far right
    },
    { // Level 6: Introduction to Smart AI (Forest Green)
        title: "These ones actually went to college.",
        quote: "They patrol their platforms. And they multiply.",
        platforms: [
            {x: 0, y: 500, w: 600, h: 20},
            {x: 800, y: 500, w: 1000, h: 20},
            {x: 2000, y: 400, w: 800, h: 20},
            {x: 3000, y: 500, w: 1000, h: 20}
        ],
        checkpoints: [
            {x: 1000, y: 450, w: 40, h: 50},
            {x: 2200, y: 350, w: 40, h: 50}
        ],
        hazards: [
            {x: -100, y: 800, w: 5000, h: 50}
        ],
        enemies: [
            { x: 1200, y: 400, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1000 },
            { x: 3500, y: 400, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1000 }
        ],
        goal: {x: 3800, y: 450, w: 50, h: 50},
        spawn: {x: 100, y: 400}
    },
    { // Level 7: Multiple smart enemies
        title: "Precision platforming required.",
        quote: "I hope you brought your precision boots.",
        platforms: [
            {x: 0, y: 600, w: 400, h: 20},
            {x: 600, y: 500, w: 200, h: 20},
            {x: 1000, y: 400, w: 200, h: 20},
            {x: 1400, y: 300, w: 200, h: 20},
            {x: 1800, y: 400, w: 200, h: 20},
            {x: 2200, y: 500, w: 200, h: 20},
            {x: 2600, y: 600, w: 400, h: 20},
            {x: 3200, y: 500, w: 200, h: 20},
            {x: 3600, y: 400, w: 400, h: 20}
        ],
        checkpoints: [
            {x: 1850, y: 350, w: 40, h: 50},
            {x: 2700, y: 550, w: 40, h: 50}
        ],
        hazards: [
            {x: -100, y: 900, w: 5000, h: 50}
        ],
        enemies: [
            { x: 1450, y: 250, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1500 },
            { x: 3700, y: 350, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1500 }
        ],
        goal: {x: 3900, y: 350, w: 50, h: 50},
        spawn: {x: 100, y: 500}
    },
    { // Level 8: Vertical Tree Climbing
        title: "Tree climbing 101. Wall jumps and double jumps.",
        quote: "You're basically a squirrel now. Act like one.",
        platforms: [
            {x: 0, y: 600, w: 600, h: 20}, // Start

            // Tree 1
            {x: 600, y: -200, w: 20, h: 800},
            {x: 620, y: 400, w: 200, h: 20},
            {x: 400, y: 200, w: 200, h: 20},
            {x: 620, y: 0, w: 200, h: 20},
            {x: 400, y: -200, w: 200, h: 20},
            
            // Tree 2
            {x: 1100, y: -600, w: 20, h: 1000},
            {x: 900, y: 200, w: 200, h: 20},
            {x: 1120, y: 0, w: 200, h: 20},
            {x: 900, y: -200, w: 200, h: 20},
            {x: 1120, y: -400, w: 200, h: 20},
            {x: 900, y: -600, w: 200, h: 20},
            
            // Tree 3
            {x: 1600, y: -1000, w: 20, h: 1000},
            {x: 1400, y: -200, w: 200, h: 20},
            {x: 1620, y: -400, w: 200, h: 20},
            {x: 1400, y: -600, w: 200, h: 20},
            {x: 1620, y: -800, w: 200, h: 20},
            {x: 1400, y: -1000, w: 200, h: 20},
            
            // Canopy
            {x: 1620, y: -1000, w: 600, h: 20}
        ],
        checkpoints: [
            {x: 950, y: 150, w: 40, h: 50},
            {x: 1450, y: -250, w: 40, h: 50}
        ],
        hazards: [
            {x: -100, y: 900, w: 3000, h: 50}
        ],
        enemies: [
            { x: 950, y: -250, width: 40, height: 24, vx: 0, vy: 0, speed: 10, aggro: 1500 },
            { x: 1900, y: -1050, width: 40, height: 24, vx: 0, vy: 0, speed: 10, aggro: 1500 }
        ],
        goal: {x: 2100, y: -1050, w: 50, h: 50},
        spawn: {x: 100, y: 500}
    },
    { // Level 9: The Bridge
        title: "No running. Nowhere to hide.",
        quote: "Paaatttiiiieeeennnnccceeeee... or just run screaming, your call.",
        platforms: [
            {x: 0, y: 500, w: 400, h: 20}, // Start
            {x: 600, y: 500, w: 1000, h: 20},
            {x: 1800, y: 500, w: 800, h: 20},
            {x: 2800, y: 500, w: 1200, h: 20},
            {x: 4200, y: 500, w: 600, h: 20}
        ],
        checkpoints: [
            {x: 1000, y: 450, w: 40, h: 50},
            {x: 3000, y: 450, w: 40, h: 50}
        ],
        hazards: [
            {x: -100, y: 900, w: 6000, h: 50}
        ],
        enemies: [
            { x: 1000, y: 450, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1000 },
            { x: 2200, y: 450, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1000 },
            { x: 3400, y: 450, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1000 }
        ],
        goal: {x: 4600, y: 450, w: 50, h: 50},
        spawn: {x: 100, y: 400}
    },
    { // Level 10: Forest Boss
        title: "The big angry salad.",
        quote: "Run left. Fast.",
        platforms: [
            // Spawn area (Far right)
            {x: 4800, y: 500, w: 400, h: 20},
            
            // Sequence going left (Tricky jumps for Forest)
            {x: 4400, y: 450, w: 200, h: 20},
            {x: 3900, y: 350, w: 300, h: 20},
            {x: 3400, y: 450, w: 200, h: 20},
            {x: 2800, y: 550, w: 400, h: 20},
            {x: 2200, y: 400, w: 300, h: 20},
            {x: 1600, y: 300, w: 300, h: 20},
            {x: 1000, y: 400, w: 400, h: 20},
            
            // Boss arena floor (Far left)
            {x: -1000, y: 600, w: 1800, h: 200},
            
            // Boss arena elevated platforms
            {x: -600, y: 450, w: 200, h: 20},
            {x: 0, y: 450, w: 200, h: 20},
            {x: -300, y: 300, w: 200, h: 20},
            {x: 400, y: 300, w: 200, h: 20}
        ],
        checkpoints: [
            {x: 3500, y: 400, w: 40, h: 50},
            {x: 1700, y: 250, w: 40, h: 50}
        ],
        hazards: [
            {x: 800, y: 900, w: 5000, h: 50} // Pit only in the scrolling section
        ],
        enemies: [
            // Boss
            { x: -500, y: 400, width: 100, height: 100, vx: 0, vy: 0, speed: 14, aggro: 3000, isBoss: true, jumpTimer: 0 },
            // 3 Minions scattered across the boss arena
            { x: -400, y: 400, width: 40, height: 24, vx: 0, vy: 0, speed: 8, aggro: 3000 },
            { x: 100, y: 400, width: 40, height: 24, vx: 0, vy: 0, speed: 8, aggro: 3000 },
            { x: -200, y: 200, width: 40, height: 24, vx: 0, vy: 0, speed: 8, aggro: 3000 }
        ],
        goal: {x: -900, y: 550, w: 50, h: 50},
        spawn: {x: 5000, y: 450}
    },
    { // Level 11: Glacial Peaks Intro
        title: "Welcome to the Glacial Peaks.",
        quote: "They move fast. Don't blink.",
        platforms: [
            {x: 0, y: 500, w: 400, h: 20},
            {x: 500, y: 500, w: 400, h: 20},
            {x: 1000, y: 500, w: 300, h: 20}
        ],
        hazards: [],
        enemies: [
            { x: 650, y: 400, width: 40, height: 40, vx: 0, vy: 0, speed: 14, aggro: 1000 }
        ],
        goal: {x: 1200, y: 450, w: 50, h: 50},
        spawn: {x: 50, y: 400}
    },
    { // Level 12: High platforms
        title: "Ascension.",
        quote: "Keep moving, they're right behind you.",
        platforms: [
            {x: 0, y: 500, w: 200, h: 20},
            {x: 300, y: 400, w: 200, h: 20},
            {x: 600, y: 300, w: 200, h: 20},
            {x: 900, y: 200, w: 200, h: 20},
            {x: 1200, y: 100, w: 200, h: 20}
        ],
        hazards: [],
        enemies: [
            { x: 400, y: 350, width: 40, height: 40, vx: 0, vy: 0, speed: 14, aggro: 1500 },
            { x: 1000, y: 150, width: 40, height: 40, vx: 0, vy: 0, speed: 14, aggro: 1500 }
        ],
        goal: {x: 1300, y: 50, w: 50, h: 50},
        spawn: {x: 50, y: 400}
    },
    { // Level 13: Gauntlet (Right to Left)
        title: "The Speed Gauntlet.",
        quote: "Run left. Don't look back.",
        platforms: [
            {x: 0, y: 500, w: 200, h: 20}, // Goal
            {x: 300, y: 500, w: 800, h: 20}, // Long run
            {x: 1200, y: 500, w: 200, h: 20} // Spawn
        ],
        hazards: [],
        enemies: [
            { x: 700, y: 400, width: 40, height: 40, vx: 0, vy: 0, speed: 14, aggro: 2000 },
            { x: 400, y: 400, width: 40, height: 40, vx: 0, vy: 0, speed: 14, aggro: 2000 }
        ],
        goal: {x: 50, y: 450, w: 50, h: 50},
        spawn: {x: 1300, y: 400}
    },
    { // Level 14: Icicle Intro
        title: "Look up.",
        quote: "Falling ice is bad for your health.",
        platforms: [
            {x: 0, y: 500, w: 1000, h: 20}
        ],
        hazards: [],
        enemies: [
            { x: 700, y: 400, width: 40, height: 40, vx: 0, vy: 0, speed: 14, aggro: 1500 }
        ],
        goal: {x: 900, y: 450, w: 50, h: 50},
        spawn: {x: 100, y: 400}
    },
    { // Level 15: Ice Boss
        title: "The Frost Construct.",
        quote: "It's cold. It's fast. Run.",
        platforms: [
            // Spawn area (Far right)
            {x: 4800, y: 500, w: 400, h: 20},
            
            // Sequence going left (Ice gaps)
            {x: 4300, y: 450, w: 200, h: 20},
            {x: 3700, y: 350, w: 400, h: 20},
            {x: 3100, y: 500, w: 300, h: 20},
            {x: 2500, y: 400, w: 200, h: 20},
            {x: 1900, y: 450, w: 300, h: 20},
            {x: 1300, y: 300, w: 400, h: 20},
            
            // Boss arena floor (Far left) - Incorporating the fractured crevasses
            {x: -1000, y: 600, w: 800, h: 200}, // Left safe zone
            {x: -150, y: 600, w: 150, h: 200}, // Crevasse 1
            {x: 50, y: 600, w: 150, h: 200}, // Crevasse 2
            {x: 250, y: 600, w: 150, h: 200}, // Crevasse 3
            {x: 450, y: 600, w: 150, h: 200}, // Crevasse 4
            {x: 650, y: 600, w: 500, h: 200}, // Right safe zone
            
            // Boss arena elevated platforms
            {x: -500, y: 450, w: 150, h: 20},
            {x: 100, y: 400, w: 150, h: 20},
            {x: 500, y: 450, w: 150, h: 20}
        ],
        checkpoints: [
            {x: 3800, y: 300, w: 40, h: 50},
            {x: 2000, y: 400, w: 40, h: 50}
        ],
        hazards: [
            {x: 1150, y: 900, w: 5000, h: 50} // Pit only in the scrolling section (1150 to keep crevasses deadly)
        ],
        enemies: [
            // Boss
            { x: -500, y: 400, width: 100, height: 100, vx: 0, vy: 0, speed: 14, aggro: 3000, isBoss: true, jumpTimer: 0 },
            // 3 Minions (Ice dashers)
            { x: -200, y: 400, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 3000, jumpCooldown: 0 },
            { x: 300, y: 400, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 3000, jumpCooldown: 0 },
            { x: 700, y: 400, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 3000, jumpCooldown: 0 }
        ],
        goal: {x: -900, y: 550, w: 50, h: 50},
        spawn: {x: 5000, y: 450}
    },
    { // Level 16: Into the Volcano
        title: "Into the Volcano.",
        quote: "Don't look down.",
        platforms: [
            {x: 0, y: 500, w: 400, h: 200},
            {x: 800, y: 500, w: 200, h: 20},
            {x: 1300, y: 400, w: 200, h: 20},
            {x: 1800, y: 500, w: 300, h: 20},
            {x: 2400, y: 350, w: 200, h: 20},
            {x: 3000, y: 450, w: 400, h: 20},
            {x: 3800, y: 500, w: 400, h: 200}
        ],
        checkpoints: [
            {x: 1800, y: 400, w: 40, h: 50},
            {x: 3000, y: 350, w: 40, h: 50}
        ],
        hazards: [
            {x: 0, y: 700, w: 5000, h: 50} // Massive lava sea below
        ],
        enemies: [
            { x: 1000, y: 250, width: 35, height: 35, vx: 0, vy: 0, speed: 14, aggro: 2000 },
            { x: 2000, y: 300, width: 35, height: 35, vx: 0, vy: 0, speed: 14, aggro: 2000 },
            { x: 3200, y: 250, width: 35, height: 35, vx: 0, vy: 0, speed: 14, aggro: 2000 }
        ],
        goal: {x: 4000, y: 450, w: 50, h: 50},
        spawn: {x: 50, y: 400}
    },
    { // Level 17: The Scorched Path
        title: "The Scorched Path.",
        quote: "Don't stop moving.",
        platforms: [
            {x: 0, y: 500, w: 300, h: 200},
            {x: 600, y: 500, w: 100, h: 20},
            {x: 900, y: 400, w: 100, h: 20},
            {x: 1200, y: 300, w: 100, h: 20},
            {x: 1600, y: 450, w: 300, h: 20},
            {x: 2200, y: 350, w: 200, h: 20},
            {x: 2700, y: 500, w: 200, h: 20},
            {x: 3200, y: 400, w: 300, h: 20},
            {x: 3800, y: 500, w: 400, h: 20}
        ],
        checkpoints: [
            {x: 1650, y: 350, w: 40, h: 50},
            {x: 3250, y: 300, w: 40, h: 50}
        ],
        hazards: [
            {x: 0, y: 700, w: 5000, h: 100} // Massive lava floor
        ],
        enemies: [
            { x: 1200, y: 100, width: 35, height: 35, vx: 0, vy: 0, speed: 14, aggro: 2000 },
            { x: 2300, y: 200, width: 35, height: 35, vx: 0, vy: 0, speed: 14, aggro: 2000 },
            { x: 3300, y: 200, width: 35, height: 35, vx: 0, vy: 0, speed: 14, aggro: 2000 }
        ],
        goal: {x: 4000, y: 450, w: 50, h: 50},
        spawn: {x: 50, y: 400}
    },
    { // Level 18: Lava Lakes
        title: "Lava Lakes.",
        quote: "Watch your step.",
        platforms: [
            {x: 0, y: 500, w: 300, h: 400},
            {x: 500, y: 550, w: 150, h: 20},
            {x: 900, y: 450, w: 150, h: 20},
            {x: 1300, y: 550, w: 150, h: 20},
            {x: 1800, y: 400, w: 300, h: 400},
            {x: 2300, y: 500, w: 150, h: 20},
            {x: 2700, y: 400, w: 150, h: 20},
            {x: 3100, y: 500, w: 150, h: 20},
            {x: 3600, y: 350, w: 400, h: 400}
        ],
        checkpoints: [
            {x: 1850, y: 300, w: 40, h: 50}
        ],
        hazards: [
            {x: 0, y: 650, w: 5000, h: 100} // Lake
        ],
        enemies: [
            { x: 900, y: 300, width: 35, height: 35, vx: 0, vy: 0, speed: 14, aggro: 2000 },
            { x: 2300, y: 300, width: 35, height: 35, vx: 0, vy: 0, speed: 14, aggro: 2000 },
            { x: 3100, y: 300, width: 35, height: 35, vx: 0, vy: 0, speed: 14, aggro: 2000 }
        ],
        goal: {x: 3800, y: 300, w: 50, h: 50},
        spawn: {x: 50, y: 400}
    },
    { // Level 19: The Crucible
        title: "The Crucible.",
        quote: "Run.",
        platforms: [
            {x: 0, y: 500, w: 300, h: 20},
            {x: 600, y: 400, w: 200, h: 20},
            {x: 1100, y: 500, w: 200, h: 20},
            {x: 1600, y: 350, w: 150, h: 20},
            {x: 2000, y: 500, w: 200, h: 20},
            {x: 2500, y: 450, w: 200, h: 20},
            {x: 3000, y: 300, w: 200, h: 20},
            {x: 3600, y: 450, w: 400, h: 20}
        ],
        checkpoints: [
            {x: 1150, y: 400, w: 40, h: 50},
            {x: 2550, y: 350, w: 40, h: 50}
        ],
        hazards: [
            {x: 0, y: 700, w: 5000, h: 100}
        ],
        enemies: [
            { x: 650, y: 200, width: 35, height: 35, vx: 0, vy: 0, speed: 14, aggro: 3000 },
            { x: 1650, y: 150, width: 35, height: 35, vx: 0, vy: 0, speed: 14, aggro: 3000 },
            { x: 3050, y: 150, width: 35, height: 35, vx: 0, vy: 0, speed: 14, aggro: 3000 }
        ],
        goal: {x: 3800, y: 400, w: 50, h: 50},
        spawn: {x: 50, y: 400}
    },
    { // Level 20: Fire Boss
        title: "The Inferno Core.",
        quote: "The heart of the fire.",
        platforms: [
            // Spawn area (Far right)
            {x: 4800, y: 500, w: 400, h: 20},
            
            // Sequence going left (Tricky jumps over lava)
            {x: 4300, y: 450, w: 200, h: 20},
            {x: 3700, y: 350, w: 400, h: 20},
            {x: 3100, y: 500, w: 300, h: 20},
            {x: 2500, y: 400, w: 200, h: 20},
            {x: 1900, y: 450, w: 300, h: 20},
            {x: 1300, y: 300, w: 400, h: 20},
            
            // Boss arena floor (Far left)
            {x: -1000, y: 600, w: 1800, h: 200},
            
            // Boss arena elevated platforms
            {x: -600, y: 450, w: 200, h: 20},
            {x: 0, y: 450, w: 200, h: 20},
            {x: -300, y: 300, w: 200, h: 20},
            {x: 400, y: 300, w: 200, h: 20}
        ],
        checkpoints: [
            {x: 3800, y: 250, w: 40, h: 50},
            {x: 2000, y: 350, w: 40, h: 50}
        ],
        hazards: [
            {x: 800, y: 900, w: 5000, h: 50} // Pit only in the scrolling section
        ],
        enemies: [
            // Boss
            { x: -500, y: 400, width: 120, height: 120, vx: 0, vy: 0, speed: 14, aggro: 4000, isBoss: true },
            // 3 Minions scattered across the boss arena
            { x: -400, y: 400, width: 35, height: 35, vx: 0, vy: 0, speed: 14, aggro: 3000 },
            { x: 100, y: 400, width: 35, height: 35, vx: 0, vy: 0, speed: 14, aggro: 3000 },
            { x: -200, y: 200, width: 35, height: 35, vx: 0, vy: 0, speed: 14, aggro: 3000 }
        ],
        goal: {x: -900, y: 550, w: 50, h: 50},
        spawn: {x: 5000, y: 450}
    },
    { // Level 21: Void Intro
        title: "Into the Abyss.",
        quote: "The darkness calls.",
        platforms: [
            {x: 0, y: 700, w: 1000, h: 200},
            {x: 1000, y: 700, w: 1000, h: 200},
            {x: 2000, y: 700, w: 1000, h: 200},
            {x: 3000, y: 700, w: 1500, h: 200},
            // Platforms
            {x: 500, y: 550, w: 200, h: 20},
            {x: 1200, y: 500, w: 200, h: 20},
            {x: 1800, y: 400, w: 200, h: 20},
            {x: 2500, y: 550, w: 200, h: 20},
            {x: 3200, y: 450, w: 300, h: 20}
        ],
        checkpoints: [
            {x: 2000, y: 650, w: 40, h: 50}
        ],
        hazards: [],
        enemies: [
            { x: 800, y: 500, width: 30, height: 30, vx: 0, vy: 0, speed: 2, aggro: 4000 },
            { x: 1900, y: 500, width: 30, height: 30, vx: 0, vy: 0, speed: 2, aggro: 4000 },
            { x: 2800, y: 500, width: 30, height: 30, vx: 0, vy: 0, speed: 2, aggro: 4000 }
        ],
        goal: {x: 4200, y: 600, w: 50, h: 50},
        spawn: {x: 50, y: 600}
    },
    { // Level 22: Event Horizon
        title: "Event Horizon.",
        quote: "Don't get pulled under.",
        platforms: [
            {x: 0, y: 700, w: 500, h: 200},
            {x: 700, y: 700, w: 800, h: 200},
            {x: 1700, y: 700, w: 600, h: 200},
            {x: 2500, y: 700, w: 1000, h: 200},
            {x: 3700, y: 700, w: 800, h: 200},
            // Platforms
            {x: 400, y: 550, w: 400, h: 20},
            {x: 1200, y: 450, w: 300, h: 20},
            {x: 2000, y: 500, w: 300, h: 20},
            {x: 3000, y: 400, w: 400, h: 20}
        ],
        checkpoints: [
            {x: 1750, y: 650, w: 40, h: 50},
            {x: 2800, y: 650, w: 40, h: 50}
        ],
        hazards: [
            {x: 0, y: 900, w: 5000, h: 100} // Bottomless pits between the solid ground
        ],
        enemies: [
            { x: 1000, y: 500, width: 30, height: 30, vx: 0, vy: 0, speed: 1.5, aggro: 4000 },
            { x: 2100, y: 500, width: 30, height: 30, vx: 0, vy: 0, speed: 1.5, aggro: 4000 },
            { x: 3200, y: 500, width: 30, height: 30, vx: 0, vy: 0, speed: 1.5, aggro: 4000 }
        ],
        goal: {x: 4300, y: 600, w: 50, h: 50},
        spawn: {x: 50, y: 600}
    },
    { // Level 23: Gravity Wells
        title: "Gravity Wells.",
        quote: "Keep your balance.",
        platforms: [
            {x: 0, y: 700, w: 5000, h: 200}, // Solid floor!
            {x: 500, y: 550, w: 200, h: 20},
            {x: 1000, y: 450, w: 200, h: 20},
            {x: 1500, y: 350, w: 200, h: 20},
            {x: 2000, y: 500, w: 200, h: 20},
            {x: 2500, y: 400, w: 200, h: 20},
            {x: 3000, y: 550, w: 200, h: 20},
            {x: 3500, y: 350, w: 200, h: 20}
        ],
        checkpoints: [
            {x: 1800, y: 650, w: 40, h: 50},
            {x: 3200, y: 650, w: 40, h: 50}
        ],
        hazards: [],
        enemies: [
            { x: 700, y: 600, width: 30, height: 30, vx: 0, vy: 0, speed: 2, aggro: 4000 },
            { x: 1600, y: 600, width: 30, height: 30, vx: 0, vy: 0, speed: 2, aggro: 4000 },
            { x: 2700, y: 600, width: 30, height: 30, vx: 0, vy: 0, speed: 2, aggro: 4000 },
            { x: 3700, y: 600, width: 30, height: 30, vx: 0, vy: 0, speed: 2, aggro: 4000 }
        ],
        goal: {x: 4500, y: 600, w: 50, h: 50},
        spawn: {x: 50, y: 600}
    },
    { // Level 24: The Crushing Dark
        title: "The Crushing Dark.",
        quote: "Don't stop moving.",
        platforms: [
            {x: 0, y: 700, w: 600, h: 200},
            {x: 800, y: 700, w: 600, h: 200},
            {x: 1600, y: 700, w: 600, h: 200},
            {x: 2400, y: 700, w: 600, h: 200},
            {x: 3200, y: 700, w: 600, h: 200},
            {x: 4000, y: 700, w: 600, h: 200},
            // High path
            {x: 500, y: 500, w: 400, h: 20},
            {x: 1300, y: 450, w: 400, h: 20},
            {x: 2100, y: 400, w: 400, h: 20},
            {x: 2900, y: 450, w: 400, h: 20},
            {x: 3700, y: 500, w: 400, h: 20}
        ],
        checkpoints: [
            {x: 1800, y: 650, w: 40, h: 50},
            {x: 3400, y: 650, w: 40, h: 50}
        ],
        hazards: [
            {x: 0, y: 900, w: 5000, h: 50}
        ],
        enemies: [
            { x: 1000, y: 600, width: 30, height: 30, vx: 0, vy: 0, speed: 2.5, aggro: 4000 },
            { x: 1800, y: 600, width: 30, height: 30, vx: 0, vy: 0, speed: 2.5, aggro: 4000 },
            { x: 2600, y: 600, width: 30, height: 30, vx: 0, vy: 0, speed: 2.5, aggro: 4000 },
            { x: 3400, y: 600, width: 30, height: 30, vx: 0, vy: 0, speed: 2.5, aggro: 4000 }
        ],
        goal: {x: 4400, y: 600, w: 50, h: 50},
        spawn: {x: 50, y: 600}
    },
    { // Level 25: Void Boss
        title: "The Void Core.",
        quote: "Escape the singularity.",
        platforms: [
            // Spawn area (Far right)
            {x: 4800, y: 700, w: 400, h: 200},
            
            // Sequence going left (Solid ground with minor gaps)
            {x: 4200, y: 700, w: 500, h: 200},
            {x: 3600, y: 700, w: 500, h: 200},
            {x: 3000, y: 700, w: 500, h: 200},
            {x: 2400, y: 700, w: 500, h: 200},
            {x: 1800, y: 700, w: 500, h: 200},
            {x: 1200, y: 700, w: 500, h: 200},
            
            // Elevated paths
            {x: 4000, y: 550, w: 200, h: 20},
            {x: 3200, y: 500, w: 300, h: 20},
            {x: 2200, y: 450, w: 200, h: 20},
            {x: 1400, y: 500, w: 300, h: 20},
            
            // Boss arena floor (Far left)
            {x: -1000, y: 700, w: 2000, h: 200},
            
            // Boss arena elevated platforms
            {x: -600, y: 500, w: 300, h: 20},
            {x: -100, y: 400, w: 300, h: 20},
            {x: 400, y: 500, w: 300, h: 20}
        ],
        checkpoints: [
            {x: 3800, y: 650, w: 40, h: 50},
            {x: 2000, y: 650, w: 40, h: 50}
        ],
        hazards: [
            {x: 800, y: 900, w: 5000, h: 50} // Pit only in the scrolling section
        ],
        enemies: [
            // Boss
            { x: -500, y: 500, width: 120, height: 120, vx: 0, vy: 0, speed: 2, aggro: 4000, isBoss: true },
            // 3 Minions scattered across the boss arena
            { x: -400, y: 600, width: 30, height: 30, vx: 0, vy: 0, speed: 2, aggro: 3000 },
            { x: 100, y: 600, width: 30, height: 30, vx: 0, vy: 0, speed: 2, aggro: 3000 },
            { x: -200, y: 300, width: 30, height: 30, vx: 0, vy: 0, speed: 2, aggro: 3000 }
        ],
        goal: {x: -900, y: 600, w: 50, h: 50},
        spawn: {x: 5000, y: 600}
    },
    { // Level 26: Celestial Intro
        title: "The Golden Gates.",
        quote: "They watch from above.",
        platforms: [
            {x: 0, y: 700, w: 1000, h: 200},
            {x: 1200, y: 650, w: 500, h: 200},
            {x: 1900, y: 600, w: 600, h: 200},
            {x: 2700, y: 650, w: 800, h: 200},
            {x: 3700, y: 700, w: 1000, h: 200},
            // High pillars to stand on to trigger dives
            {x: 800, y: 550, w: 100, h: 20},
            {x: 1500, y: 450, w: 100, h: 20},
            {x: 2400, y: 500, w: 100, h: 20},
            {x: 3200, y: 400, w: 100, h: 20}
        ],
        checkpoints: [
            {x: 2200, y: 550, w: 40, h: 50}
        ],
        hazards: [
            {x: 0, y: 900, w: 5000, h: 100}
        ],
        enemies: [
            { x: 1400, y: 200, width: 30, height: 30, vx: 0, vy: 0, speed: 4, aggro: 4000 },
            { x: 2500, y: 150, width: 30, height: 30, vx: 0, vy: 0, speed: 4, aggro: 4000 },
            { x: 3400, y: 250, width: 30, height: 30, vx: 0, vy: 0, speed: 4, aggro: 4000 }
        ],
        goal: {x: 4500, y: 600, w: 50, h: 50},
        spawn: {x: 50, y: 600}
    },
    { // Level 27: Floating Pillars
        title: "Ascension.",
        quote: "Don't look down.",
        platforms: [
            {x: 0, y: 700, w: 400, h: 200},
            {x: 600, y: 600, w: 200, h: 20},
            {x: 1000, y: 500, w: 200, h: 20},
            {x: 1400, y: 400, w: 200, h: 20},
            {x: 1800, y: 500, w: 200, h: 20},
            {x: 2200, y: 600, w: 200, h: 20},
            {x: 2600, y: 500, w: 200, h: 20},
            {x: 3000, y: 400, w: 200, h: 20},
            {x: 3400, y: 300, w: 200, h: 20},
            {x: 3800, y: 400, w: 200, h: 20},
            {x: 4200, y: 700, w: 600, h: 200}
        ],
        checkpoints: [
            {x: 2250, y: 550, w: 40, h: 50}
        ],
        hazards: [
            {x: -1000, y: 900, w: 6000, h: 100}
        ],
        enemies: [
            { x: 1200, y: 100, width: 30, height: 30, vx: 0, vy: 0, speed: 4.5, aggro: 4000 },
            { x: 2000, y: 150, width: 30, height: 30, vx: 0, vy: 0, speed: 4.5, aggro: 4000 },
            { x: 2800, y: 100, width: 30, height: 30, vx: 0, vy: 0, speed: 4.5, aggro: 4000 },
            { x: 3600, y: 50, width: 30, height: 30, vx: 0, vy: 0, speed: 4.5, aggro: 4000 }
        ],
        goal: {x: 4600, y: 600, w: 50, h: 50},
        spawn: {x: 50, y: 600}
    },
    { // Level 28: Seraphim Roost
        title: "Heaven's Fury.",
        quote: "Dodge and weave.",
        platforms: [
            {x: 0, y: 700, w: 1000, h: 200},
            {x: 1000, y: 700, w: 1000, h: 200},
            {x: 2000, y: 700, w: 1000, h: 200},
            {x: 3000, y: 700, w: 1000, h: 200},
            {x: 4000, y: 700, w: 1000, h: 200},
            // Low floating barriers
            {x: 600, y: 500, w: 100, h: 100},
            {x: 1400, y: 400, w: 100, h: 100},
            {x: 2200, y: 550, w: 100, h: 100},
            {x: 3000, y: 450, w: 100, h: 100},
            {x: 3800, y: 500, w: 100, h: 100}
        ],
        checkpoints: [
            {x: 2500, y: 650, w: 40, h: 50}
        ],
        hazards: [],
        enemies: [
            { x: 1000, y: 100, width: 30, height: 30, vx: 0, vy: 0, speed: 5, aggro: 4000 },
            { x: 1800, y: 150, width: 30, height: 30, vx: 0, vy: 0, speed: 5, aggro: 4000 },
            { x: 2600, y: 100, width: 30, height: 30, vx: 0, vy: 0, speed: 5, aggro: 4000 },
            { x: 3400, y: 150, width: 30, height: 30, vx: 0, vy: 0, speed: 5, aggro: 4000 },
            { x: 4200, y: 100, width: 30, height: 30, vx: 0, vy: 0, speed: 5, aggro: 4000 }
        ],
        goal: {x: 4800, y: 600, w: 50, h: 50},
        spawn: {x: 50, y: 600}
    },
    { // Level 29: Leap of Faith
        title: "Leap of Faith.",
        quote: "Bounce off them.",
        platforms: [
            {x: 0, y: 700, w: 500, h: 200},
            // Massive gaps, you MUST bounce on diving seraphs to cross
            {x: 1500, y: 700, w: 500, h: 200},
            {x: 3000, y: 700, w: 500, h: 200},
            {x: 4500, y: 700, w: 500, h: 200}
        ],
        checkpoints: [
            {x: 1700, y: 650, w: 40, h: 50},
            {x: 3200, y: 650, w: 40, h: 50}
        ],
        hazards: [
            {x: -1000, y: 900, w: 7000, h: 100}
        ],
        enemies: [
            { x: 1000, y: 100, width: 30, height: 30, vx: 0, vy: 0, speed: 4, aggro: 4000 },
            { x: 2500, y: 100, width: 30, height: 30, vx: 0, vy: 0, speed: 4, aggro: 4000 },
            { x: 4000, y: 100, width: 30, height: 30, vx: 0, vy: 0, speed: 4, aggro: 4000 }
        ],
        goal: {x: 4800, y: 600, w: 50, h: 50},
        spawn: {x: 50, y: 600}
    },
    { // Level 30: Celestial Boss
        title: "The Seraph Prime.",
        quote: "The final judgment.",
        platforms: [
            // Spawn area (Far right)
            {x: 4800, y: 700, w: 400, h: 200},
            
            // Sequence going left
            {x: 4200, y: 700, w: 500, h: 200},
            {x: 3600, y: 600, w: 200, h: 20},
            {x: 3000, y: 700, w: 500, h: 200},
            {x: 2400, y: 500, w: 200, h: 20},
            {x: 1800, y: 700, w: 500, h: 200},
            {x: 1200, y: 400, w: 200, h: 20},
            
            // Boss arena floor (Far left)
            {x: -1000, y: 700, w: 2000, h: 200},
            
            // Boss arena elevated platforms
            {x: -600, y: 500, w: 300, h: 20},
            {x: -100, y: 400, w: 300, h: 20},
            {x: 400, y: 500, w: 300, h: 20}
        ],
        checkpoints: [
            {x: 3100, y: 650, w: 40, h: 50},
            {x: 2000, y: 650, w: 40, h: 50}
        ],
        hazards: [
            {x: 800, y: 900, w: 5000, h: 50} 
        ],
        enemies: [
            // Seraph Boss (Massive swooping boss)
            { x: -500, y: 100, width: 150, height: 150, vx: 0, vy: 0, speed: 6, aggro: 4000, isBoss: true },
            // 3 Minions scattered high in the boss arena
            { x: -400, y: 100, width: 30, height: 30, vx: 0, vy: 0, speed: 4, aggro: 3000 },
            { x: 100, y: 150, width: 30, height: 30, vx: 0, vy: 0, speed: 4, aggro: 3000 },
            { x: -200, y: 50, width: 30, height: 30, vx: 0, vy: 0, speed: 4, aggro: 3000 }
        ],
        goal: {x: -900, y: 600, w: 50, h: 50},
        spawn: {x: 5000, y: 600}
    },
    ];

let level = null;
let state = 'menu'; 

function startGame() {
    state = 'transition';
    document.getElementById('main-menu').classList.add('hidden');
    currentLevelIndex = 0;
    loadLevel(0);
}

function loadLevel(index) {
    if (index >= levels.length) {
        // Trigger Victory Screen
        document.getElementById('victory-screen').classList.remove('hidden');
        document.getElementById('ui-layer').classList.add('hidden');
        document.getElementById('level-menu-container').classList.add('hidden');
        state = 'complete';
        playEpicMusic();
        return;
    }
    level = levels[index];
    
    // Auto-fix Level Definitions
    if (!level.sanitized) {
        level.sanitized = true;
        let safeRadius = 350; // Plenty of room
        
        // 1. Drop Checkpoints to platforms
        if (level.checkpoints) {
            for (let cp of level.checkpoints) {
                cp.w = cp.w || 40; cp.h = cp.h || 50;
                let nearestY = 9999;
                for (let plat of level.platforms) {
                    if (cp.x + cp.w > plat.x && cp.x < plat.x + (plat.w || 100) && plat.y >= cp.y - 100) {
                        if (plat.y < nearestY) nearestY = plat.y;
                    }
                }
                if (nearestY !== 9999) cp.y = nearestY - cp.h;
            }
        }
        
        // 2. Nudge enemies out of platforms
        if (level.enemies) {
            for (let enemy of level.enemies) {
                enemy.width = enemy.width || 30; enemy.height = enemy.height || 30;
                for (let plat of level.platforms) {
                    let w = plat.w || 100; let h = plat.h || 20;
                    if (enemy.x < plat.x + w && enemy.x + enemy.width > plat.x &&
                        enemy.y < plat.y + h && enemy.y + enemy.height > plat.y) {
                        enemy.y = plat.y - enemy.height - 2;
                    }
                }
            }
        }
        
        // 3. Push enemies away from spawn and checkpoints
        let safePoints = [level.spawn];
        if (level.checkpoints) safePoints = safePoints.concat(level.checkpoints);
        if (level.enemies) {
            for (let enemy of level.enemies) {
                for (let sp of safePoints) {
                    let dx = (enemy.x + enemy.width/2) - sp.x;
                    let dy = (enemy.y + enemy.height/2) - sp.y;
                    let dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < safeRadius) {
                        enemy.x += (dx >= 0 ? 1 : -1) * (safeRadius - dist);
                    }
                }
            }
        }
    }

    // Switch Themes
    if (index < 5) {
        colors = { ...themeStorm };
        levelTitle.style.color = '#66fcf1';
        levelTitle.style.textShadow = '0 0 25px rgba(102, 252, 241, 0.8), 0 0 10px #45a29e';
        levelTitle.style.fontFamily = "'Cinzel', serif";
    } else if (index < 10) {
        colors = { ...themeForest };
        levelTitle.style.color = '#4ade80';
        levelTitle.style.textShadow = '0 0 25px rgba(74, 222, 128, 0.8), 0 0 10px #2e7d32';
        levelTitle.style.fontFamily = "'Caveat', cursive";
    } else if (index < 15) {
        colors = { ...themeIce };
        levelTitle.style.color = '#bde0fe';
        levelTitle.style.textShadow = '0 0 25px rgba(189, 224, 254, 0.8), 0 0 10px #00b4d8';
        levelTitle.style.fontFamily = "'Raleway', sans-serif";
    } else if (index < 20) {
        colors = { ...themeFire };
        levelTitle.style.color = '#ffaa00';
        levelTitle.style.textShadow = '0 0 25px rgba(255, 170, 0, 0.8), 0 0 10px #ff5500';
        levelTitle.style.fontFamily = "'Cinzel', serif";
    } else if (index < 25) {
        colors = { ...themeVoid };
        levelTitle.style.color = '#bd00ff';
        levelTitle.style.textShadow = '0 0 25px rgba(189, 0, 255, 0.8), 0 0 10px #6a0dad';
        levelTitle.style.fontFamily = "'Oswald', sans-serif";
    } else {
        colors = { ...themeCelestial };
        levelTitle.style.color = '#ffd700';
        levelTitle.style.textShadow = '0 0 25px rgba(255, 215, 0, 0.8), 0 0 10px #ffffff';
        levelTitle.style.fontFamily = "'Cinzel', serif";
    }
    
    // Set UI Title
    levelTitle.innerHTML = `Level ${index + 1}<br><span style="font-size: 0.5em; font-style: italic; color: #ccc;">${level.title}</span>`;

    player.x = level.spawn.x;
    player.y = level.spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.renderW = player.width;
    player.renderH = player.height;
    player.touchWallDir = 0;
    
    playerHasMoved = false; // Reset movement flag
    lightningStrikes = []; // Reset lightning
    fallingLeaves = []; // Reset falling leaves
    fallingIcicles = []; // Reset falling icicles
    snowflakes = []; // Reset snow
    fireballs = []; // Reset boss fireballs
    particles = []; // Clear lingering ambient particles
    
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
            jumpsLeft: 2, 
            touchWallDir: 0,
            renderW: e.width,
            renderH: e.height,
            jumpCooldown: 0,
            puffs: puffs
        };
    });
    
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;
    
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
    
    // Hide main menu if selecting a level directly from it
    let mainMenu = document.getElementById('main-menu');
    if (mainMenu) mainMenu.classList.add('hidden');
    
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
                    entity.jumpsLeft = 2;
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
        // Force ALL enemies to match the player's exact top speed
        enemy.speed = MAX_SPEED * window.playerSpeedMult;
        
        // AI Logic: Always active regardless of distance
        let atLedge = false;
        let prevVy = enemy.vy;
        
        if (enemy.reactionTimer === undefined) {
            enemy.reactionTimer = 0;
            enemy.moveDir = 0;
        }
        
        if (enemy.reactionTimer > 0) {
            enemy.reactionTimer--;
        }
        
        let moveLeft = false;
        let moveRight = false;
        
        // Storm Spirits Teleportation Logic
        if (currentLevelIndex < 5 && !enemy.isBoss) { // Minions can teleport, but Boss cannot
            if (enemy.tpCooldown === undefined) {
                enemy.tpCooldown = Math.floor(60 + Math.random() * 240); // 1 to 5 seconds
            }
            if (enemy.tpCooldown > 0) {
                enemy.tpCooldown--;
                
                // Teleport Charge-Up Phase (last 0.75 seconds)
                if (Math.floor(enemy.tpCooldown) === 44) {
                    // Lock in the destination
                    if (level && level.platforms && level.platforms.length > 0) {
                        let validPlats = level.platforms;
                        if (currentLevelIndex === 4) { // Level 5
                            // Keep Boss and Minions in the arena so they don't teleport into the scrolling section
                            validPlats = level.platforms.filter(p => p.x < 1000); 
                        }
                        
                        let plat = validPlats[Math.floor(Math.random() * validPlats.length)];
                        enemy.tpTargetX = plat.x + Math.random() * Math.max(0, plat.w - enemy.width);
                        enemy.tpTargetY = plat.y - enemy.height - 5;
                    }
                }
                
                if (enemy.tpCooldown < 45) {
                    if (gameTime % 4 === 0) {
                        // Spark on the enemy
                        spawnParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, colors.enemy, 5, 2);
                        // Spark at the destination so the player knows where they are going!
                        if (enemy.tpTargetX !== undefined) {
                            spawnParticles(enemy.tpTargetX + enemy.width/2, enemy.tpTargetY + enemy.height/2, colors.enemy, 3, 0.5);
                        }
                    }
                }
            } else {
                enemy.tpCooldown = Math.floor(60 + Math.random() * 240);
                
                if (enemy.tpTargetX !== undefined) {
                    // Minimal particle flash at the OLD location
                    spawnParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, colors.enemy, 15, 1.5);
                    
                    // Teleport to pre-chosen target
                    enemy.x = enemy.tpTargetX;
                    enemy.y = enemy.tpTargetY;
                    enemy.vx = 0;
                    enemy.vy = 0;
                    
                    // Minimal particle flash at the NEW location
                    spawnParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, colors.enemy, 15, 1.5);
                    
                    enemy.tpTargetX = undefined;
                    enemy.tpTargetY = undefined;
                }
            }
        }
        
        if (currentLevelIndex >= 20 && currentLevelIndex < 30) {
            let isCelestial = currentLevelIndex >= 25;
            enemy.speed = isCelestial ? MAX_SPEED * 0.9 : MAX_SPEED;
            moveLeft = (player.x < enemy.x - 10);
            moveRight = (player.x > enemy.x + 10);
            
            // Gravity Burst State Machine
            if (!enemy.burstState) {
                enemy.burstState = 'cooldown';
                enemy.burstTimer = 0;
                enemy.cooldownMax = 60 + Math.random() * 240; // 1 to 5 seconds
            }
            let distToPlayer = Math.sqrt(Math.pow(enemy.x - player.x, 2) + Math.pow(enemy.y - player.y, 2));
            
            if (enemy.burstState === 'cooldown') {
                enemy.burstTimer++;
                if (enemy.burstTimer > enemy.cooldownMax) {
                    enemy.burstState = 'charge';
                    enemy.burstTimer = 0;
                }
            } else if (enemy.burstState === 'charge') {
                enemy.burstTimer++;
                if (enemy.burstTimer > 60) {
                    enemy.burstState = 'active';
                    enemy.burstTimer = 0;
                    
                    // Implosion/Explosion effect
                    if (isCelestial) {
                        spawnParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#ffffff', 40, 3);
                    } else {
                        spawnParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, colors.particle, 40, 3);
                    }
                }
            } else if (enemy.burstState === 'active') {
                enemy.burstTimer++;
                if (enemy.burstTimer > 30) {
                    enemy.burstState = 'cooldown';
                    enemy.burstTimer = 0;
                    enemy.cooldownMax = 60 + Math.random() * 240;
                }
            }
        } else if (currentLevelIndex >= 15) {
            // FIRE GUARDIANS
            
            // Phase State Logic
            if (enemy.phaseState === undefined) {
                enemy.phaseState = 'visible';
                // Heavily randomize initial start time so they don't sync up at the start of the level
                enemy.phaseTimer = 60 + Math.random() * 300; 
            }
            
            if (!enemy.isBoss) {
                if (enemy.phaseTimer > 0) {
                    enemy.phaseTimer--;
                } else {
                    if (enemy.phaseState === 'visible') {
                        enemy.phaseState = 'flickering';
                        enemy.phaseTimer = 45; // 0.75 seconds of flickering
                    } else if (enemy.phaseState === 'flickering') {
                        enemy.phaseState = 'invisible';
                        enemy.phaseTimer = 60; // Exactly 1 second of invisibility
                    } else if (enemy.phaseState === 'invisible') {
                        enemy.phaseState = 'visible';
                        enemy.phaseTimer = 60 + Math.random() * 240; // 1 to 5 seconds of being visible before doing it again
                    }
                }
            }
            
            if (enemy.isBoss) {
                // Boss flies and hovers
                if (enemy.startX === undefined) {
                    enemy.startX = enemy.x;
                    enemy.startY = enemy.y;
                    enemy.hoverTimer = Math.random() * 100;
                }
                
                enemy.isGrounded = false; // Always flying
                enemy.hoverTimer += 0.05;
                
                // Idle hover around spawn (Boss relies on its fireball summoning in updatePhysics)
                enemy.targetX = enemy.startX;
                enemy.targetY = enemy.startY + Math.sin(enemy.hoverTimer) * 30;
                
                let dirX = enemy.targetX - enemy.x;
                let dirY = enemy.targetY - enemy.y;
                let distToTarget = Math.sqrt(dirX*dirX + dirY*dirY);
                
                if (distToTarget > 5) {
                    enemy.vx += (dirX / distToTarget) * (enemy.speed * 0.06);
                    enemy.vy += (dirY / distToTarget) * (enemy.speed * 0.06);
                }
                
                enemy.vx *= 0.85; 
                enemy.vy *= 0.85;
                
                let currentSpeed = Math.sqrt(enemy.vx*enemy.vx + enemy.vy*enemy.vy);
                if (currentSpeed > MAX_SPEED) {
                    enemy.vx = (enemy.vx / currentSpeed) * MAX_SPEED;
                    enemy.vy = (enemy.vy / currentSpeed) * MAX_SPEED;
                }
                
                moveLeft = false; moveRight = false; // Bypass normal physics
            } else {
                // Relentless Chase AI
                moveLeft = (player.x < enemy.x - 10);
                moveRight = (player.x > enemy.x + 10);
            }
        } else if (currentLevelIndex >= 10) {
            // Ice Enemies Dash Mechanic
            if (!enemy.isBoss && currentLevelIndex < 15) {
                if (enemy.dashCooldown === undefined) {
                    enemy.dashCooldown = 30 + Math.random() * 90; // 0.5 to 2 seconds
                }
                
                if (enemy.dashCooldown > 0) {
                    enemy.dashCooldown--;
                } else {
                    enemy.dashCooldown = 30 + Math.random() * 90;
                    enemy.dashTimer = 15; // Dash lasts for 15 frames
                    enemy.vx = (player.x > enemy.x ? enemy.speed * 3.5 : -enemy.speed * 3.5);
                    enemy.vy = -JUMP_FORCE * 0.4; // Slight hop
                    enemy.isGrounded = false;
                    spawnParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, colors.enemy, 20, 2);
                }
            }
            
            // Ice enemies commit to a direction during their reaction delay so they don't awkwardly stop in mid-air
            if (enemy.reactionTimer <= 0) {
                if (player.x < enemy.x - 10) enemy.moveDir = -1;
                else if (player.x > enemy.x + 10) enemy.moveDir = 1;
                else enemy.moveDir = 0;
                
                enemy.reactionTimer = 10 + Math.random() * 15; // 0.15 to 0.4 second reaction delay
            }
            moveLeft = (enemy.moveDir === -1);
            moveRight = (enemy.moveDir === 1);
        } else {
            // Normal enemies track instantly (Storm Enemies)
            if (enemy.tpCooldown !== undefined && enemy.tpCooldown < 45) {
                // Teleport Charging Phase! Stop moving and vibrate
                moveLeft = false;
                moveRight = false;
                enemy.vx = 0; // Completely freeze
                enemy.vy = 0; // Freeze vertically too
                enemy.x += (Math.random() - 0.5) * 4; // Violent vibration
            } else {
                // Add randomness to movement so they don't line up like robots
                if (enemy.chaseOffset === undefined) {
                    enemy.chaseOffset = (Math.random() - 0.5) * 60; // Offset so they don't clump
                }
                if (Math.random() < 0.02) enemy.chaseOffset = (Math.random() - 0.5) * 60; // Occasionally shuffle
                
                let targetX = player.x + enemy.chaseOffset;
                moveLeft = (targetX < enemy.x - 10);
                moveRight = (targetX > enemy.x + 10);
            }
        }
            
            // Forest Enemies: Detect ledge to jump instantly without hesitation
            if ((currentLevelIndex >= 5 && currentLevelIndex < 10) && enemy.isGrounded) {
                let lookAheadX = moveLeft ? enemy.x - 5 : (moveRight ? enemy.x + enemy.width + 5 : enemy.x);
                let isSafe = false;
                if (moveLeft || moveRight) {
                    for (const plat of level.platforms) {
                        if (lookAheadX >= plat.x && lookAheadX <= plat.x + plat.w &&
                            enemy.y + enemy.height + 5 >= plat.y && enemy.y + enemy.height + 5 <= plat.y + plat.h + 20) {
                            isSafe = true; break;
                        }
                    }
                    if (!isSafe) { 
                        atLedge = true; 
                    }
                }
            }
            
            // Apply physics scaling based on their unique speed property
            let speedRatio = enemy.speed / MAX_SPEED;
            let enemyAccel = ACCEL * speedRatio;
            
            if (moveLeft) enemy.vx -= enemyAccel;
            if (moveRight) enemy.vx += enemyAccel;
            
            enemy.vx *= FRICTION;
            
            if (enemy.dashTimer > 0) {
                enemy.dashTimer--;
                if (enemy.vx > enemy.speed * 3.5) enemy.vx = enemy.speed * 3.5;
                if (enemy.vx < -enemy.speed * 3.5) enemy.vx = -enemy.speed * 3.5;
                if (gameTime % 2 === 0) spawnParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, colors.enemy, 2, 0.5); // Dash trail
            } else {
                if (enemy.vx > enemy.speed) enemy.vx = enemy.speed;
                if (enemy.vx < -enemy.speed) enemy.vx = -enemy.speed;
            }

            if (enemy.jumpCooldown > 0) {
                enemy.jumpCooldown--;
            }

            // Clumsier Platforming Logic (Worse AI for Levels 1-5)
            // If they are on the ground and moving into a wall, or they want to jump towards player, or they are at a ledge
            if (enemy.isGrounded && enemy.jumpCooldown <= 0 && !enemy.isBoss) {
                if (enemy.touchWallDir !== 0 || (player.y < enemy.y - 40 && Math.abs(player.x - enemy.x) < 200) || atLedge) {
                    let isForest = (currentLevelIndex >= 5 && currentLevelIndex < 10);
                    let shouldJump = (isForest && atLedge) ? true : (Math.random() < 0.1);
                    
                    if (shouldJump) { 
                        enemy.vy = JUMP_FORCE;
                        if (atLedge) {
                            // Give them forward momentum to clear the gap!
                            enemy.vx = (player.x > enemy.x ? enemy.speed : -enemy.speed);
                        }
                        enemy.isGrounded = false;
                        enemy.jumpsLeft = 1;
                        enemy.jumpCooldown = 60; // 1 second cooldown
                    }
                }
            }
            
            if (enemy.jumpCooldown <= 0 && !enemy.isBoss) {
                if (enemy.touchWallDir !== 0 && !enemy.isGrounded) {
                    // Wall jump
                    enemy.vy = JUMP_FORCE;
                    enemy.vx = -enemy.touchWallDir * enemy.speed * 1.5;
                    enemy.jumpsLeft = 1;
                    enemy.jumpCooldown = 10;
                    enemy.renderW = enemy.width - 14.4;
                    enemy.renderH = enemy.height + 14.4;
                    spawnParticles(enemy.x + (enemy.touchWallDir === 1 ? enemy.width : 0), enemy.y + enemy.height / 2, colors.enemy, 10, 1);
                } else if (enemy.isGrounded && player.y < enemy.y - 80) {
                    // Ground Jump
                    enemy.vy = JUMP_FORCE;
                    enemy.jumpsLeft = 1;
                    enemy.isGrounded = false;
                    enemy.jumpCooldown = 5;
                    enemy.renderW = enemy.width - 12;
                    enemy.renderH = enemy.height + 12;
                } else if (!enemy.isGrounded && enemy.jumpsLeft > 0 && enemy.vy > 5 && player.y < enemy.y - 20) {
                    // Double jump
                    enemy.vy = JUMP_FORCE * 0.9;
                    enemy.jumpsLeft--;
                    enemy.jumpCooldown = 5;
                    enemy.renderW = enemy.width - 9.6;
                    enemy.renderH = enemy.height + 9.6;
                } else if (enemy.isGrounded && enemy.touchWallDir !== 0) {
                    // Jump over a block
                    enemy.vy = JUMP_FORCE;
                    enemy.isGrounded = false;
                    enemy.jumpsLeft = 1;
                    enemy.jumpCooldown = 5;
                    enemy.renderW = enemy.width - 12;
                    enemy.renderH = enemy.height + 12;
                }
            }

            if (currentLevelIndex >= 5 && currentLevelIndex < 10 && !enemy.isBoss && enemy.vy < prevVy && enemy.isGrounded === false) {
                // The Leaf Enemy just jumped!
                enemy.jumpCount = (enemy.jumpCount || 0) + 1;
                if (enemy.jumpCount % 3 === 0) {
                    // Clone itself
                    if (activeEnemies.length < 12) { // Cap clones to prevent infinite lag
                        activeEnemies.push({
                            x: enemy.x, y: enemy.y,
                            width: enemy.width, height: enemy.height,
                            vx: -enemy.vx, vy: enemy.vy, // Clone jumps in opposite direction
                            speed: enemy.speed, aggro: enemy.aggro,
                            jumpCooldown: 30, jumpsLeft: enemy.jumpsLeft,
                            renderW: enemy.renderW, renderH: enemy.renderH,
                            jumpCount: 0
                        });
                        spawnParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, colors.enemyLeaf, 20, 1.5);
                    }
                }
            }

        if (enemy.isBoss) {
            if (currentLevelIndex >= 15 && currentLevelIndex < 20) {
                // Fire Boss floats heavily and aggressively charges
                enemy.isGrounded = false;
                let dirX = player.x - enemy.x;
                let dirY = player.y - enemy.y - 100; // Aim slightly above player
                let distToTarget = Math.sqrt(dirX*dirX + dirY*dirY);
                if (distToTarget > 5) {
                    enemy.vx += (dirX / distToTarget) * 0.5;
                    enemy.vy += (dirY / distToTarget) * 0.5;
                }
                enemy.vx *= 0.95;
                enemy.vy *= 0.95;
            } else if (currentLevelIndex >= 20) {
                enemy.jumpTimer = (enemy.jumpTimer || 0) + 1;
                if (enemy.isGrounded && enemy.jumpTimer > 60) { 
                    enemy.vy = JUMP_FORCE * 1.5;
                    enemy.jumpTimer = 0;
                }
            } else {
                enemy.jumpTimer++;
                if (enemy.isGrounded && enemy.jumpTimer > 100) { 
                    enemy.vy = JUMP_FORCE * 1.2;
                    enemy.jumpTimer = 0;
                }
            }
        }

        let isTeleportCharging = (currentLevelIndex < 5 && enemy.tpCooldown !== undefined && enemy.tpCooldown < 45);
        let isHoveringBoss = (currentLevelIndex >= 15 && currentLevelIndex < 20 && enemy.isBoss);
        if (!isHoveringBoss && !isTeleportCharging) {
            enemy.vy += GRAVITY;
        }

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

    if (jumpJustPressed) {
        player.jumpBufferTimer = 8; // 8 frames of input buffering
    }

    if (player.isGrounded) {
        player.coyoteTimer = 8; // 8 frames of ground coyote time
    } else {
        player.coyoteTimer--;
    }
    
    if (player.touchWallDir !== 0) {
        player.wallCoyoteTimer = 10; // 10 frames of wall coyote time
        player.lastWallDir = player.touchWallDir;
    } else {
        player.wallCoyoteTimer--;
    }

    // Wake up enemies when player moves
    if (jumpPressed || keys['ArrowLeft'] || keys['KeyA'] || keys['ArrowRight'] || keys['KeyD']) {
        playerHasMoved = true;
    }

    // Horizontal movement
    let currentSpeedMult = window.playerSpeedMult || 1.0;
    let currentJumpMult = window.playerJumpMult || 1.0;
    
    if (keys['ArrowLeft'] || keys['KeyA']) { player.vx -= ACCEL * currentSpeedMult; player.facingRight = false; }
    if (keys['ArrowRight'] || keys['KeyD']) { player.vx += ACCEL * currentSpeedMult; player.facingRight = true; }
    
    player.vx *= FRICTION;
    
    let currentMaxSpeed = MAX_SPEED * currentSpeedMult;
    if (player.vx > currentMaxSpeed) player.vx = currentMaxSpeed;
    if (player.vx < -currentMaxSpeed) player.vx = -currentMaxSpeed;

    // Jump Logic
    if (player.jumpBufferTimer > 0) {
        if (player.wallCoyoteTimer > 0 && !player.isGrounded) {
            // Wall Jump
            player.vy = JUMP_FORCE * currentJumpMult;
            player.vx = -player.lastWallDir * currentMaxSpeed * 1.5;
            player.jumpsLeft = 1;
            player.jumpBufferTimer = 0;
            player.wallCoyoteTimer = 0;
            player.renderW = player.width * 0.4;
            player.renderH = player.height * 1.6;
            spawnParticles(player.x + (player.lastWallDir === 1 ? player.width : 0), player.y + player.height / 2, colors.player, 15, 1);
        } else if (player.coyoteTimer > 0) {
            // Ground Jump
            player.vy = JUMP_FORCE * currentJumpMult;
            player.jumpsLeft = 1; 
            player.isGrounded = false;
            player.jumpBufferTimer = 0;
            player.coyoteTimer = 0;
            player.renderW = player.width * 0.5;
            player.renderH = player.height * 1.5;
            spawnParticles(player.x + player.width / 2, player.y + player.height, colors.player, 10, 0.5);
        } else if (jumpJustPressed && player.jumpsLeft > 0) {
            // Double Jump
            player.vy = JUMP_FORCE * 0.9 * currentJumpMult;
            player.jumpsLeft--;
            player.jumpBufferTimer = 0;
            player.renderW = player.width * 0.6;
            player.renderH = player.height * 1.4;
            spawnParticles(player.x + player.width / 2, player.y + player.height, colors.goal, 15, 0.8);
        }
    }
    
    player.jumpBufferTimer--;

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
    
    // Gravity Push / Pull Burst
    if (currentLevelIndex >= 20 && state === 'playing' && playerHasMoved) {
        let isCelestial = currentLevelIndex >= 25; // White holes (push)
        let isVoid = currentLevelIndex >= 20 && currentLevelIndex < 25; // Black holes (pull)

        for (let enemy of activeEnemies) {
            if (enemy.burstState !== 'active') continue; // ONLY APPLY IF ACTIVE
            
            let dx = (enemy.x + enemy.width/2) - (player.x + player.width/2);
            let dy = (enemy.y + enemy.height/2) - (player.y + player.height/2);
            let distSq = dx*dx + dy*dy;
            let dist = Math.sqrt(distSq);
            if (dist > 10 && dist < 1200) {
                // Drastically increase pullStrength because it only lasts 0.5s!
                let pullStrength = enemy.isBoss ? 1200 : 450;
                let pullForce = pullStrength / dist;
                if (pullForce > (enemy.isBoss ? 6.0 : 3.5)) pullForce = (enemy.isBoss ? 6.0 : 3.5);
                
                if (isVoid) {
                    if (!player.isGrounded || enemy.isBoss) {
                        player.vx += (dx / dist) * pullForce;
                        if (!player.isGrounded || enemy.isBoss) player.vy += (dy / dist) * pullForce;
                    }
                } else if (isCelestial) {
                    // PUSH AWAY
                    player.vx -= (dx / dist) * pullForce;
                    player.vy -= (dy / dist) * pullForce;
                }
            }
        }
    }

    // Update Enemies
    updateEnemies();
    
    // Boss Mechanics
    if (level && level.enemies.some(e => e.isBoss) && state === 'playing' && playerHasMoved) {
        if (currentLevelIndex === 4) { // Storm Boss Lightning
            if (gameTime % 120 === 0) { // Every 2 seconds
                lightningStrikes.push({
                    x: player.x + (Math.random() * 300 - 150),
                    timer: 60 // 1 second indicator
                });
            }
        } else if (currentLevelIndex === 9) { // Leaf Boss Falling Leaves
            if (gameTime % 60 === 0) { // Slower, less overwhelming flurry
                fallingLeaves.push({
                    x: player.x + (Math.random() * 800 - 400),
                    y: camera.y - 100,
                    vx: (Math.random() - 0.5) * 3, // Drift left/right
                    vy: 3 + Math.random() * 3, // Fall speed
                    seed: Math.random() * 100, // For drift animation
                    width: 24, height: 24
                });
            }
        } else if (currentLevelIndex >= 13 && currentLevelIndex < 15) {
            // Boss summons icicles
            if (Math.random() < 0.05) {
                fallingIcicles.push({
                    x: Math.random() * 2000 - 200,
                    y: camera.y - 100,
                    w: 10,
                    h: 40,
                    vy: 10 + Math.random() * 5
                });
            }
        } else if (currentLevelIndex === 19) {
            // Fire Boss summons fireballs (Level 20)
            if (Math.random() < 0.06) {
                // Aim slightly ahead of player based on their velocity
                let targetX = player.x + player.vx * 15;
                let startX = player.x + (Math.random() * 1200 - 600);
                let startY = camera.y - 100 - Math.random() * 200;
                let dx = targetX - startX;
                let dy = player.y - startY;
                let dist = Math.sqrt(dx*dx + dy*dy);
                let speed = 10 + Math.random() * 5;
                
                fireballs.push({
                    x: startX,
                    y: startY,
                    vx: (dx / dist) * speed,
                    vy: (dy / dist) * speed,
                    r: 10 + Math.random() * 6
                });
            }
        }
    }
    
    // Level hazards (non-boss)
    if (state === 'playing' && playerHasMoved) {
        if (currentLevelIndex === 14) { // Only boss level has extra icicles
            if (Math.random() < 0.03) {
                fallingIcicles.push({
                    x: player.x + (Math.random() * 800 - 200),
                    y: camera.y - 100,
                    w: 10,
                    h: 40,
                    vy: 10 + Math.random() * 5
                });
            }
        }
        
        // Atmospheric Heavy Snow (DISABLED as per user request to keep the Aurora clear)
        if (false) {
            // Intentionally left disabled
        }
    }
    
    // Handle Lightning
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
    
    // Handle Falling Leaves
    for (let i = fallingLeaves.length - 1; i >= 0; i--) {
        let leaf = fallingLeaves[i];
        
        // Homing behavior: actively track the player's X position
        if (leaf.x < player.x) leaf.vx += 0.05;
        if (leaf.x > player.x) leaf.vx -= 0.05;
        
        // Cap the horizontal speed
        if (leaf.vx > 4) leaf.vx = 4;
        if (leaf.vx < -4) leaf.vx = -4;
        
        // Sine wave drift
        leaf.x += leaf.vx + Math.sin(gameTime * 0.05 + leaf.seed) * 1.5;
        leaf.y += leaf.vy;
        
        // Death check
        if (checkRectOverlap(player, leaf)) {
            spawnParticles(player.x + player.width/2, player.y + player.height/2, colors.enemyLeaf, 20, 1.5);
            die();
            return;
        }
        
        // Clean up
        if (leaf.y > camera.y + canvas.height + 100) {
            fallingLeaves.splice(i, 1);
        }
    }
    
    // Handle Falling Icicles
    for (let i = fallingIcicles.length - 1; i >= 0; i--) {
        let icicle = fallingIcicles[i];
        icicle.y += icicle.vy;
        
        // Death check
        if (checkRectOverlap(player, {x: icicle.x, y: icicle.y, width: icicle.w, height: icicle.h})) {
            spawnParticles(player.x + player.width/2, player.y + player.height/2, colors.hazard, 20, 1.5);
            die();
            return;
        }
        
        if (icicle.y > camera.y + canvas.height + 100) {
            fallingIcicles.splice(i, 1);
        }
    }
    
    // Handle Fireballs
    for (let i = fireballs.length - 1; i >= 0; i--) {
        let fb = fireballs[i];
        fb.x += fb.vx;
        fb.y += fb.vy;
        
        // Death check (circle collision approximated as rect for simplicity)
        if (checkRectOverlap(player, {x: fb.x - fb.r, y: fb.y - fb.r, width: fb.r*2, height: fb.r*2})) {
            spawnParticles(player.x + player.width/2, player.y + player.height/2, colors.hazard, 30, 2);
            die();
            return;
        }
        
        // Leave a trail
        if (gameTime % 2 === 0) {
            particles.push({
                x: fb.x, y: fb.y,
                vx: (Math.random() - 0.5) * 2,
                vy: -Math.random() * 2,
                life: 0.5, color: colors.hazard, isAmbient: false
            });
        }
        
        if (fb.y > camera.y + canvas.height + 100) {
            fireballs.splice(i, 1);
        }
    }
    
    // Handle Snowflakes
    for (let i = snowflakes.length - 1; i >= 0; i--) {
        let snow = snowflakes[i];
        snow.y += snow.vy;
        snow.x += snow.vx + Math.sin(gameTime * 0.02 + snow.seed) * 0.5;
        
        if (snow.y > camera.y + canvas.height + 100) {
            snowflakes.splice(i, 1);
        }
    }
    
    // Death by falling off screen
    if (player.y > camera.y + canvas.height + 200) {
        die();
        return;
    }

    // Checkpoints
    if (level.checkpoints) {
        for (let cp of level.checkpoints) {
            // Precise trigger zone: player must pass X, be above or near flag height, and not below it
            let passX = player.x >= cp.x && player.x <= cp.x + 150;
            let passY = player.y >= cp.y - 600 && player.y <= cp.y + cp.h + 20;
            if (!cp.active && passX && passY) {
                cp.active = true;
                level.spawn = { x: cp.x, y: cp.y }; // Permanently updates spawn for this level instance
                spawnParticles(cp.x + cp.w/2, cp.y + cp.h/2, colors.goal, 20, 2);
            }
        }
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

    // Squash and stretch easing (super smooth bounce)
    player.renderW += (player.width - player.renderW) * 0.15;
    player.renderH += (player.height - player.renderH) * 0.15;
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
    drawLeafEnemy(ctx, x, y, width, height); // Faceless, clean aesthetic
}

function drawIceEnemy(ctx, x, y, width, height) {
    ctx.shadowBlur = 15;
    ctx.shadowColor = colors.enemy;
    
    ctx.fillStyle = colors.enemy;
    ctx.beginPath();
    ctx.moveTo(x + width/2, y);
    ctx.lineTo(x + width, y + height/2);
    ctx.lineTo(x + width/2, y + height);
    ctx.lineTo(x, y + height/2);
    ctx.closePath();
    ctx.fill();
    
    ctx.shadowBlur = 0;
}

function drawBossIce(ctx, x, y, width, height) {
    ctx.shadowBlur = 25;
    ctx.shadowColor = colors.enemy;
    
    ctx.fillStyle = colors.enemy;
    ctx.beginPath();
    ctx.moveTo(x + width/2, y - 20);
    ctx.lineTo(x + width, y + height/2);
    ctx.lineTo(x + width/2, y + height + 20);
    ctx.lineTo(x, y + height/2);
    ctx.closePath();
    ctx.fill();
    
    ctx.shadowBlur = 0;
}

function drawIcicle(ctx, x, y, width, height) {
    ctx.fillStyle = colors.hazard;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width/2, y + height);
    ctx.closePath();
    ctx.fill();
}

function drawBlazeEnemy(ctx, x, y, width, height) {
    ctx.shadowBlur = 20;
    ctx.shadowColor = colors.enemy;
    ctx.globalCompositeOperation = 'lighter';
    
    ctx.fillStyle = colors.enemy;
    ctx.beginPath();
    // Base of the flame
    ctx.arc(x + width/2, y + height - 10, width/2, Math.PI, 0, true);
    
    // Flickering tips removed (static candle)
    let flicker1 = 0;
    let flicker2 = 0;
    
    ctx.lineTo(x + width, y + height - 10);
    ctx.quadraticCurveTo(x + width*0.8, y + height/2, x + width/2 + flicker1, y);
    ctx.quadraticCurveTo(x + width*0.2, y + height/2, x, y + height - 10);
    
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
}

function drawBossBlaze(ctx, x, y, width, height) {
    ctx.shadowBlur = 30;
    ctx.shadowColor = colors.enemy;
    ctx.globalCompositeOperation = 'lighter';
    
    ctx.fillStyle = colors.enemy;
    ctx.beginPath();
    ctx.arc(x + width/2, y + height - 15, width/2 + 10, Math.PI, 0, true);
    
    // Flickering tips removed (static candle)
    let flicker1 = 0;
    let flicker2 = 0;
    let flicker3 = 0;
    
    ctx.lineTo(x + width + 10, y + height - 15);
    ctx.quadraticCurveTo(x + width*0.9, y + height/3, x + width*0.75 + flicker1, y - 10);
    ctx.quadraticCurveTo(x + width*0.5, y + height/2, x + width/2 + flicker2, y - 20);
    ctx.quadraticCurveTo(x + width*0.5, y + height/2, x + width*0.25 + flicker3, y - 10);
    ctx.quadraticCurveTo(x + width*0.1, y + height/3, x - 10, y + height - 15);
    
    ctx.fill();
    
    // Inner core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + width/2, y + height - 10, width/4, 0, Math.PI*2);
    ctx.fill();
    
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
}



function drawStormBackground() {

    // The sky gradient is already drawn. If lightning is flashing, brighten the sky!
    if (ambientLightningFlash > 0) {
        ctx.fillStyle = `rgba(111, 255, 233, ${ambientLightningFlash * 0.4})`; // Cyan flash
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Vertical parallax so the mountains shift up/down when the player jumps!
    let vParallax = -camera.y;

    // Subtle atmospheric clouds
    drawCloudLayer(ctx, 0.01, 100 + vParallax * 0.01, 'rgba(19, 29, 54, 0.3)', 0, 0.6);
    drawCloudLayer(ctx, 0.02, 250 + vParallax * 0.02, 'rgba(15, 23, 43, 0.5)', 500, 1.0);
    drawCloudLayer(ctx, 0.035, 400 + vParallax * 0.035, 'rgba(10, 17, 33, 0.7)', 1200, 1.4);

    // Far mountains (Massive, towering, smooth)
    drawMountainLayer(ctx, 0.05, canvas.height + vParallax * 0.05, 450, 80, 20, '#131d36', 0);
    // Mid mountains (Sharp, jagged peaks)
    drawMountainLayer(ctx, 0.15, canvas.height + 50 + vParallax * 0.15, 300, 150, 40, '#0a1121', 5000);
}

function drawRollingHillLayer(ctx, parallax, baseHeight, amp1, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    let step = 30;
    let levelOffset = currentLevelIndex * 99999;
    let offsetX = camera.x * parallax + levelOffset;
    
    for (let x = 0; x <= canvas.width + step; x += step) {
        let worldX = x + offsetX;
        let y = baseHeight;
        let sin1 = Math.sin(worldX * 0.001);
        let sin2 = Math.sin(worldX * 0.0031);
        y -= ((sin1 + 1) / 2) * amp1;
        y -= ((sin2 + 1) / 2) * (amp1 * 0.3); // secondary variation
        ctx.lineTo(x, y);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.fill();
}

function drawForestBackground() {
    let vParallax = -camera.y;
    
    // Deep atmospheric mist wash
    ctx.fillStyle = 'rgba(60, 90, 70, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Layer 1: Far misty hills (Massive)
    drawRollingHillLayer(ctx, 0.02, canvas.height - 100 + vParallax * 0.02, 600, '#0c1a10');
    
    // Mist between Layer 1 and 2
    let mistGradient1 = ctx.createLinearGradient(0, canvas.height - 200, 0, canvas.height);
    mistGradient1.addColorStop(0, 'rgba(165, 200, 175, 0)');
    mistGradient1.addColorStop(1, 'rgba(165, 200, 175, 0.2)');
    ctx.fillStyle = mistGradient1;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Layer 2: Mid rolling hills (Towering)
    drawRollingHillLayer(ctx, 0.1, canvas.height - 20 + vParallax * 0.1, 750, '#102214');
    
    // Mist between Layer 2 and 3
    let mistGradient2 = ctx.createLinearGradient(0, canvas.height - 150, 0, canvas.height);
    mistGradient2.addColorStop(0, 'rgba(165, 200, 175, 0)');
    mistGradient2.addColorStop(1, 'rgba(165, 200, 175, 0.3)');
    ctx.fillStyle = mistGradient2;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Layer 3: Near rolling hills (Absolute Units)
    drawRollingHillLayer(ctx, 0.25, canvas.height + 50 + vParallax * 0.25, 900, '#152b1a');
    
    // Heavy foreground mist
    let mistGradient3 = ctx.createLinearGradient(0, canvas.height - 100, 0, canvas.height + 100);
    mistGradient3.addColorStop(0, 'rgba(165, 200, 175, 0)');
    mistGradient3.addColorStop(1, 'rgba(165, 200, 175, 0.4)');
    ctx.fillStyle = mistGradient3;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawAuroraLayer(ctx, vParallax) {
    let t = Date.now() * 0.0005; 
    
    for (let i = 0; i < 3; i++) {
        let yOffset = canvas.height * 0.35 + i * 50 + vParallax * 0.05;
        let speed = 0.5 + i * 0.2;
        let phase = i * Math.PI * 0.7;
        
        ctx.beginPath();
        // Top edge of the ribbon
        for (let x = 0; x <= canvas.width + 50; x += 50) {
            let worldX = x + camera.x * 0.005;
            let y = yOffset - 250; // Stretch high up
            y += Math.sin(worldX * 0.005 + t * speed + phase) * 40;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        
        // Bottom edge of the ribbon (looping back)
        for (let x = canvas.width + 50; x >= 0; x -= 50) {
            let worldX = x + camera.x * 0.005;
            let y = yOffset;
            y += Math.sin(worldX * 0.005 + t * speed + phase) * 60;
            y += Math.sin(worldX * 0.012 - t * speed * 1.2) * 30;
            ctx.lineTo(x, y);
        }
        
        let grad = ctx.createLinearGradient(0, yOffset - 250, 0, yOffset + 60);
        if (i === 0) {
            grad.addColorStop(0, 'rgba(0, 255, 200, 0)');
            grad.addColorStop(0.5, 'rgba(0, 255, 200, 0.15)');
            grad.addColorStop(1, 'rgba(0, 255, 200, 0)');
        } else if (i === 1) {
            grad.addColorStop(0, 'rgba(150, 50, 255, 0)');
            grad.addColorStop(0.5, 'rgba(150, 50, 255, 0.15)');
            grad.addColorStop(1, 'rgba(150, 50, 255, 0)');
        } else {
            grad.addColorStop(0, 'rgba(0, 150, 255, 0)');
            grad.addColorStop(0.5, 'rgba(0, 150, 255, 0.15)');
            grad.addColorStop(1, 'rgba(0, 150, 255, 0)');
        }
        ctx.fillStyle = grad;
        ctx.fill();
    }
}

function drawIceBackground() {
    let vParallax = -camera.y;
    
    // Dynamic, waving Aurora Borealis
    drawAuroraLayer(ctx, vParallax);
    
    // Far ice peaks (Deep ocean blue)
    drawMountainLayer(ctx, 0.02, canvas.height + 50 + vParallax * 0.02, 600, 150, 50, '#05101a', 0);
    
    // Mid glacial mountains (Frost blue)
    drawMountainLayer(ctx, 0.1, canvas.height + 150 + vParallax * 0.1, 750, 200, 80, '#0a1c2e', 5000);
    
    // Near icy cliffs (Bright deep blue)
    drawMountainLayer(ctx, 0.25, canvas.height + 250 + vParallax * 0.25, 900, 300, 100, '#112c47', 10000);
}

function drawFireBackground() {
    let vParallax = -camera.y;

    // Magma cavern gradient (dark ceiling, hot floor)
    let gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0.2, '#0a0202');
    gradient.addColorStop(0.7, 'rgba(255, 60, 0, 0.1)');
    gradient.addColorStop(1, 'rgba(255, 30, 0, 0.2)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Far layer (Darkest red)
    drawSpikeLayer(ctx, 0.05, canvas.height + 50 + vParallax * 0.05, 300, 0.002, '#210808', 0, false);
    drawSpikeLayer(ctx, 0.05, -50 + vParallax * 0.05, 200, 0.002, '#210808', 2000, true);
    
    // Mid layer (Dark crimson)
    drawSpikeLayer(ctx, 0.15, canvas.height + 150 + vParallax * 0.15, 450, 0.0035, '#3a0c0c', 5000, false);
    drawSpikeLayer(ctx, 0.15, -150 + vParallax * 0.15, 300, 0.0035, '#3a0c0c', 7000, true);
    
    // Near layer (Deep red)
    drawSpikeLayer(ctx, 0.3, canvas.height + 250 + vParallax * 0.3, 500, 0.0045, '#5c1414', 10000, false);
    drawSpikeLayer(ctx, 0.3, -250 + vParallax * 0.3, 400, 0.0045, '#5c1414', 12000, true);
}

function drawPlanet(ctx, parallax, x, y, radius, color, shadowColor, seedOffset) {
    let offsetX = camera.x * parallax + seedOffset + (currentLevelIndex * 99999);
    // wrap around math for infinite space
    let worldX = (x - offsetX) % (canvas.width + radius * 4);
    if (worldX < -radius * 2) worldX += (canvas.width + radius * 4);
    
    // Draw base planet
    ctx.beginPath();
    ctx.arc(worldX, y - camera.y * parallax, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Draw eclipse/shadow
    ctx.beginPath();
    ctx.arc(worldX + radius * 0.2, y - camera.y * parallax, radius * 0.95, 0, Math.PI * 2);
    ctx.fillStyle = shadowColor;
    ctx.fill();
}

function drawVoidBackground() {
    let vParallax = -camera.y;

    // Deep space gradient
    let gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#020005');
    gradient.addColorStop(1, '#0c051a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Far Layer: Twinkling Stars
    ctx.fillStyle = '#ffffff';
    let levelOffset = currentLevelIndex * 99999;
    for (let i = 0; i < 150; i++) {
        let x = (Math.sin(i * 91.3) * 10000 - camera.x * 0.01 + levelOffset) % canvas.width;
        if (x < 0) x += canvas.width;
        let y = (Math.cos(i * 13.7) * 5000 - camera.y * 0.01) % canvas.height;
        if (y < 0) y += canvas.height;
        
        let twinkle = Math.sin(gameTime * 0.05 + i);
        if (twinkle > 0) {
            ctx.globalAlpha = twinkle * 0.5;
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1.0;

    // Mid Layer: Eclipsed Planets
    drawPlanet(ctx, 0.05, 500, 300, 150, '#1c0d36', '#020005', 0);
    drawPlanet(ctx, 0.08, 1500, 600, 80, '#2e1554', '#020005', 5000);
    drawPlanet(ctx, 0.1, 2800, 200, 250, '#120726', '#020005', 10000);

    // Near Layer: Cosmic Energy Bands (Clouds)
    drawCloudLayer(ctx, 0.15, 200 + vParallax * 0.15, 'rgba(40, 15, 80, 0.2)', 0, 1.0);
    drawCloudLayer(ctx, 0.25, 500 + vParallax * 0.25, 'rgba(60, 20, 100, 0.3)', 5000, 1.5);
    drawCloudLayer(ctx, 0.4, 800 + vParallax * 0.4, 'rgba(80, 25, 120, 0.4)', 10000, 2.0);
}

function drawGodRays(ctx, parallax) {
    let levelOffset = currentLevelIndex * 99999;
    let offsetX = camera.x * parallax + levelOffset;
    
    ctx.save();
    // Use screen blend mode for bright light rays
    ctx.globalCompositeOperation = 'screen';
    
    for (let i = 0; i < 5; i++) {
        let x = (i * 800 - offsetX * 0.5) % (canvas.width * 2) - canvas.width * 0.5;
        let width = 200 + Math.sin(gameTime * 0.02 + i) * 100;
        
        let gradient = ctx.createLinearGradient(x, -200, x - 400, canvas.height);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(x, -200);
        ctx.lineTo(x + width, -200);
        ctx.lineTo(x - 400 + width, canvas.height);
        ctx.lineTo(x - 400, canvas.height);
        ctx.fill();
    }
    ctx.restore();
}

function drawCelestialBackground() {
    let vParallax = -camera.y;

    // Golden ethereal gradient
    let gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a0f00'); // Deep dark gold space
    gradient.addColorStop(1, '#805500'); // Vibrant gold horizon
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Far Layer: Nebulas / Ethereal clouds
    drawCloudLayer(ctx, 0.05, 100 + vParallax * 0.05, 'rgba(255, 200, 50, 0.2)', 0, 1.0);
    drawCloudLayer(ctx, 0.08, 300 + vParallax * 0.08, 'rgba(255, 220, 100, 0.4)', 5000, 1.5);
    
    // Mid Layer: Floating golden rings and celestial bodies
    drawPlanet(ctx, 0.15, 600, 200 + vParallax * 0.15, 150, '#ffcc00', '#ccaa00', 0); // Huge Golden Sun/Ring
    drawPlanet(ctx, 0.15, 2000, 400 + vParallax * 0.15, 80, '#ffffff', '#fff7cc', 10000); // Glowing white moon
    
    // Near Layer: Thick golden fog
    drawCloudLayer(ctx, 0.25, 500 + vParallax * 0.25, 'rgba(255, 230, 150, 0.6)', 10000, 2.0);
    
    // God rays with higher opacity for ethereal feel
    ctx.save();
    ctx.globalAlpha = 0.6;
    drawGodRays(ctx, 0.3);
    ctx.restore();
}

function drawVoidEnemy(ctx, x, y, enemy) {
    let width = enemy.renderW;
    let height = enemy.renderH;
    let cx = x + width/2;
    let cy = y + height/2;
    
    let isCelestial = currentLevelIndex >= 25;
    let baseColor = isCelestial ? '#FFD700' : colors.enemy;
    
    let blur = 20;
    let currentColor = baseColor;
    
    if (enemy.burstState === 'charge') {
        blur = 20 + (enemy.burstTimer / 60) * 40; // Ramps up to 60
        
        // Ticking bomb flash
        let progress = enemy.burstTimer / 60;
        let freq = 1 + progress * 5; 
        if (Math.sin(enemy.burstTimer * freq) > 0) {
            currentColor = '#ffffff';
        }
    } else if (enemy.burstState === 'active') {
        blur = 60 + Math.random() * 20;
        currentColor = '#ffffff';
    }
    
    ctx.fillStyle = currentColor;
    ctx.shadowBlur = blur;
    ctx.shadowColor = (currentColor === '#ffffff') ? '#ffffff' : baseColor;
    
    ctx.beginPath();
    ctx.arc(cx, cy, width/3, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawBossVoid(ctx, x, y, enemy) {
    let width = enemy.renderW;
    let height = enemy.renderH;
    let cx = x + width/2;
    let cy = y + height/2;
    
    let isCelestial = currentLevelIndex >= 25;
    let baseColor = isCelestial ? '#FFD700' : colors.enemy;
    
    let blur = 40;
    let currentColor = baseColor;
    
    if (enemy.burstState === 'charge') {
        blur = 40 + (enemy.burstTimer / 60) * 60; // Ramps up to 100
        
        // Ticking bomb flash
        let progress = enemy.burstTimer / 60;
        let freq = 1 + progress * 5; 
        if (Math.sin(enemy.burstTimer * freq) > 0) {
            currentColor = '#ffffff';
        }
    } else if (enemy.burstState === 'active') {
        blur = 100 + Math.random() * 30;
        currentColor = '#ffffff';
    }
    
    ctx.fillStyle = currentColor;
    ctx.shadowBlur = blur;
    ctx.shadowColor = (currentColor === '#ffffff') ? '#ffffff' : baseColor;
    
    // Circle mass
    ctx.beginPath();
    ctx.arc(cx, cy, width * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawMountainLayer(ctx, parallax, baseHeight, amp1, amp2, amp3, color, seedOffset) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    
    let step = 30; // Fast rendering step
    let levelOffset = currentLevelIndex * 99999;
    let offsetX = camera.x * parallax + seedOffset + levelOffset;
    
    for (let x = 0; x <= canvas.width + step; x += step) {
        let worldX = x + offsetX;
        
        let y = baseHeight;
        // Layer 1: Large jagged peaks
        y -= Math.abs(Math.sin(worldX * 0.001)) * amp1;
        // Layer 2: Medium jaggedness
        y -= Math.abs(Math.sin(worldX * 0.0031 + 10)) * amp2;
        // Layer 3: Small rocky noise
        y -= Math.sin(worldX * 0.0073 + 20) * amp3;
        
        ctx.lineTo(x, y);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.fill();
}

function drawSpikeLayer(ctx, parallax, baseHeight, amp, freq, color, seedOffset, inverted = false) {
    ctx.fillStyle = color;
    ctx.beginPath();
    
    if (inverted) {
        ctx.moveTo(0, 0);
    } else {
        ctx.moveTo(0, canvas.height);
    }
    
    let step = 15; 
    let levelOffset = currentLevelIndex * 99999;
    let offsetX = camera.x * parallax + seedOffset + levelOffset;
    
    for (let x = 0; x <= canvas.width + step; x += step) {
        let worldX = x + offsetX;
        let y = baseHeight;
        
        let phase1 = ((worldX * freq) % 2 + 2) % 2;
        let tri1 = Math.abs(phase1 - 1);
        let spikeOffset = amp - (tri1 * amp);
        
        let phase2 = ((worldX * freq * 2.3 + 10) % 2 + 2) % 2;
        let tri2 = Math.abs(phase2 - 1);
        let amp2 = amp * 0.4;
        spikeOffset += amp2 - (tri2 * amp2);
        
        spikeOffset += Math.sin(worldX * freq * 8.3 + 20) * (amp * 0.1);
        
        if (inverted) {
            y += spikeOffset;
        } else {
            y -= spikeOffset;
        }
        
        ctx.lineTo(x, y);
    }
    
    if (inverted) {
        ctx.lineTo(canvas.width, 0);
    } else {
        ctx.lineTo(canvas.width, canvas.height);
    }
    ctx.closePath();
    ctx.fill();
}

function drawCloudLayer(ctx, parallax, baseHeight, color, seedOffset, scale) {
    ctx.fillStyle = color;
    let period = 2000;
    
    // Offset by currentLevelIndex so each level has a totally unique sky
    let levelOffset = currentLevelIndex * 99999;
    let offsetX = camera.x * parallax + seedOffset + levelOffset;
    let startX = Math.floor(offsetX / period) * period;
    
    function drawFluffyCloud(cx, cy, s) {
        ctx.beginPath();
        // 5 overlapping circles to make a classic fluffy cloud shape
        ctx.arc(cx, cy, 30 * s, 0, Math.PI * 2); // Center top
        ctx.arc(cx - 25 * s, cy + 10 * s, 20 * s, 0, Math.PI * 2); // Mid left
        ctx.arc(cx + 25 * s, cy + 5 * s, 25 * s, 0, Math.PI * 2); // Mid right
        ctx.arc(cx + 45 * s, cy + 15 * s, 15 * s, 0, Math.PI * 2); // Far right
        ctx.arc(cx - 40 * s, cy + 15 * s, 15 * s, 0, Math.PI * 2); // Far left
        // Fill the bottom gaps so it rests nicely
        ctx.rect(cx - 40 * s, cy + 10 * s, 85 * s, 20 * s);
        ctx.fill();
    }
    
    for (let i = -1; i <= Math.ceil(canvas.width / period) + 1; i++) {
        let chunkX = startX + i * period - offsetX;
        
        // Cloud cluster 1
        drawFluffyCloud(chunkX + 300, baseHeight, scale);
        drawFluffyCloud(chunkX + 450, baseHeight + 20 * scale, scale * 0.8);

        // Cloud cluster 2
        drawFluffyCloud(chunkX + 1200, baseHeight + 150 * scale, scale * 1.5);
        drawFluffyCloud(chunkX + 1000, baseHeight + 180 * scale, scale * 1.2);
        
        // Cloud cluster 3
        drawFluffyCloud(chunkX + 1800, baseHeight - 80 * scale, scale * 0.7);
    }
}

function drawParallaxBackground() {
    if (currentLevelIndex < 5) {
        drawStormBackground();
    } else if (currentLevelIndex < 10) {
        drawForestBackground();
    } else if (currentLevelIndex < 15) {
        drawIceBackground();
    } else if (currentLevelIndex < 20) {
        drawFireBackground();
    } else if (currentLevelIndex < 25) {
        drawVoidBackground();
    } else {
        drawCelestialBackground();
    }
}



function draw() {
    // Magical Gradient Background
    let bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, colors.bg);
    bgGradient.addColorStop(1, '#050a12'); // Dark abyssal bottom for depth
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawParallaxBackground();

    if (!level) return;

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    drawParticles();

    // Draw Platforms (Two-pass for perfectly merged clean borders)
    
    // Pass 1: Draw outer borders
    ctx.fillStyle = colors.platformBorder;
    for (const plat of level.platforms) {
        ctx.fillRect(plat.x - 2, plat.y - 2, plat.w + 4, plat.h + 4);
    }
    
    // Pass 2: Draw solid fills (this covers up any internal overlapping borders)
    ctx.fillStyle = colors.platform;
    for (const plat of level.platforms) {
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
    }

    // Draw Enemies
    for (const enemy of activeEnemies) {
        let cx = enemy.x + enemy.width / 2;
        let cy = enemy.y + enemy.height;
        let drawX = cx - enemy.renderW / 2;
        let drawY = cy - enemy.renderH;
        
        if (currentLevelIndex >= 20) {
            if (enemy.isBoss) {
                drawBossVoid(ctx, drawX, drawY, enemy);
            } else {
                drawVoidEnemy(ctx, drawX, drawY, enemy);
            }
        } else if (currentLevelIndex >= 15) {
            if (enemy.isBoss) {
                drawBossBlaze(ctx, drawX, drawY, enemy.renderW, enemy.renderH);
            } else {
                if (enemy.phaseState === 'invisible') continue; // Don't draw if invisible
                
                if (enemy.phaseState === 'flickering') {
                    // Strobe opacity rapidly
                    ctx.globalAlpha = (gameTime % 4 < 2) ? 0.3 : 1.0;
                }
                
                drawBlazeEnemy(ctx, drawX, drawY, enemy.renderW, enemy.renderH);
                ctx.globalAlpha = 1.0; // Reset alpha
            }
        } else if (currentLevelIndex >= 10) {
            if (enemy.isBoss) {
                drawBossIce(ctx, drawX, drawY, enemy.renderW, enemy.renderH);
            } else {
                drawIceEnemy(ctx, drawX, drawY, enemy.renderW, enemy.renderH);
            }
        } else if (currentLevelIndex >= 5) {
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
    
    // Draw Falling Leaves
    for (let leaf of fallingLeaves) {
        drawLeafEnemy(ctx, leaf.x, leaf.y, leaf.width, leaf.height);
    }
    
    // Draw Falling Icicles
    for (let icicle of fallingIcicles) {
        drawIcicle(ctx, icicle.x, icicle.y, icicle.w, icicle.h);
    }
    
    // Draw Fireballs
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 15;
    ctx.shadowColor = colors.hazard;
    for (let fb of fireballs) {
        ctx.fillStyle = colors.hazard;
        ctx.beginPath();
        ctx.arc(fb.x, fb.y, fb.r, 0, Math.PI * 2);
        ctx.fill();
        // Inner core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(fb.x, fb.y, fb.r / 2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
    
    // Draw Snowflakes
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ffffff';
    for (let snow of snowflakes) {
        // Keep snowflakes faint but visible (max 0.4 opacity)
        ctx.globalAlpha = Math.max(0.1, Math.min(0.4, snow.size / 15.0));
        ctx.beginPath();
        ctx.arc(snow.x, snow.y, snow.size / 2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
    
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

    // Draw Checkpoints
    if (level.checkpoints) {
        for (let cp of level.checkpoints) {
            ctx.fillStyle = cp.active ? colors.goal : '#555';
            ctx.shadowColor = cp.active ? colors.goal : 'transparent';
            ctx.shadowBlur = cp.active ? 20 : 0;
            
            // Draw flag pole
            ctx.fillRect(cp.x, cp.y, 4, cp.h);
            
            // Draw flag waving
            ctx.beginPath();
            ctx.moveTo(cp.x + 4, cp.y + 5);
            ctx.lineTo(cp.x + 4 + cp.w, cp.y + 15 + Math.sin(gameTime*0.1)*5);
            ctx.lineTo(cp.x + 4, cp.y + 25);
            ctx.fill();
            
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
    
    // Ambient Lightning logic for Midnight Storm
    if (ambientLightningFlash > 0) ambientLightningFlash -= 0.03;
    if (currentLevelIndex < 5 && Math.random() < 0.003) {
        ambientLightningFlash = 1.0;
    }
    
    spawnAmbientParticle();
    updateParticles();
    updatePhysics();
    updateCamera();
    draw();
    requestAnimationFrame(gameLoop);
}

// Init
window.onload = () => {
    // Only draw the background initially
    level = levels[0];
    requestAnimationFrame(gameLoop);
};


let audioCtx = null;
function playEpicMusic() {
    if (audioCtx) return; // already playing
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return; // Not supported
    
    audioCtx = new AudioContext();
    
    // Create Reverb (Impulse Response)
    let length = audioCtx.sampleRate * 4.0; // 4 second massive reverb
    let impulse = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
    let left = impulse.getChannelData(0);
    let right = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
        let decay = Math.exp(-i / (audioCtx.sampleRate * 0.8)); // Long decay
        left[i] = (Math.random() * 2 - 1) * decay;
        right[i] = (Math.random() * 2 - 1) * decay;
    }
    let convolver = audioCtx.createConvolver();
    convolver.buffer = impulse;
    
    let mainVolume = audioCtx.createGain();
    mainVolume.gain.value = 0.4;
    mainVolume.connect(convolver);
    convolver.connect(audioCtx.destination);
    
    // Heroic Chord progression: C Major, G Major, A Minor, F Major
    const progression = [
        [261.63, 329.63, 392.00, 523.25], // C Maj
        [196.00, 246.94, 293.66, 392.00], // G Maj
        [220.00, 261.63, 329.63, 440.00], // A Min
        [174.61, 220.00, 261.63, 349.23]  // F Maj
    ];
    
    // Bass notes (octave lower)
    const bassProg = [65.41, 49.00, 55.00, 43.65];
    
    let now = audioCtx.currentTime;
    let beatLength = 4.0; // 4 seconds per chord swell
    
    // Schedule 16 chords (loops for 64 seconds)
    for (let i = 0; i < 20; i++) {
        let chord = progression[i % 4];
        let bass = bassProg[i % 4];
        let startTime = now + i * beatLength;
        
        // Play Thundering Bass
        let bassOsc = audioCtx.createOscillator();
        bassOsc.type = 'sine';
        bassOsc.frequency.value = bass;
        let bassGain = audioCtx.createGain();
        bassGain.gain.setValueAtTime(0, startTime);
        bassGain.gain.linearRampToValueAtTime(1.0, startTime + 2.0);
        bassGain.gain.linearRampToValueAtTime(0, startTime + beatLength);
        bassOsc.connect(bassGain);
        bassGain.connect(mainVolume);
        bassOsc.start(startTime);
        bassOsc.stop(startTime + beatLength);
        
        // Play Orchestral Swell Chords
        for (let freq of chord) {
            let osc = audioCtx.createOscillator();
            osc.type = 'sawtooth'; // Brass/Strings feel
            
            // Filter swell for orchestral dynamics
            let filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(200, startTime); // Start muffled
            filter.frequency.exponentialRampToValueAtTime(2000, startTime + 2.5); // Swell bright
            filter.frequency.exponentialRampToValueAtTime(200, startTime + beatLength); // Fade muffled
            
            osc.frequency.value = freq;
            
            let gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.12, startTime + 2.5); // Peak volume slightly past middle
            gain.gain.linearRampToValueAtTime(0, startTime + beatLength);
            
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(mainVolume);
            
            osc.start(startTime);
            osc.stop(startTime + beatLength);
        }
    }
}
