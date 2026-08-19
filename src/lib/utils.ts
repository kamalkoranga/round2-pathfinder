import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 0–1 → "72%" */
export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** 34 → "34h", 90 → "90h (~11 days)" style compact duration. */
export function hours(value: number): string {
  return `${Math.round(value)}h`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
