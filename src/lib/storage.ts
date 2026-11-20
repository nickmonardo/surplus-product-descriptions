import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";

// JSON documents keyed by path. Production uses a private Vercel Blob store
// (BLOB_READ_WRITE_TOKEN, set when a Blob store is connected to the project);
// local development without it writes to ./.data instead.
//   batches/<id>.json             a weekly batch
//   decisions/<batchId>/<sku>.json one decision per product (last write wins)
//   state/drafted.json            SKUs already drafted, so they aren't drafted again
//   fixes/<batchId>/<sku>/<id>.json, revisions/<batchId>/<sku>.json  Magento to-do and rewrites
//   auth/used-links/<hash>.json   sign-in links already used (single-use)
//   auth/throttle/<hash>.json     when a sign-in link was last emailed to an address

const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const LOCAL_ROOT = path.join(process.cwd(), ".data");

export function storageMode(): "blob" | "local" {
  return blobEnabled() ? "blob" : "local";
}

export async function readJson<T>(key: string): Promise<T | null> {
  if (blobEnabled()) {
    const result = await get(key, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return null;
    return JSON.parse(await new Response(result.stream).text()) as T;
  }
  try {
    return JSON.parse(await fs.readFile(path.join(LOCAL_ROOT, key), "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  const body = JSON.stringify(value);
  if (blobEnabled()) {
    await put(key, body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return;
  }
  const file = path.join(LOCAL_ROOT, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body);
}

/**
 * Writes only if the key doesn't exist yet. True when this call created it, false when it
 * was already there (used for single-use sign-in links, where two clicks must not both win).
 */
export async function createJson(key: string, value: unknown): Promise<boolean> {
  const body = JSON.stringify(value);
  if (blobEnabled()) {
    try {
      await put(key, body, { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: "application/json" });
      return true;
    } catch (error) {
      if ((await readJson(key)) !== null) return false;
      throw error;
    }
  }
  const file = path.join(LOCAL_ROOT, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    await fs.writeFile(file, body, { flag: "wx" });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
}

export async function removeKey(key: string): Promise<void> {
  if (blobEnabled()) {
    await del(key);
    return;
  }
  await fs.rm(path.join(LOCAL_ROOT, key), { force: true });
}

/** Every key under a prefix (e.g. "batches/"). */
export async function listKeys(prefix: string): Promise<string[]> {
  if (blobEnabled()) {
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      keys.push(...page.blobs.map((b) => b.pathname));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return keys;
  }
  const dir = path.join(LOCAL_ROOT, prefix);
  const out: string[] = [];
  const walk = async (d: string) => {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else out.push(path.relative(LOCAL_ROOT, full).split(path.sep).join("/"));
    }
  };
  await walk(prefix.endsWith("/") ? dir : path.dirname(dir));
  return out.filter((k) => k.startsWith(prefix)).sort();
}
