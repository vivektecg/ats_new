import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface SpotlightProps {
  className?: string;
  fill?: string;
}

export function Spotlight({ className, fill = 'rgba(37,99,235,0.15)' }: SpotlightProps) {
  const spotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = spotRef.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    const onMove = (e: MouseEvent) => {
      const rect = parent.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      el.style.background = `radial-gradient(600px circle at ${x}px ${y}px, ${fill}, transparent 60%)`;
    };

    parent.addEventListener('mousemove', onMove);
    return () => parent.removeEventListener('mousemove', onMove);
  }, [fill]);

  return (
    <div
      ref={spotRef}
      className={cn(
        'pointer-events-none absolute inset-0 z-10 transition-all duration-300',
        className
      )}
    />
  );
}
