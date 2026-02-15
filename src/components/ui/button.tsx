import * as React from "react";

export type Variant = "default" | "secondary" | "ghost";

function variantClasses(variant: Variant) {
  switch (variant) {
    case "secondary":
      return "bg-gray-100 text-gray-900 hover:bg-gray-200";
    case "ghost":
      return "bg-transparent hover:bg-gray-100";
    case "default":
    default:
      return "bg-black text-white hover:bg-black/90";
  }
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "default", className = "", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={[
        "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium",
        "transition-colors disabled:opacity-50 disabled:pointer-events-none",
        variantClasses(variant),
        className,
      ].join(" ")}
    />
  );
}
