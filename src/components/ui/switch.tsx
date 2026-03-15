import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-[26px] w-[48px] shrink-0 cursor-pointer items-center rounded-full border border-border/40 transition-all duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:border-primary/60 data-[state=checked]:shadow-[0_0_8px_hsl(var(--primary)/0.3)] data-[state=unchecked]:bg-muted/80 data-[state=unchecked]:border-border/60",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-[20px] w-[20px] rounded-full bg-white shadow-md ring-0 transition-all duration-300 ease-in-out data-[state=checked]:translate-x-[23px] data-[state=unchecked]:translate-x-[2px] data-[state=checked]:shadow-[0_1px_4px_rgba(0,0,0,0.2)]",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
