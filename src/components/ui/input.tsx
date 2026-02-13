import * as React from "react";
import { cn } from "@/src/lib/cn";
export function Input(p:React.InputHTMLAttributes<HTMLInputElement>){
  return <input {...p} className={cn("w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20", p.className)} />;
}
