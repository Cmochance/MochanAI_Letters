import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 Storage Service
 * Uses AWS SDK v3 with S3-compatible API
 */

// Lazy initialization to avoid errors when env vars are not set
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "R2 storage is not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables."
      );
    }

    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return s3Client;
}

function getBucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error("R2_BUCKET_NAME environment variable is not set");
  }
  return bucket;
}

/**
 * Check if R2 storage is configured
 */
export function isStorageConfigured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

/**
 * Upload a file to R2 storage
 * @param key - The object key (path) in the bucket
 * @param data - The file data as Buffer or Uint8Array
 * @param contentType - MIME type of the file
 * @returns Object containing the key and public URL
 */
export async function uploadFile(
  key: string,
  data: Buffer | Uint8Array,
  contentType: string
): Promise<{ key: string; url: string }> {
  const client = getS3Client();
  const bucket = getBucketName();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: data,
    ContentType: contentType,
  });

  await client.send(command);

  return {
    key,
    url: getPublicUrl(key),
  };
}

/**
 * Upload a file from a URL to R2 storage
 * @param key - The object key (path) in the bucket
 * @param sourceUrl - The URL to fetch the file from
 * @returns Object containing the key and public URL
 */
export async function uploadFromUrl(
  key: string,
  sourceUrl: string
): Promise<{ key: string; url: string }> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file from URL: ${response.statusText}`);
  }

  const contentType =
    response.headers.get("content-type") || "application/octet-stream";
  const arrayBuffer = await response.arrayBuffer();
  const data = Buffer.from(arrayBuffer);

  return uploadFile(key, data, contentType);
}

/**
 * Get a presigned download URL for a file
 * @param key - The object key (path) in the bucket
 * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns Presigned URL for downloading the file
 */
export async function getDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getS3Client();
  const bucket = getBucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Get a presigned upload URL for direct client uploads
 * @param key - The object key (path) in the bucket
 * @param contentType - Expected MIME type of the file
 * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns Presigned URL for uploading the file
 */
export async function getUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getS3Client();
  const bucket = getBucketName();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Get the public URL for a file
 * Requires R2_PUBLIC_URL to be set (custom domain or r2.dev URL)
 * @param key - The object key (path) in the bucket
 * @returns Public URL for the file
 */
export function getPublicUrl(key: string): string {
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error(
      "R2_PUBLIC_URL environment variable is not set. Configure a custom domain or enable public access for your R2 bucket."
    );
  }
  // Remove trailing slash from publicUrl and leading slash from key
  const baseUrl = publicUrl.replace(/\/$/, "");
  const cleanKey = key.replace(/^\//, "");
  return `${baseUrl}/${cleanKey}`;
}

/**
 * Check if a file exists in R2 storage
 * @param key - The object key (path) in the bucket
 * @returns True if the file exists, false otherwise
 */
export async function fileExists(key: string): Promise<boolean> {
  const client = getS3Client();
  const bucket = getBucketName();

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    await client.send(command);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "NotFound") {
      return false;
    }
    throw error;
  }
}

/**
 * Delete a file from R2 storage
 * @param key - The object key (path) in the bucket
 */
export async function deleteFile(key: string): Promise<void> {
  const client = getS3Client();
  const bucket = getBucketName();

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await client.send(command);
}

/**
 * Generate a unique key for a file
 * @param prefix - Prefix for the key (e.g., "covers", "exports")
 * @param filename - Original filename
 * @param userId - User ID for namespacing
 * @returns Unique key for the file
 */
export function generateFileKey(
  prefix: string,
  filename: string,
  userId?: number
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = filename.split(".").pop() || "";
  const safeName = filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .substring(0, 50);

  if (userId) {
    return `${prefix}/${userId}/${timestamp}-${random}-${safeName}.${ext}`;
  }
  return `${prefix}/${timestamp}-${random}-${safeName}.${ext}`;
}
