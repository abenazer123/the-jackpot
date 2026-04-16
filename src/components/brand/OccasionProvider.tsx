/**
 * OccasionProvider — page-level context for the visitor's self-identified
 * occasion. The OccasionSelector section writes to it; future downstream
 * sections (tagline swaps, review reordering, proximity pills) will read
 * from it. Wedding-specific venue input state lives here too.
 *
 * Wrap in page.tsx (not layout.tsx — occasion is page-specific).
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type OccasionId =
  | "bachelorette"
  | "wedding"
  | "family"
  | "birthday"
  | "getaway";

interface OccasionContextValue {
  occasion: OccasionId;
  setOccasion: (id: OccasionId) => void;
  venue: string;
  setVenue: (v: string) => void;
}

const OccasionContext = createContext<OccasionContextValue>({
  occasion: "bachelorette",
  setOccasion: () => {},
  venue: "",
  setVenue: () => {},
});

export function OccasionProvider({ children }: { children: ReactNode }) {
  const [occasion, setOccasion] = useState<OccasionId>("bachelorette");
  const [venue, setVenue] = useState("");

  return (
    <OccasionContext.Provider
      value={{ occasion, setOccasion, venue, setVenue }}
    >
      {children}
    </OccasionContext.Provider>
  );
}

export function useOccasion(): OccasionContextValue {
  return useContext(OccasionContext);
}
