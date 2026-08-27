import {
  createCipheriv,
  createDecipheriv,
  randomBytes
} from "node:crypto";

const KEY_BYTES = 32;
const IV_BYTES = 12;
const VERSION = "v1";

function decodeKey(
  encodedKey: string
): Buffer {
  const key = Buffer.from(
    encodedKey,
    "base64"
  );

  if (key.length !== KEY_BYTES) {
    throw new Error(
      "Credential encryption key must decode to exactly 32 bytes."
    );
  }

  return key;
}

export function encryptCredential(
  plaintext: string,
  encodedKey: string
): string {
  if (!plaintext) {
    throw new Error(
      "Credential plaintext is required."
    );
  }

  const key = decodeKey(encodedKey);
  const iv = randomBytes(IV_BYTES);

  const cipher = createCipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  const ciphertext = Buffer.concat([
    cipher.update(
      plaintext,
      "utf8"
    ),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    ciphertext.toString(
      "base64url"
    ),
    tag.toString("base64url")
  ].join(".");
}

export function decryptCredential(
  encoded: string,
  encodedKey: string
): string {
  const parts = encoded.split(".");

  if (
    parts.length !== 4 ||
    parts[0] !== VERSION
  ) {
    throw new Error(
      "Unsupported credential ciphertext."
    );
  }

  const ivPart = parts[1];
  const ciphertextPart = parts[2];
  const tagPart = parts[3];

  if (
    !ivPart ||
    !ciphertextPart ||
    !tagPart
  ) {
    throw new Error(
      "Malformed credential ciphertext."
    );
  }

  const key = decodeKey(encodedKey);
  const iv = Buffer.from(
    ivPart,
    "base64url"
  );
  const ciphertext = Buffer.from(
    ciphertextPart,
    "base64url"
  );
  const tag = Buffer.from(
    tagPart,
    "base64url"
  );

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return plaintext.toString("utf8");
}
