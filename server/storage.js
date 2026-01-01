import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, 'uploads');
const getSigningSecret = () => process.env.SIGNED_URL_SECRET || 'dev-secret';

export const ensureUploadsDir = () => {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
};

const getExtension = (mimeType) => {
  if (!mimeType) return 'jpg';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  return 'jpg';
};

export const saveBase64Image = (base64Image) => {
  const match = /^data:(.+);base64,(.*)$/.exec(base64Image);
  const mimeType = match?.[1] || 'image/jpeg';
  const data = match?.[2] || base64Image;
  const buffer = Buffer.from(data, 'base64');
  const fileId = crypto.randomUUID();
  const fileName = `${fileId}.${getExtension(mimeType)}`;
  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, buffer);
  return { id: fileId, path: filePath, mimeType };
};

export const signFileUrl = (fileId, expiresInSeconds = 3600) => {
  const signingSecret = getSigningSecret();
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const token = crypto.createHmac('sha256', signingSecret).update(`${fileId}:${expires}`).digest('hex');
  return `/api/files/${fileId}?token=${token}&expires=${expires}`;
};

export const verifyFileToken = (fileId, token, expires) => {
  const signingSecret = getSigningSecret();
  if (!token || !expires) return false;
  const expiry = Number(expires);
  if (Number.isNaN(expiry) || expiry < Math.floor(Date.now() / 1000)) return false;
  const expected = crypto.createHmac('sha256', signingSecret).update(`${fileId}:${expiry}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
};
