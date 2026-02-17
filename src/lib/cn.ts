import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// function to make classnames a little more dynamic/easier to integrate 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
