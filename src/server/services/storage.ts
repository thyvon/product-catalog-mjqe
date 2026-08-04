import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { Client } from "minio";

const DEFAULT_BUCKET = "product-images";

let cachedClient: Client | null | undefined;

export function getMinioClient(): Client | null {
  if (cachedClient !== undefined) return cachedClient;
  const endpoint = process.env.MINIO_ENDPOINT;
  if (!endpoint) {
    cachedClient = null;
    return null;
  }
  cachedClient = new Client({
    endPoint: endpoint,
    port: Number(process.env.MINIO_PORT || "9000"),
    useSSL: (process.env.MINIO_USE_SSL || "false") === "true",
    accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
  });
  return cachedClient;
}

export function getMinioBucket(): string {
  return process.env.MINIO_BUCKET || DEFAULT_BUCKET;
}

export function isMinioEnabled(): boolean {
  return getMinioClient() !== null;
}

export async function ensureBucket(client: Client = getMinioClient()!): Promise<void> {
  const bucket = getMinioBucket();
  try {
    const exists = await client.bucketExists(bucket);
    if (!exists) await client.makeBucket(bucket);
  } catch (err: any) {
    console.warn(`[storage] Failed to ensure MinIO bucket "${bucket}":`, err?.message || err);
  }
}

export async function saveObject(
  key: string,
  data: Buffer,
  contentType?: string,
  client: Client = getMinioClient()!,
): Promise<void> {
  await ensureBucket(client);
  await client.putObject(getMinioBucket(), key, data, data.length, {
    "Content-Type": contentType || "application/octet-stream",
  });
}

export interface StoredObject {
  stream: Readable;
  contentType: string;
  size: number;
}

export async function getObject(
  key: string,
  client: Client = getMinioClient()!,
): Promise<StoredObject | null> {
  try {
    const bucket = getMinioBucket();
    const stream = await client.getObject(bucket, key);
    const stat = await client.statObject(bucket, key);
    return {
      stream,
      contentType: stat.metaData?.["content-type"] || "application/octet-stream",
      size: Number(stat.size || 0),
    };
  } catch (err: any) {
    if (err?.code === "NoSuchKey" || err?.code === "NotFound") return null;
    console.warn(`[storage] Failed to read object "${key}":`, err?.message || err);
    return null;
  }
}

export function getLocalUploadsDir(): string {
  const dir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
