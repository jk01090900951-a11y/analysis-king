import fs from "fs";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// TODO: 실 서비스에서는 로컬 디스크 대신 S3/오브젝트 스토리지 사용 권장 (VPS 디스크 용량 한계)
export async function storagePut(key: string, data: Buffer | Uint8Array): Promise<string> {
  const safeKey = `${crypto.randomUUID()}-${key.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filePath = path.join(UPLOAD_DIR, safeKey);
  fs.writeFileSync(filePath, data);
  return `/uploads/${safeKey}`;
}
