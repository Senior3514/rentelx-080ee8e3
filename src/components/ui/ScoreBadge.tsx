import { motion } from "framer-motion";

export const ScoreBadge = ({ score }: { score: number }) => {
  const color = score >= 80 ? "bg-score-high" : score >= 50 ? "bg-score-medium" : "bg-score-low";
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.1 }}
      className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white ${color}`}
    >
      {score}
    </motion.span>
  );
};
