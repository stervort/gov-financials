import * as React from "react";
import { cn } from "@/src/lib/cn";
type Variant="default"|"secondary"|"ghost";
const v:Record<Variant,string>={default:"bg-black text-white hover:bg-black/90",secondary:"bg-gray-100 text-gray-900 hover:bg-gray-200",ghost:"text-gray-900 hover:bg-gray-100"};
export function Button({variant="default",className,...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&{variant?:Variant}){
  return <button {...props} className={cn("inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50", v[variant], className)} />;
}
