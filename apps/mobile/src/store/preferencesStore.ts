import { create } from "zustand";

export const DIETARY_PRESETS = [
  "No nuts",
  "Vegetarian",
  "Vegan",
  "Gluten-free",
  "No dairy",
  "No shellfish",
] as const;

type PreferencesStore = {
  notes: string;
  setNotes: (notes: string) => void;
  togglePreset: (preset: string) => void;
  clearNotes: () => void;
};

function hasPreset(notes: string, preset: string) {
  return notes
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .includes(preset.trim().toLowerCase());
}

export const usePreferencesStore = create<PreferencesStore>((set, get) => ({
  notes: "",

  setNotes: (notes) => set({ notes: notes.trim().slice(0, 200) }),

  togglePreset: (preset) => {
    const current = get().notes.trim();
    if (hasPreset(current, preset)) {
      const next = current
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.toLowerCase() !== preset.trim().toLowerCase())
        .join(", ");
      set({ notes: next });
      return;
    }
    set({ notes: current ? `${current}, ${preset}` : preset });
  },

  clearNotes: () => set({ notes: "" }),
}));
