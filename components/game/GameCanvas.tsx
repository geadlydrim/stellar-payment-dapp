'use client';

import { useEffect, useRef } from 'react';
import {
  WEAPON_ANIM,
  TIER_COLORS,
  type Tier,
  type WeaponType,
} from '@/lib/game';
import {
  drawSprite,
  drawWeaponAtGrip,
  getHeroFrame,
  getDummyFrame,
  getWeaponSprite,
  getArrowSprite,
  getBoltSprite,
  getSpark,
  getDust,
  WEAPON_GRIP,
  WEAPON_REST_ANGLE,
} from './pixel/sprites';

export interface EquippedWeaponView {
  weaponType: WeaponType;
  tier: Tier;
  damage: number;
  effectiveDamage: number;
  buffActive: boolean;
}

interface GameCanvasProps {
  equipped: EquippedWeaponView | null;
  /** Display size (upscaled). Default 1260×560 (4× 315×140 buffer). */
  width?: number;
  height?: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  kind: 'arrow' | 'bolt';
  damage: number;
  tier: Tier;
  alive: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  kind: 'spark' | 'dust' | 'straw';
  tier?: Tier;
}

interface AttackState {
  active: boolean;
  progress: number;
  weaponType: WeaponType;
  hitApplied: boolean;
}

/** +75% over original 180×80; 4× upscale → 1260×560 display. */
const BUF_W = 315;
const BUF_H = 140;
const FLOOR_Y = 110;
/** Draw baked 1× sprites at 2× so actors keep visual size in the larger buffer. */
const SPRITE_SCALE = 2;
const PLAYER_W = 28;
const PLAYER_H = 30;
const DUMMY_W = 28;
const DUMMY_H = 44;
const DUMMY_MAX_HP = 200;
const MOVE_SPEED = 96;

const REACH: Record<WeaponType, { reach: number; hitW: number }> = {
  sword: { reach: 24, hitW: 22 },
  dagger: { reach: 16, hitW: 12 },
  bow: { reach: 0, hitW: 0 },
  staff: { reach: 0, hitW: 0 },
  spear: { reach: 36, hitW: 16 },
};

export function GameCanvas({
  equipped,
  width = 1260,
  height = 560,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const equippedRef = useRef(equipped);
  equippedRef.current = equipped;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const buf = document.createElement('canvas');
    buf.width = BUF_W;
    buf.height = BUF_H;
    const bctx = buf.getContext('2d')!;
    bctx.imageSmoothingEnabled = false;

    const keys = new Set<string>();
    let playerX = 48;
    let facing = 1;
    let moving = false;
    let animTimer = 0;
    let dummyHp = DUMMY_MAX_HP;
    let dummyFlash = 0;
    let dummyWobble = 0;
    let dummyRegenTimer = 0;
    let cooldown = 0;
    let attack: AttackState | null = null;
    let shake = 0;
    let camX = 0;
    const floats: FloatText[] = [];
    const projectiles: Projectile[] = [];
    const particles: Particle[] = [];
    let last = performance.now();
    let raf = 0;
    let running = true;
    let time = 0;

    const stars = Array.from({ length: 48 }, (_, i) => ({
      x: (i * 47 + 13) % BUF_W,
      y: (i * 31 + 7) % (FLOOR_Y - 12),
      tw: (i * 0.37) % 1,
      layer: i % 2,
    }));

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (
        k === 'a' ||
        k === 'd' ||
        k === ' ' ||
        k === 'arrowleft' ||
        k === 'arrowright'
      ) {
        e.preventDefault();
      }
      keys.add(k);
      if (k === ' ' || k === 'j') tryAttack();
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onBlur = () => keys.clear();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    function spawnParticles(
      x: number,
      y: number,
      kind: Particle['kind'],
      n: number,
      tier?: Tier
    ) {
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 18 + Math.random() * 50;
        particles.push({
          x,
          y,
          vx: Math.cos(ang) * sp * (kind === 'dust' ? 0.4 : 1),
          vy:
            Math.sin(ang) * sp * (kind === 'dust' ? 0.3 : 1) -
            (kind === 'straw' ? 25 : 0),
          life: 0.25 + Math.random() * 0.35,
          maxLife: 0.5,
          kind,
          tier,
        });
      }
    }

    function tryAttack() {
      const eq = equippedRef.current;
      if (!eq || cooldown > 0 || (attack && attack.active)) return;
      const anim = WEAPON_ANIM[eq.weaponType];
      attack = {
        active: true,
        progress: 0,
        weaponType: eq.weaponType,
        hitApplied: false,
      };
      cooldown = anim.cooldownMs / 1000;

      if (anim.projectile) {
        const kind = eq.weaponType === 'bow' ? 'arrow' : 'bolt';
        projectiles.push({
          x: playerX + facing * 14,
          y: FLOOR_Y - PLAYER_H * 0.55,
          vx: facing * (kind === 'arrow' ? 180 : 155),
          kind,
          damage: eq.effectiveDamage,
          tier: eq.tier,
          alive: true,
        });
      }
    }

    function damageDummy(amount: number, fromX: number, tier?: Tier) {
      dummyHp = Math.max(0, dummyHp - amount);
      dummyFlash = 0.22;
      dummyWobble = 0.35;
      shake = Math.min(5, 2 + amount / 18);
      spawnParticles(fromX, FLOOR_Y - DUMMY_H * 0.5, 'spark', 7, tier);
      spawnParticles(fromX, FLOOR_Y - DUMMY_H * 0.4, 'straw', 5);
      floats.push({
        x: fromX,
        y: FLOOR_Y - DUMMY_H - 6,
        text: `-${amount}`,
        life: 0.9,
        color: '#ff6b4a',
      });
      if (dummyHp <= 0) {
        dummyRegenTimer = 1.2;
        shake = 6;
        floats.push({
          x: fromX,
          y: FLOOR_Y - DUMMY_H - 18,
          text: 'RESET',
          life: 1.1,
          color: '#f59e0b',
        });
      }
    }

    function meleeHitCheck() {
      if (!attack || attack.hitApplied) return;
      const eq = equippedRef.current;
      if (!eq) return;
      if (WEAPON_ANIM[attack.weaponType].projectile) return;
      if (attack.progress < 0.35 || attack.progress > 0.75) return;

      const dummyX = BUF_W - 40;
      const { reach, hitW } = REACH[attack.weaponType];
      const hitLeft =
        facing === 1
          ? playerX + PLAYER_W / 2
          : playerX - PLAYER_W / 2 - reach;
      const hitRight = hitLeft + (facing === 1 ? reach + hitW * 0.3 : reach);
      const dummyLeft = dummyX - DUMMY_W / 2;
      const dummyRight = dummyX + DUMMY_W / 2;

      if (hitRight > dummyLeft && hitLeft < dummyRight) {
        attack.hitApplied = true;
        damageDummy(eq.effectiveDamage, dummyX, eq.tier);
      }
    }

    function tick(now: number) {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;

      const dummyX = BUF_W - 40;

      let vx = 0;
      if (keys.has('a') || keys.has('arrowleft')) vx -= 1;
      if (keys.has('d') || keys.has('arrowright')) vx += 1;
      moving = vx !== 0;
      if (moving) {
        facing = vx > 0 ? 1 : -1;
        playerX += vx * MOVE_SPEED * dt;
        animTimer += dt;
        if (Math.random() < dt * 8) {
          spawnParticles(playerX, FLOOR_Y - 1, 'dust', 1);
        }
      } else {
        animTimer += dt * 0.5;
      }
      playerX = Math.max(16, Math.min(BUF_W - 70, playerX));
      camX = playerX * 0.04;

      if (cooldown > 0) cooldown -= dt;
      if (shake > 0) shake = Math.max(0, shake - dt * 12);
      if (dummyWobble > 0) dummyWobble = Math.max(0, dummyWobble - dt);

      if (attack?.active) {
        const dur = WEAPON_ANIM[attack.weaponType].durationMs / 1000;
        attack.progress += dt / dur;
        meleeHitCheck();
        if (attack.progress >= 1) attack = null;
      }

      for (const p of projectiles) {
        if (!p.alive) continue;
        p.x += p.vx * dt;
        const dummyLeft = dummyX - DUMMY_W / 2;
        const dummyRight = dummyX + DUMMY_W / 2;
        const dummyTop = FLOOR_Y - DUMMY_H;
        if (
          p.x > dummyLeft &&
          p.x < dummyRight &&
          p.y > dummyTop &&
          p.y < FLOOR_Y
        ) {
          p.alive = false;
          damageDummy(p.damage, dummyX, p.tier);
        }
        if (p.x < -12 || p.x > BUF_W + 12) p.alive = false;
      }
      for (let i = projectiles.length - 1; i >= 0; i--) {
        if (!projectiles[i]!.alive) projectiles.splice(i, 1);
      }

      for (const p of particles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 70 * dt;
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i]!.life <= 0) particles.splice(i, 1);
      }

      if (dummyFlash > 0) dummyFlash -= dt;
      if (dummyHp <= 0) {
        dummyRegenTimer -= dt;
        if (dummyRegenTimer <= 0) dummyHp = DUMMY_MAX_HP;
      }

      for (const f of floats) {
        f.life -= dt;
        f.y -= 20 * dt;
      }
      for (let i = floats.length - 1; i >= 0; i--) {
        if (floats[i]!.life <= 0) floats.splice(i, 1);
      }

      draw(dummyX);
      raf = requestAnimationFrame(tick);
    }

    function draw(dummyX: number) {
      const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
      const sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;

      bctx.save();
      bctx.setTransform(1, 0, 0, 1, sx, sy);
      bctx.imageSmoothingEnabled = false;

      drawBackground();
      drawDummy(dummyX);
      drawPlayer();
      drawProjectiles();
      drawParticles();
      drawFloats();
      drawHud();

      bctx.restore();

      ctx!.imageSmoothingEnabled = false;
      ctx!.clearRect(0, 0, width, height);
      ctx!.drawImage(buf, 0, 0, width, height);
    }

    function drawBackground() {
      const bands = ['#0d1520', '#121c28', '#162230', '#1a2838', '#1e3040'];
      const bandH = Math.ceil(FLOOR_Y / bands.length);
      for (let i = 0; i < bands.length; i++) {
        bctx.fillStyle = bands[i]!;
        bctx.fillRect(0, i * bandH, BUF_W, bandH + 1);
        if (i < bands.length - 1) {
          bctx.fillStyle = bands[i + 1]!;
          for (let x = 0; x < BUF_W; x += 2) {
            for (let y = 0; y < 2; y++) {
              if ((x / 2 + y) % 2 === 0) {
                bctx.fillRect(x, i * bandH + bandH - 2 + y, 1, 1);
              }
            }
          }
        }
      }

      bctx.fillStyle = '#2a4060';
      bctx.fillRect(BUF_W - 66 - camX * 0.3, 14, 32, 32);
      bctx.fillStyle = '#3a5878';
      bctx.fillRect(BUF_W - 62 - camX * 0.3, 18, 18, 18);
      bctx.fillStyle = '#1a2838';
      bctx.fillRect(BUF_W - 48 - camX * 0.3, 22, 14, 20);

      for (const s of stars) {
        const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(time * 2 + s.tw * 6));
        bctx.globalAlpha = twinkle;
        bctx.fillStyle = s.layer === 0 ? '#ffffff' : '#a8c8e8';
        const px = (s.x - camX * (s.layer === 0 ? 0.15 : 0.35) + BUF_W) % BUF_W;
        bctx.fillRect(px, s.y, 1, 1);
      }
      bctx.globalAlpha = 1;

      bctx.fillStyle = '#0a1018';
      const ruinX = -camX * 0.5;
      const ruins = [
        [20, 70, 14, 40],
        [34, 84, 10, 26],
        [70, 76, 18, 34],
        [96, 88, 8, 22],
        [175, 72, 20, 38],
        [196, 84, 12, 26],
        [245, 80, 16, 30],
      ];
      for (const [x, y, w, h] of ruins) {
        bctx.fillRect(x! + ruinX, y!, w!, h!);
      }
      bctx.fillStyle = '#1a3040';
      bctx.fillRect(24 + ruinX, 80, 3, 5);
      bctx.fillRect(78 + ruinX, 88, 3, 5);
      bctx.fillRect(182 + ruinX, 84, 3, 5);

      for (let x = -12; x < BUF_W + 12; x += 12) {
        const gx = Math.floor((x + camX * 0.2) / 12) * 12 - camX * 0.2;
        bctx.fillStyle = '#2a4a38';
        bctx.fillRect(gx, FLOOR_Y, 12, BUF_H - FLOOR_Y);
        bctx.fillStyle = '#3d6b4a';
        bctx.fillRect(gx, FLOOR_Y, 12, 3);
        bctx.fillStyle = '#245038';
        bctx.fillRect(gx, FLOOR_Y + 3, 12, 2);
        const seed = Math.abs(Math.floor(gx / 12) * 17) % 7;
        if (seed === 0) {
          bctx.fillStyle = '#4a7a58';
          bctx.fillRect(gx + 3, FLOOR_Y - 3, 2, 3);
          bctx.fillRect(gx + 6, FLOOR_Y - 5, 2, 5);
        } else if (seed === 3) {
          bctx.fillStyle = '#6a6050';
          bctx.fillRect(gx + 7, FLOOR_Y + 6, 3, 2);
        }
      }

      drawPlatform(84 - camX * 0.25, 70, 36);
      drawPlatform(192 - camX * 0.25, 58, 28);
    }

    function drawPlatform(x: number, y: number, w: number) {
      bctx.fillStyle = '#3d5a48';
      bctx.fillRect(x, y, w, 6);
      bctx.fillStyle = '#5a8a68';
      bctx.fillRect(x, y, w, 2);
      bctx.fillStyle = '#1a3028';
      bctx.fillRect(x + 2, y + 6, w - 4, 3);
    }

    function drawActorSprite(
      sprite: HTMLCanvasElement,
      x: number,
      wobble = 0,
      flip = false
    ) {
      const sw = sprite.width * SPRITE_SCALE;
      const sh = sprite.height * SPRITE_SCALE;
      bctx.save();
      bctx.translate(x + wobble, FLOOR_Y);
      if (wobble) bctx.rotate(wobble * 0.02);
      if (flip) bctx.scale(-1, 1);
      bctx.imageSmoothingEnabled = false;
      bctx.drawImage(sprite, -sw / 2, -sh, sw, sh);
      bctx.restore();
      return sh;
    }

    function drawDummy(dummyX: number) {
      const hit = dummyFlash > 0;
      const sprite = getDummyFrame(hit);
      const wob =
        dummyWobble > 0
          ? Math.sin(dummyWobble * 40) * 3 * dummyWobble
          : 0;
      const sh = drawActorSprite(sprite, dummyX, wob, false);

      const barW = 36;
      const barH = 5;
      const barX = Math.round(dummyX - barW / 2);
      const barY = FLOOR_Y - sh - 10;
      bctx.fillStyle = '#0a0a10';
      bctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
      const ratio = Math.max(0, dummyHp / DUMMY_MAX_HP);
      const fill = Math.round(barW * ratio);
      bctx.fillStyle = ratio > 0.4 ? '#4ade80' : '#f87171';
      bctx.fillRect(barX, barY, fill, barH);
      bctx.fillStyle = '#0a0a10';
      for (let i = 1; i < 4; i++) {
        bctx.fillRect(barX + i * 9, barY, 1, barH);
      }

      bctx.fillStyle = '#8a9aaa';
      pixelText(bctx, 'DUMMY', dummyX - 16, barY - 10);
    }

    function drawPlayer() {
      const eq = equippedRef.current;
      const frame = moving
        ? Math.floor(animTimer * 10) % 4
        : Math.floor(animTimer * 2) % 2;
      const sprite = getHeroFrame(moving ? 'run' : 'idle', frame);
      const bob = moving ? 0 : Math.sin(animTimer * 3) * 0.5;

      bctx.save();
      bctx.translate(playerX, FLOOR_Y + bob);
      if (facing < 0) bctx.scale(-1, 1);
      bctx.imageSmoothingEnabled = false;
      const sw = sprite.width * SPRITE_SCALE;
      const sh = sprite.height * SPRITE_SCALE;
      bctx.drawImage(sprite, -sw / 2, -sh, sw, sh);
      bctx.restore();

      if (eq) {
        drawWeapon(eq.weaponType, eq.tier);
      } else {
        bctx.fillStyle = '#ffffff88';
        pixelText(bctx, 'EQUIP', playerX - 16, FLOOR_Y - sh - 8);
      }
    }

    function drawWeapon(type: WeaponType, tier: Tier) {
      const prog =
        attack?.active && attack.weaponType === type ? attack.progress : 0;
      const handX = playerX + facing * 9;
      const handY = FLOOR_Y - PLAYER_H * 0.42;
      const sprite = getWeaponSprite(type, tier);
      const grip = WEAPON_GRIP[type];
      const tipLen = grip.tipLen * SPRITE_SCALE;
      const color = TIER_COLORS[tier];

      bctx.save();
      bctx.translate(handX, handY);
      if (facing < 0) bctx.scale(-1, 1);

      if (type === 'sword') {
        // Swing: back-up → forward-down (tip always away from body mid-swing)
        const angle =
          prog > 0
            ? -0.9 + prog * 2.9
            : WEAPON_REST_ANGLE.sword;
        bctx.rotate(angle);
        drawWeaponAtGrip(bctx, sprite, type, SPRITE_SCALE);
        if (prog > 0.15 && prog < 0.9) {
          drawBladeArc(bctx, tipLen, angle, 0.7, color, 0.75);
        }
      } else if (type === 'dagger') {
        const angle = WEAPON_REST_ANGLE.dagger;
        // Tip direction in local (pre-rotate) hand space: (sin θ, −cos θ)
        const jab =
          prog > 0 ? Math.sin(prog * Math.PI * 2) * (tipLen * 0.85) : 0;
        const tipDx = Math.sin(angle);
        const tipDy = -Math.cos(angle);
        bctx.translate(jab * tipDx, jab * tipDy);
        bctx.rotate(angle);
        drawWeaponAtGrip(bctx, sprite, type, SPRITE_SCALE);
        if (prog > 0) {
          // Ghost toward grip along blade axis (local −Y after rotate)
          drawWeaponAtGrip(bctx, sprite, type, SPRITE_SCALE, 0.35);
          bctx.save();
          bctx.translate(0, 4);
          drawWeaponAtGrip(bctx, sprite, type, SPRITE_SCALE, 0.25);
          bctx.restore();
          bctx.strokeStyle = color;
          bctx.globalAlpha = 0.7;
          bctx.lineWidth = 2;
          bctx.beginPath();
          bctx.moveTo(0, -tipLen);
          bctx.lineTo(0, -tipLen - 6);
          bctx.stroke();
          bctx.globalAlpha = 1;
        }
      } else if (type === 'bow') {
        drawWeaponAtGrip(bctx, sprite, type, SPRITE_SCALE);
        if (prog > 0 && prog < 0.55) {
          // String pull toward hero (−X), arrow nocked
          bctx.fillStyle = color;
          const pull = prog * 8;
          bctx.fillRect(-2 - pull, -1, pull + 2, 2);
          bctx.fillStyle = '#e8d5a3';
          bctx.fillRect(-2, -1, 10, 2);
        }
      } else if (type === 'staff') {
        const angle = WEAPON_REST_ANGLE.staff;
        const pulse = prog > 0 ? 1 + Math.sin(prog * Math.PI) * 0.2 : 1;
        bctx.rotate(angle);
        drawWeaponAtGrip(bctx, sprite, type, SPRITE_SCALE * pulse);
        if (prog > 0) {
          // Glow at orb (tip of staff, along −Y from grip)
          const r = 5 + prog * 6;
          bctx.fillStyle = `${color}55`;
          bctx.fillRect(-r / 2, -tipLen * pulse - r / 2, r, r);
          bctx.fillStyle = `${color}aa`;
          bctx.fillRect(-2, -tipLen * pulse - 2, 4, 4);
        }
      } else if (type === 'spear') {
        const angle = WEAPON_REST_ANGLE.spear;
        // Thrust along tip axis (not across the shaft)
        const thrust =
          prog > 0 ? Math.sin(prog * Math.PI) * (tipLen * 1.1) : 0;
        const tipDx = Math.sin(angle);
        const tipDy = -Math.cos(angle);
        bctx.translate(thrust * tipDx, thrust * tipDy);
        bctx.rotate(angle);
        drawWeaponAtGrip(bctx, sprite, type, SPRITE_SCALE);
        if (prog > 0.25 && prog < 0.8) {
          bctx.strokeStyle = color;
          bctx.globalAlpha = 0.65;
          bctx.lineWidth = 2;
          bctx.beginPath();
          bctx.moveTo(0, -tipLen);
          bctx.lineTo(0, -tipLen - 10);
          bctx.stroke();
          bctx.globalAlpha = 1;
        }
      }

      bctx.restore();
    }

    /** Arc trail at blade tip radius — locked to current swing angle. */
    function drawBladeArc(
      c: CanvasRenderingContext2D,
      radius: number,
      currentAngle: number,
      sweep: number,
      color: string,
      alpha: number
    ) {
      // In grip space tip is at (0, -radius) before rotate; after rotate the
      // whole context is rotated, so tip sits at local (0, -radius) already.
      // Draw an arc centered on grip spanning the last `sweep` radians of motion.
      c.save();
      // Un-rotate to draw arc in hand space using absolute tip angles
      // Current tip angle from +X: currentAngle - π/2 (tip was -Y)
      // Simpler: stroke a short arc around grip from (angle-sweep) to angle
      // in the unrotated... we're already rotated by currentAngle, so tip is up.
      // Trail should fan behind the blade: from prior angle to now.
      c.rotate(-currentAngle); // back to hand axes
      const tipAng0 = currentAngle - Math.PI / 2; // tip direction in hand space
      const start = tipAng0 - sweep;
      const end = tipAng0;
      c.strokeStyle = color;
      c.globalAlpha = alpha;
      c.lineWidth = 3;
      c.lineCap = 'round';
      c.beginPath();
      c.arc(0, 0, radius, start, end, false);
      c.stroke();
      c.globalAlpha = alpha * 0.45;
      c.lineWidth = 5;
      c.beginPath();
      c.arc(0, 0, radius, start + sweep * 0.35, end, false);
      c.stroke();
      c.restore();
    }

    function drawProjectiles() {
      for (const p of projectiles) {
        if (!p.alive) continue;
        if (p.kind === 'arrow') {
          drawSprite(bctx, getArrowSprite(p.tier), p.x, p.y, {
            flipX: p.vx < 0,
            scale: SPRITE_SCALE,
          });
        } else {
          const pulse = 0.85 + Math.sin(time * 20) * 0.15;
          drawSprite(bctx, getBoltSprite(p.tier), p.x, p.y, {
            scale: SPRITE_SCALE * pulse,
          });
          bctx.fillStyle = `${TIER_COLORS[p.tier]}44`;
          bctx.fillRect(p.x - 5, p.y - 5, 10, 10);
        }
      }
    }

    function drawParticles() {
      for (const p of particles) {
        const a = Math.max(0, p.life / p.maxLife);
        if (p.kind === 'spark' && p.tier) {
          drawSprite(bctx, getSpark(p.tier), p.x, p.y, {
            alpha: a,
            scale: SPRITE_SCALE,
          });
        } else if (p.kind === 'dust') {
          drawSprite(bctx, getDust(), p.x, p.y, {
            alpha: a * 0.7,
            scale: SPRITE_SCALE,
          });
        } else {
          bctx.globalAlpha = a;
          bctx.fillStyle = '#e8d5a3';
          bctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 3);
          bctx.globalAlpha = 1;
        }
      }
    }

    function drawFloats() {
      for (const f of floats) {
        bctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.4));
        bctx.fillStyle = f.color;
        pixelText(bctx, f.text, f.x - f.text.length * 3, f.y);
        bctx.globalAlpha = 1;
      }
    }

    function drawHud() {
      const eq = equippedRef.current;
      const panelH = eq ? 28 : 16;
      const panelW = 140;
      bctx.fillStyle = '#0a1018cc';
      bctx.fillRect(4, 4, panelW, panelH);
      bctx.fillStyle = '#3a5a68';
      bctx.fillRect(4, 4, panelW, 1);
      bctx.fillRect(4, 4 + panelH - 1, panelW, 1);
      bctx.fillRect(4, 4, 1, panelH);
      bctx.fillRect(4 + panelW - 1, 4, 1, panelH);

      bctx.fillStyle = '#c8d8e0';
      pixelText(bctx, 'A/D MOVE  SPC ATK', 8, 9);
      if (eq) {
        bctx.fillStyle = TIER_COLORS[eq.tier];
        const label = `${eq.weaponType.toUpperCase()} ${eq.effectiveDamage}${eq.buffActive ? ' +' : ''}`;
        pixelText(bctx, label, 8, 20);
      }
    }

    function pixelText(
      c: CanvasRenderingContext2D,
      text: string,
      x: number,
      y: number
    ) {
      c.font = '8px monospace';
      c.textBaseline = 'top';
      c.fillText(text.toUpperCase(), Math.round(x), Math.round(y));
    }

    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      tabIndex={0}
      aria-label="Stellar4 playfield"
      className="w-full max-w-full rounded-xl border border-[var(--qf-card-border)] outline-none focus:ring-2 focus:ring-[var(--qf-accent-2)]"
      style={{
        background: '#0d1520',
        aspectRatio: `${width}/${height}`,
        imageRendering: 'pixelated',
      }}
      onClick={(e) => (e.target as HTMLCanvasElement).focus()}
    />
  );
}
