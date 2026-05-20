import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface HoverBorderGradientProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  as?: React.ElementType;
}

export function HoverBorderGradient({
  children,
  className,
  containerClassName,
  as: Tag = 'div',
}: HoverBorderGradientProps) {
  const [hovered, setHovered] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={onMove}
      className={cn('relative rounded-xl p-[1px] overflow-hidden', containerClassName)}
      style={{
        background: hovered
          ? `radial-gradient(200px circle at ${position.x}px ${position.y}px, rgba(37,99,235,0.6), rgba(124,58,237,0.4) 40%, rgba(15,23,42,1) 80%)`
          : 'rgba(30,41,59,0.5)',
      }}
    >
      <Tag className={cn('relative z-10 rounded-xl', className)}>
        {children}
      </Tag>
    </div>
  );
}
