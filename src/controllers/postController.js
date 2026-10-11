const pool = require("../config/database");
const { sendTelegramAlert } = require("../lib/telegram");
const {
  generateTranslations,
  getTranslationStatus,
  hasAllTranslations,
} = require("../lib/translate");

const SUPPORTED_TRANSLATION_LOCALES = new Set(["en", "de", "fa", "ru"]);

function localizePost(post, locale) {
  if (!locale || locale === "ar") return post;

  const translation = post.translations?.[locale];
  if (!translation) {
    return { ...post, translationAvailable: false };
  }
  const isComplete =
    typeof translation.title === "string" &&
    typeof translation.excerpt === "string" &&
    typeof translation.content === "string" &&
    typeof translation.category === "string" &&
    typeof translation.author === "string" &&
    Array.isArray(translation.tags) &&
    translation.tags.every((tag) => typeof tag === "string");
  if (!isComplete) {
    return { ...post, translationAvailable: false };
  }

  return {
    ...post,
    title: translation.title || post.title,
    excerpt: translation.excerpt ?? post.excerpt,
    content: translation.content || post.content,
    category: translation.category || post.category,
    tags: Array.isArray(translation.tags) ? translation.tags : post.tags,
    author: translation.author || post.author,
    translationAvailable: true,
  };
}

// جلب جميع المقالات (مع دعم استعلام اللغة ?lang=en)
exports.getAllPosts = async (req, res) => {
  try {
    const requestedLanguage = String(req.query.lang || "ar");
    if (
      requestedLanguage !== "ar" &&
      !SUPPORTED_TRANSLATION_LOCALES.has(requestedLanguage)
    ) {
      return res.status(400).json({ error: "اللغة المطلوبة غير مدعومة" });
    }

    const result = await pool.query(
      `SELECT id, title, slug, excerpt, content, category, tags, cover_image, 
              author, views, translations, created_at, updated_at 
       FROM posts 
       WHERE status = 'published' 
       ORDER BY created_at DESC`,
    );

    const posts = result.rows.map((post) => {
      const localizedPost = localizePost(post, requestedLanguage);
      const publicPost = { ...localizedPost };
      Object.assign(publicPost, getTranslationStatus(post.translations));
      delete publicPost.translations;
      return publicPost;
    });

    res.json({
      success: true,
      count: posts.length,
      posts,
    });
  } catch (error) {
    console.error("خطأ في جلب المقالات:", error);
    res.status(500).json({ error: "حدث خطأ في جلب المقالات" });
  }
};

// جلب مقالة واحدة (مع دعم اللغة ?lang=en أو ru أو de)
exports.getPost = async (req, res) => {
  try {
    const { id } = req.params;
    const requestedLanguage = String(req.query.lang || "ar");
    if (
      requestedLanguage !== "ar" &&
      !SUPPORTED_TRANSLATION_LOCALES.has(requestedLanguage)
    ) {
      return res.status(400).json({ error: "اللغة المطلوبة غير مدعومة" });
    }

    // زيادة عدد المشاهدات
    await pool.query("UPDATE posts SET views = views + 1 WHERE id = $1", [id]);

    const result = await pool.query(
      `SELECT id, title, slug, excerpt, content, category, tags, 
              cover_image, author, views, status, translations, created_at, updated_at 
       FROM posts 
       WHERE id = $1 AND status = 'published'`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "المقالة غير موجودة" });
    }

    const post = localizePost(result.rows[0], requestedLanguage);

    res.json({ post });
  } catch (error) {
    console.error("خطأ في جلب المقالة:", error);
    res.status(500).json({ error: "حدث خطأ في جلب المقالة" });
  }
};

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 200);
}

// إنشاء مقالة جديدة (Admin فقط)
exports.createPost = async (req, res) => {
  try {
    const {
      title,
      excerpt,
      content,
      category,
      tags,
      coverImage,
      author,
      status,
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "العنوان والمحتوى مطلوبان" });
    }

    const slug = normalizeSlug(title) || "post";

    const existingSlug = await pool.query(
      "SELECT id FROM posts WHERE slug = $1",
      [slug],
    );

    let finalSlug = slug;
    if (existingSlug.rows.length > 0) {
      finalSlug = `${slug}-${Date.now().toString().slice(-6)}`;
    }

    const finalExcerpt = excerpt || content.substring(0, 200);
    const normalizedCategory = category || "غير مصنف";
    const normalizedTags = Array.isArray(tags) ? tags : [];
    const normalizedAuthor = author || "إسلام هداية";
    const publishedStatus = status || "published";

    // Translate before publishing so the database always has every locale.
    const translations =
      publishedStatus === "published"
        ? await generateTranslations({
            title,
            excerpt: finalExcerpt,
            content,
            category: normalizedCategory,
            tags: normalizedTags,
            author: normalizedAuthor,
          })
        : {};

    const result = await pool.query(
      `INSERT INTO posts (
        title, slug, excerpt, content, category, tags, 
        cover_image, author, status, translations
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      RETURNING *`,
      [
        title,
        finalSlug,
        finalExcerpt,
        content,
        normalizedCategory,
        normalizedTags,
        coverImage || null,
        normalizedAuthor,
        publishedStatus,
        JSON.stringify(translations),
      ],
    );

    const newPost = result.rows[0];

    // إرسال إشعار Telegram
    await sendTelegramAlert(
      `📝 **مقالة جديدة (متعددة اللغات)**\n` +
        `العنوان: ${newPost.title}\n` +
        `التصنيف: ${newPost.category}\n` +
        `الكاتب: ${newPost.author}\n` +
        `الرابط: /blog/${newPost.slug}`,
    ).catch(console.error);

    // تسجيل النشاط
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        "create_post",
        req.ip,
        req.headers["user-agent"],
        JSON.stringify({ postId: newPost.id }),
      ],
    );

    res.status(201).json({
      success: true,
      message:
        publishedStatus === "published"
          ? "تم إنشاء المقالة وترجمتها إلى اللغات الأربع بنجاح"
          : "تم حفظ المسودة",
      post: newPost,
      ...getTranslationStatus(newPost.translations),
    });
  } catch (error) {
    console.error("خطأ في إنشاء المقالة:", error);
    if (error.translationError) {
      return res.status(error.statusCode || 502).json({
        error: error.message,
        translationError: true,
        code: error.code,
      });
    }
    res.status(500).json({ error: "حدث خطأ في إنشاء المقالة" });
  }
};

// تحديث مقالة (Admin فقط)
exports.updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      excerpt,
      content,
      category,
      tags,
      coverImage,
      author,
      status,
      regenerateTranslations, // خيار إضافي: true إذا أردت إعادة توليد الترجمات بعد تعديل النص العربي
    } = req.body;

    const existingPost = await pool.query("SELECT * FROM posts WHERE id = $1", [
      id,
    ]);

    if (existingPost.rows.length === 0) {
      return res.status(404).json({ error: "المقالة غير موجودة" });
    }

    const currentPost = existingPost.rows[0];
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (excerpt !== undefined) {
      updates.push(`excerpt = $${paramCount++}`);
      values.push(excerpt);
    }
    if (content !== undefined) {
      updates.push(`content = $${paramCount++}`);
      values.push(content);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(category);
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramCount++}`);
      values.push(tags);
    }
    if (coverImage !== undefined) {
      updates.push(`cover_image = $${paramCount++}`);
      values.push(coverImage);
    }
    if (author !== undefined) {
      updates.push(`author = $${paramCount++}`);
      values.push(author);
    }
    if (status) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }

    const translationSourceChanged =
      (title !== undefined && title !== currentPost.title) ||
      (excerpt !== undefined && excerpt !== currentPost.excerpt) ||
      (content !== undefined && content !== currentPost.content) ||
      (category !== undefined && category !== currentPost.category) ||
      (author !== undefined && author !== currentPost.author) ||
      (tags !== undefined &&
        JSON.stringify(tags) !== JSON.stringify(currentPost.tags));
    const nextStatus = status || currentPost.status;
    const shouldGenerateTranslations =
      nextStatus === "published" &&
      (regenerateTranslations ||
        translationSourceChanged ||
        !hasAllTranslations(currentPost.translations));

    if (shouldGenerateTranslations) {
      const newTranslations = await generateTranslations({
        title: title ?? currentPost.title,
        excerpt: excerpt !== undefined ? excerpt : currentPost.excerpt,
        content: content ?? currentPost.content,
        category: category ?? currentPost.category,
        tags: tags ?? currentPost.tags,
        author: author ?? currentPost.author,
      });
      updates.push(`translations = $${paramCount++}::jsonb`);
      values.push(JSON.stringify(newTranslations));
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const client = await pool.connect();
    let result;
    try {
      await client.query("BEGIN");
      result = await client.query(
        `UPDATE posts
         SET ${updates.join(", ")}
         WHERE id = $${paramCount}
         RETURNING *`,
        values,
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "المقالة غير موجودة" });
      }

      if (shouldGenerateTranslations && !hasAllTranslations(result.rows[0].translations)) {
        throw new Error("لم يتم حفظ الترجمات كاملة في قاعدة البيانات");
      }

      await client.query(
        `INSERT INTO activity_logs (user_id, action, ip_address, user_agent, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.id,
          "update_post",
          req.ip,
          req.headers["user-agent"],
          JSON.stringify({ postId: id }),
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch((rollbackError) => {
        console.error("خطأ في التراجع عن تحديث المقالة:", rollbackError);
      });
      throw error;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      message: "تم تحديث المقالة بنجاح",
      post: result.rows[0],
      ...getTranslationStatus(result.rows[0].translations),
    });
  } catch (error) {
    console.error("خطأ في تحديث المقالة:", error);
    if (error.translationError) {
      return res.status(error.statusCode || 502).json({
        error: error.message,
        translationError: true,
        code: error.code,
      });
    }
    res.status(500).json({ error: "حدث خطأ في تحديث المقالة" });
  }
};

// حذف مقالة (Admin فقط)
exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM posts WHERE id = $1 RETURNING *",
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "المقالة غير موجودة" });
    }

    await pool.query(
      `INSERT INTO activity_logs (user_id, action, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        "delete_post",
        req.ip,
        req.headers["user-agent"],
        JSON.stringify({ postId: id }),
      ],
    );

    res.json({
      success: true,
      message: "تم حذف المقالة بنجاح",
    });
  } catch (error) {
    console.error("خطأ في حذف المقالة:", error);
    res.status(500).json({ error: "حدث خطأ في حذف المقالة" });
  }
};
