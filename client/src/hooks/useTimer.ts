import { useState, useEffect, useRef } from 'react';

export function useTimer(totalSeconds: number, active: boolean) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setRemaining(totalSeconds);
      return;
    }

    setRemaining(totalSeconds);
    intervalRef.current = window.setInterval(() => {
      setRemaining(prev => {
        if (prev <= 0) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, totalSeconds]);

  const fraction = totalSeconds > 0 ? remaining / totalSeconds : 0;

  return { remaining, fraction };
}
