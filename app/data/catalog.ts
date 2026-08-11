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
    image: "/images/unsplash/study.jpg",
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
    image: "/images/unsplash/podcast-home.jpg",
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
    image: "/images/unsplash/food-hospitality.jpg",
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

export type LofiGirlPlaylist = {
  id: string;
  title: string;
  spotifyTitle: string;
  description: string;
  spotifyId: string;
  use: MusicUseSlug;
  genre: string;
  moods: readonly string[];
  image: `/images/unsplash/playlists/${string}.jpg`;
  imagePosition?: string;
  borderColor: `#${string}`;
};

/**
 * Editorial directions drawn from Lofi Girl's public Spotify profile.
 * The photographs are mood references, not official Spotify cover art.
 */
export const lofiGirlPlaylists = [
  {
    id: "lofi-study",
    title: "Lofi Study",
    spotifyTitle: "Lofi Girl - beats to relax/study to",
    description: "Warm, steady instrumentals for long edits, deep work and quiet routines.",
    spotifyId: "0vvXsWCC9xrXsKd4FyS8kM",
    use: "study-focus",
    genre: "Lofi",
    moods: ["Warm", "Calm", "Focused"],
    image: "/images/unsplash/playlists/lofi-study.jpg",
    imagePosition: "center 42%",
    borderColor: "#2F665E",
  },
  {
    id: "synthwave-night",
    title: "Synthwave Night",
    spotifyTitle: "Synthwave - beats to chill/game to",
    description: "Neon pulse and retro electronics for gaming, streams and after-dark edits.",
    spotifyId: "1YIe34rcmLjCYpY9wJoM2p",
    use: "gaming-streaming",
    genre: "Synthwave",
    moods: ["Neon", "Driving", "Focused"],
    image: "/images/unsplash/playlists/synthwave-night.jpg",
    imagePosition: "center 50%",
    borderColor: "#6674B9",
  },
  {
    id: "peaceful-piano",
    title: "Peaceful Piano",
    spotifyTitle: "Peaceful Piano - music to focus/study to",
    description: "Spacious piano pieces for reading, reflective stories and slower moments.",
    spotifyId: "1u4F50HA53L3Jwxbnk9IeO",
    use: "study-focus",
    genre: "Piano",
    moods: ["Peaceful", "Reflective", "Soft"],
    image: "/images/unsplash/playlists/peaceful-piano.jpg",
    imagePosition: "center 48%",
    borderColor: "#84927B",
  },
  {
    id: "dark-ambient",
    title: "Dark Ambient",
    spotifyTitle: "Dark Ambient - music to escape/dream to",
    description: "Textural, cinematic sound for night scenes, documentaries and imagined worlds.",
    spotifyId: "07lYUEyTkWP3NqIa7Kzyqx",
    use: "cinematic",
    genre: "Ambient",
    moods: ["Dark", "Dreamy", "Cinematic"],
    image: "/images/unsplash/playlists/dark-ambient-fog.jpg",
    imagePosition: "60% center",
    borderColor: "#536B63",
  },
  {
    id: "jazz-lofi",
    title: "Jazz Lofi",
    spotifyTitle: "Jazz lofi",
    description: "Soft keys, dusty drums and late-night warmth for cafés, food and everyday life.",
    spotifyId: "6abvvGTDj4WuFRNDMsHsw8",
    use: "food-hospitality",
    genre: "Jazz Lofi",
    moods: ["Cozy", "Late night", "Easygoing"],
    image: "/images/unsplash/playlists/jazz-lofi-saxophone.jpg",
    imagePosition: "58% center",
    borderColor: "#B88A54",
  },
  {
    id: "chill-house",
    title: "Chill House",
    spotifyTitle: "Chill House 2026 - Feel Good Friday",
    description: "Light electronic momentum for summer recaps, travel and feel-good campaigns.",
    spotifyId: "4lqntZDCCDC5ySCz9Y5eJn",
    use: "travel",
    genre: "Chill House",
    moods: ["Bright", "Sunny", "Free"],
    image: "/images/unsplash/playlists/chill-house.jpg",
    imagePosition: "center 58%",
    borderColor: "#D49A68",
  },
  {
    id: "sleep-ambient",
    title: "Sleep Ambient",
    spotifyTitle: "Sleep Ambient",
    description: "Weightless sound beds for meditation, rest, wellness and gentle transitions.",
    spotifyId: "4AITFDgLpIPPLYmFIKgsvr",
    use: "wellness",
    genre: "Ambient",
    moods: ["Restful", "Gentle", "Weightless"],
    image: "/images/unsplash/playlists/sleep-ambient-bedside.jpg",
    imagePosition: "64% center",
    borderColor: "#8B7895",
  },
  {
    id: "chill-guitar",
    title: "Chill Guitar",
    spotifyTitle: "Chill Guitar",
    description: "Organic guitar-led music for personal stories, podcasts and unhurried vlogs.",
    spotifyId: "1NvyHldjNnayEvqpyk3AYr",
    use: "lifestyle-vlogs",
    genre: "Acoustic",
    moods: ["Organic", "Intimate", "Easygoing"],
    image: "/images/unsplash/playlists/chill-guitar.jpg",
    imagePosition: "center 50%",
    borderColor: "#A9694F",
  },
] satisfies readonly LofiGirlPlaylist[];

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
