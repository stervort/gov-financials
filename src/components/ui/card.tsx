import * as React from "react";
import { cn } from "@/src/lib/cn";
export function Card(p: React.HTMLAttributes<HTMLDivElement>) { return <div {...p} className={cn("rounded-lg border bg-white", p.className)} />; }
export function CardHeader(p: React.HTMLAttributes<HTMLDivElement>) { return <div {...p} className={cn("border-b px-4 py-3", p.className)} />; }
export function CardTitle(p: React.HTMLAttributes<HTMLHeadingElement>) { return <h2 {...p} className={cn("text-lg font-semibold", p.className)} />; }
export function CardContent(p: React.HTMLAttributes<HTMLDivElement>) { return <div {...p} className={cn("px-4 py-4", p.className)} />; }
