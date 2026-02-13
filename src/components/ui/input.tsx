import * as React from "react";
import { cn } from "@/src/lib/cn";
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("w-full rounded-md border px-3 py-2 text-sm", props.className)} />;
}
