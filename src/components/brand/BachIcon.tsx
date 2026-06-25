/**
 * BachIcon — a small line-art icon vocabulary for the /bachelorette page
 * (value stack + experience tiles + anchor items). Replaces the pink
 * asterisks. Same approach as the /batch Icon: a switch over keys returning
 * inline SVGs with a consistent stroke treatment. Inherits `currentColor`.
 */

export type BachIconKey =
  | "house"
  | "glam"
  | "chef"
  | "boat"
  | "camera"
  | "decor"
  | "transport"
  | "planning"
  | "playbook"
  | "welcome"
  | "recap"
  | "clock"
  | "shield";

export function BachIcon({
  k,
  size = 22,
}: {
  k: BachIconKey | string;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (k) {
    case "house":
      return (
        <svg {...common}>
          <path d="M4 11 L12 4 L20 11" />
          <path d="M6 10 L6 20 L18 20 L18 10" />
        </svg>
      );
    case "glam": // hand mirror
      return (
        <svg {...common}>
          <circle cx="12" cy="9" r="5" />
          <path d="M12 14 L12 20 M9.5 20 L14.5 20" />
        </svg>
      );
    case "chef": // fork + knife
      return (
        <svg {...common}>
          <path d="M8 3 L8 21 M6 3 L6 8 Q6 9 7 9 L9 9 Q10 9 10 8 L10 3" />
          <path d="M16 3 Q19 4 19 9 Q19 12 16 12 L16 21" />
        </svg>
      );
    case "boat":
      return (
        <svg {...common}>
          <path d="M4 15 L20 15 L18 19 L6 19 Z" />
          <path d="M12 15 L12 4 L19 11 L12 11" />
        </svg>
      );
    case "camera":
    case "recap": // camera / video, close enough vocab
      return (
        <svg {...common}>
          <path d="M4 8 L7 8 L8.5 6 L15.5 6 L17 8 L20 8 L20 18 L4 18 Z" />
          <circle cx="12" cy="12.5" r="3.2" />
        </svg>
      );
    case "decor": // balloons
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="4" />
          <circle cx="16" cy="9.5" r="3.2" />
          <path d="M9 12 L9 20 M16 12.7 L16 19" />
        </svg>
      );
    case "transport": // car
      return (
        <svg {...common}>
          <path d="M3 15 L4.5 10 L17 10 L20 14 L21 15 L21 18 L3 18 Z" />
          <circle cx="7" cy="18" r="1.6" />
          <circle cx="16.5" cy="18" r="1.6" />
        </svg>
      );
    case "planning": // clipboard checklist
      return (
        <svg {...common}>
          <path d="M6 5 L18 5 L18 21 L6 21 Z" />
          <path d="M9 4 L15 4 L15 6.5 L9 6.5 Z" />
          <path d="M9 11 L10.5 12.5 L13 9.5 M9 16 L15 16" />
        </svg>
      );
    case "playbook": // open book
      return (
        <svg {...common}>
          <path d="M12 7 Q8 4 4 5 L4 18 Q8 17 12 19 Q16 17 20 18 L20 5 Q16 4 12 7 Z" />
          <path d="M12 7 L12 19" />
        </svg>
      );
    case "welcome": // banner / sign
      return (
        <svg {...common}>
          <path d="M5 4 L19 4 L19 13 L12 13 L12 16 M19 13 L17 16" />
          <path d="M5 4 L5 13 L12 13" />
          <path d="M5 7 L19 7" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7.5 L12 12 L15 14" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 L19 6 L19 11 Q19 18 12 21 Q5 18 5 11 L5 6 Z" />
          <path d="M9 12 L11 14 L15 9.5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
  }
}
