import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectValue,
  SelectTrigger as BaseSelectTrigger,
  SelectScrollDownButton,
  SelectScrollUpButton,
} from "@/components/ui/select";

export const selectTriggerVariants = cva(
  "flex w-full items-center justify-between rounded-md border border-input bg-background ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
  {
    variants: {
      size: {
        sm: "h-8 px-3 py-1 text-xs",
        md: "h-10 px-3 py-2 text-sm",
        lg: "h-11 px-4 text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export interface AppSelectTriggerProps
  extends React.ComponentPropsWithoutRef<typeof BaseSelectTrigger>,
    VariantProps<typeof selectTriggerVariants> {}

export const AppSelectTrigger = React.forwardRef<
  React.ElementRef<typeof BaseSelectTrigger>,
  AppSelectTriggerProps
>(({ className, size, ...props }, ref) => (
  <BaseSelectTrigger
    ref={ref}
    className={cn(selectTriggerVariants({ size }), className)}
    {...props}
  />
));

AppSelectTrigger.displayName = "AppSelectTrigger";

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectValue,
  SelectScrollDownButton,
  SelectScrollUpButton,
};
