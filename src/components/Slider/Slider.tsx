import type { CSSProperties, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "min" | "max"> & {
  value: number;
  min?: number;
  max?: number;
};

/**
 * The app's range slider (Stat Points, current HP): a light track filled in
 * green up to the value, with a round green knob — styled in globals.css
 * (`.slider`) rather than via `accent-color`, which makes the browser darken
 * the whole track for a light accent like this green.
 */
export function Slider({ value, min = 0, max = 100, className, style, ...props }: SliderProps) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      className={cn("slider w-full", className)}
      style={{ ...style, "--fill": `${fill}%` } as CSSProperties}
      {...props}
    />
  );
}
