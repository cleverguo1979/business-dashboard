/**
 * 客户端 AES-256-CBC 解密
 * 密钥由邀请词派生，与登录页面联动
 */
const PASSPHRASE_KEY = 'dashboard_passphrase';

export function setPassphrase(pass: string) {
  sessionStorage.setItem(PASSPHRASE_KEY, pass);
}

export function getPassphrase(): string {
  return sessionStorage.getItem(PASSPHRASE_KEY) || '';
}

export function isAuthed(): boolean {
  return !!sessionStorage.getItem(PASSPHRASE_KEY);
}

function deriveKeyFromPassphrase(pass: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyData = enc.encode(pass);
  return crypto.subtle.digest('SHA-256', keyData).then(hash =>
    crypto.subtle.importKey('raw', hash, { name: 'AES-CBC' }, false, ['decrypt'])
  );
}

/**
 * 解密二进制 .enc 文件为 CSV 文本
 */
export async function decryptCSV(encryptedData: ArrayBuffer, passphrase: string): Promise<string> {
  const key = await deriveKeyFromPassphrase(passphrase);
  const iv = encryptedData.slice(0, 16);
  const ciphertext = encryptedData.slice(16);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: new Uint8Array(iv) },
    key,
    ciphertext
  );
  return new TextDecoder('utf-8').decode(decrypted);
}
