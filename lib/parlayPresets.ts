// The fixed set of recurring NFL slots the group actually uses. Kickoff time isn't
// tracked at all -- what matters is which slot a parlay belongs to, for stats later.
// "Free-for-all" is the escape hatch for anything that doesn't fit (other sports, a
// one-off, a custom label like "MNF Week 2").
export type ParlayPreset = {
  key: string;
  label: string;
  league: string;
  // SNF/TNF/MNF are inherently one real-world game -- the same-game pick rule doesn't
  // apply to them. 1pm/4pm have multiple games, so it does.
  singleGame: boolean;
};

export const PARLAY_PRESETS: ParlayPreset[] = [
  { key: "1pm", label: "1 o'clock games", league: "NFL", singleGame: false },
  { key: "4pm", label: "4 o'clock games", league: "NFL", singleGame: false },
  { key: "snf", label: "SNF", league: "NFL", singleGame: true },
  { key: "tnf", label: "TNF", league: "NFL", singleGame: true },
  { key: "mnf", label: "MNF", league: "NFL", singleGame: true },
];

export const FREE_FOR_ALL_KEY = "free-for-all";
