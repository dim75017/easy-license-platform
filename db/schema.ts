import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const leadTypes = ["sync", "retail_waitlist"] as const;
export type LeadType = (typeof leadTypes)[number];

export const leadStatuses = [
  "new",
  "contacted",
  "qualified",
  "closed",
  "archived",
] as const;
export type LeadStatus = (typeof leadStatuses)[number];

export const leads = sqliteTable(
  "leads",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type", { enum: leadTypes }).notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    company: text("company").notNull(),
    project: text("project"),
    useCase: text("use_case"),
    budget: text("budget"),
    timeline: text("timeline"),
    status: text("status", { enum: leadStatuses }).notNull().default("new"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check(
      "leads_type_check",
      sql`${table.type} IN ('sync', 'retail_waitlist')`,
    ),
    check(
      "leads_status_check",
      sql`${table.status} IN ('new', 'contacted', 'qualified', 'closed', 'archived')`,
    ),
    check(
      "leads_email_length_check",
      sql`length(${table.email}) BETWEEN 3 AND 254`,
    ),
    check(
      "leads_name_length_check",
      sql`length(${table.name}) BETWEEN 1 AND 120`,
    ),
    check(
      "leads_company_length_check",
      sql`length(${table.company}) BETWEEN 1 AND 160`,
    ),
    check(
      "leads_project_length_check",
      sql`${table.project} IS NULL OR length(${table.project}) BETWEEN 1 AND 4000`,
    ),
    check(
      "leads_use_case_length_check",
      sql`${table.useCase} IS NULL OR length(${table.useCase}) BETWEEN 1 AND 4000`,
    ),
    check(
      "leads_budget_length_check",
      sql`${table.budget} IS NULL OR length(${table.budget}) BETWEEN 1 AND 120`,
    ),
    check(
      "leads_timeline_length_check",
      sql`${table.timeline} IS NULL OR length(${table.timeline}) BETWEEN 1 AND 120`,
    ),
    check(
      "leads_request_shape_check",
      sql`(
        (${table.type} = 'sync' AND ${table.project} IS NOT NULL AND ${table.useCase} IS NULL)
        OR
        (${table.type} = 'retail_waitlist' AND ${table.useCase} IS NOT NULL AND ${table.project} IS NULL)
      )`,
    ),
    index("idx_leads_created_at_id").on(table.createdAt, table.id),
  ],
);

export const accountPlans = ["creator", "pro"] as const;
export type AccountPlan = (typeof accountPlans)[number];

export const accountPlatforms = [
  "youtube",
  "twitch",
  "podcast",
  "instagram",
  "tiktok",
  "other",
] as const;
export type AccountPlatform = (typeof accountPlatforms)[number];

export const userProfiles = sqliteTable(
  "user_profiles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    externalUserId: text("external_user_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    company: text("company"),
    planPreference: text("plan_preference", { enum: accountPlans }).notNull(),
    primaryPlatform: text("primary_platform", {
      enum: accountPlatforms,
    }).notNull(),
    marketingOptIn: integer("marketing_opt_in", { mode: "boolean" })
      .notNull()
      .default(false),
    policiesAcknowledgedAt: text("policies_acknowledged_at").notNull(),
    onboardingCompletedAt: text("onboarding_completed_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_user_profiles_external_user_id").on(table.externalUserId),
    index("idx_user_profiles_email").on(table.email),
    check(
      "user_profiles_external_user_id_length_check",
      sql`length(${table.externalUserId}) BETWEEN 1 AND 256`,
    ),
    check(
      "user_profiles_email_length_check",
      sql`length(${table.email}) BETWEEN 3 AND 254`,
    ),
    check(
      "user_profiles_display_name_length_check",
      sql`length(${table.displayName}) BETWEEN 1 AND 120`,
    ),
    check(
      "user_profiles_company_length_check",
      sql`${table.company} IS NULL OR length(${table.company}) BETWEEN 1 AND 160`,
    ),
    check(
      "user_profiles_plan_check",
      sql`${table.planPreference} IN ('creator', 'pro')`,
    ),
    check(
      "user_profiles_platform_check",
      sql`${table.primaryPlatform} IN ('youtube', 'twitch', 'podcast', 'instagram', 'tiktok', 'other')`,
    ),
  ],
);

export const artistStatuses = ["active", "hidden", "archived"] as const;
export type ArtistStatus = (typeof artistStatuses)[number];

export const releaseTypes = [
  "single",
  "ep",
  "album",
  "compilation",
  "other",
] as const;
export type ReleaseType = (typeof releaseTypes)[number];

export const catalogStatuses = [
  "draft",
  "needs_review",
  "ready",
  "published",
  "hidden",
  "archived",
] as const;
export type CatalogStatus = (typeof catalogStatuses)[number];

export const rightsStatuses = ["pending", "cleared", "restricted"] as const;
export type RightsStatus = (typeof rightsStatuses)[number];

export const aiReviewStatuses = ["pending", "cleared", "rejected"] as const;
export type AiReviewStatus = (typeof aiReviewStatuses)[number];

export const assetKinds = [
  "source_master",
  "streaming_copy",
  "download_copy",
  "waveform_peaks",
] as const;
export type AssetKind = (typeof assetKinds)[number];

export const assetStatuses = [
  "pending",
  "available",
  "quarantined",
  "failed",
  "deleted",
] as const;
export type AssetStatus = (typeof assetStatuses)[number];

export const ingestStatuses = [
  "discovered",
  "inspecting",
  "matching",
  "needs_review",
  "ready",
  "imported",
  "quarantined",
  "skipped",
  "failed",
] as const;
export type IngestStatus = (typeof ingestStatuses)[number];

export const catalogVerificationModes = ["catalog_owner_direct"] as const;
export type CatalogVerificationMode =
  (typeof catalogVerificationModes)[number];

export const spotifyMatchStatuses = [
  "candidate",
  "verified",
  "rejected",
  "stale",
] as const;
export type SpotifyMatchStatus = (typeof spotifyMatchStatuses)[number];

export const spotifyMatchMethods = [
  "distributor_uri",
  "orchard_uri",
  "isrc",
  "exact_metadata",
  "metadata_duration",
  "manual",
] as const;
export type SpotifyMatchMethod = (typeof spotifyMatchMethods)[number];

export const artists = sqliteTable(
  "artists",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    spotifyArtistId: text("spotify_artist_id"),
    status: text("status", { enum: artistStatuses }).notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check(
      "artists_status_check",
      sql`${table.status} IN ('active', 'hidden', 'archived')`,
    ),
    check(
      "artists_name_length_check",
      sql`length(${table.name}) BETWEEN 1 AND 300`,
    ),
    check(
      "artists_normalized_name_length_check",
      sql`length(${table.normalizedName}) BETWEEN 1 AND 300`,
    ),
    check(
      "artists_spotify_id_length_check",
      sql`${table.spotifyArtistId} IS NULL OR length(${table.spotifyArtistId}) BETWEEN 1 AND 64`,
    ),
    index("idx_artists_normalized_name").on(table.normalizedName),
    index("idx_artists_status_name").on(table.status, table.normalizedName),
    index("idx_artists_spotify_artist_id").on(table.spotifyArtistId),
  ],
);

export const releases = sqliteTable(
  "releases",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    primaryArtistId: integer("primary_artist_id")
      .notNull()
      .references(() => artists.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    title: text("title").notNull(),
    normalizedTitle: text("normalized_title").notNull(),
    artistCredit: text("artist_credit").notNull(),
    type: text("type", { enum: releaseTypes }).notNull().default("other"),
    upc: text("upc"),
    releaseDate: text("release_date"),
    spotifyAlbumId: text("spotify_album_id"),
    coverSourceUrl: text("cover_source_url"),
    coverStorageKey: text("cover_storage_key"),
    status: text("status", { enum: catalogStatuses }).notNull().default("draft"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check(
      "releases_type_check",
      sql`${table.type} IN ('single', 'ep', 'album', 'compilation', 'other')`,
    ),
    check(
      "releases_status_check",
      sql`${table.status} IN ('draft', 'needs_review', 'ready', 'published', 'hidden', 'archived')`,
    ),
    check(
      "releases_title_length_check",
      sql`length(${table.title}) BETWEEN 1 AND 500`,
    ),
    check(
      "releases_normalized_title_length_check",
      sql`length(${table.normalizedTitle}) BETWEEN 1 AND 500`,
    ),
    check(
      "releases_artist_credit_length_check",
      sql`length(${table.artistCredit}) BETWEEN 1 AND 1000`,
    ),
    check(
      "releases_upc_length_check",
      sql`${table.upc} IS NULL OR length(${table.upc}) BETWEEN 8 AND 14`,
    ),
    check(
      "releases_release_date_length_check",
      sql`${table.releaseDate} IS NULL OR length(${table.releaseDate}) IN (4, 7, 10)`,
    ),
    check(
      "releases_spotify_album_id_length_check",
      sql`${table.spotifyAlbumId} IS NULL OR length(${table.spotifyAlbumId}) BETWEEN 1 AND 64`,
    ),
    check(
      "releases_cover_source_url_length_check",
      sql`${table.coverSourceUrl} IS NULL OR length(${table.coverSourceUrl}) BETWEEN 1 AND 2048`,
    ),
    check(
      "releases_cover_storage_key_length_check",
      sql`${table.coverStorageKey} IS NULL OR length(${table.coverStorageKey}) BETWEEN 1 AND 1000`,
    ),
    index("idx_releases_artist_status").on(table.primaryArtistId, table.status),
    index("idx_releases_normalized_title").on(table.normalizedTitle),
    index("idx_releases_upc").on(table.upc),
    index("idx_releases_spotify_album_id").on(table.spotifyAlbumId),
  ],
);

export const tracks = sqliteTable(
  "tracks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    releaseId: integer("release_id")
      .notNull()
      .references(() => releases.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    primaryArtistId: integer("primary_artist_id")
      .notNull()
      .references(() => artists.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    title: text("title").notNull(),
    normalizedTitle: text("normalized_title").notNull(),
    artistCredit: text("artist_credit").notNull(),
    versionLabel: text("version_label"),
    isrc: text("isrc"),
    discNumber: integer("disc_number").notNull().default(1),
    trackNumber: integer("track_number"),
    durationMs: integer("duration_ms"),
    genre: text("genre"),
    mood: text("mood"),
    theme: text("theme"),
    rightsStatus: text("rights_status", { enum: rightsStatuses })
      .notNull()
      .default("pending"),
    aiReviewStatus: text("ai_review_status", { enum: aiReviewStatuses })
      .notNull()
      .default("pending"),
    status: text("status", { enum: catalogStatuses }).notNull().default("draft"),
    publishedAt: text("published_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check(
      "tracks_status_check",
      sql`${table.status} IN ('draft', 'needs_review', 'ready', 'published', 'hidden', 'archived')`,
    ),
    check(
      "tracks_rights_status_check",
      sql`${table.rightsStatus} IN ('pending', 'cleared', 'restricted')`,
    ),
    check(
      "tracks_ai_review_status_check",
      sql`${table.aiReviewStatus} IN ('pending', 'cleared', 'rejected')`,
    ),
    check(
      "tracks_publish_rights_check",
      sql`${table.status} != 'published' OR ${table.rightsStatus} = 'cleared'`,
    ),
    check(
      "tracks_publish_ai_review_check",
      sql`${table.status} != 'published' OR ${table.aiReviewStatus} = 'cleared'`,
    ),
    check(
      "tracks_title_length_check",
      sql`length(${table.title}) BETWEEN 1 AND 500`,
    ),
    check(
      "tracks_normalized_title_length_check",
      sql`length(${table.normalizedTitle}) BETWEEN 1 AND 500`,
    ),
    check(
      "tracks_artist_credit_length_check",
      sql`length(${table.artistCredit}) BETWEEN 1 AND 1000`,
    ),
    check(
      "tracks_version_label_length_check",
      sql`${table.versionLabel} IS NULL OR length(${table.versionLabel}) BETWEEN 1 AND 300`,
    ),
    check(
      "tracks_isrc_length_check",
      sql`${table.isrc} IS NULL OR length(${table.isrc}) = 12`,
    ),
    check("tracks_disc_number_check", sql`${table.discNumber} >= 1`),
    check(
      "tracks_track_number_check",
      sql`${table.trackNumber} IS NULL OR ${table.trackNumber} >= 1`,
    ),
    check(
      "tracks_duration_ms_check",
      sql`${table.durationMs} IS NULL OR ${table.durationMs} BETWEEN 1 AND 86400000`,
    ),
    check(
      "tracks_genre_length_check",
      sql`${table.genre} IS NULL OR length(${table.genre}) BETWEEN 1 AND 120`,
    ),
    check(
      "tracks_mood_length_check",
      sql`${table.mood} IS NULL OR length(${table.mood}) BETWEEN 1 AND 120`,
    ),
    check(
      "tracks_theme_length_check",
      sql`${table.theme} IS NULL OR length(${table.theme}) BETWEEN 1 AND 120`,
    ),
    index("idx_tracks_release_position").on(
      table.releaseId,
      table.discNumber,
      table.trackNumber,
    ),
    index("idx_tracks_release_status").on(table.releaseId, table.status),
    index("idx_tracks_artist_status").on(table.primaryArtistId, table.status),
    index("idx_tracks_rights_status").on(table.rightsStatus, table.status),
    index("idx_tracks_isrc").on(table.isrc),
    index("idx_tracks_normalized_title").on(table.normalizedTitle),
    index("idx_tracks_status_genre").on(table.status, table.genre),
    index("idx_tracks_status_mood").on(table.status, table.mood),
    index("idx_tracks_status_theme").on(table.status, table.theme),
  ],
);

export const trackAssets = sqliteTable(
  "track_assets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    trackId: integer("track_id")
      .notNull()
      .references(() => tracks.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    kind: text("kind", { enum: assetKinds }).notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size"),
    durationMs: integer("duration_ms"),
    sha256: text("sha256"),
    derivedFromSha256: text("derived_from_sha256"),
    status: text("status", { enum: assetStatuses }).notNull().default("pending"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check(
      "track_assets_kind_check",
      sql`${table.kind} IN ('source_master', 'streaming_copy', 'download_copy', 'waveform_peaks')`,
    ),
    check(
      "track_assets_status_check",
      sql`${table.status} IN ('pending', 'available', 'quarantined', 'failed', 'deleted')`,
    ),
    check(
      "track_assets_storage_key_length_check",
      sql`length(${table.storageKey}) BETWEEN 1 AND 1000`,
    ),
    check(
      "track_assets_mime_type_length_check",
      sql`length(${table.mimeType}) BETWEEN 1 AND 120`,
    ),
    check(
      "track_assets_byte_size_check",
      sql`${table.byteSize} IS NULL OR ${table.byteSize} >= 1`,
    ),
    check(
      "track_assets_duration_ms_check",
      sql`${table.durationMs} IS NULL OR ${table.durationMs} BETWEEN 1 AND 86400000`,
    ),
    check(
      "track_assets_sha256_check",
      sql`${table.sha256} IS NULL OR length(${table.sha256}) = 64`,
    ),
    check(
      "track_assets_derived_from_sha256_check",
      sql`${table.derivedFromSha256} IS NULL OR length(${table.derivedFromSha256}) = 64`,
    ),
    uniqueIndex("uq_track_assets_storage_key").on(table.storageKey),
    index("idx_track_assets_track_kind_status").on(
      table.trackId,
      table.kind,
      table.status,
    ),
    index("idx_track_assets_sha256").on(table.sha256),
  ],
);

export const ingestItems = sqliteTable(
  "ingest_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    batchKey: text("batch_key").notNull(),
    sourceKey: text("source_key").notNull(),
    sourceRowNumber: integer("source_row_number"),
    sourceFileName: text("source_file_name").notNull(),
    sourceSha256: text("source_sha256"),
    verificationMode: text("verification_mode", {
      enum: catalogVerificationModes,
    }),
    ownerAttestationSha256: text("owner_attestation_sha256"),
    catalogueScopeSha256: text("catalogue_scope_sha256"),
    selectionSha256: text("selection_sha256"),
    masterInspectionSha256: text("master_inspection_sha256"),
    masterReadComplete: integer("master_read_complete", { mode: "boolean" }),
    declaredTitle: text("declared_title"),
    declaredArtist: text("declared_artist"),
    declaredDurationMs: integer("declared_duration_ms"),
    measuredDurationMs: integer("measured_duration_ms"),
    trackId: integer("track_id").references(() => tracks.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    assetId: integer("asset_id").references(() => trackAssets.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    status: text("status", { enum: ingestStatuses })
      .notNull()
      .default("discovered"),
    failureCode: text("failure_code"),
    reviewNote: text("review_note"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check(
      "ingest_items_status_check",
      sql`${table.status} IN ('discovered', 'inspecting', 'matching', 'needs_review', 'ready', 'imported', 'quarantined', 'skipped', 'failed')`,
    ),
    check(
      "ingest_items_batch_key_length_check",
      sql`length(${table.batchKey}) BETWEEN 1 AND 160`,
    ),
    check(
      "ingest_items_source_key_length_check",
      sql`length(${table.sourceKey}) BETWEEN 1 AND 160`,
    ),
    check(
      "ingest_items_source_row_number_check",
      sql`${table.sourceRowNumber} IS NULL OR ${table.sourceRowNumber} >= 1`,
    ),
    check(
      "ingest_items_source_file_name_length_check",
      sql`length(${table.sourceFileName}) BETWEEN 1 AND 1000`,
    ),
    check(
      "ingest_items_source_sha256_check",
      sql`${table.sourceSha256} IS NULL OR length(${table.sourceSha256}) = 64`,
    ),
    check(
      "ingest_items_verification_mode_check",
      sql`${table.verificationMode} IS NULL OR ${table.verificationMode} = 'catalog_owner_direct'`,
    ),
    check(
      "ingest_items_owner_attestation_sha256_check",
      sql`${table.ownerAttestationSha256} IS NULL OR length(${table.ownerAttestationSha256}) = 64`,
    ),
    check(
      "ingest_items_catalogue_scope_sha256_check",
      sql`${table.catalogueScopeSha256} IS NULL OR length(${table.catalogueScopeSha256}) = 64`,
    ),
    check(
      "ingest_items_selection_sha256_check",
      sql`${table.selectionSha256} IS NULL OR length(${table.selectionSha256}) = 64`,
    ),
    check(
      "ingest_items_master_inspection_sha256_check",
      sql`${table.masterInspectionSha256} IS NULL OR length(${table.masterInspectionSha256}) = 64`,
    ),
    check(
      "ingest_items_owner_direct_evidence_shape_check",
      sql`(
        ${table.verificationMode} IS NULL
        AND ${table.ownerAttestationSha256} IS NULL
        AND ${table.catalogueScopeSha256} IS NULL
        AND ${table.selectionSha256} IS NULL
        AND ${table.masterInspectionSha256} IS NULL
        AND ${table.masterReadComplete} IS NULL
      ) OR (
        ${table.verificationMode} = 'catalog_owner_direct'
        AND ${table.ownerAttestationSha256} IS NOT NULL
        AND ${table.catalogueScopeSha256} IS NOT NULL
        AND ${table.selectionSha256} IS NOT NULL
        AND ${table.masterInspectionSha256} = ${table.sourceSha256}
        AND ${table.masterReadComplete} = 1
        AND ${table.sourceRowNumber} IS NOT NULL
        AND ${table.sourceSha256} IS NOT NULL
        AND ${table.declaredDurationMs} IS NOT NULL
      )`,
    ),
    check(
      "ingest_items_declared_title_length_check",
      sql`${table.declaredTitle} IS NULL OR length(${table.declaredTitle}) BETWEEN 1 AND 500`,
    ),
    check(
      "ingest_items_declared_artist_length_check",
      sql`${table.declaredArtist} IS NULL OR length(${table.declaredArtist}) BETWEEN 1 AND 1000`,
    ),
    check(
      "ingest_items_declared_duration_ms_check",
      sql`${table.declaredDurationMs} IS NULL OR ${table.declaredDurationMs} BETWEEN 1 AND 86400000`,
    ),
    check(
      "ingest_items_measured_duration_ms_check",
      sql`${table.measuredDurationMs} IS NULL OR ${table.measuredDurationMs} BETWEEN 1 AND 86400000`,
    ),
    check(
      "ingest_items_failure_code_length_check",
      sql`${table.failureCode} IS NULL OR length(${table.failureCode}) BETWEEN 1 AND 120`,
    ),
    check(
      "ingest_items_review_note_length_check",
      sql`${table.reviewNote} IS NULL OR length(${table.reviewNote}) BETWEEN 1 AND 4000`,
    ),
    uniqueIndex("uq_ingest_items_batch_source").on(
      table.batchKey,
      table.sourceKey,
    ),
    index("idx_ingest_items_status_updated_at").on(
      table.status,
      table.updatedAt,
    ),
    index("idx_ingest_items_track_id").on(table.trackId),
    index("idx_ingest_items_source_sha256").on(table.sourceSha256),
    index("idx_ingest_items_verification_mode").on(table.verificationMode),
  ],
);

export const spotifyMatches = sqliteTable(
  "spotify_matches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    trackId: integer("track_id")
      .notNull()
      .references(() => tracks.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    spotifyTrackId: text("spotify_track_id").notNull(),
    spotifyAlbumId: text("spotify_album_id"),
    spotifyTitle: text("spotify_title"),
    spotifyArtistCredit: text("spotify_artist_credit"),
    spotifyAlbumTitle: text("spotify_album_title"),
    spotifyIsrc: text("spotify_isrc"),
    spotifyDurationMs: integer("spotify_duration_ms"),
    durationDeltaMs: integer("duration_delta_ms"),
    coverSourceUrl: text("cover_source_url"),
    method: text("method", { enum: spotifyMatchMethods }).notNull(),
    score: integer("score").notNull(),
    status: text("status", { enum: spotifyMatchStatuses })
      .notNull()
      .default("candidate"),
    checkedAt: text("checked_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    reviewedAt: text("reviewed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check(
      "spotify_matches_method_check",
      sql`${table.method} IN ('distributor_uri', 'orchard_uri', 'isrc', 'exact_metadata', 'metadata_duration', 'manual')`,
    ),
    check(
      "spotify_matches_status_check",
      sql`${table.status} IN ('candidate', 'verified', 'rejected', 'stale')`,
    ),
    check(
      "spotify_matches_verified_shape_check",
      sql`${table.status} != 'verified' OR (
        (${table.spotifyAlbumId} IS NOT NULL OR ${table.method} = 'orchard_uri')
        AND ${table.spotifyTitle} IS NOT NULL
        AND ${table.spotifyArtistCredit} IS NOT NULL
        AND ${table.spotifyAlbumTitle} IS NOT NULL
        AND ${table.spotifyDurationMs} IS NOT NULL
        AND ${table.durationDeltaMs} IS NOT NULL
      )`,
    ),
    check(
      "spotify_matches_track_id_length_check",
      sql`length(${table.spotifyTrackId}) BETWEEN 1 AND 64`,
    ),
    check(
      "spotify_matches_album_id_length_check",
      sql`${table.spotifyAlbumId} IS NULL OR length(${table.spotifyAlbumId}) BETWEEN 1 AND 64`,
    ),
    check(
      "spotify_matches_title_length_check",
      sql`${table.spotifyTitle} IS NULL OR length(${table.spotifyTitle}) BETWEEN 1 AND 500`,
    ),
    check(
      "spotify_matches_artist_credit_length_check",
      sql`${table.spotifyArtistCredit} IS NULL OR length(${table.spotifyArtistCredit}) BETWEEN 1 AND 1000`,
    ),
    check(
      "spotify_matches_album_title_length_check",
      sql`${table.spotifyAlbumTitle} IS NULL OR length(${table.spotifyAlbumTitle}) BETWEEN 1 AND 500`,
    ),
    check(
      "spotify_matches_isrc_length_check",
      sql`${table.spotifyIsrc} IS NULL OR length(${table.spotifyIsrc}) = 12`,
    ),
    check(
      "spotify_matches_duration_ms_check",
      sql`${table.spotifyDurationMs} IS NULL OR ${table.spotifyDurationMs} BETWEEN 1 AND 86400000`,
    ),
    check(
      "spotify_matches_duration_delta_ms_check",
      sql`${table.durationDeltaMs} IS NULL OR ${table.durationDeltaMs} BETWEEN 0 AND 86400000`,
    ),
    check(
      "spotify_matches_cover_source_url_length_check",
      sql`${table.coverSourceUrl} IS NULL OR length(${table.coverSourceUrl}) BETWEEN 1 AND 2048`,
    ),
    check(
      "spotify_matches_score_check",
      sql`${table.score} BETWEEN 0 AND 10000`,
    ),
    uniqueIndex("uq_spotify_matches_track_candidate").on(
      table.trackId,
      table.spotifyTrackId,
    ),
    uniqueIndex("uq_spotify_matches_verified_track")
      .on(table.trackId)
      .where(sql`${table.status} = 'verified'`),
    index("idx_spotify_matches_track_status_score").on(
      table.trackId,
      table.status,
      table.score,
    ),
    index("idx_spotify_matches_spotify_track_id").on(table.spotifyTrackId),
  ],
);
