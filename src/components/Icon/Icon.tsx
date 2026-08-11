import { IconName } from "@/enums";
import { ICON_PATHS } from "./paths";

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 20, className = "" }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 -960 960 960"
      width={size}
      height={size}
      fill="currentColor"
      className={`shrink-0 select-none ${className}`}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
