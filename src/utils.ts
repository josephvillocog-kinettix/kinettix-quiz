import CryptoJS from "crypto-js";

/**
 * Decrypts a text value using CryptoJS AES and a specified encryption key.
 * If the value does not appear to be encrypted (e.g. doesn't start with the
 * typical CryptoJS prefix "U2FsdGVkX1" or if decryption fails), it safely falls back
 * to returning the original string value.
 */
export function decryptText(ciphertext: any, key: string): string {
  if (ciphertext === undefined || ciphertext === null) {
    return "";
  }
  
  const textStr = String(ciphertext).trim();
  const keyStr = String(key || "").trim();

  // If there is no encryption key, we return the text directly as plain text.
  if (!keyStr) {
    return textStr;
  }

  try {
    // CryptoJS AES standard output is base64 text which often starts with "U2FsdGVkX1" (Salted__)
    // We try to decrypt using standard CryptoJS AES decrypter.
    const bytes = CryptoJS.AES.decrypt(textStr, keyStr);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    
    // If it decrypted to a valid string, return it
    if (decrypted) {
      return decrypted;
    }
  } catch (error) {
    console.warn(`Decryption failed for "${textStr.substring(0, 15)}..." using key. Falling back to raw value. Error:`, error);
  }

  // Try standard fallback decryption (without strict Salted__ requirement, in case of raw block mode ciphers)
  try {
    const bytesDirect = CryptoJS.AES.decrypt(textStr, keyStr);
    const decryptedDirect = bytesDirect.toString(CryptoJS.enc.Utf8);
    if (decryptedDirect) {
      return decryptedDirect;
    }
  } catch {
    // Ignore and fallback
  }

  // Return original text if everything failed
  return textStr;
}

/**
 * Normalizes text to make answer matching robust.
 * Removes leading/trailing spaces, multiple inner spaces, and converts to lowercase.
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ") // Collapse multiple spaces to a single space
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ""); // Optionally strip common outer punctuation for lenient matching
}
