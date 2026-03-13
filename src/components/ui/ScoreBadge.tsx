import { motion } from "framer-motion";

const scoreLabel = (score: number) => {
  if (score >= 80) return { color: "bg-score-high", glow: true };
  if (score >= 50) return { color: "bg-score-medium", glow: false };
  return { color: "bg-score-low", glow: false };
};

export const ScoreBadge = ({ score, size = "sm" }: { score: number; size?: "sm" | "md" | "lg" }) => {
  const { color, glow } = scoreLabel(score);
  const sizeClasses = {
    sm: "px-2.5 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };

  return (
    <motion.span
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.1 }}
      transition={{ type: "spring", stiffness: 300, damping: 15 }}
      className={`inline-flex items-center justify-center rounded-full font-bold text-white ${color} ${sizeClasses[size]} ${glow ? "animate-glow" : ""}`}
    >
      {score}
    </motion.span>
  );
};

/* ─── Score Legend Component ─── */
export const ScoreLegend = ({ language = "en" }: { language?: string }) => {
  const labels = {
    en: { high: "80+ Excellent", medium: "50-79 Good", low: "<50 Low" },
    he: { high: "80+ מעולה", medium: "50-79 טוב", low: "50> נמוך" },
    es: { high: "80+ Excelente", medium: "50-79 Bueno", low: "<50 Bajo" },
  };
  const l = labels[language as keyof typeof labels] || labels.en;

  return (
    <motion.div
      className="flex items-center gap-3 text-[10px] text-muted-foreground"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
    >
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-score-high" />
        {l.high}
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-score-medium" />
        {l.medium}
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-score-low" />
        {l.low}
      </span>
    </motion.div>
  );
};
