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
    if (currentLevelIndex < 10 || currentLevelIndex >= 15) {
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
        } else {
            p.x += p.vx;
        }
        p.y += p.vy;
        p.life -= p.isAmbient ? 0.005 : 0.02;
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
        title: "Jump. That's literally it.",
        quote: "Hold the right arrow key. I believe in you.",
        platforms: [
            {x: 0, y: 500, w: 1000, h: 20},
            {x: 300, y: 350, w: 200, h: 20},
            {x: 800, y: 200, w: 200, h: 20}
        ],
        hazards: [],
        enemies: [
            { x: 500, y: 400, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 800 }
        ],
        goal: {x: 850, y: 150, w: 50, h: 50}, 
        spawn: {x: 100, y: 400}
    },
    { // Level 2: Gravity is a harsh mistress
        title: "Gravity is a harsh mistress.",
        quote: "Press the up arrow to jump. Groundbreaking, I know.",
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
        goal: {x: 50, y: 50, w: 50, h: 50}, 
        spawn: {x: 100, y: 400}
    },
    { // Level 3: Don't look down
        title: "Don't look down. Or do, I'm not your dad.",
        quote: "Sometimes you have to jump twice. It's called a double jump.",
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
        goal: {x: 50, y: 350, w: 50, h: 50}, 
        spawn: {x: 1700, y: 300}
    },
    { // Level 4: Parkour
        title: "The Wall Jump Cavern.",
        quote: "Hug the walls. They won't hurt you... much.",
        platforms: [
            {x: 0, y: 500, w: 350, h: 20}, // Start platform
            // Thin walls to wall jump between
            {x: 350, y: -300, w: 20, h: 900},
            {x: 650, y: -300, w: 20, h: 900},
            // Bottom pit floor
            {x: 370, y: 600, w: 280, h: 20},
            // High landing platform
            {x: 670, y: -300, w: 200, h: 20}
        ],
        hazards: [],
        enemies: [
            { x: 500, y: 550, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1500 }
        ],
        goal: {x: 800, y: -350, w: 50, h: 50},
        spawn: {x: 100, y: 400}
    },
    { // Level 5: Boss Fight
        title: "It's a boss. Try not to die immediately.",
        quote: "Just don't stand in the giant glowing lightning indicators. Simple.",
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
        quote: "They learned how to turn around! The horror!",
        platforms: [
            {x: 0, y: 500, w: 300, h: 20},
            {x: 400, y: 500, w: 400, h: 20}, // Enemy patrols here and doesn't fall off!
            {x: 900, y: 500, w: 300, h: 20}
        ],
        hazards: [],
        enemies: [
            { x: 550, y: 400, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1000 }
        ],
        goal: {x: 50, y: 450, w: 50, h: 50},
        spawn: {x: 1100, y: 400}
    },
    { // Level 7: Multiple smart enemies
        title: "Precision platforming required.",
        quote: "I hope you brought your precision boots.",
        platforms: [
            {x: 0, y: 600, w: 100, h: 20}, // End
            {x: 400, y: 500, w: 140, h: 20}, // Widened platform
            {x: 900, y: 400, w: 140, h: 20}, // Widened platform
            {x: 1400, y: 500, w: 140, h: 20}, // Widened platform
            {x: 1800, y: 600, w: 200, h: 20} // Start
        ],
        hazards: [],
        enemies: [
            { x: 1420, y: 450, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1500 }
        ],
        goal: {x: 25, y: 550, w: 50, h: 50},
        spawn: {x: 1900, y: 500}
    },
    { // Level 8: Vertical Tree Climbing
        title: "Tree climbing 101. Wall jumps and double jumps.",
        quote: "You're basically a squirrel now. Act like one.",
        platforms: [
            {x: 0, y: 600, w: 200, h: 20}, // Start
            {x: 400, y: 100, w: 20, h: 600}, // Main Trunk (standard 20px width)
            {x: 200, y: 400, w: 120, h: 20}, // Branch left
            {x: 500, y: 250, w: 120, h: 20}, // Branch right
            {x: 200, y: 100, w: 120, h: 20}, // Branch left high
            {x: 460, y: -100, w: 200, h: 20} // Top canopy
        ],
        hazards: [],
        enemies: [
            { x: 520, y: 200, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1500 }
        ],
        goal: {x: 550, y: -150, w: 50, h: 50},
        spawn: {x: 50, y: 500}
    },
    { // Level 9: The Bridge
        title: "No running. Nowhere to hide.",
        quote: "Paaatttiiiieeeennnnccceeeee... or just run screaming, your call.",
        platforms: [
            {x: 0, y: 500, w: 150, h: 20}, // Start
            {x: 200, y: 500, w: 850, h: 20}, // Long flat bridge
            {x: 1150, y: 500, w: 150, h: 20} // End
        ],
        hazards: [],
        enemies: [
            { x: 700, y: 450, width: 40, height: 24, vx: 0, vy: 0, speed: 14, aggro: 1000 }
        ],
        goal: {x: 1200, y: 450, w: 50, h: 50},
        spawn: {x: 50, y: 400}
    },
    { // Level 10: Forest Boss
        title: "The big angry salad.",
        quote: "It's literally raining leaves of death. Look up.",
        platforms: [
            {x: 0, y: 600, w: 400, h: 200}, // Start floor
            {x: 500, y: 500, w: 100, h: 20}, // Steps up
            {x: 700, y: 400, w: 100, h: 20},
            {x: 500, y: 300, w: 100, h: 20},
            {x: 300, y: 200, w: 100, h: 20},
            {x: 500, y: 100, w: 100, h: 20},
            {x: 700, y: 0, w: 100, h: 20},
            {x: 900, y: -100, w: 100, h: 20},
            {x: 1100, y: -200, w: 400, h: 20}, // Boss arena canopy
            // Massive wall on the right to prevent falling out
            {x: 1500, y: -200, w: 20, h: 1000}
        ],
        hazards: [],
        enemies: [
            { x: 1200, y: -300, width: 100, height: 100, vx: 0, vy: 0, speed: 14, aggro: 3000, isBoss: true, jumpTimer: 0 }
        ],
        goal: {x: 1400, y: -250, w: 50, h: 50},
        spawn: {x: 100, y: 500}
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
        quote: "It's cold. It's fast. It wants you dead.",
        platforms: [
            {x: -200, y: 600, w: 2000, h: 200}, 
            {x: 400, y: 450, w: 200, h: 20},
            {x: 1000, y: 450, w: 200, h: 20},
            {x: 700, y: 300, w: 200, h: 20}
        ],
        hazards: [],
        enemies: [
            { x: 1400, y: 400, width: 100, height: 100, vx: 0, vy: 0, speed: 14, aggro: 3000, isBoss: true, jumpTimer: 0 }
        ],
        goal: {x: 1600, y: 550, w: 50, h: 50},
        spawn: {x: 100, y: 500}
    },
    { // Level 16: Into the Volcano
        title: "Into the Volcano.",
        quote: "It's getting hot in here.",
        platforms: [
            {x: 0, y: 500, w: 400, h: 200},
            {x: 600, y: 400, w: 200, h: 200},
            {x: 1000, y: 300, w: 400, h: 200}
        ],
        hazards: [
            {x: 400, y: 650, w: 200, h: 50}, // Lava pit
            {x: 800, y: 550, w: 200, h: 50}
        ],
        enemies: [
            { x: 1100, y: 250, width: 35, height: 35, vx: 0, vy: 0, speed: 22, aggro: 2000 }
        ],
        goal: {x: 1300, y: 250, w: 50, h: 50},
        spawn: {x: 50, y: 400}
    },
    { // Level 17: The Scorched Path
        title: "The Scorched Path.",
        quote: "Don't stop moving.",
        platforms: [
            {x: 0, y: 500, w: 200, h: 200},
            {x: 400, y: 500, w: 100, h: 20},
            {x: 700, y: 400, w: 100, h: 20},
            {x: 1000, y: 300, w: 100, h: 20},
            {x: 1300, y: 200, w: 300, h: 20}
        ],
        hazards: [
            {x: 0, y: 700, w: 1600, h: 100} // Massive lava floor
        ],
        enemies: [
            { x: 1400, y: 100, width: 35, height: 35, vx: 0, vy: 0, speed: 22, aggro: 2000 },
            { x: 700, y: 200, width: 35, height: 35, vx: 0, vy: 0, speed: 22, aggro: 2000 } // Floating guardian
        ],
        goal: {x: 1500, y: 150, w: 50, h: 50},
        spawn: {x: 50, y: 400}
    },
    { // Level 18: Lava Lakes
        title: "Lava Lakes.",
        quote: "Watch your step.",
        platforms: [
            {x: 0, y: 300, w: 150, h: 400},
            {x: 350, y: 450, w: 150, h: 20},
            {x: 700, y: 550, w: 150, h: 20},
            {x: 1050, y: 450, w: 150, h: 20},
            {x: 1400, y: 300, w: 200, h: 400}
        ],
        hazards: [
            {x: 150, y: 650, w: 1250, h: 100} // Lake
        ],
        enemies: [
            { x: 350, y: 300, width: 35, height: 35, vx: 0, vy: 0, speed: 23, aggro: 2000 },
            { x: 700, y: 300, width: 35, height: 35, vx: 0, vy: 0, speed: 23, aggro: 2000 },
            { x: 1050, y: 300, width: 35, height: 35, vx: 0, vy: 0, speed: 23, aggro: 2000 }
        ],
        goal: {x: 1500, y: 250, w: 50, h: 50},
        spawn: {x: 50, y: 200}
    },
    { // Level 19: Guardian's Roost
        title: "Guardian's Roost.",
        quote: "They are protecting something.",
        platforms: [
            {x: 0, y: 700, w: 400, h: 20},
            {x: 200, y: 500, w: 100, h: 20},
            {x: -100, y: 350, w: 150, h: 20},
            {x: 300, y: 200, w: 100, h: 20},
            {x: 600, y: 150, w: 200, h: 20},
            {x: 1000, y: 250, w: 300, h: 20}
        ],
        hazards: [],
        enemies: [
            { x: 200, y: 350, width: 35, height: 35, vx: 0, vy: 0, speed: 24, aggro: 3000 },
            { x: 500, y: 100, width: 35, height: 35, vx: 0, vy: 0, speed: 24, aggro: 3000 },
            { x: 1100, y: 100, width: 35, height: 35, vx: 0, vy: 0, speed: 24, aggro: 3000 }
        ],
        goal: {x: 1200, y: 200, w: 50, h: 50},
        spawn: {x: 50, y: 600}
    },
    { // Level 20: Fire Boss
        title: "The Inferno Core.",
        quote: "The heart of the fire.",
        platforms: [
            {x: 0, y: 600, w: 400, h: 200},
            {x: 600, y: 600, w: 400, h: 20},
            {x: 1200, y: 600, w: 400, h: 200},
            {x: 200, y: 400, w: 200, h: 20},
            {x: 1200, y: 400, w: 200, h: 20}
        ],
        hazards: [
            {x: 400, y: 750, w: 200, h: 50}, // Lava between platforms
            {x: 1000, y: 750, w: 200, h: 50}
        ],
        enemies: [
            { x: 800, y: 300, width: 120, height: 120, vx: 0, vy: 0, speed: 26, aggro: 4000, isBoss: true }
        ],
        goal: {x: 1450, y: 550, w: 50, h: 50},
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
    } else {
        colors = { ...themeFire };
        levelTitle.style.color = '#ffaa00';
        levelTitle.style.textShadow = '0 0 25px rgba(255, 170, 0, 0.8), 0 0 10px #ff5500';
        levelTitle.style.fontFamily = "'Cinzel', serif";
    }
    
    // Set UI Title
    levelTitle.innerHTML = `Level ${index + 1}<br><span style="font-size: 0.5em; font-style: italic; color: #ccc;">${level.title}</span><br><span style="font-size: 0.4em; font-weight: normal; color: #aaa;">"${level.quote}"</span>`;

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
    }, 3500); // Increased from 2000ms to give time to read the quote
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
        if (currentLevelIndex < 5 && !enemy.isBoss) {
            if (enemy.tpCooldown === undefined) {
                enemy.tpCooldown = Math.floor(60 + Math.random() * 240); // 1 to 5 seconds
            }
            if (enemy.tpCooldown > 0) {
                enemy.tpCooldown--;
                
                // Teleport Charge-Up Phase (last 0.75 seconds)
                if (Math.floor(enemy.tpCooldown) === 44) {
                    // Lock in the destination
                    if (level && level.platforms && level.platforms.length > 0) {
                        let plat = level.platforms[Math.floor(Math.random() * level.platforms.length)];
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
        
        if (currentLevelIndex >= 15) {
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
                // Guardian AI Priorities (1. Stop the player, 2. Kill the player)
                enemy.speed = MAX_SPEED; // Exact same physics/speed as player
                
                if (enemy.startX === undefined) {
                    enemy.startX = enemy.x;
                }
                
                let distToPlayerX = Math.abs(player.x - enemy.x);
                let distToPlayerY = Math.abs(player.y - enemy.y);
                
                if (distToPlayerX < 250 && distToPlayerY < 300) {
                    // Priority 2: KILL - Player got too close, abandon post and charge!
                    moveLeft = (player.x < enemy.x - 10);
                    moveRight = (player.x > enemy.x + 10);
                } else if (distToPlayerX < 800) {
                    // Priority 1: STOP - Keep a blocking position between the player and the goal (the right side)
                    let blockTargetX = player.x + 200;
                    moveLeft = (blockTargetX < enemy.x - 10);
                    moveRight = (blockTargetX > enemy.x + 10);
                } else {
                    // Idle: Guard post
                    moveLeft = (enemy.startX < enemy.x - 10);
                    moveRight = (enemy.startX > enemy.x + 10);
                }
            }
        } else if (currentLevelIndex >= 10) {
            // Ice Enemies Dash Mechanic
            if (!enemy.isBoss && currentLevelIndex < 15) {
                if (enemy.dashCooldown === undefined) {
                    enemy.dashCooldown = 60 + Math.random() * 240; // 1-5 seconds
                }
                
                if (enemy.dashCooldown > 0) {
                    enemy.dashCooldown--;
                } else {
                    enemy.dashCooldown = 60 + Math.random() * 240;
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
                enemy.vx *= 0.8; // Skidd to a halt
                enemy.x += (Math.random() - 0.5) * 4; // Violent vibration
            } else {
                moveLeft = (player.x < enemy.x - 10);
                moveRight = (player.x > enemy.x + 10);
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
                if (enemy.jumpCount >= 3) {
                    enemy.jumpCount = 0;
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
            if (currentLevelIndex >= 15) {
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
            } else {
                enemy.jumpTimer++;
                if (enemy.isGrounded && enemy.jumpTimer > 100) { 
                    enemy.vy = JUMP_FORCE * 1.2;
                    enemy.jumpTimer = 0;
                }
            }
        }

        if (currentLevelIndex < 15 || !enemy.isBoss) {
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
        if (enemy.phaseState !== 'invisible' && checkRectOverlap(player, enemy)) {
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
    
    if (keys['ArrowLeft'] || keys['KeyA']) player.vx -= ACCEL * currentSpeedMult;
    if (keys['ArrowRight'] || keys['KeyD']) player.vx += ACCEL * currentSpeedMult;
    
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

    // Update Enemies
    updateEnemies();
    
    // Boss Mechanics
    if (level && level.enemies.some(e => e.isBoss) && state === 'playing') {
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
        } else if (currentLevelIndex >= 19) {
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
    if (state === 'playing') {
        if (currentLevelIndex === 13 || currentLevelIndex === 14) {
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
        
        // Atmospheric Heavy Snow
        if (currentLevelIndex >= 10 && currentLevelIndex < 15) {
            // Intense blizzard - cap max flakes to prevent lag
            if (snowflakes.length < 500) {
                for (let s = 0; s < 4; s++) {
                    snowflakes.push({
                        x: player.x + (Math.random() * 2400 - 1200), // Huge spread
                        y: camera.y - 100 - Math.random() * 100,
                        vx: (Math.random() - 0.2) * 6, // Strong magical wind
                        vy: 4 + Math.random() * 6, // Fast falling
                        size: 3 + Math.random() * 5,
                        seed: Math.random() * 100
                    });
                }
            }
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
    
    // Flickering tips
    let flicker1 = Math.sin(gameTime * 0.2) * 5;
    let flicker2 = Math.cos(gameTime * 0.3) * 5;
    
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
    
    let flicker1 = Math.sin(gameTime * 0.15) * 10;
    let flicker2 = Math.cos(gameTime * 0.25) * 10;
    let flicker3 = Math.sin(gameTime * 0.1) * 8;
    
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

function draw() {
    // Magical Gradient Background
    let bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, colors.bg);
    bgGradient.addColorStop(1, '#050a12'); // Dark abyssal bottom for depth
    ctx.fillStyle = bgGradient;
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
        
        if (currentLevelIndex >= 15) {
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
