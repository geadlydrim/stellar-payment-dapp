interface Particle {
  id: string;
  left: number;
  delay: number;
  rotate: number;
  color: string;
  size: number;
  square: boolean;
}

export function makeConfettiBurst(): Particle[] {
  const colors = ['#5EEAD4', '#0D9488', '#ffffff'];
  const particles: Particle[] = [];
  for (let i = 0; i < 24; i++) {
    particles.push({
      id: `c${i}-${Date.now()}`,
      left: Math.round(Math.random() * 96),
      delay: Math.round(Math.random() * 30) / 100,
      rotate: Math.round(Math.random() * 360),
      color: colors[i % colors.length],
      size: 6 + Math.round(Math.random() * 5),
      square: i % 2 === 0,
    });
  }
  return particles;
}

export function Confetti({ particles }: { particles: Particle[] }) {
  return (
    <>
      {particles.map((p) => (
        <div
          key={p.id}
          className="fixed pointer-events-none z-[25]"
          style={{
            top: '10px',
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.square ? '2px' : '50%',
            transform: `rotate(${p.rotate}deg)`,
            animation: `qf-confetti-fall 1.3s ease-in ${p.delay}s both`,
          }}
        />
      ))}
    </>
  );
}
