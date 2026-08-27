import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Dev-grade AES-256-GCM. Replace with KMS/Secrets Manager in AWS. */
export class TokenVault {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = createHash("sha256").update(secret).digest();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
  }

  decrypt(payload: string): string {
    const [version, ivB64, tagB64, dataB64] = payload.split(":");
    if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) {
      throw new Error("Invalid encrypted token format");
    }
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }
}
