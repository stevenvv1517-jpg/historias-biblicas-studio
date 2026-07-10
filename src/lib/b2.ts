import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "node:fs";
import path from "node:path";

export function getB2Config() {
  const keyId = process.env.B2_APPLICATION_KEY_ID;
  const key = process.env.B2_APPLICATION_KEY;
  const bucket = process.env.B2_BUCKET_NAME;
  const endpoint = process.env.B2_ENDPOINT;

  if (!keyId || !key || !bucket || !endpoint) {
    throw new Error(
      "Faltan variables B2: B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_ENDPOINT"
    );
  }

  return { keyId, key, bucket, endpoint };
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    const { keyId, key, endpoint } = getB2Config();
    client = new S3Client({
      endpoint,
      region: "us-west-004",
      credentials: { accessKeyId: keyId, secretAccessKey: key },
      forcePathStyle: true,
    });
  }
  return client;
}

export async function uploadToB2(
  localFilePath: string,
  remoteKey: string
): Promise<void> {
  const { bucket } = getB2Config();
  const s3 = getClient();

  const fileBuffer = fs.readFileSync(localFilePath);
  const ext = path.extname(localFilePath).toLowerCase();
  const contentType =
    ext === ".mp4"
      ? "video/mp4"
      : ext === ".mp3"
        ? "audio/mpeg"
        : ext === ".png"
          ? "image/png"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : "application/octet-stream";

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: remoteKey,
      Body: fileBuffer,
      ContentType: contentType,
    })
  );
}

export async function getSignedDownloadUrl(
  remoteKey: string,
  expiresInSeconds: number = 604800
): Promise<string> {
  const { bucket } = getB2Config();
  const s3 = getClient();

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: remoteKey }),
    { expiresIn: expiresInSeconds }
  );

  return url;
}

export async function readJsonFromB2<T>(remoteKey: string): Promise<T | null> {
  try {
    const { bucket } = getB2Config();
    const s3 = getClient();
    const resp = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: remoteKey })
    );
    const body = await resp.Body?.transformToString("utf-8");
    return body ? JSON.parse(body) : null;
  } catch {
    return null;
  }
}

export async function writeJsonToB2(
  remoteKey: string,
  data: unknown
): Promise<void> {
  const { bucket } = getB2Config();
  const s3 = getClient();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: remoteKey,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
    })
  );
}
