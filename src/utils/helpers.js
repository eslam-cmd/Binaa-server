// توليد معرف فريد
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// تنسيق التاريخ
function formatDate(date, locale = "ar-EG") {
  return new Date(date).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// اختصار النص
function truncateText(text, maxLength = 200) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// استخراج الكلمات المفتاحية من النص
function extractKeywords(text, limit = 10) {
  if (!text) return [];

  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 3);

  const wordCount = {};
  words.forEach((word) => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map((entry) => entry[0]);
}

// التحقق من أن القيمة فارغة
function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

// تأخير (للمحاكاة)
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// جلب IP حقيقي
function getRealIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.headers["x-real-ip"] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip
  );
}

module.exports = {
  generateId,
  formatDate,
  truncateText,
  extractKeywords,
  isEmpty,
  sleep,
  getRealIP,
};
