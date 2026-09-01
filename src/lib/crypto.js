const crypto = require("crypto");

// توليد رمز OTP عشوائي 6 أرقام
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// توليد رمز جلسة عشوائي
function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

// تشفير البيانات الحساسة
function encryptData(text, secret) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(secret.padEnd(32, "0")),
    iv,
  );
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  return { encrypted, iv: iv.toString("hex"), tag: tag.toString("hex") };
}

// فك التشفير
function decryptData(encryptedData, iv, tag, secret) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(secret.padEnd(32, "0")),
    Buffer.from(iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// تجزئة النصوص البسيطة (لتخزين آمن)
function hashText(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

module.exports = {
  generateOTP,
  generateSessionToken,
  encryptData,
  decryptData,
  hashText,
};
