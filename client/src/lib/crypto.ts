export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface EncryptedMessage {
  encryptedContent: string;
  senderEncryptedKey: string;
  recipientEncryptedKey: string;
  iv: string;
}

export async function generateKeyPair(): Promise<KeyPair> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicKey = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const privateKey = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  return {
    publicKey: arrayBufferToBase64(publicKey),
    privateKey: arrayBufferToBase64(privateKey),
  };
}

export async function encryptMessage(
  message: string,
  senderPublicKey: string,
  recipientPublicKey: string
): Promise<EncryptedMessage> {
  const aesKey = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  const encryptedContent = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    aesKey,
    data
  );

  const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);

  const senderPubKey = await window.crypto.subtle.importKey(
    "spki",
    base64ToArrayBuffer(senderPublicKey),
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );

  const recipientPubKey = await window.crypto.subtle.importKey(
    "spki",
    base64ToArrayBuffer(recipientPublicKey),
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );

  const senderEncryptedKey = await window.crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    senderPubKey,
    exportedAesKey
  );

  const recipientEncryptedKey = await window.crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    recipientPubKey,
    exportedAesKey
  );

  return {
    encryptedContent: arrayBufferToBase64(encryptedContent),
    senderEncryptedKey: arrayBufferToBase64(senderEncryptedKey),
    recipientEncryptedKey: arrayBufferToBase64(recipientEncryptedKey),
    iv: arrayBufferToBase64(iv),
  };
}

export async function decryptMessage(
  encryptedContent: string,
  encryptedKey: string,
  iv: string,
  privateKey: string
): Promise<string> {
  const privateKeyObj = await window.crypto.subtle.importKey(
    "pkcs8",
    base64ToArrayBuffer(privateKey),
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["decrypt"]
  );

  const decryptedAesKey = await window.crypto.subtle.decrypt(
    {
      name: "RSA-OAEP",
    },
    privateKeyObj,
    base64ToArrayBuffer(encryptedKey)
  );

  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    decryptedAesKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["decrypt"]
  );

  const decryptedContent = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToArrayBuffer(iv),
    },
    aesKey,
    base64ToArrayBuffer(encryptedContent)
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedContent);
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function generateFingerprint(publicKey: string): string {
  const hash = publicKey.slice(0, 40);
  return hash.match(/.{1,4}/g)?.join(" ") || hash;
}

export function saveKeysToStorage(username: string, keyPair: KeyPair): void {
  localStorage.setItem(`archer_keys_${username}`, JSON.stringify(keyPair));
}

export function getKeysFromStorage(username: string): KeyPair | null {
  const keys = localStorage.getItem(`archer_keys_${username}`);
  return keys ? JSON.parse(keys) : null;
}

export function clearKeysFromStorage(username: string): void {
  localStorage.removeItem(`archer_keys_${username}`);
}
