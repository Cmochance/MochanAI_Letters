import crypto from "crypto";

export type PasswordHash = {
  algorithm: "scrypt";
  salt: string;
  hash: string;
};

function toBase64(buf: Buffer) {
  return buf.toString("base64");
}

function fromBase64(value: string) {
  return Buffer.from(value, "base64");
}

export async function hashPassword(params: {
  password: string;
  pepper?: string;
  saltBase64?: string;
}): Promise<PasswordHash> {
  const salt = params.saltBase64 ? fromBase64(params.saltBase64) : crypto.randomBytes(16);
  const pepper = params.pepper ?? "";
  const passwordBytes = Buffer.from(`${params.password}${pepper}`, "utf-8");

  const key = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(passwordBytes, salt, 64, { N: 1 << 15, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });

  return {
    algorithm: "scrypt",
    salt: toBase64(salt),
    hash: toBase64(key),
  };
}

export async function verifyPassword(params: {
  password: string;
  pepper?: string;
  stored: PasswordHash;
}): Promise<boolean> {
  if (params.stored.algorithm !== "scrypt") return false;
  const computed = await hashPassword({
    password: params.password,
    pepper: params.pepper,
    saltBase64: params.stored.salt,
  });
  return crypto.timingSafeEqual(fromBase64(computed.hash), fromBase64(params.stored.hash));
}

