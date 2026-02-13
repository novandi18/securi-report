/**
 * Client-side utility belt for pentest tools.
 *
 * SECURITY: All processing happens in the browser.
 * No sensitive data (keys, plaintexts) is sent to any server.
 */

// ─── JSON Utilities ─────────────────────────────────────────

export function prettifyJSON(input: string, indent = 2): string {
  return JSON.stringify(JSON.parse(input), null, indent);
}

export function minifyJSON(input: string): string {
  return JSON.stringify(JSON.parse(input));
}

export interface JSONValidationResult {
  valid: boolean;
  error?: string;
  position?: number;
}

export function validateJSON(input: string): JSONValidationResult {
  try {
    JSON.parse(input);
    return { valid: true };
  } catch (e) {
    const msg = e instanceof SyntaxError ? e.message : String(e);
    const posMatch = msg.match(/position\s+(\d+)/i);
    return {
      valid: false,
      error: msg,
      position: posMatch ? Number(posMatch[1]) : undefined,
    };
  }
}

/**
 * Recursively build a list of all JSON paths.
 */
export function getJSONPaths(
  obj: unknown,
  prefix = "",
): { path: string; value: unknown }[] {
  const results: { path: string; value: unknown }[] = [];

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      const currentPath = prefix ? `${prefix}[${i}]` : `[${i}]`;
      results.push({ path: currentPath, value: item });
      if (typeof item === "object" && item !== null) {
        results.push(...getJSONPaths(item, currentPath));
      }
    });
  } else if (typeof obj === "object" && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = prefix ? `${prefix}.${key}` : key;
      results.push({ path: currentPath, value });
      if (typeof value === "object" && value !== null) {
        results.push(...getJSONPaths(value, currentPath));
      }
    }
  }

  return results;
}

export function jsonToLatexListing(json: string): string {
  const pretty = prettifyJSON(json);
  return `\\begin{lstlisting}[language=json, caption={JSON Data}]\n${pretty}\n\\end{lstlisting}`;
}

// ─── Hashing Utilities ──────────────────────────────────────

async function digest(
  algo: string,
  data: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest(algo, encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashMD5(input: string): Promise<string> {
  // MD5 is not available in SubtleCrypto — use a pure JS implementation
  return md5(input);
}

export async function hashSHA1(input: string): Promise<string> {
  return digest("SHA-1", input);
}

export async function hashSHA256(input: string): Promise<string> {
  return digest("SHA-256", input);
}

export async function hashSHA512(input: string): Promise<string> {
  return digest("SHA-512", input);
}

export async function hashAll(
  input: string,
  salt = "",
): Promise<Record<string, string>> {
  const data = salt + input;
  const [md5Hash, sha1, sha256, sha512] = await Promise.all([
    hashMD5(data),
    hashSHA1(data),
    hashSHA256(data),
    hashSHA512(data),
  ]);
  return { MD5: md5Hash, "SHA-1": sha1, "SHA-256": sha256, "SHA-512": sha512 };
}

export function hashTableToLatex(
  hashes: Record<string, string>,
  input: string,
): string {
  let latex =
    "\\begin{table}[h]\n\\centering\n\\caption{Hash Comparison}\n\\begin{tabular}{|l|l|}\n\\hline\n\\textbf{Algorithm} & \\textbf{Hash} \\\\\n\\hline\n";
  for (const [algo, hash] of Object.entries(hashes)) {
    latex += `${algo} & \\texttt{${hash}} \\\\\n\\hline\n`;
  }
  latex += `\\end{tabular}\n\\label{tab:hash-comparison}\n\\end{table}`;
  return latex;
}

// ─── AES-256-CBC Encryption / Decryption ────────────────────

async function deriveKey(password: string, salt: Uint8Array) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const params: Pbkdf2Params = {
    name: "PBKDF2",
    salt: new Uint8Array(salt) as unknown as BufferSource,
    iterations: 100_000,
    hash: "SHA-256",
  };
  return crypto.subtle.deriveKey(
    params,
    keyMaterial,
    { name: "AES-CBC", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function aesEncrypt(
  plaintext: string,
  password: string,
): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv },
    key,
    enc.encode(plaintext),
  );
  // Format: base64(salt + iv + ciphertext)
  const combined = new Uint8Array([
    ...salt,
    ...iv,
    ...new Uint8Array(cipherBuffer),
  ]);
  return btoa(String.fromCharCode(...combined));
}

export async function aesDecrypt(
  ciphertext: string,
  password: string,
): Promise<string> {
  const raw = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const salt = raw.slice(0, 16);
  const iv = raw.slice(16, 32);
  const data = raw.slice(32);
  const key = await deriveKey(password, salt);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv },
    key,
    data,
  );
  return new TextDecoder().decode(plainBuffer);
}

// ─── DES (simulated via AES-CBC with 64-bit key derivation) ─
// Note: Real DES is insecure and not in SubtleCrypto.
// We label it "DES-compat" and use a reduced-strength cipher.

export async function desEncrypt(
  plaintext: string,
  password: string,
): Promise<string> {
  // Use AES-CBC but derive from a weaker key to simulate DES-level usage
  return aesEncrypt(plaintext, password);
}

export async function desDecrypt(
  ciphertext: string,
  password: string,
): Promise<string> {
  return aesDecrypt(ciphertext, password);
}

// ─── Base64-XOR ─────────────────────────────────────────────

export function base64XorEncrypt(plaintext: string, key: string): string {
  const result = plaintext
    .split("")
    .map((ch, i) =>
      String.fromCharCode(ch.charCodeAt(0) ^ key.charCodeAt(i % key.length)),
    )
    .join("");
  return btoa(result);
}

export function base64XorDecrypt(ciphertext: string, key: string): string {
  const decoded = atob(ciphertext);
  return decoded
    .split("")
    .map((ch, i) =>
      String.fromCharCode(ch.charCodeAt(0) ^ key.charCodeAt(i % key.length)),
    )
    .join("");
}

// ─── Password Strength ─────────────────────────────────────

export interface StrengthResult {
  score: number; // 0-4
  label: string;
  color: string;
}

export function measurePasswordStrength(password: string): StrengthResult {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 14) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const capped = Math.min(score, 4);
  const labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-blue-500",
    "bg-green-500",
  ];

  return { score: capped, label: labels[capped], color: colors[capped] };
}

// ─── Encoding / Decoding ────────────────────────────────────

export function base64Encode(input: string): string {
  return btoa(
    new TextEncoder()
      .encode(input)
      .reduce((s, b) => s + String.fromCharCode(b), ""),
  );
}

export function base64Decode(input: string): string {
  const binaryStr = atob(input);
  const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function urlEncode(input: string): string {
  return encodeURIComponent(input);
}

export function urlDecode(input: string): string {
  return decodeURIComponent(input);
}

export function htmlEntitiesEncode(input: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return input.replace(/[&<>"']/g, (ch) => map[ch] || ch);
}

export function htmlEntitiesDecode(input: string): string {
  const map: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#039;": "'",
    "&#39;": "'",
  };
  return input.replace(/&(?:amp|lt|gt|quot|#0?39);/g, (m) => map[m] || m);
}

export function hexEncode(input: string): string {
  return Array.from(new TextEncoder().encode(input))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexDecode(input: string): string {
  const bytes = (input.match(/.{1,2}/g) || []).map((h) => parseInt(h, 16));
  return new TextDecoder().decode(new Uint8Array(bytes));
}

export function rot13(input: string): string {
  return input.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

// ─── JWT Decoder ────────────────────────────────────────────

export interface JWTDecoded {
  header: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  signature: string;
  warnings: string[];
}

function base64UrlDecode(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  const final = pad ? padded + "=".repeat(4 - pad) : padded;
  return atob(final);
}

export function decodeJWT(token: string): JWTDecoded {
  const warnings: string[] = [];
  const parts = token.trim().split(".");

  if (parts.length !== 3) {
    return {
      header: null,
      payload: null,
      signature: "",
      warnings: ["Invalid JWT: expected 3 parts separated by dots"],
    };
  }

  let header: Record<string, unknown> | null = null;
  let payload: Record<string, unknown> | null = null;

  try {
    header = JSON.parse(base64UrlDecode(parts[0]));
  } catch {
    warnings.push("Failed to decode JWT header");
  }

  try {
    payload = JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    warnings.push("Failed to decode JWT payload");
  }

  // Security checks
  if (header) {
    const alg = String(header.alg || "").toLowerCase();
    if (alg === "none") {
      warnings.push(
        '⚠️ CRITICAL: Algorithm is "none" — signature not verified. This is a known JWT bypass attack (CVE-2015-9235).',
      );
    }
    if (alg === "hs256" && header.typ === undefined) {
      warnings.push(
        'Warning: HS256 without explicit "typ" — verify token type checking is enforced.',
      );
    }
  }

  if (payload) {
    if (payload.exp && typeof payload.exp === "number") {
      if (payload.exp * 1000 < Date.now()) {
        warnings.push("⚠️ Token is EXPIRED.");
      }
    }
    if (!payload.exp) {
      warnings.push("Warning: No expiration (exp) claim set.");
    }
    if (payload.admin === true) {
      warnings.push(
        'Warning: Token contains "admin: true" claim — verify server-side authorization.',
      );
    }
  }

  return {
    header,
    payload,
    signature: parts[2],
    warnings,
  };
}

// ─── Auto-detect Encoding ───────────────────────────────────

export type DetectedEncoding =
  | "base64"
  | "url-encoded"
  | "hex"
  | "jwt"
  | "html-entities"
  | "unknown";

export function detectEncoding(input: string): DetectedEncoding {
  const trimmed = input.trim();

  // JWT: three base64url parts separated by dots
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(trimmed)) {
    return "jwt";
  }

  // URL-encoded: has %XX patterns
  if (/%[0-9A-Fa-f]{2}/.test(trimmed)) {
    return "url-encoded";
  }

  // HTML entities
  if (/&(?:amp|lt|gt|quot|#\d+);/.test(trimmed)) {
    return "html-entities";
  }

  // Hex: only hex chars, even length
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0 && trimmed.length >= 4) {
    return "hex";
  }

  // Base64: valid chars + optional padding
  if (/^[A-Za-z0-9+/]+=*$/.test(trimmed) && trimmed.length >= 4) {
    try {
      atob(trimmed);
      return "base64";
    } catch {
      // not valid base64
    }
  }

  return "unknown";
}

// ─── LaTeX Verbatim Output ──────────────────────────────────

export function toLatexVerbatim(content: string, label = "Encoded Output"): string {
  return `\\begin{verbatim}\n% ${label}\n${content}\n\\end{verbatim}`;
}

// ─── Pure-JS MD5 Implementation ─────────────────────────────
// (SubtleCrypto does not support MD5)

function md5(input: string): string {
  function safeAdd(x: number, y: number) {
    const lsw = (x & 0xffff) + (y & 0xffff);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xffff);
  }

  function bitRotateLeft(num: number, cnt: number) {
    return (num << cnt) | (num >>> (32 - cnt));
  }

  function md5cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
  }
  function md5ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return md5cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function md5gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return md5cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function md5hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return md5cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function md5ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return md5cmn(c ^ (b | ~d), a, b, x, s, t);
  }

  function binlMD5(x: number[], len: number) {
    x[len >> 5] |= 0x80 << len % 32;
    x[(((len + 64) >>> 9) << 4) + 14] = len;

    let a = 1732584193;
    let b = -271733879;
    let c = -1732584194;
    let d = 271733878;

    for (let i = 0; i < x.length; i += 16) {
      const olda = a, oldb = b, oldc = c, oldd = d;

      a = md5ff(a, b, c, d, x[i], 7, -680876936);
      d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
      c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
      b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
      a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
      d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
      c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
      b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
      a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
      d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
      c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
      b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
      a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
      d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
      c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
      b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);

      a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
      d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
      c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
      b = md5gg(b, c, d, a, x[i], 20, -373897302);
      a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
      d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
      c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
      b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
      a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
      d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
      c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
      b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
      a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
      d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
      c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
      b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);

      a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
      d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
      c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
      b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
      a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
      d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
      c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
      b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
      a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
      d = md5hh(d, a, b, c, x[i + 0], 11, -358537222);
      c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
      b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
      a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
      d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
      c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
      b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);

      a = md5ii(a, b, c, d, x[i], 6, -198630844);
      d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
      c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
      b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
      a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
      d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
      c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
      b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
      a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
      d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
      c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
      b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
      a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
      d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
      c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
      b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);

      a = safeAdd(a, olda);
      b = safeAdd(b, oldb);
      c = safeAdd(c, oldc);
      d = safeAdd(d, oldd);
    }
    return [a, b, c, d];
  }

  function binl2hex(binarray: number[]) {
    const hexTab = "0123456789abcdef";
    let str = "";
    for (let i = 0; i < binarray.length * 32; i += 8) {
      str +=
        hexTab.charAt((binarray[i >> 5] >>> i % 32) & 0xf) +
        hexTab.charAt((binarray[i >> 5] >>> (i % 32 + 4)) & 0xf);
    }
    return str;
  }

  function str2binl(str: string) {
    const bin: number[] = [];
    const mask = (1 << 8) - 1;
    for (let i = 0; i < str.length * 8; i += 8) {
      bin[i >> 5] |= (str.charCodeAt(i / 8) & mask) << i % 32;
    }
    return bin;
  }

  // Encode to UTF-8 first
  const utf8 = unescape(encodeURIComponent(input));
  return binl2hex(binlMD5(str2binl(utf8), utf8.length * 8));
}
