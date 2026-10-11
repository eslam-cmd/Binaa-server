const { GoogleGenAI } = require("@google/genai");

const TARGET_LANGUAGES = {
  en: "English",
  de: "German",
  fa: "Persian (Farsi)",
  ru: "Russian",
};

function createTranslationError(
  message,
  statusCode = 502,
  code = "TRANSLATION_FAILED",
) {
  const error = new Error(message);
  error.translationError = true;
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function sanitizeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function protectCodeBlocks(content) {
  const codeSegments = [];
  const protectedContent = String(content || "").replace(
    /(`{3,}[\s\S]*?`{3,}|~{3,}[\s\S]*?~{3,}|`[^`\n]+`)/g,
    (code) => {
      const marker = `__BLOG_CODE_${codeSegments.length}__`;
      codeSegments.push({ marker, code });
      return marker;
    },
  );
  return { protectedContent, codeSegments };
}

function restoreCodeBlocks(content, codeSegments) {
  let restoredContent = String(content || "");
  for (const { marker, code } of codeSegments) {
    if (restoredContent.includes(marker)) {
      restoredContent = restoredContent.split(marker).join(code);
    }
  }
  return restoredContent;
}

async function generateTranslations({
  title,
  excerpt,
  content,
  category,
  tags,
  author,
}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw createTranslationError(
      "لم يتم ضبط مفتاح Gemini على الخادم. لم يتم نشر المقالة.",
      503,
      "GEMINI_KEY_MISSING",
    );
  }

  const { protectedContent, codeSegments } = protectCodeBlocks(content);
  const originalTags = Array.isArray(tags) ? tags : [];

  const input = {
    title: title || "",
    excerpt: excerpt || "",
    content: protectedContent,
    category: category || "غير مصنف",
    tags: originalTags,
    author: author || "إسلام هداية",
  };

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `You are an expert technical translator. Translate this Arabic technical blog post into English (en), German (de), Persian/Farsi (fa), and Russian (ru).

Return ONLY a valid JSON object with exactly these top-level keys: en, de, fa, ru.
Each language value must have this structure:
{"title":"...","excerpt":"...","content":"...","category":"...","tags":["..."],"author":"..."}

RULES:
1. Translate title, excerpt, category, tags, and content accurately.
2. Maintain Markdown formatting and structure strictly.
3. CRITICAL: Preserve all __BLOG_CODE_n__ markers exactly as they are without modifying or dropping them.
4. Do not translate code, shell commands, URLs, or variable names.
5. Return raw JSON without markdown code fences (\`\`\`json).

Source Data:
${JSON.stringify(input)}`,
      config: {
        responseMimeType: "application/json",
      },
    });

    let rawText = response.text || "{}";
    // تنظيف في حال أرجع النموذج وسوم markdown إضافية
    rawText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const parsed = JSON.parse(rawText);
    const translations = {};

    for (const [locale] of Object.entries(TARGET_LANGUAGES)) {
      const item = parsed[locale] || {};

      // معالجة مرنة للوسوم لتجنب الانهيار إذا اختلف عددها
      const safeTags =
        Array.isArray(item.tags) && item.tags.length > 0
          ? item.tags.map(String)
          : originalTags;

      translations[locale] = {
        title: sanitizeText(item.title, title),
        excerpt: sanitizeText(item.excerpt, excerpt || ""),
        category: sanitizeText(item.category, category || "Uncategorized"),
        author: sanitizeText(item.author, author || "Islam Hadaya"),
        tags: safeTags,
        content: restoreCodeBlocks(
          sanitizeText(item.content, input.content),
          codeSegments,
        ),
      };
    }

    return translations;
  } catch (error) {
    if (error.translationError) throw error;

    console.error("AI translation error detail:", {
      status: error.status,
      message: error.message,
      stack: error.stack,
    });

    const message = String(error.message || error);
    if (
      /user location is not supported|location.*not supported/i.test(message)
    ) {
      throw createTranslationError(
        "رفضت Gemini الطلب لأن موقع الخادم غير مدعوم. يجب تشغيل الخادم في منطقة تدعم Gemini. لم يتم حفظ التعديل أو نشر المقالة.",
        503,
        "REGION_RESTRICTED",
      );
    }

    const isTemporarilyUnavailable =
      error.status === 503 ||
      error.status === 429 ||
      /high demand|temporarily unavailable/i.test(message);

    throw createTranslationError(
      isTemporarilyUnavailable
        ? "خدمة Gemini مشغولة أو غير متاحة مؤقتاً من الخادم. يرجى المحاولة لاحقاً."
        : "فشلت ترجمة المقالة من قِبل الخدمة. يرجى المحاولة مرة أخرى.",
      isTemporarilyUnavailable ? 503 : 502,
      isTemporarilyUnavailable ? "SERVICE_BUSY" : "TRANSLATION_FAILED",
    );
  }
}

function hasAllTranslations(translations) {
  if (!translations || typeof translations !== "object") return false;
  return Object.keys(TARGET_LANGUAGES).every(
    (locale) =>
      translations[locale] &&
      typeof translations[locale].title === "string" &&
      typeof translations[locale].content === "string",
  );
}

function getTranslationStatus(translations) {
  const translatedLanguages = Object.keys(TARGET_LANGUAGES).filter(
    (locale) =>
      translations?.[locale] &&
      typeof translations[locale].title === "string" &&
      typeof translations[locale].content === "string",
  );

  return {
    translatedLanguages,
    translationCount: translatedLanguages.length,
    hasTranslations: translatedLanguages.length > 0,
    translationsComplete:
      translatedLanguages.length === Object.keys(TARGET_LANGUAGES).length,
  };
}

module.exports = {
  generateTranslations,
  getTranslationStatus,
  hasAllTranslations,
};
