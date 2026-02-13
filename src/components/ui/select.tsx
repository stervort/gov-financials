import * as React from "react";
import { cn } from "@/src/lib/cn";
export function Select(p:React.SelectHTMLAttributes<HTMLSelectElement>){
  return <select {...p} className={cn("w-full rounded-md border px-3 py-2 text-sm bg-white", p.className)} />;
}
