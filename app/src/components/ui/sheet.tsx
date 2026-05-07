"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type SheetContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const SheetContext = React.createContext<SheetContextValue | null>(null);

interface SheetProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const Sheet: React.FC<SheetProps> = ({
  open,
  onOpenChange,
  children,
  ...props
}) => {
  const [internalOpen, setInternalOpen] = React.useState(open ?? false);
  const isControlled = open !== undefined;
  const valueOpen = isControlled ? open! : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };

  return (
    <SheetContext.Provider value={{ open: valueOpen, setOpen }}>
      <div {...props}>{children}</div>
    </SheetContext.Provider>
  );
};

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "left" | "right";
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, side = "right", children, ...props }, ref) => {
    const ctx = React.useContext(SheetContext);
    if (!ctx || !ctx.open) return null;

    return (
      <div className="fixed inset-0 z-40 flex">
        <div
          className="absolute inset-0 bg-black/40"
          onClick={() => ctx.setOpen(false)}
        />
        <div
          ref={ref}
          className={cn(
            "relative z-50 h-full w-72 bg-sidebar text-sidebar-foreground shadow-lg",
            side === "left" ? "ml-0" : "ml-auto",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </div>
    );
  }
);
SheetContent.displayName = "SheetContent";

export { Sheet, SheetContent };

