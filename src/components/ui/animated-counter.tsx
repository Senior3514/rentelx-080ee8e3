import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { useMotionValue, useSpring } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}

export function AnimatedCounter({ value, suffix = "", prefix = "", duration = 1200, className }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { duration, bounce: 0 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (isInView) motionVal.set(value);
  }, [isInView, value, motionVal]);

  useEffect(() => {
    return spring.on("change", (v) => setDisplay(Math.round(v)));
  }, [spring]);

  return (
    <span ref={ref} className={className}>
      {prefix}{display.toLocaleString()}{suffix}
    </span>
  );
}

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ScoreRing({ score, size = 80, strokeWidth = 6, className }: ScoreRingProps) {
  const ref = useRef<SVGCircleElement>(null);
  const isInView = useInView({ current: ref.current?.closest("svg") as Element | null }, { once: true });
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (score / 100) * circ;

  const color =
    score >= 80 ? "hsl(142, 60%, 40%)" :
    score >= 50 ? "hsl(38, 85%, 55%)" :
    "hsl(0, 65%, 50%)";

  return (
    <div className={`relative inline-flex items-center justify-center ${className ?? ""}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          ref={ref}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={isInView ? dashOffset : circ}
          style={{
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1) 0.3s",
          }}
        />
      </svg>
      <span
        className="absolute text-sm font-bold stat-number"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}
