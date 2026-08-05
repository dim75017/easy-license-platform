export const useCategories = [
  {
    slug: "travel",
    label: "Travel",
    description: "Road trips, city guides and slow journeys.",
    image: "/images/unsplash/hero-listening.jpg",
  },
  {
    slug: "cinematic",
    label: "Cinematic",
    description: "Short films, trailers, documentaries and visual essays.",
    image: "/images/unsplash/campaign-filmset.jpg",
  },
  {
    slug: "lifestyle-vlogs",
    label: "Lifestyle & Vlogs",
    description: "Everyday edits, routines, interiors and personal stories.",
    image: "/images/unsplash/vlogger.jpg",
  },
  {
    slug: "study-focus",
    label: "Study & Focus",
    description: "Long-form work, study sessions and calm tutorials.",
    image: "/images/stock/cozy-workspace.jpg",
  },
  {
    slug: "gaming-streaming",
    label: "Gaming & Streaming",
    description: "Gameplay, live sessions and community content.",
    image: "/images/unsplash/streamer.jpg",
  },
  {
    slug: "podcasts",
    label: "Podcasts",
    description: "Openings, transitions, interviews and narrative episodes.",
    image: "/images/stock/studio-artist.jpg",
  },
  {
    slug: "wellness",
    label: "Wellness",
    description: "Meditation, movement, rest and quiet rituals.",
    image: "/images/unsplash/massage.jpg",
  },
  {
    slug: "food-hospitality",
    label: "Food & Hospitality",
    description: "Recipes, cafés, restaurants and welcoming spaces.",
    image: "/images/unsplash/retail/cafe.jpg",
  },
] as const;

export type MusicUseSlug = (typeof useCategories)[number]["slug"];

export const playlists = [
  { title: "Soft focus", subtitle: "Lo-fi & ambient for deep work", use: "study-focus" as MusicUseSlug, accent: "plum", tracks: "186 tracks" },
  { title: "Daylight drives", subtitle: "Warm instrumentals for travel stories", use: "travel" as MusicUseSlug, accent: "gold", tracks: "242 tracks" },
  { title: "Quiet scenes", subtitle: "Cinematic music for picture-led work", use: "cinematic" as MusicUseSlug, accent: "forest", tracks: "164 tracks" },
  { title: "After hours", subtitle: "Jazzhop and late-night rhythms", use: "food-hospitality" as MusicUseSlug, accent: "rust", tracks: "128 tracks" },
  { title: "Live energy", subtitle: "Background music for streams", use: "gaming-streaming" as MusicUseSlug, accent: "blue", tracks: "97 tracks" },
  { title: "Slow rituals", subtitle: "Gentle music for wellness and rest", use: "wellness" as MusicUseSlug, accent: "sage", tracks: "211 tracks" },
] as const;

export type Track = {
  id: string;
  spotifyId: string;
  title: string;
  artist: string;
  genre: string;
  streams: string;
  cover: string;
  spotifyUrl: string;
  suggestedUses: MusicUseSlug[];
  moods: string[];
  /** Compatibility fields used by the signed-in workspace preview. */
  mood: string;
  use: string;
  bpm: "—";
  duration: string;
  accent: string;
};

export const tracks: Track[] = [
  {
    id: "EL-FEAT-001",
    spotifyId: "5Nsf7Z3GKvdWj2FEP12QUy",
    title: "Melting Snowman",
    artist: "Mujo",
    genre: "Lofi",
    streams: "1.1M streams",
    cover: "/images/catalogue/melting-snowman.jpg",
    spotifyUrl: "https://open.spotify.com/track/5Nsf7Z3GKvdWj2FEP12QUy",
    suggestedUses: ["study-focus", "gaming-streaming", "wellness", "lifestyle-vlogs"],
    moods: ["Warm", "Calm", "Cozy"],
    mood: "Warm",
    use: "Study & Focus",
    bpm: "—",
    duration: "Spotify",
    accent: "violet",
  },
  {
    id: "EL-FEAT-002",
    spotifyId: "0Q2LHrREFF9rtX3PuMUoNL",
    title: "5:32pm",
    artist: "The Deli",
    genre: "Jazzhop",
    streams: "167.9M streams",
    cover: "/images/catalogue/532pm.jpg",
    spotifyUrl: "https://open.spotify.com/track/0Q2LHrREFF9rtX3PuMUoNL",
    suggestedUses: ["travel", "lifestyle-vlogs", "food-hospitality", "gaming-streaming"],
    moods: ["Bright", "Easygoing", "Warm"],
    mood: "Easygoing",
    use: "Travel",
    bpm: "—",
    duration: "Spotify",
    accent: "peach",
  },
  {
    id: "EL-FEAT-003",
    spotifyId: "6BFm6CduJnfZ1RsMYjWO9G",
    title: "Blue and Green",
    artist: "Aso",
    genre: "Chillhop",
    streams: "35.7M streams",
    cover: "/images/catalogue/blue-and-green.jpg",
    spotifyUrl: "https://open.spotify.com/track/6BFm6CduJnfZ1RsMYjWO9G",
    suggestedUses: ["travel", "cinematic", "study-focus", "lifestyle-vlogs"],
    moods: ["Reflective", "Open", "Calm"],
    mood: "Reflective",
    use: "Cinematic",
    bpm: "—",
    duration: "Spotify",
    accent: "blue",
  },
  {
    id: "EL-FEAT-004",
    spotifyId: "4aw3VYsMAEhqaq87YXyvKA",
    title: "Drifting away",
    artist: "Charlee Nguyen",
    genre: "Ambient",
    streams: "5.9M streams",
    cover: "/images/catalogue/drifting-away.jpg",
    spotifyUrl: "https://open.spotify.com/track/4aw3VYsMAEhqaq87YXyvKA",
    suggestedUses: ["cinematic", "podcasts", "wellness", "study-focus"],
    moods: ["Gentle", "Intimate", "Dreamy"],
    mood: "Gentle",
    use: "Podcasts",
    bpm: "—",
    duration: "Spotify",
    accent: "mint",
  },
];

export const featuredTracks = tracks;
export const genres = ["All genres", ...Array.from(new Set(tracks.map((track) => track.genre)))];
export const moods = ["All moods", ...Array.from(new Set(tracks.flatMap((track) => track.moods)))];
export const uses = ["All uses", ...useCategories.map((category) => category.label)];
