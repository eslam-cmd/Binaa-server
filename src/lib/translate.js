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

function isValidTranslation(value) {
  return (
    value &&
    typeof value.title === "string" &&
    value.title.trim() &&
    typeof value.excerpt === "string" &&
    typeof value.content === "string" &&
    typeof value.category === "string" &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    typeof value.author === "string"
  );
}

function protectCodeBlocks(content) {
  const codeSegments = [];
  const protectedContent = content.replace(
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
  let restoredContent = content;
  for (const { marker, code } of codeSegments) {
    if (restoredContent.split(marker).length !== 2) {
      throw createTranslationError(
        "Gemini returned incomplete Markdown code markers. The article was not published.",
      );
    }
    restoredContent = restoredContent.replace(marker, code);
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
  const input = {
    title,
    excerpt: excerpt || "",
    content: protectedContent,
    category: category || "غير مصنف",
    tags: Array.isArray(tags) ? tags : [],
    author: author || "إسلام هداية",
  };

  try {
    const response = await new GoogleGenAI({ apiKey }).models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Translate this Arabic technical blog post into English (en), German (de), Persian/Farsi (fa), and Russian (ru).

Return only a JSON object with exactly these top-level keys: en, de, fa, ru.
Each language value must contain:
{"title":"...","excerpt":"...","content":"...","category":"...","tags":["..."],"author":"..."}

Rules:
- Translate all natural-language fields, including category, every tag, and author when appropriate.
- Preserve Markdown structure, links, and formatting in content.
- Do not alter any __BLOG_CODE_n__ placeholders. They represent code blocks or inline code and must be returned exactly once.
- Do not translate commands, identifiers, URLs, or package names.
- Keep an empty excerpt empty.
- Preserve the number and order of tags.
- Do not add explanations or fields.

Source article:
${JSON.stringify(input)}`,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    const translations = {};

    for (const [locale, languageName] of Object.entries(TARGET_LANGUAGES)) {
      if (!isValidTranslation(parsed[locale])) {
        throw createTranslationError(
          `Gemini returned an invalid ${languageName} translation. The article was not published.`,
        );
      }
      if (parsed[locale].tags.length !== input.tags.length) {
        throw createTranslationError(
          `Gemini returned an incomplete ${languageName} tags translation. The article was not published.`,
        );
      }
      translations[locale] = {
        ...parsed[locale],
        content: restoreCodeBlocks(parsed[locale].content, codeSegments),
      };
    }

    return translations;
  } catch (error) {
    if (error.translationError) throw error;

    console.error("AI translation failed:", error);
    const message = String(error.message || error);
    if (/user location is not supported|location.*not supported/i.test(message)) {
      throw createTranslationError(
        "رفضت Gemini الطلب لأن موقع الخادم غير مدعوم. يجب تشغيل الخادم في منطقة تدعم Gemini؛ تشغيل VPN على جهاز زائر الموقع لن يحل المشكلة. لم يتم حفظ التعديل أو نشر المقالة.",
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
        ? "خدمة Gemini مشغولة أو غير متاحة مؤقتاً من الخادم. لم يتم حفظ التعديل أو نشر المقالة؛ يرجى المحاولة لاحقاً."
        : "فشلت ترجمة المقالة. لم يتم حفظ التعديل أو نشر المقالة؛ يرجى المحاولة مرة أخرى.",
      isTemporarilyUnavailable ? 503 : 502,
      isTemporarilyUnavailable ? "SERVICE_BUSY" : "TRANSLATION_FAILED",
    );
  }
}

function hasAllTranslations(translations) {
  return Object.keys(TARGET_LANGUAGES).every((locale) =>
    isValidTranslation(translations?.[locale]),
  );
}

function getTranslationStatus(translations) {
  const translatedLanguages = Object.keys(TARGET_LANGUAGES).filter((locale) =>
    isValidTranslation(translations?.[locale]),
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
