import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface BeamBackgroundProps {
  className?: string;
}

export function BeamBackground({ className }: BeamBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const beams: { x: number; y: number; angle: number; speed: number; width: number; color: string; alpha: number }[] = [];
    const colors = ['rgba(37,99,235', 'rgba(124,58,237', 'rgba(6,182,212', 'rgba(29,78,216'];

    for (let i = 0; i < 6; i++) {
      beams.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        angle: 35 + Math.random() * 20,
        speed: 0.4 + Math.random() * 0.6,
        width: 1.5 + Math.random() * 2,
        color: colors[i % colors.length],
        alpha: 0.4 + Math.random() * 0.3,
      });
    }

    let animId: number;
    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      beams.forEach(b => {
        const rad = (b.angle * Math.PI) / 180;
        const len = canvas.width * 1.8;
        const x2 = b.x + Math.cos(rad) * len;
        const y2 = b.y + Math.sin(rad) * len;

        const grad = ctx.createLinearGradient(b.x, b.y, x2, y2);
        grad.addColorStop(0, `${b.color},0)`);
        grad.addColorStop(0.3, `${b.color},${b.alpha})`);
        grad.addColorStop(0.7, `${b.color},${b.alpha * 0.7})`);
        grad.addColorStop(1, `${b.color},0)`);

        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = grad;
        ctx.lineWidth = b.width;
        ctx.stroke();

        b.y -= b.speed;
        b.x += b.speed * 0.3;
        if (b.y < -100) {
          b.y = canvas.height + 100;
          b.x = Math.random() * canvas.width;
        }
      });

      animId = requestAnimationFrame(draw);
    }
    draw();

    const resize = () => {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={cn('absolute inset-0 w-full h-full', className)}
    />
  );
}
