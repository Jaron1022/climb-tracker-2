import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is missing.`);
  }

  return value;
}

export function r2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL
  );
}

export function createR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${getRequiredEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY")
    }
  });
}

export async function createUploadUrl(key: string, contentType: string) {
  const client = createR2Client();
  const command = new PutObjectCommand({
    Bucket: getRequiredEnv("R2_BUCKET_NAME"),
    Key: key,
    ContentType: contentType
  });

  return getSignedUrl(client, command, { expiresIn: 60 });
}

export function getPublicPhotoUrl(key: string) {
  const baseUrl = getRequiredEnv("NEXT_PUBLIC_R2_PUBLIC_BASE_URL").replace(/\/$/, "");
  return `${baseUrl}/${key}`;
}

export async function deleteObjectByKey(key: string) {
  const client = createR2Client();
  const command = new DeleteObjectCommand({
    Bucket: getRequiredEnv("R2_BUCKET_NAME"),
    Key: key
  });

  await client.send(command);
}

export function getR2KeyFromPublicUrl(url: string) {
  const baseUrl = getRequiredEnv("NEXT_PUBLIC_R2_PUBLIC_BASE_URL").replace(/\/$/, "");
  if (!url.startsWith(baseUrl)) {
    return null;
  }

  const key = url.slice(baseUrl.length + 1);
  return key || null;
}
