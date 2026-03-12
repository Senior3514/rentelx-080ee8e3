import { motion } from "framer-motion";

export const PageHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-6">
    <h1 className="text-2xl font-display font-bold">{title}</h1>
    {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
  </motion.div>
);
