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

canvas.width = 1000;
canvas.height = 600;

let score = 0;
let isDragging = false;
let startX, startY, currentX, currentY;
let arrows = [];
let target = { x: 800, y: 300, radius: 30, speed: 1.5, direction: 1 };
let boss = { active: false, hp: 500000000, maxHp: 500000000, x: 800, y: 300, radius: 80, phase: 1, lastTeleport: 0, teleportCount: 0, isGroggy: false, groggyEndTime: 0, isCharging: false, chargeStartTime: 0, lastChargeAttackTime: 0, targetX: 0, targetY: 0, starLevel: 0, lastStarUpdateTime: 0 };
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
    update() { this.life -= 0.1; return this.life > 0; }
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
        this.x += this.vx; this.y += this.vy;
        this.life -= 0.02;
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
        this.timer++;
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
        this.r += 2;
        this.life -= 0.02;
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
        this.x = x + (Math.random() - 0.5) * 20;
        this.y = y - 10;
        this.text = text;
        this.color = color;
        this.isCrit = isCrit;
        this.life = 1.0;
        this.vy = isCrit ? -2.5 : -1.5;
        this.vx = (Math.random() - 0.5) * 1.5;
        this.size = isCrit ? 22 : 14;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy *= 0.98;
        this.life -= 0.02;
        return this.life > 0;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (this.isCrit) {
            ctx.font = `900 ${this.size}px monospace`;
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.color;
            ctx.fillStyle = this.color;
            ctx.fillText(this.text, this.x, this.y);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeText(this.text, this.x, this.y);
        } else {
            ctx.font = `700 ${this.size}px monospace`;
            ctx.fillStyle = this.color;
            ctx.fillText(this.text, this.x, this.y);
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
        this.r += (this.maxR - this.r) * 0.15 + 1;
        this.life -= 0.04;
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
        this.x += this.vx;
        this.y += this.vy;
        
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
    constructor(x, y, vx, vy, tier, stars) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.tier = tier;
        this.stars = stars;
        this.isStuck = false;
    }
    update() {
        if (this.isStuck) return;
        
        const oldX = this.x, oldY = this.y;
        
        // Boss Gravity Pattern (Disabled during Groggy)
        if (boss.active && !boss.isGroggy) {
            const bdx = boss.x - this.x, bdy = boss.y - this.y;
            const bdist = Math.sqrt(bdx * bdx + bdy * bdy);
            if (bdist < 400) {
                const force = (1 - bdist / 400) * 0.2;
                this.vx += bdx * force * 0.05;
                this.vy += bdy * force * 0.05;
            }
        }

        this.x += this.vx; this.y += this.vy;
        this.vy += GRAVITY * (1 - (this.tier / 12));

        if (this.tier > 5 && Math.random() > 0.5) ripples.push(new Ripple(this.x, this.y, this.tier / 2));
        
        // 화살 비행 잔상 궤적 추가
        if (Math.random() > 0.3) {
            const trailColor = this.stars > 0 ? TIER_CONFIG.COLORS[Math.min(this.stars, TIER_CONFIG.MAX_LEVEL)] : (this.tier >= 10 ? ACCENT : 'rgba(255, 255, 255, 0.4)');
            particles.push(new Particle(this.x, this.y, -this.vx * 0.2 + (Math.random() - 0.5) * 1, -this.vy * 0.2 + (Math.random() - 0.5) * 1, trailColor));
        }

        // Sub-stepping to prevent tunneling
        const steps = Math.ceil(Math.sqrt(this.vx * this.vx + this.vy * this.vy) / (target.radius * 0.5));
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const checkX = oldX + (this.x - oldX) * t;
            const checkY = oldY + (this.y - oldY) * t;
            
            const dx = checkX - (boss.active ? boss.x : target.x);
            const dy = checkY - (boss.active ? boss.y : target.y);
            const hitRadius = boss.active ? boss.radius : target.radius;

            if (Math.sqrt(dx * dx + dy * dy) < hitRadius) {
                this.x = checkX; this.y = checkY;
                this.isStuck = true; this.vx = 0; this.vy = 0;
                combo++; lastHitTime = Date.now();
                const starBonus = this.stars > 0 ? TIER_CONFIG.getPower(this.stars) : 1;
                let damage = (10 + (this.tier * 20)) * (1 + (combo * 0.1)) * starBonus;
                let isCrit = false;
                
                if (boss.active) {
                    if (boss.isGroggy) {
                        damage *= 2.5; // Massive damage boost during Groggy!
                        isCrit = true;
                    }
                    boss.hp = Math.max(0, boss.hp - damage);
                    bossHpFill.style.width = (boss.hp / boss.maxHp * 100) + '%';
                    if (boss.hp <= 0) {
                        boss.active = false; bossHpContainer.classList.add('hidden');
                        bossModeBtn.textContent = 'RIFT CONQUERED';
                        impactFlash = 1.5; shakeAmount = 100;
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
    constructor(x, y, vx, vy, tier, stars) {
        this.x = x;
        this.y = y;
        this.vx = vx * 1.4; // 망치는 묵직하게 더 빠르게 날아감
        this.vy = vy * 1.1;
        this.tier = tier;
        this.stars = stars;
        this.state = 'flying'; // 'flying' | 'returning'
        this.angle = 0;
        this.rotSpeed = 0.15 + (tier * 0.02) + (stars * 0.05);
        this.width = 24 + tier * 2 + stars * 3;
        this.height = 14 + tier * 1.5 + stars * 2;
        this.handleLen = 25 + tier * 2 + stars * 3;
        this.maxDist = 650 + (tier * 30);
        this.flyDist = 0;
    }
    update() {
        this.angle += this.rotSpeed;
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
            this.x += this.vx;
            this.y += this.vy;
            this.vy += GRAVITY * 0.3; // 중력을 무겁게 적용
            this.flyDist += Math.sqrt(this.vx * this.vx + this.vy * this.vy);

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
            this.x += this.vx;
            this.y += this.vy;
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
        // Check Groggy Expiry
        if (boss.isGroggy && Date.now() > boss.groggyEndTime) {
            boss.isGroggy = false;
            boss.lastTeleport = Date.now();
        }

        // Pattern: Floating & Teleport (Disabled during Groggy / Charging)
        if (!boss.isGroggy && !boss.isCharging && Date.now() - boss.lastTeleport > 4000) {
            boss.teleportCount++;
            if (boss.teleportCount >= 4) {
                boss.isGroggy = true;
                boss.groggyEndTime = Date.now() + 6000; // 6 seconds groggy
                boss.teleportCount = 0;
                Sounds.overload();
                impactFlash = 0.5;
            } else {
                boss.x = 600 + Math.random() * 300;
                boss.y = 100 + Math.random() * 400;
                boss.lastTeleport = Date.now();
                impactFlash = 0.3;
            }
        }

        if (boss.isCharging) {
            boss.lastTeleport = Date.now(); // 차징 중에는 텔레포트 쿨타임 리셋
        } else {
            boss.y += Math.sin(Date.now() / 1000) * (boss.isGroggy ? 0.3 : (boss.hp < boss.maxHp * 0.7 ? 2 : 1));
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
            arrows.push(new Arrow(startX, startY, Math.cos(angle) * limitedDist * power, Math.sin(angle) * limitedDist * power, tier, starLevel));
            shakeAmount = 1 + (tier * 0.5) + (starLevel * 1);
            Sounds.fire(tier); if (starLevel >= 10) impactFlash = 1;
        } else if (currentWeapon === 'hammer') {
            if (!isHammerThrown) {
                hammers.push(new HammerProjectile(startX, startY, Math.cos(angle) * limitedDist * power, Math.sin(angle) * limitedDist * power, tier, starLevel));
                isHammerThrown = true;
                shakeAmount = 5 + (tier * 1) + (starLevel * 2);
                // 망치 발사 시 웅장하게 천둥 소리 재생
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

function update() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (shakeAmount > 0) { ctx.translate((Math.random() - 0.5) * shakeAmount, (Math.random() - 0.5) * shakeAmount); shakeAmount *= 0.85; }
    drawTarget();
    particles = particles.filter(p => { p.draw(); return p.update(); });
    ripples = ripples.filter(r => { r.draw(); return r.update(); });
    bolts = bolts.filter(b => { b.draw(); return b.update(); });
    orbitParticles = orbitParticles.filter(op => { op.draw(); return op.update(startX || currentX || canvas.width/2, startY || currentY || canvas.height/2); });
    vortexParticles = vortexParticles.filter(vp => { vp.draw(); return vp.update(); });
    shockwaves = shockwaves.filter(s => { s.draw(); return s.update(); });
    bossProjectiles = bossProjectiles.filter(bp => { bp.draw(); return bp.update(); });
    drawBow();
    arrows.forEach(a => { a.draw(); a.update(); });
    hammers = hammers.filter(h => { h.draw(); return h.update(); });
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

        if (!boss.isGroggy && Math.random() < 0.015) {
            floorPatterns.push(new VoidPattern(currentX || 500, currentY || 300));
        }
        floorPatterns = floorPatterns.filter(p => {
            const active = p.update();
            p.draw();
            if (p.isExploded && p.timer === p.duration) {
                const dx = (currentX || 0) - p.x, dy = (currentY || 0) - p.y;
                if (Math.sqrt(dx * dx + dy * dy) < p.radius) {
                    playerHP -= 20;
                    document.getElementById('player-hp-fill').style.width = (playerHP / maxPlayerHP * 100) + '%';
                    impactFlash = 0.5; shakeAmount = 40;
                    if (playerHP <= 0) {
                        boss.active = false;
                        bossHpContainer.classList.add('hidden');
                        bossModeBtn.textContent = 'RIFT REJECTED';
                        playerHP = 100;
                        document.getElementById('player-hp-fill').style.width = '100%';
                    }
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
    requestAnimationFrame(update);
}

// Consolidated into the single mousemove listener above

bossModeBtn.addEventListener('click', () => {
    boss.active = !boss.active;
    if (boss.active) {
        boss.hp = boss.maxHp;
        bossHpFill.style.width = '100%';
        bossHpContainer.classList.remove('hidden');
        bossModeBtn.textContent = 'EXIT RIFT';
    } else {
        bossHpContainer.classList.add('hidden');
        bossModeBtn.textContent = 'ENTER BOSS RIFT';
    }
});

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

update();
