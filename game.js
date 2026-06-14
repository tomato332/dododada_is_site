import { Sounds } from './sounds.js';
import { TIER_CONFIG } from './tiers.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const cursorDot = document.querySelector('.cursor-dot');
const cursorOutline = document.querySelector('.cursor-outline');
const comboDisplay = document.getElementById('combo-display');
const analysisPanel = document.getElementById('analysis-panel');
const statTier = document.getElementById('stat-tier');
const statProb = document.getElementById('stat-prob');
const statBar = document.getElementById('stat-bar');
const statPredict = document.getElementById('stat-predict');
const statPity = document.getElementById('stat-pity');
const bossModeBtn = document.getElementById('boss-mode-btn');
const bossHpContainer = document.getElementById('boss-hp-container');
const bossHpFill = document.getElementById('boss-hp-fill');

canvas.width = 1200;
canvas.height = 800;

let score = 0;
let isDragging = false;
let startX, startY, currentX, currentY;
let arrows = [];
let target = { x: 900, y: 400, radius: 30, speed: 1.5, direction: 1 };
let boss = { 
    active: false, 
    hp: 500000000, 
    maxHp: 500000000, 
    x: 900, 
    y: 400, 
    radius: 80, 
    phase: 1, 
    lastTeleport: 0, 
    teleportCount: 0, 
    isGroggy: false, 
    groggyEndTime: 0, 
    isCharging: false, 
    chargeStartTime: 0, 
    lastChargeAttackTime: 0, 
    targetX: 0, 
    targetY: 0, 
    starLevel: 0, 
    lastStarUpdateTime: 0,
    // New Patterns
    gravityEnabled: false,
    gravityStrength: 0.15,
    rifts: [], // Dimensional Rifts
    guardians: [], // Orbiting Guardians
    isBursting: false, // Singularity Burst
    timeScale: 1.0,
    lastPatternTime: 0
};
let playerHP = 100, maxPlayerHP = 100;
let floorPatterns = [];
let particles = [];
let combo = 0;
let lastHitTime = 0;
let chargeStartTime = 0;
let shakeAmount = 0;
let ripples = [];
let floatingTexts = [];
let shockwaves = [];
let vortexParticles = [];
let orbitParticles = [];
let bossProjectiles = [];
let currentWeapon = 'bow';
let hammers = [];
let swings = [];
let isHammerThrown = false;
let starLevel = 0;
let targetStarLevel = 0;
let isStarRolled = false;
let lastStarUpdateTime = 0;
let impactFlash = 0;
let lastEvolutionCheck = 0;
let bolts = [];
let isOverloading = false;
let overloadEndTime = 0;

// Multiplayer Variables
let peer = null;
let conn = null;
let myId = '';
let remotePlayer = {
    x: -100, y: -100,
    hp: 100, maxHp: 100,
    active: false,
    weapon: 'bow',
    isCharging: false,
    chargeProgress: 0
};
let isPvP = false;
let isCoop = false;
let isHost = false;
let isDead = false;
let invulnerableUntil = 0;
let countdownRemaining = 0;
let lastTime = performance.now();
let dt = 1.0;

const GRAVITY = 0.08;
const MAX_PULL = 150;
const COLOR = '#ffffff';
const ACCENT = '#ff3e00';

class Bolt {
    constructor(x, y, targetX, targetY, color) {
        this.points = [{ x, y }];
        this.targetX = targetX; this.targetY = targetY;
        this.color = color;
        this.life = 1.0;
        let cx = x, cy = y;
        const steps = 5;
        for (let i = 0; i < steps; i++) {
            cx += (targetX - x) / steps + (Math.random() - 0.5) * 20;
            cy += (targetY - y) / steps + (Math.random() - 0.5) * 20;
            this.points.push({ x: cx, y: cy });
        }
        this.points.push({ x: targetX, y: targetY });
    }
    update() { this.life -= 0.1 * dt; return this.life > 0; }
    draw() {
        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = this.life;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let p of this.points) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, vx, vy, color = COLOR) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.size = Math.random() * 2 + 1;
        this.life = 1.0;
        this.color = color;
    }
    update() {
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.life -= 0.02 * dt;
        return this.life > 0;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life * 0.4;
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

class VoidPattern {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.radius = 60;
        this.timer = 0;
        this.duration = 120; // 2 seconds at 60fps
        this.isExploded = false;
        this.alpha = 0;
    }
    update() {
        this.timer += dt;
        this.alpha = Math.min(0.6, this.timer / this.duration);
        if (this.timer >= this.duration && !this.isExploded) {
            this.isExploded = true;
            return true; // Explode this frame
        }
        return this.timer < this.duration + 20; // Stay a bit after explosion
    }
    draw() {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = '#ff003c';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.fillStyle = this.isExploded ? '#ff003c' : `rgba(255, 0, 60, ${this.alpha * 0.3})`;
        ctx.arc(this.x, this.y, this.radius * (this.isExploded ? 1.2 : this.timer / this.duration), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Ripple {
    constructor(x, y, radius) {
        this.x = x; this.y = y;
        this.r = 0;
        this.maxR = radius * 5;
        this.life = 1.0;
    }
    update() {
        this.r += 2 * dt;
        this.life -= 0.02 * dt;
        return this.life > 0;
    }
    draw() {
        ctx.save();
        ctx.strokeStyle = `rgba(255,255,255,${this.life * 0.1})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }
}

class FloatingText {
    constructor(x, y, text, color, isCrit = false) {
        this.x = x + (Math.random() - 0.5) * 40;
        this.y = y - 20;
        this.text = text;
        this.color = color;
        this.isCrit = isCrit;
        this.life = 1.0;
        this.vy = isCrit ? -8 : -4;
        this.vx = (Math.random() - 0.5) * 4;
        this.gravity = 0.2;
        this.size = isCrit ? 36 : 24;
        this.opacity = 1.0;
        this.scale = 1.5;
    }
    update() {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vy += this.gravity * dt;
        this.life -= 0.015 * dt;
        this.scale = Math.max(1, this.scale * Math.pow(0.95, dt));
        return this.life > 0;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const displayColor = this.isCrit ? `hsl(${(Date.now() / 2) % 360}, 100%, 70%)` : this.color;
        
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale, this.scale);
        
        if (this.isCrit) {
            ctx.font = `italic 900 ${this.size}px 'Arial Black', sans-serif`;
            ctx.shadowBlur = 20;
            ctx.shadowColor = displayColor;
            
            // Outline
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 6;
            ctx.strokeText(this.text, 0, 0);
            
            // Gradient fill
            const grad = ctx.createLinearGradient(0, -this.size/2, 0, this.size/2);
            grad.addColorStop(0, '#fff');
            grad.addColorStop(0.5, displayColor);
            grad.addColorStop(1, '#ff003c');
            ctx.fillStyle = grad;
            ctx.fillText(this.text, 0, 0);
        } else {
            ctx.font = `900 ${this.size}px 'Arial Black', sans-serif`;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 4;
            ctx.strokeText(this.text, 0, 0);
            ctx.fillStyle = displayColor;
            ctx.fillText(this.text, 0, 0);
        }
        ctx.restore();
    }
}

class Shockwave {
    constructor(x, y, maxRadius, color) {
        this.x = x;
        this.y = y;
        this.r = 0;
        this.maxR = maxRadius;
        this.color = color;
        this.life = 1.0;
    }
    update() {
        this.r += ((this.maxR - this.r) * 0.15 + 1) * dt;
        this.life -= 0.04 * dt;
        return this.life > 0 && this.r < this.maxR;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3 * this.life;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

class VortexParticle {
    constructor(centerX, centerY, color) {
        this.centerX = centerX;
        this.centerY = centerY;
        this.angle = Math.random() * Math.PI * 2;
        this.dist = 80 + Math.random() * 120;
        this.speed = 1.5 + Math.random() * 2.5;
        this.rotSpeed = 0.05 + Math.random() * 0.05;
        this.size = Math.random() * 2.5 + 1;
        this.color = color;
        this.life = 1.0;
    }
    update() {
        this.dist -= this.speed;
        this.angle += this.rotSpeed;
        if (this.dist <= 5) {
            this.life = 0;
        }
        return this.life > 0;
    }
    draw() {
        const x = this.centerX + Math.cos(this.angle) * this.dist;
        const y = this.centerY + Math.sin(this.angle) * this.dist;
        ctx.save();
        ctx.globalAlpha = this.life * (this.dist / 200);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(x, y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class OrbitParticle {
    constructor(centerX, centerY, color) {
        this.centerX = centerX;
        this.centerY = centerY;
        this.angle = Math.random() * Math.PI * 2;
        this.radius = 28 + Math.random() * 36;
        this.rotSpeed = 0.03 + Math.random() * 0.06;
        this.size = Math.random() * 2 + 1.2;
        this.color = color || '#ff3e00';
        this.released = false;
        this.life = 1.0;
    }
    update(centerX, centerY) {
        if (!this.released) {
            // follow bow center while orbiting
            this.centerX = centerX;
            this.centerY = centerY;
            this.angle += this.rotSpeed;
        } else {
            // released: drift outward and fade
            this.angle += this.rotSpeed * 0.6;
            this.radius += 1.6;
            this.life -= 0.03;
        }
        return this.life > 0;
    }
    draw() {
        const x = this.centerX + Math.cos(this.angle) * this.radius;
        const y = this.centerY + Math.sin(this.angle) * this.radius;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowBlur = 12;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.released ? Math.max(0, this.life * 0.6) : 0.95;
        ctx.beginPath(); ctx.arc(x, y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    release() { this.released = true; }
}

class BossProjectile {
    constructor(x, y, targetX, targetY, stars) {
        this.x = x;
        this.y = y;
        const dx = targetX - x;
        const dy = targetY - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        this.speed = 8.5 + (stars * 0.1);
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        this.stars = stars;
        this.radius = 12 + stars * 1.5;
        this.damage = Math.floor(20 + stars * 6);
        this.color = TIER_CONFIG.COLORS[Math.min(this.stars, TIER_CONFIG.MAX_LEVEL)];
        this.life = 1.0;
    }
    update() {
        const dt = boss.active ? boss.timeScale : 1.0;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        if (this.x < -50 || this.x > canvas.width + 50 || this.y < -50 || this.y > canvas.height + 50) {
            return false;
        }

        const px = currentX || 0;
        const py = currentY || 0;
        const pdx = px - this.x;
        const pdy = py - this.y;
        const distToPlayer = Math.sqrt(pdx * pdx + pdy * pdy);
        
        if (distToPlayer < this.radius + 15) {
            playerHP -= this.damage;
            document.getElementById('player-hp-fill').style.width = (playerHP / maxPlayerHP * 100) + '%';
            impactFlash = 0.8;
            shakeAmount = 25 + this.stars * 3;
            Sounds.hit(this.stars);
            
            const activeColor = this.stars === 10 ? `hsl(${Date.now() % 360}, 100%, 70%)` : this.color;
            for (let i = 0; i < 20 + this.stars * 4; i++) {
                particles.push(new Particle(this.x, this.y, (Math.random() - 0.5) * (8 + this.stars * 0.5), (Math.random() - 0.5) * (8 + this.stars * 0.5), activeColor));
            }
            
            if (playerHP <= 0) {
                boss.active = false;
                boss.isCharging = false;
                bossHpContainer.classList.add('hidden');
                bossModeBtn.textContent = 'RIFT REJECTED';
                playerHP = 100;
                document.getElementById('player-hp-fill').style.width = '100%';
            }
            return false;
        }

        const activeColor = this.stars === 10 ? `hsl(${Date.now() % 360}, 100%, 70%)` : this.color;

        // 11성 이상 비행 시 주위로 전기 스파크 방출
        if (this.stars >= 11 && Math.random() < 0.2) {
            const bAngle = Math.random() * Math.PI * 2;
            const bDist = 30 + Math.random() * 30;
            bolts.push(new Bolt(this.x, this.y, this.x + Math.cos(bAngle) * bDist, this.y + Math.sin(bAngle) * bDist, activeColor));
        }

        if (Math.random() < 0.5) {
            particles.push(new Particle(this.x, this.y, -this.vx * 0.2 + (Math.random() - 0.5) * 2, -this.vy * 0.2 + (Math.random() - 0.5) * 2, activeColor));
        }
        return true;
    }
    draw() {
        ctx.save();
        let activeColor = this.color;
        if (this.stars === 10) {
            activeColor = `hsl(${Date.now() % 360}, 100%, 70%)`;
        }
        ctx.shadowBlur = 10 + this.stars * 3;
        ctx.shadowColor = activeColor;
        ctx.fillStyle = activeColor;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Arrow {
    constructor(x, y, vx, vy, tier, stars, isRemote = false) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.tier = tier;
        this.stars = stars;
        this.isStuck = false;
        this.isRemote = isRemote;
    }
    update() {
        if (this.isStuck) return;
        
        const oldX = this.x, oldY = this.y;
        const bossTS = boss.active ? boss.timeScale : 1.0;
        const totalDt = dt * bossTS;
        
        // Boss Gravity Pattern
        if (boss.active && boss.gravityEnabled && !boss.isGroggy) {
            const bdx = boss.x - this.x, bdy = boss.y - this.y;
            const bdist = Math.sqrt(bdx * bdx + bdy * bdy);
            if (bdist < 300) {
                const force = (1 - bdist / 300) * boss.gravityStrength;
                this.vx += bdx * force * totalDt;
                this.vy += bdy * force * totalDt;
            }
        }

        this.x += this.vx * totalDt; this.y += this.vy * totalDt;
        this.vy += GRAVITY * totalDt * (1 - (this.tier / 12));

        if (this.tier > 5 && Math.random() > 0.5) ripples.push(new Ripple(this.x, this.y, (this.tier / 2) * totalDt));
        
        // 화살 비행 잔상 궤적 추가
        if (Math.random() > 0.3) {
            const trailColor = this.stars > 0 ? TIER_CONFIG.COLORS[Math.min(this.stars, TIER_CONFIG.MAX_LEVEL)] : (this.tier >= 10 ? ACCENT : 'rgba(255, 255, 255, 0.4)');
            particles.push(new Particle(this.x, this.y, -this.vx * 0.2 + (Math.random() - 0.5) * 1, -this.vy * 0.2 + (Math.random() - 0.5) * 1, trailColor));
        }

        // Sub-stepping to prevent tunneling
        const steps = Math.ceil(Math.max(1, Math.sqrt(this.vx * this.vx + this.vy * this.vy) * totalDt / (target.radius * 0.5)));
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const checkX = oldX + (this.x - oldX) * t;
            const checkY = oldY + (this.y - oldY) * t;
            
            const dx = checkX - (boss.active ? boss.x : target.x);
            const dy = checkY - (boss.active ? boss.y : target.y);
            const hitRadius = boss.active ? boss.radius : target.radius;

            if (Math.sqrt(dx * dx + dy * dy) < hitRadius) {
                this.x = checkX; this.y = checkY;
                this.isStuck = true; this.hitTime = Date.now();
                this.vx = 0; this.vy = 0;
                combo++; lastHitTime = Date.now();
                const starBonus = this.stars > 0 ? TIER_CONFIG.getPower(this.stars) : 1;
                let damage = (10 + (this.tier * 20)) * (1 + (combo * 0.1)) * starBonus;
                let isCrit = false;
                
                if (boss.active) {
                    if (boss.isGroggy) {
                        damage *= 2.5; // Massive damage boost during Groggy!
                        isCrit = true;
                    }
                    if (isCoop && !isHost) {
                        sendData({ type: 'boss_damage', damage: damage });
                    } else {
                        boss.hp = Math.max(0, boss.hp - damage);
                        bossHpFill.style.width = (boss.hp / boss.maxHp * 100) + '%';
                        if (boss.hp <= 0) {
                            boss.active = false; bossHpContainer.classList.add('hidden');
                            bossModeBtn.textContent = 'RIFT CONQUERED';
                            impactFlash = 1.5; shakeAmount = 100;
                        }
                    }
                } else {
                    score += damage;
                    scoreElement.textContent = Math.floor(score);
                }

                shakeAmount = 2 + (this.tier * 2) + (this.stars * 12);
                Sounds.hit(this.stars);
                const pColor = TIER_CONFIG.COLORS[Math.min(this.stars, TIER_CONFIG.MAX_LEVEL)];
                
                // 데미지 텍스트 팝업 추가
                let dmgText = Math.floor(damage).toLocaleString();
                if (damage >= 1000000) dmgText = (damage / 1000000).toFixed(1) + 'M';
                else if (damage >= 1000) dmgText = (damage / 1000).toFixed(1) + 'K';
                if (boss.isGroggy && boss.active) dmgText = 'CRITICAL! ' + dmgText;
                floatingTexts.push(new FloatingText(this.x, this.y, dmgText, pColor, isCrit || this.stars >= 10 || combo >= 5));

                // 충격파 추가
                const shockRadius = 30 + this.tier * 8 + this.stars * 12;
                shockwaves.push(new Shockwave(this.x, this.y, shockRadius, pColor));

                for (let i = 0; i < 15 + this.tier * 5 + this.stars * 70; i++) {
                    particles.push(new Particle(this.x, this.y, (Math.random() - 0.5) * (5 + this.tier + this.stars * 5), (Math.random() - 0.5) * (5 + this.tier + this.stars * 5), pColor));
                }
                setTimeout(() => arrows = arrows.filter(a => a !== this), 1000);
                break;
            }
        }

        if (this.x > canvas.width || this.y > canvas.height) { arrows = arrows.filter(a => a !== this); combo = 0; }
    }
    draw() {
        ctx.save();
        let color = this.stars > 0 ? TIER_CONFIG.COLORS[Math.min(this.stars, TIER_CONFIG.MAX_LEVEL)] : (this.tier >= 10 ? ACCENT : COLOR);
        if (this.stars === 10) color = `hsl(${Date.now() % 360}, 100%, 70%)`;
        ctx.shadowBlur = this.stars * 15; ctx.shadowColor = color; ctx.strokeStyle = color;
        ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x - this.vx * 1.2, this.y - this.vy * 1.2);
        ctx.lineWidth = 1 + (this.tier / 5) + (this.stars / 1.2); ctx.stroke();
        ctx.restore();
    }
}

class HammerProjectile {
    constructor(x, y, vx, vy, tier, stars, isRemote = false) {
        this.x = x;
        this.y = y;
        this.vx = vx * 1.4; // 망치는 묵직하게 더 빠르게 날아감
        this.vy = vy * 1.1;
        this.tier = tier;
        this.stars = stars;
        this.state = 'flying'; // 'flying' | 'returning'
        this.isRemote = isRemote;
        this.angle = 0;
        this.rotSpeed = 0.15 + (tier * 0.02) + (stars * 0.05);
        this.width = 24 + tier * 2 + stars * 3;
        this.height = 14 + tier * 1.5 + stars * 2;
        this.handleLen = 25 + tier * 2 + stars * 3;
        this.maxDist = 650 + (tier * 30);
        this.flyDist = 0;
    }
    update() {
        const bossTS = boss.active ? boss.timeScale : 1.0;
        const totalDt = dt * bossTS;
        this.angle += this.rotSpeed * totalDt;
        const activeColor = this.stars === 10 ? `hsl(${Date.now() % 360}, 100%, 70%)` : (this.stars > 0 ? TIER_CONFIG.COLORS[Math.min(this.stars, TIER_CONFIG.MAX_LEVEL)] : '#00ffd2');
        
        if (Math.random() < 0.5) {
            particles.push(new Particle(this.x, this.y, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, activeColor));
        }

        // 비행 중 정전기 스파크
        if (Math.random() < 0.15 + (this.stars * 0.06)) {
            const bAngle = Math.random() * Math.PI * 2;
            const bDist = 25 + Math.random() * 25;
            bolts.push(new Bolt(this.x, this.y, this.x + Math.cos(bAngle) * bDist, this.y + Math.sin(bAngle) * bDist, activeColor));
        }

        if (this.state === 'flying') {
            const oldX = this.x, oldY = this.y;
            
            // Boss Gravity Pattern
            if (boss.active && boss.gravityEnabled && !boss.isGroggy) {
                const bdx = boss.x - this.x, bdy = boss.y - this.y;
                const bdist = Math.sqrt(bdx * bdx + bdy * bdy);
                if (bdist < 300) {
                    const force = (1 - bdist / 300) * boss.gravityStrength;
                    this.vx += bdx * force * totalDt;
                    this.vy += bdy * force * totalDt;
                }
            }
            
            this.x += this.vx * totalDt;
            this.y += this.vy * totalDt;
            this.vy += GRAVITY * 0.3 * totalDt; // 중력을 무겁게 적용
            this.flyDist += Math.sqrt(this.vx * this.vx + this.vy * this.vy) * totalDt;

            if (this.y > canvas.height + 50 || this.flyDist > this.maxDist) {
                this.state = 'returning';
            }

            const targetX = boss.active ? boss.x : target.x;
            const targetY = boss.active ? boss.y : target.y;
            const hitRadius = boss.active ? boss.radius : target.radius;

            const dx = this.x - targetX;
            const dy = this.y - targetY;
            
            if (Math.sqrt(dx * dx + dy * dy) < hitRadius + 10) {
                // 충돌!
                this.state = 'returning';
                this.vx = 0;
                this.vy = 0;
                combo++;
                lastHitTime = Date.now();

                const starBonus = this.stars > 0 ? TIER_CONFIG.getPower(this.stars) : 1;
                // 망치 피해량 보정 (활의 1.4배 피해)
                let damage = (15 + (this.tier * 28)) * (1 + (combo * 0.12)) * starBonus;
                let isCrit = false;

                if (boss.active) {
                    if (boss.isGroggy) {
                        damage *= 2.5;
                        isCrit = true;
                    }
                    if (isCoop && !isHost) {
                        sendData({ type: 'boss_damage', damage: damage });
                    } else {
                        boss.hp = Math.max(0, boss.hp - damage);
                        bossHpFill.style.width = (boss.hp / boss.maxHp * 100) + '%';
                        if (boss.hp <= 0) {
                            boss.active = false;
                            bossHpContainer.classList.add('hidden');
                            bossModeBtn.textContent = 'RIFT CONQUERED';
                            impactFlash = 1.5;
                            shakeAmount = 100;
                        }
                    }
                } else {
                    score += damage;
                    scoreElement.textContent = Math.floor(score);
                }

                shakeAmount = 6 + (this.tier * 4) + (this.stars * 18);
                Sounds.hit(this.stars); // 타격음

                // 천둥 벼락 소환
                const boltCount = 3 + this.stars;
                for (let k = 0; k < boltCount; k++) {
                    const bAngle = Math.random() * Math.PI * 2;
                    const bRadius = 150 + Math.random() * 100;
                    bolts.push(new Bolt(this.x, this.y, this.x + Math.cos(bAngle) * bRadius, this.y + Math.sin(bAngle) * bRadius, activeColor));
                }

                let dmgText = Math.floor(damage).toLocaleString();
                if (damage >= 1000000) dmgText = (damage / 1000000).toFixed(1) + 'M';
                else if (damage >= 1000) dmgText = (damage / 1000).toFixed(1) + 'K';
                if (boss.isGroggy && boss.active) dmgText = 'CRITICAL THUNDER! ' + dmgText;
                
                floatingTexts.push(new FloatingText(this.x, this.y, dmgText, activeColor, isCrit || this.stars >= 10 || combo >= 5));

                // 거대 천둥 충격파
                const shockRadius = 45 + this.tier * 12 + this.stars * 18;
                shockwaves.push(new Shockwave(this.x, this.y, shockRadius, activeColor));

                for (let i = 0; i < 25 + this.tier * 8 + this.stars * 80; i++) {
                    particles.push(new Particle(this.x, this.y, (Math.random() - 0.5) * (7 + this.tier + this.stars * 6), (Math.random() - 0.5) * (7 + this.tier + this.stars * 6), activeColor));
                }
            }
        } else if (this.state === 'returning') {
            const px = currentX || 50;
            const py = currentY || 300;
            const dx = px - this.x;
            const dy = py - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 35) {
                // 망치 회수 완료!
                isHammerThrown = false;
                // 회수 성공 찌리릿음 재생
                Sounds.charge(1); 
                return false;
            }

            const speed = 14 + (this.stars * 0.8);
            this.vx = (dx / dist) * speed;
            this.vy = (dy / dist) * speed;
            this.x += this.vx * totalDt;
            this.y += this.vy * totalDt;
        }

        return true;
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        let activeColor = this.stars > 0 ? TIER_CONFIG.COLORS[Math.min(this.stars, TIER_CONFIG.MAX_LEVEL)] : (this.tier >= 10 ? ACCENT : '#00ffd2');
        if (this.stars === 10) activeColor = `hsl(${Date.now() % 360}, 100%, 70%)`;
        
        ctx.shadowBlur = 12 + this.stars * 6;
        ctx.shadowColor = activeColor;
        ctx.strokeStyle = activeColor;
        ctx.fillStyle = activeColor;
        ctx.lineWidth = 2 + (this.tier * 0.3);
        
        // 자루 (Handle)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, this.handleLen);
        ctx.stroke();
        
        // 폼멜 (자루 끝 가죽 고리 등)
        ctx.beginPath();
        ctx.arc(0, this.handleLen, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // 망치 머리 (Head)
        ctx.beginPath();
        ctx.rect(-this.width / 2, -this.height / 2, this.width, this.height);
        ctx.stroke();
        
        // 내부 뇌전 충전 코어
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(-this.width / 2 + 2, -this.height / 2 + 2, this.width - 4, this.height - 4);
        
        // 쐐기 날
        ctx.beginPath();
        ctx.moveTo(-this.width / 2, -this.height / 4);
        ctx.lineTo(-this.width / 2 - 4, 0);
        ctx.lineTo(-this.width / 2, this.height / 4);
        ctx.moveTo(this.width / 2, -this.height / 4);
        ctx.lineTo(this.width / 2 + 4, 0);
        ctx.lineTo(this.width / 2, this.height / 4);
        ctx.stroke();
        
        ctx.restore();
    }
}

class HammerSwing {
    constructor(x, y, targetX, targetY, tier, stars) {
        this.x = x;
        this.y = y;
        this.targetX = targetX;
        this.targetY = targetY;
        this.tier = tier;
        this.stars = stars;
        this.angle = Math.atan2(targetY - y, targetX - x);
        this.slashAngle = -Math.PI * 0.55;
        this.targetSlashAngle = Math.PI * 0.55;
        this.radius = 150 + (tier * 18) + (stars * 24);
        this.isFinished = false;
        this.hitCount = 0;
        this.maxHits = 3; // 최대 3타 다단히트
        this.lastHitFrame = 0;
        this.points = [];
    }
    update() {
        this.slashAngle += (this.targetSlashAngle - this.slashAngle) * 0.28 + 0.05;
        if (this.slashAngle >= this.targetSlashAngle - 0.06) {
            this.isFinished = true;
            return false;
        }

        const currentAbsAngle = this.angle + this.slashAngle;
        const tipX = this.x + Math.cos(currentAbsAngle) * this.radius;
        const tipY = this.y + Math.sin(currentAbsAngle) * this.radius;
        
        this.points.push({ x: tipX, y: tipY });
        if (this.points.length > 7) this.points.shift();

        const activeColor = this.stars === 10 ? `hsl(${Date.now() % 360}, 100%, 70%)` : (this.stars > 0 ? TIER_CONFIG.COLORS[Math.min(this.stars, TIER_CONFIG.MAX_LEVEL)] : '#ff3e00');

        if (Math.random() < 0.9) {
            particles.push(new Particle(tipX, tipY, (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7, activeColor));
        }

        // 보스 투사체 휩쓸어 파괴 및 격쇄
        bossProjectiles = bossProjectiles.filter(bp => {
            const dx = bp.x - this.x;
            const dy = bp.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= this.radius + 30) {
                const angleToProj = Math.atan2(dy, dx);
                let diff = Math.abs(angleToProj - this.angle);
                if (diff > Math.PI) diff = Math.PI * 2 - diff;
                if (diff < Math.PI * 0.6) {
                    for (let i = 0; i < 10; i++) {
                        particles.push(new Particle(bp.x, bp.y, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, '#00ffd2'));
                    }
                    Sounds.hit(1);
                    return false;
                }
            }
            return true;
        });

        // 보스/과녁 타격
        const targetX = boss.active ? boss.x : target.x;
        const targetY = boss.active ? boss.y : target.y;
        const hitRadius = boss.active ? boss.radius : target.radius;
        const tdx = targetX - this.x;
        const tdy = targetY - this.y;
        const tdist = Math.sqrt(tdx * tdx + tdy * tdy);

        if (tdist <= this.radius + hitRadius + 15 && this.hitCount < this.maxHits && Date.now() - this.lastHitFrame > 60) {
            const angleToTarget = Math.atan2(tdy, tdx);
            let diff = Math.abs(angleToTarget - this.angle);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;

            if (diff < Math.PI * 0.65) {
                this.hitCount++;
                this.lastHitFrame = Date.now();

                const starBonus = this.stars > 0 ? TIER_CONFIG.getPower(this.stars) : 1;
                // 휘두르기는 콤보 비례 및 묵직한 다단히트 (타격당 활의 1.1배 데미지)
                let damage = (11 + (this.tier * 22)) * (1 + (combo * 0.1)) * starBonus;
                let isCrit = false;

                if (boss.active) {
                    if (boss.isGroggy) {
                        damage *= 2.5;
                        isCrit = true;
                    }
                    boss.hp = Math.max(0, boss.hp - damage);
                    bossHpFill.style.width = (boss.hp / boss.maxHp * 100) + '%';
                    if (boss.hp <= 0) {
                        boss.active = false;
                        bossHpContainer.classList.add('hidden');
                        bossModeBtn.textContent = 'RIFT CONQUERED';
                        impactFlash = 1.5;
                        shakeAmount = 100;
                    }
                } else {
                    score += damage;
                    scoreElement.textContent = Math.floor(score);
                }

                shakeAmount = 5 + (this.tier * 3) + (this.stars * 14);
                Sounds.hit(this.stars);

                // 대지 벼락 균열 기둥 (첫 번째 히트 시 전진 발생)
                if (this.hitCount === 1) {
                    combo++;
                    const crackCount = 3 + Math.floor(this.stars / 2);
                    for (let k = 0; k < crackCount; k++) {
                        const offsetAngle = this.angle + (Math.random() - 0.5) * 0.35;
                        const crackDist = 140 + k * 110;
                        const cx = this.x + Math.cos(offsetAngle) * crackDist;
                        const cy = this.y + Math.sin(offsetAngle) * crackDist;
                        bolts.push(new Bolt(this.x, this.y, cx, cy, activeColor));
                        
                        for (let i = 0; i < 18; i++) {
                            particles.push(new Particle(cx, cy, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, activeColor));
                        }
                    }
                }

                let dmgText = Math.floor(damage).toLocaleString();
                if (damage >= 1000000) dmgText = (damage / 1000000).toFixed(1) + 'M';
                else if (damage >= 1000) dmgText = (damage / 1000).toFixed(1) + 'K';
                dmgText = `${this.hitCount}x ` + dmgText;
                if (boss.isGroggy && boss.active) dmgText = 'CRITICAL SMASH! ' + dmgText;
                
                floatingTexts.push(new FloatingText(targetX + (Math.random() - 0.5) * 80, targetY + (Math.random() - 0.5) * 80, dmgText, activeColor, isCrit || this.stars >= 10 || combo >= 5));

                shockwaves.push(new Shockwave(targetX, targetY, 45 + this.stars * 12, activeColor));
            }
        }

        return true;
    }
    draw() {
        const activeColor = this.stars === 10 ? `hsl(${Date.now() % 360}, 100%, 70%)` : (this.stars > 0 ? TIER_CONFIG.COLORS[Math.min(this.stars, TIER_CONFIG.MAX_LEVEL)] : '#ff3e00');

        if (this.points.length > 1) {
            ctx.save();
            ctx.shadowBlur = 18 + this.stars * 5;
            ctx.shadowColor = activeColor;
            ctx.strokeStyle = activeColor;
            ctx.fillStyle = activeColor;
            ctx.globalAlpha = 0.15;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            for (let p of this.points) {
                ctx.lineTo(p.x, p.y);
            }
            ctx.closePath();
            ctx.fill();

            ctx.globalAlpha = 0.45;
            ctx.lineWidth = 4 + this.stars * 0.6;
            ctx.beginPath();
            ctx.moveTo(this.points[0].x, this.points[0].y);
            for (let i = 1; i < this.points.length; i++) {
                ctx.lineTo(this.points[i].x, this.points[i].y);
            }
            ctx.stroke();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        const currentAbsAngle = this.angle + this.slashAngle;
        ctx.rotate(currentAbsAngle);

        ctx.shadowBlur = 15 + this.stars * 5;
        ctx.shadowColor = activeColor;
        ctx.strokeStyle = activeColor;
        ctx.fillStyle = activeColor;

        const hWidth = 36 + this.tier * 3 + this.stars * 4;
        const hHeight = 18 + this.tier * 2 + this.stars * 3;
        const hHandle = 36 + this.tier * 3 + this.stars * 4;
        ctx.lineWidth = 3 + (this.tier * 0.35);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, hHandle);
        ctx.stroke();

        ctx.beginPath();
        ctx.rect(-hWidth / 2, -hHeight / 2, hWidth, hHeight);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(-hWidth / 2 + 2, -hHeight / 2 + 2, hWidth - 4, hHeight - 4);

        ctx.restore();
    }
}

function drawTrajectory() {
    if (!isDragging) return;
    const dx = startX - currentX, dy = startY - currentY;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), MAX_PULL);
    const angle = Math.atan2(dy, dx);
    const timeCharged = Date.now() - chargeStartTime;
    const tier = Math.min(10, Math.floor(dist / 30) + Math.floor(timeCharged / 400));
    const power = 0.1 + (tier * 0.05) + (starLevel * 0.02);
    let vx = Math.cos(angle) * dist * power, vy = Math.sin(angle) * dist * power, tx = startX, ty = startY;
    ctx.save();
    let color = tier >= 10 ? (starLevel > 0 ? TIER_CONFIG.COLORS[Math.min(starLevel, 10)] : ACCENT) : 'rgba(255, 255, 255, 0.05)';
    if (starLevel === 10) color = `hsl(${Date.now() % 360}, 100%, 70%)`;
    ctx.strokeStyle = color; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(tx, ty);
    for (let i = 0; i < 20; i++) { tx += vx; ty += vy; vy += GRAVITY * (1 - (tier / 12)); ctx.lineTo(tx, ty); }
    ctx.stroke(); ctx.restore();
}

function drawTarget() {
    if (boss.active) {
        // --- 5. TIME WARP LOGIC ---
        // 보스 HP가 낮을수록 가끔 시간을 느리게 만듦
        if (!boss.isGroggy && Math.random() < 0.005 * dt && Date.now() - boss.lastPatternTime > 5000) {
            boss.timeScale = 0.3;
            boss.lastPatternTime = Date.now();
            floatingTexts.push(new FloatingText(canvas.width/2, canvas.height/2, 'TIME WARP', '#ff00ff', 30));
        }
        if (boss.timeScale < 1.0 && Date.now() - boss.lastPatternTime > 2000) {
            boss.timeScale = Math.min(1.0, boss.timeScale + 0.01 * dt);
        }

        // Check Groggy Expiry
        if (boss.isGroggy && Date.now() > boss.groggyEndTime) {
            boss.isGroggy = false;
            boss.lastTeleport = Date.now();
            
            // --- 4. SINGULARITY ERUPTION (On Groggy Recovery) ---
            boss.isBursting = true;
            for (let i = 0; i < 36; i++) {
                const angle = (i * 10) * Math.PI / 180;
                const bx = boss.x + Math.cos(angle) * 20;
                const by = boss.y + Math.sin(angle) * 20;
                const p = new BossProjectile(bx, by, bx + Math.cos(angle)*100, by + Math.sin(angle)*100, 15);
                p.speed = 5; p.vx = Math.cos(angle) * p.speed; p.vy = Math.sin(angle) * p.speed;
                bossProjectiles.push(p);
            }
            floatingTexts.push(new FloatingText(boss.x, boss.y, 'SINGULARITY ERUPTION', '#ff003c', 20));
        }

        // Pattern: Floating & Teleport
        if (!boss.isGroggy && !boss.isCharging && Date.now() - boss.lastTeleport > 4000 * boss.timeScale) {
            // --- 2. DIMENSIONAL RIFT (Leave rift on teleport) ---
            if (boss.active) {
                boss.rifts.push({ x: boss.x, y: boss.y, life: 1.0, lastShoot: Date.now() });
            }

            boss.teleportCount++;
            if (boss.teleportCount >= 4) {
                boss.isGroggy = true;
                boss.groggyEndTime = Date.now() + 6000;
                boss.teleportCount = 0;
                Sounds.overload();
                impactFlash = 0.5;
            } else {
                // Teleport Effect (Shockwave at old location)
                shockwaves.push(new Shockwave(boss.x, boss.y, boss.radius * 2, '#7000ff'));
                for(let i=0; i<30; i++) particles.push(new Particle(boss.x, boss.y, (Math.random()-0.5)*15, (Math.random()-0.5)*15, '#7000ff'));

                boss.x = 200 + Math.random() * (canvas.width - 400);
                boss.y = 100 + Math.random() * (canvas.height - 200);
                
                // Teleport Effect (Shockwave at new location)
                shockwaves.push(new Shockwave(boss.x, boss.y, boss.radius * 2, '#00ffd2'));
                for(let i=0; i<30; i++) particles.push(new Particle(boss.x, boss.y, (Math.random()-0.5)*15, (Math.random()-0.5)*15, '#00ffd2'));

                boss.lastTeleport = Date.now();
                impactFlash = 0.3;
            }
        }

        // Rift Update & Draw
        boss.rifts = boss.rifts.filter(rift => {
            rift.life -= 0.005 * dt;
            ctx.save();
            ctx.globalAlpha = rift.life;
            ctx.shadowBlur = 15; ctx.shadowColor = '#7000ff';
            ctx.strokeStyle = '#7000ff'; ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(rift.x - 20, rift.y - 20); ctx.lineTo(rift.x + 20, rift.y + 20);
            ctx.moveTo(rift.x + 20, rift.y - 20); ctx.lineTo(rift.x - 20, rift.y + 20);
            ctx.stroke();
            ctx.restore();

            if (Date.now() - rift.lastShoot > 2000) {
                bossProjectiles.push(new BossProjectile(rift.x, rift.y, canvas.width/2, canvas.height/2, 5));
                rift.lastShoot = Date.now();
            }
            return rift.life > 0;
        });

        // --- 3. EVENT HORIZON (Guardians) ---
        if (!boss.isGroggy && boss.guardians.length < 3 && Math.random() < 0.01 * dt) {
            boss.guardians.push({ angle: Math.random() * Math.PI * 2, distance: 150, radius: 25 });
        }
        boss.guardians.forEach((g, idx) => {
            g.angle += 0.03 * boss.timeScale * dt;
            const gx = boss.x + Math.cos(g.angle) * g.distance;
            const gy = boss.y + Math.sin(g.angle) * g.distance;
            
            ctx.save();
            ctx.fillStyle = '#000'; ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 2;
            ctx.shadowBlur = 15; ctx.shadowColor = '#ff00ff';
            ctx.beginPath(); ctx.arc(gx, gy, g.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.restore();

            // Collision with arrows
            arrows.forEach(a => {
                const dist = Math.sqrt((a.x - gx)**2 + (a.y - gy)**2);
                if (dist < g.radius + 10) { a.life = 0; particles.push(new Particle(a.x, a.y, 0, 0, '#ff00ff')); }
            });
        });

        // --- 1. GRAVITY WELL ---
        if (!boss.isGroggy && boss.hp < boss.maxHp * 0.8) {
            boss.gravityEnabled = true;
            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = 'rgba(255, 62, 0, 0.2)';
            ctx.arc(boss.x, boss.y, 300, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        } else { boss.gravityEnabled = false; }

        if (boss.isCharging) {
            boss.lastTeleport = Date.now();
        } else {
            boss.y += Math.sin(Date.now() / 1000) * (boss.isGroggy ? 0.3 : (boss.hp < boss.maxHp * 0.7 ? 2 : 1)) * boss.timeScale;
        }
        
        ctx.save(); ctx.translate(boss.x, boss.y);
        let pulse = Math.sin(Date.now() / 200) * 10;
        
        // 차징 시 소용돌이 파티클 생성 및 팽창 효과
        if (boss.isCharging) {
            const elapsed = Date.now() - boss.chargeStartTime;
            const chargeRatio = Math.min(1, elapsed / 2000);
            
            // 80ms 간격으로 보스의 차징 등급 성장 (최대 25성 근처 도달)
            if (Date.now() - boss.lastStarUpdateTime > 80) {
                boss.starLevel = Math.min(TIER_CONFIG.MAX_LEVEL, boss.starLevel + 1);
                boss.lastStarUpdateTime = Date.now();
                Sounds.evolve(boss.starLevel); // 보스 진화 사운드 재생
                shakeAmount = 4 + boss.starLevel * 1.2;
            }

            pulse = Math.sin(Date.now() / 100) * 8 + (chargeRatio * 35);
            
            if (Math.random() < 0.6) {
                const vColor = TIER_CONFIG.COLORS[Math.min(boss.starLevel, TIER_CONFIG.MAX_LEVEL)];
                vortexParticles.push(new VortexParticle(boss.x, boss.y, vColor));
            }
            
            // 차징 완료 및 발사
            if (elapsed >= 2000) {
                boss.isCharging = false;
                boss.lastChargeAttackTime = Date.now();
                Sounds.fire(15);
                impactFlash = 1.2;
                bossProjectiles.push(new BossProjectile(boss.x, boss.y, boss.targetX, boss.targetY, boss.starLevel));
            }
        }

        // Dynamic colors: Cyan for Groggy, Violet for critical, Red for normal
        const color = boss.isGroggy ? '#00ffd2' : (boss.hp < boss.maxHp * 0.3 ? '#ff00ff' : '#ff003c');
        
        // Dark Aura & Phase Effects
        const grd = ctx.createRadialGradient(0, 0, boss.radius, 0, 0, boss.radius * 3);
        grd.addColorStop(0, color + '33'); grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd; ctx.fillRect(-boss.radius*3, -boss.radius*3, boss.radius*6, boss.radius*6);

        // Dimensional Rings (Flickers/weak during Groggy)
        const ringCount = boss.isGroggy ? 1 : (boss.hp < boss.maxHp * 0.5 ? 3 : 1);
        for(let i=0; i< ringCount; i++) {
            ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = boss.isGroggy ? 0.5 : 2;
            ctx.rotate(Date.now() / (1000 + i*500));
            ctx.ellipse(0, 0, (boss.radius + 20) + i*20, (boss.radius + 10) - i*5, 0, 0, Math.PI * 2); ctx.stroke();
        }

        // Singularity Core
        ctx.shadowBlur = boss.isGroggy ? 80 : 50; ctx.shadowColor = color;
        ctx.fillStyle = boss.isGroggy ? 'rgba(0, 255, 210, 0.1)' : '#000000'; ctx.beginPath();
        ctx.arc(0, 0, boss.radius + pulse, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.stroke();
        
        // Render HUD text above the boss core when Groggy
        if (boss.isGroggy) {
            ctx.restore(); // Temp restore to draw non-rotated text
            ctx.save(); ctx.translate(boss.x, boss.y);
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            
            ctx.font = '900 14px monospace';
            ctx.fillStyle = '#00ffd2';
            ctx.shadowBlur = 10; ctx.shadowColor = '#00ffd2';
            ctx.fillText('CORE EXPOSED', 0, -boss.radius - 40);
            
            ctx.font = '700 10px monospace';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.shadowBlur = 0;
            const remaining = ((boss.groggyEndTime - Date.now()) / 1000).toFixed(1);
            ctx.fillText(`TAKE AIM: 2.5x DMG (${remaining}s)`, 0, -boss.radius - 20);
        }
        
        // Render HUD text when Charging
        if (boss.isCharging) {
            ctx.restore();
            ctx.save(); ctx.translate(boss.x, boss.y);
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            
            const activeColor = TIER_CONFIG.COLORS[Math.min(boss.starLevel, TIER_CONFIG.MAX_LEVEL)];
            
            ctx.font = '900 14px monospace';
            ctx.fillStyle = activeColor;
            ctx.shadowBlur = 10; ctx.shadowColor = activeColor;
            ctx.fillText('VOID BLAST CHARGING', 0, -boss.radius - 60);
            
            // 보스 충전 등급 표시
            ctx.font = '900 24px sans-serif';
            ctx.fillText(TIER_CONFIG.getName(boss.starLevel), 0, -boss.radius - 35);
            
            ctx.font = '700 10px monospace';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.shadowBlur = 0;
            const chargePct = Math.min(100, ((Date.now() - boss.chargeStartTime) / 2000 * 100)).toFixed(0);
            ctx.fillText(`TARGET LOCKED: ${chargePct}% (${TIER_CONFIG.getLabel(boss.starLevel)})`, 0, -boss.radius - 15);
        }
        
        ctx.restore();

        // 조준 레이저 가이드라인선 (등급에 따른 색상 및 두께 변화)
        if (boss.isCharging) {
            ctx.save();
            const activeColor = TIER_CONFIG.COLORS[Math.min(boss.starLevel, TIER_CONFIG.MAX_LEVEL)];
            ctx.strokeStyle = activeColor + '55';
            ctx.lineWidth = 1.5 + (boss.starLevel * 0.15);
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(boss.x, boss.y);
            ctx.lineTo(boss.targetX, boss.targetY);
            ctx.stroke();
            ctx.restore();
        }
        return;
    }

    target.y += target.speed * target.direction;
    if (target.y > canvas.height - 100 || target.y < 100) target.direction *= -1;

    // Draw Target as a 'Quantum Singularity'
    ctx.save();
    ctx.translate(target.x, target.y);
    
    // Core Pulse
    const pulse = Math.sin(Date.now() / 200) * 5;
    const chargeIntensity = isDragging ? starLevel / 25 : 0;
    
    // Outer Rings
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 - i * 0.03})`;
        ctx.lineWidth = 1;
        const r = target.radius + (i * 15) + (pulse * (i + 1)) + (chargeIntensity * 10);
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Main Hit Area
    ctx.beginPath();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 15 + chargeIntensity * 20;
    ctx.shadowColor = '#ffffff';
    ctx.arc(0, 0, target.radius + pulse, 0, Math.PI * 2);
    ctx.stroke();

    // Core Distortion
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.arc(0, 0, target.radius * 0.4 + pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

let pityBonus = 0;

function drawBow() {
    if (!isDragging) return;
    const dx = startX - currentX, dy = startY - currentY;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), MAX_PULL);
    const angle = Math.atan2(dy, dx);
    const timeCharged = Date.now() - chargeStartTime;
    const tier = Math.min(10, Math.floor(dist / 30) + Math.floor(timeCharged / 400));

    // Draw Guide Line (Dashed Line between Drag Start and Current Cursor)
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.moveTo(startX, startY);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();

    // Draw Aim Line (Projected path in the shooting direction)
    const aimDist = dist * 5; // Project the aim point forward based on pull strength
    const aimX = startX + Math.cos(angle) * aimDist;
    const aimY = startY + Math.sin(angle) * aimDist;
    
    ctx.beginPath();
    ctx.setLineDash([8, 4]);
    ctx.strokeStyle = starLevel > 0 ? TIER_CONFIG.COLORS[Math.min(starLevel, TIER_CONFIG.MAX_LEVEL)] : 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.moveTo(startX, startY);
    ctx.lineTo(aimX, aimY);
    ctx.stroke();

    // Draw Aim Reticle at the end of the aim line
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.arc(aimX, aimY, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (tier >= 10) {
        if (!isStarRolled) {
            const rand = Math.random();
            if (rand < 0.01) targetStarLevel = 10;
            else if (rand < 0.03) targetStarLevel = 9;
            else if (rand < 0.07) targetStarLevel = 8;
            else if (rand < 0.12) targetStarLevel = 7;
            else if (rand < 0.20) targetStarLevel = 6;
            else if (rand < 0.35) targetStarLevel = 5;
            else if (rand < 0.55) targetStarLevel = 4;
            else if (rand < 0.75) targetStarLevel = 3;
            else targetStarLevel = 2;
            starLevel = 1; isStarRolled = true; lastStarUpdateTime = Date.now(); lastEvolutionCheck = Date.now();
            pityBonus = 0;
            isOverloading = false;
        } else {
            const baseInterval = boss.active ? 120 : 800; // Ultra-fast charging in Boss Mode
            const currentInterval = isOverloading ? 50 : baseInterval; // 50ms during overload!
            if (Date.now() - lastEvolutionCheck > currentInterval) {
                lastEvolutionCheck = Date.now();
                const baseChance = boss.active ? 0.40 : 0.15; // 40% base upgrade chance in Boss Mode
                const upgradeChance = (isOverloading ? 0.45 : baseChance) + pityBonus;
                const downgradeChance = starLevel > 15 ? 0.08 : 0.03;

                if (Math.random() < upgradeChance) {
                    const evolRand = Math.random();
                    let jump = 1;
                    if (evolRand < 0.05) jump = 10;
                    else if (evolRand < 0.15) jump = 3;
                    else if (evolRand < 0.40) jump = 2;

                    // Trigger Overload on big jumps (20% chance)
                    if (jump >= 3 && !isOverloading && Math.random() < 0.2) {
                        isOverloading = true;
                        overloadEndTime = Date.now() + 2500;
                        Sounds.overload();
                        impactFlash = 1; // Flash red
                    }

                    targetStarLevel = Math.min(TIER_CONFIG.MAX_LEVEL, targetStarLevel + jump);
                    shakeAmount = 15 + (jump * 5) + (isOverloading ? 20 : 0);
                    for (let i = 0; i < jump; i++) ripples.push(new Ripple(startX, startY, 15 + i * 5));
                    Sounds.evolve(targetStarLevel);
                    pityBonus = Math.max(0, pityBonus - 0.05);
                } else if (starLevel > 1 && Math.random() < (isOverloading ? 0.01 : downgradeChance)) {
                    // Downgrade Chance is LOWER during overload to keep the momentum
                    targetStarLevel = Math.max(1, targetStarLevel - 1);
                    starLevel = targetStarLevel;
                    shakeAmount = 30;
                    pityBonus += 0.10;
                    Sounds.evolve(1);
                    for (let i = 0; i < 50; i++) {
                        const pa = Math.random() * Math.PI * 2;
                        particles.push(new Particle(startX, startY, Math.cos(pa) * 10, Math.sin(pa) * 10, '#ff0000'));
                    }
                } else {
                    pityBonus += 0.02;
                }
            }
        }

        // Check Overload Expiry
        if (isOverloading && Date.now() > overloadEndTime) {
            isOverloading = false;
        }
    }

    if (isStarRolled && starLevel < targetStarLevel) {
        const updateSpeed = starLevel > 30 ? 60 : 100; // Faster count-up for high tiers
        if (Date.now() - lastStarUpdateTime > updateSpeed) {
            starLevel++; lastStarUpdateTime = Date.now(); shakeAmount = 5 + starLevel * 4;
            Sounds.evolve(starLevel);
            for (let i = 0; i < 20; i++) {
                const pa = Math.random() * Math.PI * 2; const pd = Math.random() * 40;
                particles.push(new Particle(startX + Math.cos(pa) * pd, startY + Math.sin(pa) * pd, Math.cos(pa) * 5, Math.sin(pa) * 5, TIER_CONFIG.COLORS[Math.min(starLevel, TIER_CONFIG.MAX_LEVEL)]));
            }
        }
    }

    const vibX = (Math.random() - 0.5) * (tier * 0.5 + starLevel);
    const vibY = (Math.random() - 0.5) * (tier * 0.5 + starLevel);
    if (tier > 3 && Math.random() < (tier * 0.05)) ripples.push(new Ripple(startX, startY, tier + starLevel));
    if (dist > 10) {
        for (let i = 0; i < (tier / 2) + starLevel * 2; i++) {
            const pAngle = Math.random() * Math.PI * 2; const pDist = 30 + Math.random() * 60;
            const px = startX + Math.cos(pAngle) * pDist; const py = startY + Math.sin(pAngle) * pDist;
            const pColor = starLevel > 0 ? TIER_CONFIG.COLORS[Math.min(starLevel, TIER_CONFIG.MAX_LEVEL)] : (tier >= 10 ? ACCENT : 'rgba(255,255,255,0.2)');
            particles.push(new Particle(px, py, (startX - px) * 0.08, (startY - py) * 0.08, pColor));
        }

        // 보텍스 소용돌이 에너지 흡수 파티클 생성
        if (Math.random() < 0.4 + (starLevel * 0.05)) {
            const vColor = starLevel > 0 ? TIER_CONFIG.COLORS[Math.min(starLevel, TIER_CONFIG.MAX_LEVEL)] : (tier >= 10 ? ACCENT : '#ffffff');
            vortexParticles.push(new VortexParticle(startX, startY, vColor));
        }
    }

    if (starLevel >= 11) {
        if (Math.random() < 0.3) {
            const bAngle = Math.random() * Math.PI * 2; const bDist = 60 + Math.random() * 40;
            bolts.push(new Bolt(startX, startY, startX + Math.cos(bAngle) * bDist, startY + Math.sin(bAngle) * bDist, TIER_CONFIG.COLORS[Math.min(starLevel, TIER_CONFIG.MAX_LEVEL)]));
        }
        if (starLevel >= 15) {
            particles.forEach(p => {
                const pdx = startX - p.x, pdy = startY - p.y; const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
                if (pdist < 150) { p.vx += pdx * 0.005; p.vy += pdy * 0.005; }
            });
        }
    }
    const baseColor = starLevel > 0 ? TIER_CONFIG.COLORS[Math.min(starLevel, TIER_CONFIG.MAX_LEVEL)] : (tier >= 10 ? ACCENT : `rgba(255, 255, 255, ${0.3 + (tier * 0.07)})`);

    if (currentWeapon === 'bow') {
        ctx.save(); ctx.translate(startX + vibX, startY + vibY); ctx.rotate(angle);
        ctx.strokeStyle = baseColor; ctx.lineWidth = 0.5 + (tier / 20) + (starLevel / 5);
        if (tier > 5) {
            ctx.beginPath(); ctx.strokeStyle = tier >= 10 ? baseColor : 'rgba(255,255,255,0.1)';
            for (let i = 0; i < 3 + (starLevel / 2); i++) {
                const offset = (Date.now() / 100 + i) % 10; ctx.moveTo(-60 - offset, -20);
                ctx.bezierCurveTo(-70 - offset, -10, -50 - offset, 10, -60 - offset, 20);
            }
            ctx.stroke();
        }
        if (tier >= 10) {
            ctx.save(); ctx.translate(-dist / 2, 0); ctx.rotate(Date.now() / 200);
            if (starLevel >= 15) {
                ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 40; ctx.shadowColor = '#ffffff';
                ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.shadowBlur = 10 + starLevel * 5; ctx.shadowColor = baseColor;
                ctx.strokeStyle = baseColor; ctx.lineWidth = 1;
                for (let j = 0; j < 1 + (starLevel / 2); j++) {
                    const s = 4 + j * 4; ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.lineTo(0, -s); ctx.closePath(); ctx.stroke();
                }
            }
            ctx.restore();
        }
        ctx.restore();
    } else if (currentWeapon === 'hammer') {
        ctx.save();
        ctx.translate(startX + vibX, startY + vibY);
        // 충전 세기 및 등급에 비례한 고속 휠윈드 회전 연출
        const rotSpeed = Date.now() / (150 - (tier * 10) - Math.min(80, starLevel * 4));
        ctx.rotate(rotSpeed);
        
        const activeColor = starLevel > 0 ? TIER_CONFIG.COLORS[Math.min(starLevel, TIER_CONFIG.MAX_LEVEL)] : (tier >= 10 ? ACCENT : '#00ffd2');
        ctx.shadowBlur = 10 + starLevel * 6;
        ctx.shadowColor = activeColor;
        ctx.strokeStyle = activeColor;
        ctx.fillStyle = activeColor;
        ctx.lineWidth = 2 + (tier * 0.3);
        
        const hWidth = 24 + tier * 2 + starLevel * 3;
        const hHeight = 14 + tier * 1.5 + starLevel * 2;
        const hHandle = 25 + tier * 2 + starLevel * 3;

        // 자루
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, hHandle);
        ctx.stroke();
        
        // 폼멜
        ctx.beginPath();
        ctx.arc(0, hHandle, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // 망치 머리
        ctx.beginPath();
        ctx.rect(-hWidth / 2, -hHeight / 2, hWidth, hHeight);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(-hWidth / 2 + 2, -hHeight / 2 + 2, hWidth - 4, hHeight - 4);
        
        // 쐐기 날
        ctx.beginPath();
        ctx.moveTo(-hWidth / 2, -hHeight / 4);
        ctx.lineTo(-hWidth / 2 - 4, 0);
        ctx.lineTo(-hWidth / 2, hHeight / 4);
        ctx.moveTo(hWidth / 2, -hHeight / 4);
        ctx.lineTo(hWidth / 2 + 4, 0);
        ctx.lineTo(hWidth / 2, hHeight / 4);
        ctx.stroke();
        
        ctx.restore();
    } else if (currentWeapon === 'swing') {
        ctx.save();
        ctx.translate(startX + vibX, startY + vibY);
        // 조준 각도 방향에 맞춰 뒤로 젖힌 채 부르르 흔들리는 연출
        const shakeVal = (Math.random() - 0.5) * (tier * 0.8 + starLevel * 0.4);
        ctx.rotate(angle + Math.PI * 0.65 + shakeVal * 0.05);
        
        const activeColor = starLevel > 0 ? TIER_CONFIG.COLORS[Math.min(starLevel, TIER_CONFIG.MAX_LEVEL)] : (tier >= 10 ? ACCENT : '#ff3e00');
        ctx.shadowBlur = 12 + starLevel * 6;
        ctx.shadowColor = activeColor;
        ctx.strokeStyle = activeColor;
        ctx.fillStyle = activeColor;
        
        const hWidth = 32 + tier * 3 + starLevel * 3;
        const hHeight = 16 + tier * 2 + starLevel * 2;
        const hHandle = 32 + tier * 3 + starLevel * 3;
        ctx.lineWidth = 3 + (tier * 0.35);

        // 자루
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, hHandle);
        ctx.stroke();
        
        // 망치 머리
        ctx.beginPath();
        ctx.rect(-hWidth / 2, -hHeight / 2, hWidth, hHeight);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(-hWidth / 2 + 2, -hHeight / 2 + 2, hWidth - 4, hHeight - 4);
        
        ctx.restore();

        if (Math.random() < 0.2 + (starLevel * 0.05)) {
            ripples.push(new Ripple(startX, startY, 5 + tier * 2));
        }
    }

    if (starLevel > 0) {
        analysisPanel.classList.add('visible');
        ctx.save(); ctx.translate(startX + vibX, startY + vibY); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const glowColor = TIER_CONFIG.COLORS[Math.min(starLevel, TIER_CONFIG.MAX_LEVEL)];
        
        const p = 0.15 + pityBonus;
        const currentProbVal = (p * 100).toFixed(1);
        const expectedGain = Math.floor(3 * p * 1.9); 
        const potentialMax = Math.min(TIER_CONFIG.MAX_LEVEL, starLevel + expectedGain + (p > 0.3 ? 2 : 1));

        // Update Analysis Panel
        statTier.textContent = TIER_CONFIG.getName(starLevel);
        statTier.style.color = glowColor;
        statProb.textContent = `${currentProbVal}%`;
        const currentLimit = isOverloading ? 50 : (boss.active ? 120 : 800);
        statBar.style.width = `${Math.min(1, (Date.now() - lastEvolutionCheck) / currentLimit) * 100}%`;
        statBar.style.background = glowColor;
        statBar.style.boxShadow = `0 0 10px ${glowColor}`;
        
        const currentName = TIER_CONFIG.getName(starLevel);
        const predictName = TIER_CONFIG.getName(potentialMax);
        statPredict.textContent = `${currentName} ➔ ${predictName}+`;
        statPity.textContent = `+${(pityBonus * 100).toFixed(0)}%`;

        if (isOverloading) {
            statProb.textContent = 'OVERLOAD';
            statProb.style.color = '#ff0000';
            statProb.style.textShadow = '0 0 10px #ff0000';
        } else {
            statProb.textContent = `${currentProbVal}%`;
            statProb.style.color = '#ffffff';
            statProb.style.textShadow = 'none';
        }

        // Small Probability Sensor (Keep for immersion)
        if (starLevel < TIER_CONFIG.MAX_LEVEL) {
            ctx.font = '700 9px monospace';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillText(`PROBABILITY: ${currentProbVal}%`, 0, -150);
            const barW = 60;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.strokeRect(-barW/2, -142, barW, 2);
            ctx.fillStyle = glowColor; ctx.globalAlpha = 0.5;
            ctx.fillRect(-barW/2, -142, barW * Math.min(1, (Date.now() - lastEvolutionCheck) / 800), 2);
            ctx.globalAlpha = 1;
        }

        ctx.globalAlpha = 0.2; ctx.fillStyle = glowColor; ctx.beginPath(); ctx.roundRect(-100, -115, 200, 50, 10); ctx.fill();
        ctx.globalAlpha = 1; ctx.shadowBlur = 25; ctx.shadowColor = glowColor; ctx.fillStyle = glowColor;
        ctx.font = '900 32px sans-serif'; ctx.fillText(TIER_CONFIG.getName(starLevel), 0, -95);
        ctx.font = '700 11px sans-serif'; ctx.shadowBlur = 0;
        const labelText = starLevel < targetStarLevel ? 'EVOLVING...' : TIER_CONFIG.getLabel(starLevel);
        ctx.fillText(labelText, 0, -125); ctx.restore();
    } else {
        analysisPanel.classList.remove('visible');
    }

    if (tier > 0) {
        const maxSize = 120;
        const targetSize = Math.min(maxSize, 30 + tier * 5 + starLevel * 2);
        cursorOutline.style.width = targetSize + 'px';
        cursorOutline.style.height = targetSize + 'px';
        cursorOutline.style.borderColor = baseColor;
        
        // Increase opacity and sharpness of brackets as power grows
        const intensity = Math.min(1, (tier + starLevel / 5) / 15);
        cursorOutline.style.borderWidth = (0.5 + intensity * 1.5) + 'px';
        cursorOutline.style.boxShadow = `0 0 ${10 + intensity * 20}px ${baseColor}`;
    }
}

window.addEventListener('mousedown', (e) => {
    Sounds.resume();
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left; startY = e.clientY - rect.top;
    currentX = startX; currentY = startY; isDragging = true;
    chargeStartTime = Date.now(); starLevel = 0; isStarRolled = false;
    // Spawn orbit particles around the bow for visual feedback
    orbitParticles = [];
    const color = starLevel > 0 ? TIER_CONFIG.COLORS[Math.min(starLevel, TIER_CONFIG.MAX_LEVEL)] : ACCENT;
    for (let i = 0; i < 16; i++) {
        orbitParticles.push(new OrbitParticle(startX, startY, color));
    }
});

window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    cursorDot.style.left = mouseX + 'px';
    cursorDot.style.top = mouseY + 'px';

    // Update canvas-relative coordinates for gameplay logic (CCD, patterns, etc.)
    currentX = mouseX - rect.left;
    currentY = mouseY - rect.top;

    if (isDragging) {
        // Mirror the crosshair relative to startX to show where you're aiming
        const aimX = startX + (startX - currentX);
        const aimY = startY + (startY - currentY);
        
        cursorOutline.style.left = (aimX + rect.left) + 'px';
        cursorOutline.style.top = (aimY + rect.top) + 'px';
    } else {
        cursorOutline.style.left = mouseX + 'px';
        cursorOutline.style.top = mouseY + 'px';
    }
});

window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    const dx = startX - currentX, dy = startY - currentY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 15) {
        const limitedDist = Math.min(dist, MAX_PULL);
        const angle = Math.atan2(dy, dx);
        const timeCharged = Date.now() - chargeStartTime;
        const tier = Math.min(10, Math.floor(limitedDist / 30) + Math.floor(timeCharged / 400));
        const power = 0.1 + (tier * 0.05) + (starLevel * 0.02);
        
        if (currentWeapon === 'bow') {
            const arrow = new Arrow(startX, startY, Math.cos(angle) * limitedDist * power, Math.sin(angle) * limitedDist * power, tier, starLevel);
            arrows.push(arrow);
            if (isCoop) {
                sendData({
                    type: 'shoot',
                    weapon: 'bow',
                    arrow: { x: startX, y: startY, angle: angle, power: power, tier: tier, stars: starLevel }
                });
            }
            shakeAmount = 1 + (tier * 0.5) + (starLevel * 1);
            Sounds.fire(tier); if (starLevel >= 10) impactFlash = 1;
        } else if (currentWeapon === 'hammer') {
            if (!isHammerThrown) {
                const hammer = new HammerProjectile(startX, startY, Math.cos(angle) * limitedDist * power, Math.sin(angle) * limitedDist * power, tier, starLevel);
                hammers.push(hammer);
                if (isCoop) {
                    sendData({
                        type: 'shoot',
                        weapon: 'hammer',
                        hammer: { x: startX, y: startY, tx: startX + Math.cos(angle) * 100, ty: startY + Math.sin(angle) * 100, tier: tier, stars: starLevel, vx: hammer.vx, vy: hammer.vy, state: hammer.state }
                    });
                }
                isHammerThrown = true;
                shakeAmount = 5 + (tier * 1) + (starLevel * 2);
                Sounds.fire(tier); if (starLevel >= 10) impactFlash = 1;
            }
        } else if (currentWeapon === 'swing') {
            const targetAimX = startX + Math.cos(angle) * 100;
            const targetAimY = startY + Math.sin(angle) * 100;
            swings.push(new HammerSwing(startX, startY, targetAimX, targetAimY, tier, starLevel));
            shakeAmount = 8 + (tier * 2) + (starLevel * 3);
            Sounds.fire(tier + 2); // 묵직하게 한 옥타브 높은 충격음
            if (starLevel >= 10) impactFlash = 1;
        }
    }
    isDragging = false; cursorOutline.style.width = '30px'; cursorOutline.style.height = '30px';
    analysisPanel.classList.remove('visible');
    starLevel = 0; isStarRolled = false;
    // release orbit particles so they drift and fade
    orbitParticles.forEach(p => p.release());
});

function drawCinematicEffects() {
    const chargeRatio = isDragging ? Math.min(1, (Date.now() - chargeStartTime) / 4000) : 0;
    const intensity = chargeRatio * (1 + starLevel / 10);
    if (intensity > 0.1) {
        ctx.save();
        const grd = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 200, canvas.width / 2, canvas.height / 2, 800);
        grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, `rgba(0,0,0,${intensity * 0.4})`);
        ctx.fillStyle = grd; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
    }
    if (intensity > 0.6) {
        ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${(intensity - 0.6) * 0.2})`; ctx.lineWidth = 0.5;
        for (let i = 0; i < 20; i++) {
            const angle = (Math.random() * Math.PI * 2); const len = 100 + Math.random() * 400;
            ctx.beginPath(); ctx.moveTo(Math.cos(angle) * 300, Math.sin(angle) * 300);
            ctx.lineTo(Math.cos(angle) * (300 + len), Math.sin(angle) * (300 + len)); ctx.stroke();
        }
        ctx.restore();
    }
    if (impactFlash > 0) {
        ctx.save(); ctx.fillStyle = `rgba(255, 255, 255, ${impactFlash * 0.2})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore(); impactFlash -= 0.05;
    }
}

// --- Multiplayer Functions ---
function initMultiplayer() {
    const peerIdDisplay = document.getElementById('peer-id-display');
    const remoteIdInput = document.getElementById('remote-id-input');
    const connectBtn = document.getElementById('connect-btn');
    const statusDisplay = document.getElementById('connection-status');

    peer = new Peer();

    peer.on('open', (id) => {
        myId = id;
        peerIdDisplay.innerText = `ID: ${id}`;
        statusDisplay.innerText = 'Ready to connect';
    });

    const copyBtn = document.getElementById('copy-id-btn');
    copyBtn.addEventListener('click', () => {
        if (!myId) return;
        navigator.clipboard.writeText(myId).then(() => {
            const originalText = copyBtn.innerText;
            copyBtn.innerText = 'COPIED!';
            copyBtn.style.background = '#00ff88';
            setTimeout(() => {
                copyBtn.innerText = originalText;
                copyBtn.style.background = '';
            }, 2000);
        });
    });

    peer.on('connection', (c) => {
        if (conn) conn.close();
        conn = c;
        setupConnection();
        isHost = true;
        statusDisplay.innerText = 'FRIEND CONNECTED';
        isCoop = true;
    });

    connectBtn.addEventListener('click', () => {
        const remoteId = remoteIdInput.value;
        if (!remoteId) return;
        
        if (conn) conn.close();
        conn = peer.connect(remoteId);
        setupConnection();
        isHost = false;
        statusDisplay.innerText = 'CONNECTING...';
    });

    peer.on('error', (err) => {
        statusDisplay.innerText = `Error: ${err.type}`;
    });
}

function setupConnection() {
    conn.on('open', () => {
        document.getElementById('connection-status').innerText = 'CONNECTED';
        isCoop = true;
        sendData({ type: 'sync_request' });
    });

    conn.on('data', (data) => {
        handleIncomingData(data);
    });

    conn.on('close', () => {
        document.getElementById('connection-status').innerText = 'DISCONNECTED';
        remotePlayer.active = false;
        isCoop = false;
        conn = null;
    });
}

function sendData(data) {
    if (conn && conn.open) {
        conn.send(data);
    }
}

function handleIncomingData(data) {
    switch (data.type) {
        case 'player_pos':
            remotePlayer.x = data.x;
            remotePlayer.y = data.y;
            remotePlayer.active = true;
            remotePlayer.weapon = data.weapon;
            remotePlayer.isCharging = data.isCharging;
            remotePlayer.chargeProgress = data.chargeProgress;
            break;
        case 'player_hp':
            remotePlayer.hp = data.hp;
            break;
        case 'shoot':
            if (data.weapon === 'bow') {
                arrows.push(new Arrow(data.arrow.x, data.arrow.y, data.arrow.angle, data.arrow.power, data.arrow.tier, data.arrow.stars, true));
            } else if (data.weapon === 'hammer') {
                const h = new HammerProjectile(data.hammer.x, data.hammer.y, data.hammer.vx, data.hammer.vy, data.hammer.tier, data.hammer.stars, true);
                h.state = data.hammer.state;
                hammers.push(h);
            }
            Sounds.fire(data.power || 1);
            break;
        case 'boss_sync':
            if (!isHost) {
                boss.hp = data.hp;
                boss.active = data.active;
                boss.x = data.x;
                boss.y = data.y;
                if (data.active) {
                    bossHpContainer.classList.remove('hidden');
                    bossHpFill.style.width = (boss.hp / boss.maxHp * 100) + '%';
                } else {
                    bossHpContainer.classList.add('hidden');
                }
            }
            break;
        case 'pvp_hit':
            // Take damage if in PvP mode OR if the other person is attacking you while connected
            if (Date.now() > invulnerableUntil) {
                playerHP -= data.damage;
                shockwaves.push(new Ripple(data.x, data.y, 50));
                floatingTexts.push(new FloatingText(data.x, data.y, `${Math.floor(data.damage)}`, '#ff003c', data.damage > 50));
                updateHPBar();
            }
            break;
        case 'boss_damage':
            if (isHost) {
                boss.hp -= data.damage;
                bossHpFill.style.width = (boss.hp / boss.maxHp * 100) + '%';
                if (boss.hp <= 0) {
                    boss.active = false;
                    bossHpContainer.classList.add('hidden');
                }
            }
            break;
        case 'pvp_request':
            document.getElementById('pvp-request-panel').classList.remove('hidden');
            break;
        case 'pvp_accept':
            isPvP = true;
            document.getElementById('pvp-mode-btn').textContent = 'LEAVE ARENA';
            document.getElementById('pvp-mode-btn').classList.add('active');
            startCountdown();
            break;
        case 'pvp_decline':
            alert("Duel request declined.");
            break;
    }
}

function drawRemotePlayer() {
    if (!remotePlayer.active) return;
    ctx.save();
    ctx.translate(remotePlayer.x, remotePlayer.y);
    
    // Draw remote player body (as a simple archer silhouette)
    ctx.fillStyle = '#ff3e00';
    ctx.globalAlpha = 0.8;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff3e00';
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    
    // HP Bar UI above player
    const barWidth = 40;
    const barHeight = 4;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(-barWidth/2, -30, barWidth, barHeight);
    
    const hpRatio = Math.max(0, remotePlayer.hp / remotePlayer.maxHp);
    ctx.fillStyle = hpRatio > 0.3 ? '#00ffd2' : '#ff003c';
    ctx.fillRect(-barWidth/2, -30, barWidth * hpRatio, barHeight);
    
    // HP Percentage Text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 10px Inter';
    ctx.textAlign = 'center';
    ctx.globalAlpha = 1.0;
    ctx.fillText(`${Math.ceil(hpRatio * 100)}%`, 0, -35);
    
    ctx.restore();
}

initMultiplayer();

function update(timestamp) {
    // High Refresh Rate Fix: Calculate Delta Time
    const currentTime = timestamp || performance.now();
    dt = Math.min((currentTime - lastTime) / (1000 / 60), 3.0); // Cap at 3x to prevent huge jumps
    lastTime = currentTime;

    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Multiplayer Sync
    if (isCoop) {
        sendData({
            type: 'player_pos',
            x: currentX || 50,
            y: currentY || 300,
            weapon: currentWeapon,
            isCharging: isDragging,
            chargeProgress: chargeStartTime ? (Date.now() - chargeStartTime) / 1000 : 0
        });
        
        if (isHost && boss.active) {
            sendData({
                type: 'boss_sync',
                hp: boss.hp,
                active: boss.active,
                x: boss.x,
                y: boss.y
            });
        }
    }

    if (shakeAmount > 0) { 
        ctx.translate((Math.random() - 0.5) * shakeAmount, (Math.random() - 0.5) * shakeAmount); 
        shakeAmount *= Math.pow(0.85, dt); 
    }
    drawTarget();
    drawRemotePlayer();
    // (Existing filters remain the same as they call .update() which we'll fix in the classes)
    if (particles.length > 500) particles.splice(0, particles.length - 500);
    particles = particles.filter(p => { p.draw(); return p.update(); });
    ripples = ripples.filter(r => { r.draw(); return r.update(); });
    bolts = bolts.filter(b => { b.draw(); return b.update(); });
    orbitParticles = orbitParticles.filter(op => { op.draw(); return op.update(startX || currentX || canvas.width/2, startY || currentY || canvas.height/2); });
    vortexParticles = vortexParticles.filter(vp => { vp.draw(); return vp.update(); });
    shockwaves = shockwaves.filter(s => { s.draw(); return s.update(); });
    bossProjectiles = bossProjectiles.filter(bp => { bp.draw(); return bp.update(); });
    drawBow();
    arrows = arrows.filter(a => {
        a.draw();
        a.update();
        
        // PvP Collision Check (Only my projectiles can hit the remote player)
        if (isPvP && remotePlayer.active && !a.isStuck && !a.isRemote) {
            const dx = a.x - remotePlayer.x;
            const dy = a.y - remotePlayer.y;
            if (Math.sqrt(dx * dx + dy * dy) < 30) {
                const damage = (5 + (a.tier * 2)) * (1 + (a.stars * 0.5));
                sendData({ type: 'pvp_hit', damage: damage, x: a.x, y: a.y });
                return false; // Destroy arrow on hit
            }
        }
        return !a.isStuck || (a.isStuck && Date.now() - (a.hitTime || 0) < 1000);
    });
    
    hammers = hammers.filter(h => { 
        const active = h.update(); 
        h.draw(); 
        
        // PvP Collision Check for Hammers (Only my projectiles can hit the remote player)
        if (isPvP && remotePlayer.active && h.state === 'flying' && !h.isRemote) {
            const dx = h.x - remotePlayer.x;
            const dy = h.y - remotePlayer.y;
            if (Math.sqrt(dx * dx + dy * dy) < 40) {
                const damage = (10 + (h.tier * 5)) * (1 + (h.stars * 1.0));
                sendData({ type: 'pvp_hit', damage: damage, x: h.x, y: h.y });
                h.state = 'returning';
            }
        }
        return active;
    });
    swings = swings.filter(s => { s.draw(); return s.update(); });
    floatingTexts = floatingTexts.filter(ft => { ft.draw(); return ft.update(); });
    drawCinematicEffects();

    // Floor Patterns (Drawn on top of cinematic effects for visibility)
    if (boss.active) {
        // 보스 차징 공격 트리거 (보스 액티브 상태이고, 그로기가 아니며, 차징 중이 아닐 때 6초 쿨타임마다 작동)
        if (!boss.isGroggy && !boss.isCharging && Date.now() - boss.lastChargeAttackTime > 6000) {
            boss.isCharging = true;
            boss.chargeStartTime = Date.now();
            boss.starLevel = 1;
            boss.lastStarUpdateTime = Date.now();
            boss.targetX = currentX || 500;
            boss.targetY = currentY || 300;
            Sounds.overload(); // 웅장한 충전 경보음
        }

        if (!boss.isGroggy && Math.random() < 0.015 * dt) {
            floorPatterns.push(new VoidPattern(currentX || 500, currentY || 300));
        }
        floorPatterns = floorPatterns.filter(p => {
            const active = p.update();
            p.draw();
            if (p.isExploded && p.timer === p.duration) {
                const dx = (currentX || 0) - p.x, dy = (currentY || 0) - p.y;
                if (Math.sqrt(dx * dx + dy * dy) < p.radius && Date.now() > invulnerableUntil) {
                    playerHP -= 20;
                    updateHPBar();
                    impactFlash = 0.5; shakeAmount = 40;
                }
            }
            return active;
        });
    }
    if (combo > 1 && Date.now() - lastHitTime < 1500) {
        if (comboDisplay.textContent !== `${combo} STREAK`) {
            comboDisplay.textContent = `${combo} STREAK`; comboDisplay.classList.remove('pop');
            void comboDisplay.offsetWidth; comboDisplay.classList.add('pop');
        }
    } else comboDisplay.classList.remove('pop');

    // request permission for next frame
    requestAnimationFrame(update);
}

// Consolidated into the single mousemove listener above

function startCountdown(callback) {
    const countdownEl = document.getElementById('intro-countdown');
    countdownEl.classList.remove('hidden');
    countdownRemaining = 3;
    invulnerableUntil = Date.now() + 4000; // 3s countdown + 1s grace
    
    const interval = setInterval(() => {
        countdownEl.innerText = countdownRemaining;
        if (countdownRemaining <= 0) {
            clearInterval(interval);
            countdownEl.classList.add('hidden');
            if (callback) callback();
        }
        countdownRemaining--;
    }, 1000);
}

bossModeBtn.addEventListener('click', () => {
    if (isPvP) return; // Can't enter boss during PvP
    boss.active = !boss.active;
    if (boss.active) {
        startCountdown(() => {
            boss.hp = boss.maxHp;
            bossHpFill.style.width = '100%';
            bossHpContainer.classList.remove('hidden');
        });
        bossModeBtn.textContent = 'EXIT RIFT';
        bossModeBtn.classList.add('active');
    } else {
        bossHpContainer.classList.add('hidden');
        bossModeBtn.textContent = 'ENTER BOSS RIFT';
        bossModeBtn.classList.remove('active');
    }
});

const pvpModeBtn = document.getElementById('pvp-mode-btn');
pvpModeBtn.addEventListener('click', () => {
    if (boss.active) return;
    if (isPvP) {
        isPvP = false;
        pvpModeBtn.textContent = 'DUEL ARENA';
        pvpModeBtn.classList.remove('active');
    } else {
        if (isCoop) {
            sendData({ type: 'pvp_request' });
            pvpModeBtn.textContent = 'REQUESTING...';
        } else {
            alert("Connect with a friend first!");
        }
    }
});

const pvpAcceptBtn = document.getElementById('pvp-accept-btn');
const pvpDeclineBtn = document.getElementById('pvp-decline-btn');

pvpAcceptBtn.addEventListener('click', () => {
    document.getElementById('pvp-request-panel').classList.add('hidden');
    isPvP = true;
    pvpModeBtn.textContent = 'LEAVE ARENA';
    pvpModeBtn.classList.add('active');
    sendData({ type: 'pvp_accept' });
    startCountdown();
    playerHP = 100;
    isDead = false;
    updateHPBar();
});

pvpDeclineBtn.addEventListener('click', () => {
    document.getElementById('pvp-request-panel').classList.add('hidden');
    sendData({ type: 'pvp_decline' });
});

function updateHPBar() {
    const hpPercent = Math.max(0, (playerHP / maxPlayerHP) * 100);
    document.getElementById('player-hp-fill').style.width = hpPercent + '%';
    document.getElementById('player-hp-percent').innerText = Math.ceil(hpPercent) + '%';
    
    if (isCoop) {
        sendData({ type: 'player_hp', hp: playerHP });
    }
    
    if (playerHP <= 0 && !isDead) {
        isDead = true;
        Sounds.overload(); // Play a sound for death
        floatingTexts.push(new FloatingText(currentX || canvas.width/2, currentY || canvas.height/2, "REJECTED", "#ff003c", true));
        
        setTimeout(() => {
            playerHP = 100;
            isDead = false;
            updateHPBar();
        }, 3000);
    }
}

// Weapon Selector Event Listeners
const bowBtn = document.getElementById('weapon-bow-btn');
const hammerBtn = document.getElementById('weapon-hammer-btn');
const swingBtn = document.getElementById('weapon-swing-btn');

bowBtn.addEventListener('click', () => {
    if (isDragging) return;
    currentWeapon = 'bow';
    bowBtn.classList.add('active');
    hammerBtn.classList.remove('active');
    swingBtn.classList.remove('active');
    isHammerThrown = false;
    hammers = [];
    swings = [];
    Sounds.charge(1);
});

hammerBtn.addEventListener('click', () => {
    if (isDragging) return;
    currentWeapon = 'hammer';
    hammerBtn.classList.add('active');
    bowBtn.classList.remove('active');
    swingBtn.classList.remove('active');
    isHammerThrown = false;
    hammers = [];
    swings = [];
    Sounds.overload();
});

swingBtn.addEventListener('click', () => {
    if (isDragging) return;
    currentWeapon = 'swing';
    swingBtn.classList.add('active');
    bowBtn.classList.remove('active');
    hammerBtn.classList.remove('active');
    isHammerThrown = false;
    hammers = [];
    swings = [];
    Sounds.overload();
});

// Initial cursor state fix
cursorDot.style.opacity = '1';
cursorOutline.style.opacity = '1';
cursorDot.style.left = '50%';
cursorDot.style.top = '50%';
cursorOutline.style.left = '50%';
cursorOutline.style.top = '50%';

requestAnimationFrame(update);
