import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>>(
  ({ className, ...props }, ref) => (
    <SwitchPrimitive.Root ref={ref} className={cn("peer inline-flex h-5 w-9 items-center rounded-full bg-secondary data-[state=checked]:bg-primary transition-colors", className)} {...props}>
      <SwitchPrimitive.Thumb className="block h-4 w-4 rounded-full bg-background translate-x-0.5 data-[state=checked]:translate-x-4 transition-transform" />
    </SwitchPrimitive.Root>
  )
);
Switch.displayName = SwitchPrimitive.Root.displayName;
export { Switch };
