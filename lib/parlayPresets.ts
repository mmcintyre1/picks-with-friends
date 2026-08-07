// The fixed set of recurring NFL slots the group actually uses. Kickoff time isn't
// tracked at all -- what matters is which slot a parlay belongs to, for stats later.
// "Free-for-all" is the escape hatch for anything that doesn't fit (other sports, a
// one-off, a custom label like "MNF Week 2").
export type ParlayPreset = {
  key: string;
  label: string;
  league: string;
};

export const PARLAY_PRESETS: ParlayPreset[] = [
  { key: "1pm", label: "1 o'clock games", league: "NFL" },
  { key: "4pm", label: "4 o'clock games", league: "NFL" },
  { key: "snf", label: "SNF", league: "NFL" },
  { key: "tnf", label: "TNF", league: "NFL" },
  { key: "mnf", label: "MNF", league: "NFL" },
];

export const FREE_FOR_ALL_KEY = "free-for-all";
