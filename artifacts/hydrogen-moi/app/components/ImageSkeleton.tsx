interface ImageSkeletonProps {
  variant?: 'warm' | 'card' | 'dark';
  className?: string;
  borderRadius?: number;
}

export function ImageSkeleton({ variant = 'warm', className = '', borderRadius }: ImageSkeletonProps) {
  const bg =
    variant === 'dark'
      ? 'rgba(30,24,20,0.18)'
      : variant === 'card'
      ? '#f0ece6'
      : '#e8e0d8';

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{ backgroundColor: bg, borderRadius }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${
            variant === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(250,248,245,0.6)'
          } 50%, transparent 100%)`,
          backgroundSize: '200% 100%',
          animation: 'shimmer-sweep 1.4s ease-in-out infinite',
        }}
      />
    </div>
  );
}
