import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TravelDuration = "day" | "onenight" | "twonight";
export type TravelPurpose =
  | "food"
  | "kculture"
  | "nature"
  | "history"
  | "shopping"
  | "rest";

export interface ContentItem {
  id: number;
  name: string;
  imageUrl: string;
}

export interface BudgetRange {
  min: number;
  max: number;
}

interface OnboardingState {
  duration: TravelDuration | null;
  selectedArtists: ContentItem[];
  selectedRegions: ContentItem[];
  purposes: TravelPurpose[];
  budget: BudgetRange;
  setDuration: (d: TravelDuration) => void;
  toggleArtist: (item: ContentItem) => void;
  toggleRegion: (item: ContentItem) => void;
  togglePurpose: (p: TravelPurpose) => void;
  setBudget: (range: BudgetRange) => void;
  reset: () => void;
}

const DEFAULT_BUDGET: BudgetRange = { min: 30000, max: 2000000 };

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      duration: null,
      selectedArtists: [],
      selectedRegions: [],
      purposes: [],
      budget: DEFAULT_BUDGET,
      setDuration: (d) => set({ duration: d }),
      toggleArtist: (item) =>
        set((state) => {
          const exists = state.selectedArtists.some((a) => a.id === item.id);
          if (exists) {
            return { selectedArtists: state.selectedArtists.filter((a) => a.id !== item.id) };
          }
          if (state.selectedArtists.length >= 5) return state;
          return { selectedArtists: [...state.selectedArtists, item] };
        }),
      toggleRegion: (item) =>
        set((state) => {
          const exists = state.selectedRegions.some((r) => r.id === item.id);
          if (exists) {
            return { selectedRegions: state.selectedRegions.filter((r) => r.id !== item.id) };
          }
          if (state.selectedRegions.length >= 5) return state;
          return { selectedRegions: [...state.selectedRegions, item] };
        }),
      togglePurpose: (p) =>
        set((state) => {
          const exists = state.purposes.includes(p);
          return {
            purposes: exists
              ? state.purposes.filter((x) => x !== p)
              : [...state.purposes, p],
          };
        }),
      setBudget: (range) => set({ budget: range }),
      reset: () =>
        set({
          duration: null,
          selectedArtists: [],
          selectedRegions: [],
          purposes: [],
          budget: DEFAULT_BUDGET,
        }),
    }),
    { name: "kride-onboarding" }
  )
);
