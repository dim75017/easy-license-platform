import { catalogueMoodFilters, type CatalogueMood } from "../lib/catalog-moods";

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
    image: "/images/unsplash/study-focus-clean.jpg",
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

export type PlaylistAccent = Readonly<{
  color: `#${string}`;
  ink: `#${string}`;
}>;

export const playlistGenreAccents = {
  Lofi: { color: "#a84432", ink: "#fff9f1" },
  Synthwave: { color: "#5b4a91", ink: "#fff9f1" },
  Piano: { color: "#4f735a", ink: "#fff9f1" },
  Ambient: { color: "#315d63", ink: "#fff9f1" },
  "Jazz Lofi": { color: "#8b4a2f", ink: "#fff9f1" },
  "Chill House": { color: "#d8892b", ink: "#292832" },
  Acoustic: { color: "#a75d36", ink: "#fff9f1" },
  Classical: { color: "#795a34", ink: "#fff9f1" },
  "Bossa Lofi": { color: "#c69a2c", ink: "#292832" },
  "Seasonal Lofi": { color: "#a63336", ink: "#fff9f1" },
} as const satisfies Record<string, PlaylistAccent>;

export type PlaylistGenre = keyof typeof playlistGenreAccents;

export type LofiGirlPlaylist = {
  id: string;
  title: string;
  spotifyTitle: string;
  description: string;
  spotifyId: string;
  use: MusicUseSlug;
  genre: PlaylistGenre;
  accent?: PlaylistAccent;
  moods: readonly string[];
  image: `/images/unsplash/playlists/${string}.jpg`;
  thumbnail: `/images/unsplash/playlists/thumbnails/${string}.webp`;
  imagePosition?: string;
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
    image: "/images/unsplash/playlists/lofi-study-laptop-dwZlYC-6-9c.jpg",
    thumbnail: "/images/unsplash/playlists/thumbnails/lofi-study-laptop-dwZlYC-6-9c.webp",
    imagePosition: "66% 44%",
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
    image: "/images/unsplash/playlists/synthwave-console-p0j-mE6mGo4.jpg",
    thumbnail: "/images/unsplash/playlists/thumbnails/synthwave-console-p0j-mE6mGo4.webp",
    imagePosition: "50% 50%",
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
    image: "/images/unsplash/playlists/peaceful-piano-hands-5P1-Bemnb0c.jpg",
    thumbnail: "/images/unsplash/playlists/thumbnails/peaceful-piano-hands-5P1-Bemnb0c.webp",
    imagePosition: "52% 50%",
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
    thumbnail: "/images/unsplash/playlists/thumbnails/dark-ambient-fog.webp",
    imagePosition: "60% center",
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
    thumbnail: "/images/unsplash/playlists/thumbnails/jazz-lofi-saxophone.webp",
    imagePosition: "58% center",
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
    thumbnail: "/images/unsplash/playlists/thumbnails/chill-house.webp",
    imagePosition: "center 58%",
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
    thumbnail: "/images/unsplash/playlists/thumbnails/sleep-ambient-bedside.webp",
    imagePosition: "64% center",
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
    image: "/images/unsplash/playlists/chill-guitar-couch-KEtvAfDlpWI.jpg",
    thumbnail: "/images/unsplash/playlists/thumbnails/chill-guitar-couch-KEtvAfDlpWI.webp",
    imagePosition: "46% 47%",
  },
  {
    id: "relaxing-classical",
    title: "Classical",
    spotifyTitle: "Relaxing Classical Music",
    description: "Soothing strings and piano for focused work, elegant edits and reflective scenes.",
    spotifyId: "36varCeUCC5XN7rXuMMa0Z",
    use: "study-focus",
    genre: "Classical",
    moods: ["Elegant", "Peaceful", "Reflective"],
    image: "/images/unsplash/playlists/classical-quartet-__2fmv-P4eA.jpg",
    thumbnail: "/images/unsplash/playlists/thumbnails/classical-quartet-__2fmv-P4eA.webp",
    imagePosition: "center",
  },
  {
    id: "bossa-lofi",
    title: "Bossa Lofi",
    spotifyTitle: "Bossa Lofi",
    description: "Sunny bossa grooves and mellow lofi textures for food, travel and easygoing stories.",
    spotifyId: "7Lky3YE5SfTMKQxD7FnC6J",
    use: "food-hospitality",
    genre: "Bossa Lofi",
    moods: ["Sunny", "Easygoing", "Warm"],
    image: "/images/unsplash/playlists/bossa-trees-KttgjNw5Iqo.jpg",
    thumbnail: "/images/unsplash/playlists/thumbnails/bossa-trees-KttgjNw5Iqo.webp",
    imagePosition: "center",
  },
  {
    id: "christmas-music",
    title: "Christmas Music",
    spotifyTitle: "Christmas Music",
    description: "Warm festive instrumentals for holiday edits, gatherings and winter storytelling.",
    spotifyId: "74UM9i1Dkr7dClq7u4PGYF",
    use: "lifestyle-vlogs",
    genre: "Seasonal Lofi",
    accent: { color: "#a63336", ink: "#fff9f1" },
    moods: ["Festive", "Cozy", "Warm"],
    image: "/images/unsplash/playlists/christmas-tree-Kf8ko_oGN20.jpg",
    thumbnail: "/images/unsplash/playlists/thumbnails/christmas-tree-Kf8ko_oGN20.webp",
    imagePosition: "center",
  },
  {
    id: "halloween-music",
    title: "Halloween Music",
    spotifyTitle: "Halloween Music 2026",
    description: "Spooky lofi beats and eerie textures for seasonal streams, games and night-time edits.",
    spotifyId: "6FEzJ6EWEHpUz0nz7gIVvJ",
    use: "gaming-streaming",
    genre: "Seasonal Lofi",
    accent: { color: "#df7428", ink: "#292832" },
    moods: ["Spooky", "Dark", "Playful"],
    image: "/images/unsplash/playlists/halloween-pumpkin-MYRG0ptGh50.jpg",
    thumbnail: "/images/unsplash/playlists/thumbnails/halloween-pumpkin-MYRG0ptGh50.webp",
    imagePosition: "center",
  },
] satisfies readonly LofiGirlPlaylist[];

export function getPlaylistAccent(playlist: Pick<LofiGirlPlaylist, "genre" | "accent">): PlaylistAccent {
  return playlist.accent ?? playlistGenreAccents[playlist.genre];
}

export type CreatorPlaylistTrack = {
  playlistId: string;
  playlistTitle: string;
  spotifyId: string;
  previewUrl: `https://p.scdn.co/mp3-preview/${string}`;
  title: string;
  artist: string;
  genre: string;
  duration: `${number}:${number}`;
  durationIso: `PT${number}M${number}S`;
  cover: `/images/catalogue/creator-playlist-tracks/${string}.webp`;
  suggestedUses: readonly MusicUseSlug[];
  moods: readonly FeaturedMood[];
};

export const featuredMoods = ["Warm", "Calm", "Cozy", "Bright", "Easygoing", "Reflective", "Open", "Gentle", "Intimate", "Dreamy"] as const;
export type FeaturedMood = (typeof featuredMoods)[number] | CatalogueMood;

/**
 * Eight editor-selected tracks drawn from the featured public playlists,
 * verified from Spotify's public embeds on 2026-08-11. Artwork is stored
 * locally; promotional audio previews remain remote and are never cached.
 */
export const creatorPlaylistTracks = [
  {
    playlistId: "lofi-study",
    playlistTitle: "Lofi Study",
    spotifyId: "4ytksG38eM66TkmAjn3PmU",
    previewUrl: "https://p.scdn.co/mp3-preview/96689c48a7af6e6061a9fd4a48d470ee83875714",
    title: "Snowflakes",
    artist: "Pandrezz",
    genre: "Lofi",
    duration: "3:20",
    durationIso: "PT3M20S",
    cover: "/images/catalogue/creator-playlist-tracks/snowflakes.webp",
    suggestedUses: ["study-focus"],
    moods: ["Warm", "Calm", "Laid Back", "Relaxing", "Peaceful"],
  },
  {
    playlistId: "synthwave-night",
    playlistTitle: "Synthwave Night",
    spotifyId: "0pbcr9ya4OHHDwMKOb5YZr",
    previewUrl: "https://p.scdn.co/mp3-preview/9ac1edb67776450aa20d66e525b128751f526db8",
    title: "Celestial Awakening",
    artist: "Opal",
    genre: "Synthwave",
    duration: "3:01",
    durationIso: "PT3M1S",
    cover: "/images/catalogue/creator-playlist-tracks/celestial-awakening.webp",
    suggestedUses: ["gaming-streaming"],
    moods: ["Bright", "Open", "Hopeful", "Happy", "Floating"],
  },
  {
    playlistId: "peaceful-piano",
    playlistTitle: "Peaceful Piano",
    spotifyId: "2tWn2VgQTOAU0IwAjMHkOn",
    previewUrl: "https://p.scdn.co/mp3-preview/456c4002a241bb502b608502c394beeac29a08e8",
    title: "The Places We Used to Walk",
    artist: "Mariposa",
    genre: "Piano",
    duration: "3:01",
    durationIso: "PT3M1S",
    cover: "/images/catalogue/creator-playlist-tracks/the-places-we-used-to-walk.webp",
    suggestedUses: ["podcasts"],
    moods: ["Reflective", "Sad", "Sentimental", "Peaceful"],
  },
  {
    playlistId: "dark-ambient",
    playlistTitle: "Dark Ambient",
    spotifyId: "1bcrf3BtzGyHCfc27jqcCi",
    previewUrl: "https://p.scdn.co/mp3-preview/64fcff60ab297f39ffce22394b4174e3528befc0",
    title: "Lightswitch",
    artist: "Stilte, schimmerlicht",
    genre: "Ambient",
    duration: "1:51",
    durationIso: "PT1M51S",
    cover: "/images/catalogue/creator-playlist-tracks/lightswitch.webp",
    suggestedUses: ["cinematic"],
    moods: ["Dreamy", "Dark", "Mysterious", "Floating"],
  },
  {
    playlistId: "jazz-lofi",
    playlistTitle: "Jazz Lofi",
    spotifyId: "2mnWnyRWdsTHUcOMrD6JgC",
    previewUrl: "https://p.scdn.co/mp3-preview/9f04914e875c55adeb4bd870ed60ccd29a3a6ecb",
    title: "Frozen Bubbles",
    artist: "Worldtraveller, Max Merseny, Viktor Minsky",
    genre: "Jazz Lofi",
    duration: "2:08",
    durationIso: "PT2M8S",
    cover: "/images/catalogue/creator-playlist-tracks/frozen-bubbles.webp",
    suggestedUses: ["food-hospitality"],
    moods: ["Cozy", "Smooth", "Happy", "Laid Back"],
  },
  {
    playlistId: "chill-house",
    playlistTitle: "Chill House",
    spotifyId: "5PRK2YEF3iSufclolLWqaQ",
    previewUrl: "https://p.scdn.co/mp3-preview/ccc8c3e33d7c84fe938bd5a11b2153422618f348",
    title: "Tempel",
    artist: "Morning life",
    genre: "Chill House",
    duration: "2:26",
    durationIso: "PT2M26S",
    cover: "/images/catalogue/creator-playlist-tracks/tempel.webp",
    suggestedUses: ["travel"],
    moods: ["Easygoing", "Laid Back", "Smooth", "Relaxing"],
  },
  {
    playlistId: "sleep-ambient",
    playlistTitle: "Sleep Ambient",
    spotifyId: "7N0SEnpPcc28E1kBhRFoKQ",
    previewUrl: "https://p.scdn.co/mp3-preview/096223c9326975fd256d46b78c94a13a0771c320",
    title: "Flickering Dust",
    artist: "anębu",
    genre: "Ambient",
    duration: "2:08",
    durationIso: "PT2M8S",
    cover: "/images/catalogue/creator-playlist-tracks/flickering-dust.webp",
    suggestedUses: ["wellness"],
    moods: ["Gentle", "Peaceful", "Relaxing", "Floating"],
  },
  {
    playlistId: "chill-guitar",
    playlistTitle: "Chill Guitar",
    spotifyId: "0kjzCZ5nEUb7WN9tIwOjKI",
    previewUrl: "https://p.scdn.co/mp3-preview/825d8362abacc77191cfb4f2af96e9277b163ca5",
    title: "Green Glimmers",
    artist: "Antonio Roberto",
    genre: "Acoustic",
    duration: "2:26",
    durationIso: "PT2M26S",
    cover: "/images/catalogue/creator-playlist-tracks/green-glimmers.webp",
    suggestedUses: ["lifestyle-vlogs"],
    moods: ["Intimate", "Romantic", "Warm", "Sentimental"],
  },
] satisfies readonly CreatorPlaylistTrack[];

export type Track = {
  id: string;
  spotifyId: string;
  previewUrl: `https://p.scdn.co/mp3-preview/${string}`;
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
  bpm: number | null;
  duration: `${number}:${number}` | null;
  durationIso: `PT${number}M${number}S` | null;
  accent: string;
};

export const tracks: Track[] = [
  {
    id: "EL-FEAT-001",
    spotifyId: "5Nsf7Z3GKvdWj2FEP12QUy",
    previewUrl: "https://p.scdn.co/mp3-preview/1f9010c8d1247012b47cbe912912d8a91052f958",
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
    bpm: null,
    duration: "3:01",
    durationIso: "PT3M1S",
    accent: "violet",
  },
  {
    id: "EL-FEAT-002",
    spotifyId: "0Q2LHrREFF9rtX3PuMUoNL",
    previewUrl: "https://p.scdn.co/mp3-preview/bd2312921fd60bcd65401541cb608fecc96b525e",
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
    bpm: null,
    duration: "2:08",
    durationIso: "PT2M8S",
    accent: "peach",
  },
  {
    id: "EL-FEAT-003",
    spotifyId: "6BFm6CduJnfZ1RsMYjWO9G",
    previewUrl: "https://p.scdn.co/mp3-preview/271745d56b282f5b081c84c1fc57aaed1ed5d6e4",
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
    bpm: null,
    duration: "2:26",
    durationIso: "PT2M26S",
    accent: "blue",
  },
  {
    id: "EL-FEAT-004",
    spotifyId: "4aw3VYsMAEhqaq87YXyvKA",
    previewUrl: "https://p.scdn.co/mp3-preview/7c12e967ceb03fa2efb04e48617b19e35e1dbe4a",
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
    bpm: null,
    duration: "2:26",
    durationIso: "PT2M26S",
    accent: "mint",
  },
];

export type WorkspaceRelease = {
  id: string;
  title: string;
  type: string;
  upc: string | null;
  releaseDate: string | null;
  trackCount: number | null;
};

export type WorkspaceTrack = {
  id: string;
  spotifyId: string | null;
  previewUrl: string;
  previewDownloadUrl?: string | null;
  spotifyUrl: string | null;
  title: string;
  artist: string;
  cover: string | null;
  genre: string;
  moods: readonly string[];
  themes: readonly MusicUseSlug[];
  duration: `${number}:${number}` | null;
  durationIso: `PT${number}M${number}S` | null;
  bpm: number | null;
  release?: WorkspaceRelease | null;
  publishedAt?: string | null;
};

/** A normalized, honest preview index for the connected search experience. */
export const workspaceTracks: readonly WorkspaceTrack[] = [
  ...creatorPlaylistTracks.map((track) => ({
    id: `PLAYLIST-${track.spotifyId}`,
    spotifyId: track.spotifyId,
    previewUrl: track.previewUrl,
    spotifyUrl: `https://open.spotify.com/track/${track.spotifyId}`,
    title: track.title,
    artist: track.artist,
    cover: track.cover,
    genre: track.genre,
    moods: track.moods,
    themes: track.suggestedUses,
    duration: track.duration,
    durationIso: track.durationIso,
    bpm: null,
  })),
  ...tracks.map((track) => ({
    id: track.id,
    spotifyId: track.spotifyId,
    previewUrl: track.previewUrl,
    spotifyUrl: track.spotifyUrl,
    title: track.title,
    artist: track.artist,
    cover: track.cover,
    genre: track.genre,
    moods: track.moods,
    themes: track.suggestedUses,
    duration: track.duration,
    durationIso: track.durationIso,
    bpm: track.bpm,
  })),
];

export const featuredTracks = tracks;
export const genres = ["All genres", ...Array.from(new Set(workspaceTracks.map((track) => track.genre)))];
export const moods = ["All moods", ...Array.from(new Set([...catalogueMoodFilters, ...workspaceTracks.flatMap((track) => track.moods)]))];
export const uses = ["All themes", ...useCategories.map((category) => category.label)];

/** Canonical search language for the connected music library. */
export const musicSearchTaxonomy = {
  genres: genres.slice(1),
  moods: catalogueMoodFilters,
  themes: useCategories.map(({ label, slug }) => ({ label, slug })),
  artists: Array.from(new Set(workspaceTracks.map((track) => track.artist))),
} as const;
