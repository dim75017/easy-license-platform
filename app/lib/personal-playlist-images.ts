const PERSONAL_PLAYLIST_DB_NAME = "symbiome-personal-library-v1";
const PERSONAL_PLAYLIST_IMAGE_STORE = "playlist-images";
const PERSONAL_PLAYLIST_DB_VERSION = 1;
const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_STORED_IMAGE_BYTES = 384 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const imageKeyPattern = /^playlist-cover:[a-z0-9-]{1,120}$/iu;

let databasePromise: Promise<IDBDatabase> | null = null;

export function personalPlaylistImageKey(playlistId: string): string {
  const key = `playlist-cover:${playlistId}`;
  if (!isPersonalPlaylistImageKey(key)) throw new Error("The playlist image key is invalid.");
  return key;
}

export function isPersonalPlaylistImageKey(value: unknown): value is string {
  return typeof value === "string" && imageKeyPattern.test(value);
}

export async function preparePersonalPlaylistImage(file: File): Promise<Blob> {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error("Choose a JPEG, PNG or WebP image.");
  }
  if (file.size <= 0 || file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("Choose an image smaller than 8 MB.");
  }
  if (typeof createImageBitmap !== "function") {
    throw new Error("Image processing is unavailable in this browser.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image could not be opened.");
  }

  try {
    if (bitmap.width < 1 || bitmap.height < 1) throw new Error("This image has invalid dimensions.");
    const sourceRatio = bitmap.width / bitmap.height;
    const targetRatio = 4 / 3;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = bitmap.width;
    let sourceHeight = bitmap.height;

    if (sourceRatio > targetRatio) {
      sourceWidth = bitmap.height * targetRatio;
      sourceX = (bitmap.width - sourceWidth) / 2;
    } else if (sourceRatio < targetRatio) {
      sourceHeight = bitmap.width / targetRatio;
      sourceY = (bitmap.height - sourceHeight) / 2;
    }

    const attempts = [
      { width: 640, quality: .8 },
      { width: 560, quality: .72 },
      { width: 480, quality: .64 },
    ] as const;
    let lastBlob: Blob | null = null;

    for (const attempt of attempts) {
      const width = Math.max(1, Math.min(attempt.width, Math.round(sourceWidth)));
      const height = Math.max(1, Math.round(width / targetRatio));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Image processing is unavailable in this browser.");
      context.fillStyle = "#292832";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
      lastBlob = await canvasBlob(canvas, "image/webp", attempt.quality);
      if (lastBlob && lastBlob.size <= MAX_STORED_IMAGE_BYTES) return lastBlob;
    }

    if (!lastBlob) throw new Error("This image could not be prepared.");
    throw new Error("This image remains too large after compression.");
  } finally {
    bitmap.close();
  }
}

export async function savePersonalPlaylistImage(key: string, image: Blob): Promise<void> {
  if (!isPersonalPlaylistImageKey(key)) throw new Error("The playlist image key is invalid.");
  if (image.size <= 0 || image.size > MAX_STORED_IMAGE_BYTES) throw new Error("The playlist image is too large.");
  const database = await openPersonalPlaylistDatabase();
  await transactionComplete(database, "readwrite", (store) => store.put(image, key));
}

export async function loadPersonalPlaylistImage(key: string): Promise<Blob | null> {
  if (!isPersonalPlaylistImageKey(key)) return null;
  const database = await openPersonalPlaylistDatabase();
  return new Promise<Blob | null>((resolve, reject) => {
    const transaction = database.transaction(PERSONAL_PLAYLIST_IMAGE_STORE, "readonly");
    const request = transaction.objectStore(PERSONAL_PLAYLIST_IMAGE_STORE).get(key);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => reject(request.error ?? new Error("The playlist image could not be read."));
  });
}

export async function deletePersonalPlaylistImage(key: string): Promise<void> {
  if (!isPersonalPlaylistImageKey(key)) throw new Error("The playlist image key is invalid.");
  const database = await openPersonalPlaylistDatabase();
  await transactionComplete(database, "readwrite", (store) => store.delete(key));
}

function openPersonalPlaylistDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Local image storage is unavailable."));

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(PERSONAL_PLAYLIST_DB_NAME, PERSONAL_PLAYLIST_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PERSONAL_PLAYLIST_IMAGE_STORE)) {
        database.createObjectStore(PERSONAL_PLAYLIST_IMAGE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error("Local image storage could not be opened."));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error("Local image storage is blocked by another tab."));
    };
  });
  return databasePromise;
}

function transactionComplete(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(PERSONAL_PLAYLIST_IMAGE_STORE, mode);
    operation(transaction.objectStore(PERSONAL_PLAYLIST_IMAGE_STORE));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("The playlist image could not be saved."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The playlist image save was cancelled."));
  });
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
