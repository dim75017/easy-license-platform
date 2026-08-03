export type Track = {
  id: string;
  title: string;
  artist: string;
  mood: string;
  use: string;
  bpm: number;
  duration: string;
  accent: string;
  new?: boolean;
};

export const tracks: Track[] = [
  {
    id: "EL-001",
    title: "Window Seat",
    artist: "Catalogue preview",
    mood: "Dreamy",
    use: "Study",
    bpm: 76,
    duration: "2:41",
    accent: "violet",
    new: true,
  },
  {
    id: "EL-002",
    title: "Soft Focus",
    artist: "Catalogue preview",
    mood: "Warm",
    use: "Vlog",
    bpm: 82,
    duration: "2:18",
    accent: "peach",
  },
  {
    id: "EL-003",
    title: "After the Rain",
    artist: "Catalogue preview",
    mood: "Nostalgic",
    use: "Storytelling",
    bpm: 70,
    duration: "3:06",
    accent: "blue",
  },
  {
    id: "EL-004",
    title: "Quiet Momentum",
    artist: "Catalogue preview",
    mood: "Focused",
    use: "Coding",
    bpm: 88,
    duration: "2:52",
    accent: "mint",
    new: true,
  },
  {
    id: "EL-005",
    title: "Corner Café",
    artist: "Catalogue preview",
    mood: "Cozy",
    use: "Podcast",
    bpm: 74,
    duration: "2:33",
    accent: "amber",
  },
  {
    id: "EL-006",
    title: "Neon Notebook",
    artist: "Catalogue preview",
    mood: "Night",
    use: "Streaming",
    bpm: 92,
    duration: "2:27",
    accent: "pink",
  },
  {
    id: "EL-007",
    title: "Small Hours",
    artist: "Catalogue preview",
    mood: "Calm",
    use: "Sleep",
    bpm: 64,
    duration: "3:22",
    accent: "indigo",
  },
  {
    id: "EL-008",
    title: "Day One",
    artist: "Catalogue preview",
    mood: "Hopeful",
    use: "Lifestyle",
    bpm: 86,
    duration: "2:49",
    accent: "lime",
  },
];

export const moods = ["All moods", ...Array.from(new Set(tracks.map((track) => track.mood)))];
export const uses = ["All uses", ...Array.from(new Set(tracks.map((track) => track.use)))];
