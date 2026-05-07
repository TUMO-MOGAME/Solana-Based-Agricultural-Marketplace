"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type TooltipContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

const TooltipProvider: React.FC<
  React.PropsWithChildren<{ delayDuration?: number }>
> = ({ children }) => <>{children}</>;

const Tooltip: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      {children}
    </TooltipContext.Provider>
  );
};

const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, asChild, ...props }, ref) => {
  const ctx = React.useContext(TooltipContext);

  const handleMouseEnter = () => ctx?.setOpen(true);
  const handleMouseLeave = () => ctx?.setOpen(false);

  if (asChild && React.isValidElement(props.children)) {
    // cloneElement's props type is `Partial<unknown>`, which doesn't accept
    // `ref`/handlers by default. Cast the child to a permissive ReactElement
    // so TS allows merging these props in.
    const child = props.children as React.ReactElement<
      Record<string, unknown>
    >;
    return React.cloneElement(child, {
      ref,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    } as Record<string, unknown>);
  }

  return (
    <button
      ref={ref}
      className={cn(className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    />
  );
});
TooltipTrigger.displayName = "TooltipTrigger";

export interface TooltipContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  hidden?: boolean;
  // Accepted for compatibility with callers (e.g. sidebar SidebarMenuButton)
  // that pass these through from Radix-flavoured APIs. We don't do positioning
  // in this lightweight tooltip, so they're ignored at runtime.
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  (
    // strip `side` and `align` so they don't leak onto the DOM node
    { className, hidden, side: _side, align: _align, ...props },
    ref
  ) => {
    const ctx = React.useContext(TooltipContext);
    if (!ctx || !ctx.open || hidden) return null;

    return (
      <div
        ref={ref}
        className={cn(
          "z-50 rounded-md bg-slate-900 px-2 py-1 text-xs text-slate-50 shadow-md",
          className
        )}
        {...props}
      />
    );
  }
);
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };

