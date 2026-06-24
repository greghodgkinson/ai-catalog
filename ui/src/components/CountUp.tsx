import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, duration = 1400): number {
  const [val, setVal] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (target === 0 || started.current) return;
    started.current = true;
    const begin = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - begin) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(eased * target));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);

  return val;
}

interface Props {
  value: number;
  className?: string;
}

export function CountUp({ value, className }: Props) {
  const display = useCountUp(value);
  return <span className={className}>{display.toLocaleString()}</span>;
}
