import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";

interface AnimatedCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export const AnimatedCard = ({ children, className = "", delay = 0, ...props }: AnimatedCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut", delay }}
      whileHover={{ y: -3, boxShadow: "0 12px 32px rgba(0,0,0,0.12)" }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};
