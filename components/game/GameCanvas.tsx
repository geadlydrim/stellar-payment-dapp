'use client';

import { useEffect, useRef } from 'react';
import {
  WEAPON_ANIM,
  TIER_COLORS,
  type Tier,
  type WeaponType,
} from '@/lib/game';

export interface EquippedWeaponView {
  weaponType: WeaponType;
  tier: Tier;
  damage: number;
  /** Effective damage after buff. */
  effectiveDamage: number;
  buffActive: boolean;
}

interface GameCanvasProps {
  equipped: EquippedWeaponView | null;
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
  alive: boolean;
}

interface AttackState {
  active: boolean;
  progress: number; // 0..1
  weaponType: WeaponType;
  hitApplied: boolean;
}

const FLOOR_Y_RATIO = 0.78;
const PLAYER_W = 28;
const PLAYER_H = 44;
const DUMMY_W = 36;
const DUMMY_H = 56;
const DUMMY_MAX_HP = 200;
const MOVE_SPEED = 220; // px/s

export function GameCanvas({ equipped, width = 720, height = 320 }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const equippedRef = useRef(equipped);
  equippedRef.current = equipped;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const keys = new Set<string>();
    let playerX = 80;
    let facing = 1; // 1 right, -1 left
    let dummyHp = DUMMY_MAX_HP;
    let dummyFlash = 0;
    let dummyRegenTimer = 0;
    let cooldown = 0;
    let attack: AttackState | null = null;
    const floats: FloatText[] = [];
    const projectiles: Projectile[] = [];
    let last = performance.now();
    let raf = 0;
    let running = true;

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'd' || k === ' ' || k === 'arrowleft' || k === 'arrowright') {
        e.preventDefault();
      }
      keys.add(k);
      if (k === ' ' || k === 'j') tryAttack();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
    };
    const onBlur = () => keys.clear();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

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
        const floorY = height * FLOOR_Y_RATIO;
        const kind = eq.weaponType === 'bow' ? 'arrow' : 'bolt';
        projectiles.push({
          x: playerX + facing * 20,
          y: floorY - PLAYER_H * 0.55,
          vx: facing * (kind === 'arrow' ? 420 : 360),
          kind,
          damage: eq.effectiveDamage,
          alive: true,
        });
      }
    }

    function damageDummy(amount: number, fromX: number) {
      dummyHp = Math.max(0, dummyHp - amount);
      dummyFlash = 0.25;
      floats.push({
        x: fromX,
        y: height * FLOOR_Y_RATIO - DUMMY_H - 8,
        text: `-${amount}`,
        life: 0.9,
        color: '#ff6b4a',
      });
      if (dummyHp <= 0) {
        dummyRegenTimer = 1.2;
        floats.push({
          x: fromX,
          y: height * FLOOR_Y_RATIO - DUMMY_H - 28,
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
      const anim = WEAPON_ANIM[attack.weaponType];
      if (anim.projectile) return;

      // Hit window mid-swing
      if (attack.progress < 0.35 || attack.progress > 0.75) return;

      const floorY = height * FLOOR_Y_RATIO;
      const dummyX = width - 90;
      const reach = anim.reach;
      const hitW = anim.hitWidth;
      const hitLeft =
        facing === 1
          ? playerX + PLAYER_W / 2
          : playerX - PLAYER_W / 2 - reach;
      const hitRight = hitLeft + (facing === 1 ? reach + hitW * 0.3 : reach);
      const dummyLeft = dummyX - DUMMY_W / 2;
      const dummyRight = dummyX + DUMMY_W / 2;

      if (hitRight > dummyLeft && hitLeft < dummyRight) {
        attack.hitApplied = true;
        damageDummy(eq.effectiveDamage, dummyX);
      }
      void floorY;
    }

    function tick(now: number) {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const floorY = height * FLOOR_Y_RATIO;
      const dummyX = width - 90;

      // Movement
      let vx = 0;
      if (keys.has('a') || keys.has('arrowleft')) vx -= 1;
      if (keys.has('d') || keys.has('arrowright')) vx += 1;
      if (vx !== 0) {
        facing = vx > 0 ? 1 : -1;
        playerX += vx * MOVE_SPEED * dt;
      }
      playerX = Math.max(24, Math.min(width - 140, playerX));

      if (cooldown > 0) cooldown -= dt;

      // Attack progress
      if (attack?.active) {
        const dur = WEAPON_ANIM[attack.weaponType].durationMs / 1000;
        attack.progress += dt / dur;
        meleeHitCheck();
        if (attack.progress >= 1) attack = null;
      }

      // Projectiles
      for (const p of projectiles) {
        if (!p.alive) continue;
        p.x += p.vx * dt;
        const dummyLeft = dummyX - DUMMY_W / 2;
        const dummyRight = dummyX + DUMMY_W / 2;
        const dummyTop = floorY - DUMMY_H;
        if (
          p.x > dummyLeft &&
          p.x < dummyRight &&
          p.y > dummyTop &&
          p.y < floorY
        ) {
          p.alive = false;
          damageDummy(p.damage, dummyX);
        }
        if (p.x < -20 || p.x > width + 20) p.alive = false;
      }
      for (let i = projectiles.length - 1; i >= 0; i--) {
        if (!projectiles[i]!.alive) projectiles.splice(i, 1);
      }

      // Dummy flash / regen
      if (dummyFlash > 0) dummyFlash -= dt;
      if (dummyHp <= 0) {
        dummyRegenTimer -= dt;
        if (dummyRegenTimer <= 0) dummyHp = DUMMY_MAX_HP;
      }

      // Floats
      for (const f of floats) {
        f.life -= dt;
        f.y -= 40 * dt;
      }
      for (let i = floats.length - 1; i >= 0; i--) {
        if (floats[i]!.life <= 0) floats.splice(i, 1);
      }

      draw(floorY, dummyX);
      raf = requestAnimationFrame(tick);
    }

    function draw(floorY: number, dummyX: number) {
      // Background
      const g = ctx!.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, '#1a2a32');
      g.addColorStop(0.55, '#243b44');
      g.addColorStop(1, '#1a2830');
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, width, height);

      // Stars
      ctx!.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 28; i++) {
        const sx = (i * 97) % width;
        const sy = (i * 53) % (floorY - 40);
        ctx!.fillRect(sx, sy, 2, 2);
      }

      // Floor
      ctx!.fillStyle = '#2d4a3e';
      ctx!.fillRect(0, floorY, width, height - floorY);
      ctx!.fillStyle = '#3d6b55';
      ctx!.fillRect(0, floorY, width, 4);

      // Platform stripes
      ctx!.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx!.beginPath();
      for (let x = 0; x < width; x += 28) {
        ctx!.moveTo(x, floorY + 8);
        ctx!.lineTo(x + 14, height);
      }
      ctx!.stroke();

      drawDummy(dummyX, floorY);
      drawPlayer(floorY);
      drawProjectiles();
      drawFloats();
      drawHud();
    }

    function drawDummy(dummyX: number, floorY: number) {
      const top = floorY - DUMMY_H;
      const flash = dummyFlash > 0;
      ctx!.save();
      if (flash) ctx!.globalAlpha = 0.7 + Math.sin(dummyFlash * 40) * 0.3;

      // Body
      ctx!.fillStyle = flash ? '#ffaa88' : '#c4a574';
      ctx!.fillRect(dummyX - DUMMY_W / 2, top + 14, DUMMY_W, DUMMY_H - 14);
      // Head
      ctx!.beginPath();
      ctx!.arc(dummyX, top + 10, 12, 0, Math.PI * 2);
      ctx!.fill();
      // Cross face
      ctx!.strokeStyle = '#5c4030';
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(dummyX - 5, top + 6);
      ctx!.lineTo(dummyX + 5, top + 14);
      ctx!.moveTo(dummyX + 5, top + 6);
      ctx!.lineTo(dummyX - 5, top + 14);
      ctx!.stroke();
      // Arms
      ctx!.strokeStyle = flash ? '#ffaa88' : '#c4a574';
      ctx!.lineWidth = 5;
      ctx!.beginPath();
      ctx!.moveTo(dummyX - DUMMY_W / 2, top + 28);
      ctx!.lineTo(dummyX - DUMMY_W / 2 - 14, top + 44);
      ctx!.moveTo(dummyX + DUMMY_W / 2, top + 28);
      ctx!.lineTo(dummyX + DUMMY_W / 2 + 14, top + 44);
      ctx!.stroke();
      ctx!.restore();

      // HP bar
      const barW = 56;
      const barH = 6;
      const barX = dummyX - barW / 2;
      const barY = top - 14;
      ctx!.fillStyle = 'rgba(0,0,0,0.45)';
      ctx!.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
      const ratio = Math.max(0, dummyHp / DUMMY_MAX_HP);
      ctx!.fillStyle = ratio > 0.4 ? '#4ade80' : '#f87171';
      ctx!.fillRect(barX, barY, barW * ratio, barH);

      ctx!.fillStyle = 'rgba(255,255,255,0.55)';
      ctx!.font = '10px sans-serif';
      ctx!.textAlign = 'center';
      ctx!.fillText('Dummy', dummyX, top - 18);
    }

    function drawPlayer(floorY: number) {
      const top = floorY - PLAYER_H;
      const eq = equippedRef.current;

      // Body
      ctx!.fillStyle = '#6fe6c8';
      ctx!.fillRect(playerX - PLAYER_W / 2, top + 12, PLAYER_W, PLAYER_H - 12);
      // Head
      ctx!.fillStyle = '#f0e6d8';
      ctx!.beginPath();
      ctx!.arc(playerX, top + 8, 10, 0, Math.PI * 2);
      ctx!.fill();
      // Eye
      ctx!.fillStyle = '#1a2a32';
      ctx!.beginPath();
      ctx!.arc(playerX + facing * 3, top + 7, 2, 0, Math.PI * 2);
      ctx!.fill();

      // Weapon + attack animation
      if (eq) {
        drawWeapon(eq.weaponType, eq.tier, floorY);
      } else {
        // Fists hint
        ctx!.fillStyle = 'rgba(255,255,255,0.25)';
        ctx!.font = '11px sans-serif';
        ctx!.textAlign = 'center';
        ctx!.fillText('Equip a weapon', playerX, top - 8);
      }
    }

    function drawWeapon(type: WeaponType, tier: Tier, floorY: number) {
      const color = TIER_COLORS[tier];
      const prog = attack?.active && attack.weaponType === type ? attack.progress : 0;
      const handX = playerX + facing * 12;
      const handY = floorY - PLAYER_H * 0.45;

      ctx!.save();
      ctx!.translate(handX, handY);
      ctx!.scale(facing, 1);

      if (type === 'sword') {
        const angle = prog > 0 ? -1.2 + prog * 2.4 : -0.35;
        ctx!.rotate(angle);
        ctx!.fillStyle = '#8b6914';
        ctx!.fillRect(-3, -4, 6, 14);
        ctx!.fillStyle = color;
        ctx!.fillRect(-2, -36, 4, 34);
        ctx!.fillStyle = '#ddd';
        ctx!.beginPath();
        ctx!.moveTo(-2, -36);
        ctx!.lineTo(2, -36);
        ctx!.lineTo(0, -42);
        ctx!.fill();
        if (prog > 0.2 && prog < 0.8) {
          ctx!.strokeStyle = `${color}88`;
          ctx!.lineWidth = 3;
          ctx!.beginPath();
          ctx!.arc(0, 0, 38, -1.4, 0.6);
          ctx!.stroke();
        }
      } else if (type === 'dagger') {
        const jab = prog > 0 ? Math.sin(prog * Math.PI * 2) * 18 : 0;
        ctx!.translate(jab, 0);
        ctx!.rotate(-0.5);
        ctx!.fillStyle = '#6b4423';
        ctx!.fillRect(-2, -2, 4, 10);
        ctx!.fillStyle = color;
        ctx!.fillRect(-1.5, -22, 3, 20);
        if (prog > 0) {
          // second ghost dagger
          ctx!.globalAlpha = 0.45;
          ctx!.translate(0, 8);
          ctx!.fillRect(-1.5, -22, 3, 20);
        }
      } else if (type === 'bow') {
        ctx!.strokeStyle = color;
        ctx!.lineWidth = 3;
        ctx!.beginPath();
        ctx!.arc(4, 0, 18, -1.2, 1.2);
        ctx!.stroke();
        ctx!.strokeStyle = '#ccc';
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(4, -16);
        ctx!.lineTo(4, 16);
        ctx!.stroke();
        if (prog > 0 && prog < 0.5) {
          ctx!.strokeStyle = color;
          ctx!.beginPath();
          ctx!.moveTo(4, 0);
          ctx!.lineTo(4 - prog * 20, 0);
          ctx!.stroke();
        }
      } else if (type === 'staff') {
        const pulse = prog > 0 ? 1 + Math.sin(prog * Math.PI) * 0.3 : 1;
        ctx!.rotate(-0.4);
        ctx!.fillStyle = '#5c4030';
        ctx!.fillRect(-2, -8, 4, 40);
        ctx!.fillStyle = color;
        ctx!.beginPath();
        ctx!.arc(0, -14, 7 * pulse, 0, Math.PI * 2);
        ctx!.fill();
        if (prog > 0) {
          ctx!.globalAlpha = 0.5;
          ctx!.beginPath();
          ctx!.arc(0, -14, 12 * pulse, 0, Math.PI * 2);
          ctx!.strokeStyle = color;
          ctx!.lineWidth = 2;
          ctx!.stroke();
        }
      } else if (type === 'spear') {
        const thrust = prog > 0 ? Math.sin(prog * Math.PI) * 36 : 0;
        ctx!.translate(thrust, 0);
        ctx!.rotate(-0.15);
        ctx!.fillStyle = '#6b4423';
        ctx!.fillRect(-2, -4, 4, 12);
        ctx!.fillStyle = '#8b7355';
        ctx!.fillRect(-1.5, -48, 3, 46);
        ctx!.fillStyle = color;
        ctx!.beginPath();
        ctx!.moveTo(0, -58);
        ctx!.lineTo(-5, -46);
        ctx!.lineTo(5, -46);
        ctx!.fill();
      }

      ctx!.restore();
    }

    function drawProjectiles() {
      for (const p of projectiles) {
        if (!p.alive) continue;
        if (p.kind === 'arrow') {
          ctx!.fillStyle = '#e8d5a3';
          ctx!.fillRect(p.x - 10, p.y - 1, 18, 2);
          ctx!.fillStyle = '#c0c0c0';
          ctx!.beginPath();
          ctx!.moveTo(p.x + (p.vx > 0 ? 10 : -10), p.y);
          ctx!.lineTo(p.x + (p.vx > 0 ? 4 : -4), p.y - 4);
          ctx!.lineTo(p.x + (p.vx > 0 ? 4 : -4), p.y + 4);
          ctx!.fill();
        } else {
          const grd = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, 10);
          grd.addColorStop(0, '#fff');
          grd.addColorStop(0.4, '#a855f7');
          grd.addColorStop(1, 'transparent');
          ctx!.fillStyle = grd;
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, 10, 0, Math.PI * 2);
          ctx!.fill();
        }
      }
    }

    function drawFloats() {
      for (const f of floats) {
        ctx!.globalAlpha = Math.max(0, f.life);
        ctx!.fillStyle = f.color;
        ctx!.font = 'bold 14px sans-serif';
        ctx!.textAlign = 'center';
        ctx!.fillText(f.text, f.x, f.y);
        ctx!.globalAlpha = 1;
      }
    }

    function drawHud() {
      const eq = equippedRef.current;
      ctx!.fillStyle = 'rgba(0,0,0,0.35)';
      ctx!.fillRect(10, 10, 200, eq ? 48 : 28);
      ctx!.fillStyle = 'rgba(255,255,255,0.85)';
      ctx!.font = '12px sans-serif';
      ctx!.textAlign = 'left';
      ctx!.fillText('A / D move · Space attack', 18, 28);
      if (eq) {
        ctx!.fillStyle = TIER_COLORS[eq.tier];
        ctx!.fillText(
          `${eq.weaponType} · ${eq.effectiveDamage} dmg${eq.buffActive ? ' (buff!)' : ''}`,
          18,
          46
        );
      }
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
      style={{ background: '#1a2a32', aspectRatio: `${width}/${height}` }}
      onClick={(e) => (e.target as HTMLCanvasElement).focus()}
    />
  );
}
