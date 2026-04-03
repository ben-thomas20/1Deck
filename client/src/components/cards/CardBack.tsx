import './CardBack.css';

interface CardBackProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CardBack({ size = 'md', className = '' }: CardBackProps) {
  return (
    <div className={`card-back card-back--${size} ${className}`}>
      <div className="card-back-pattern" />
    </div>
  );
}
