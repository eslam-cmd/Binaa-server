const pool = require("../config/database");
const { sendTelegramAlert } = require("../lib/telegram");

// جلب جميع المقالات
exports.getAllPosts = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, slug, excerpt, category, tags, cover_image, 
              author, views, created_at, updated_at 
       FROM posts 
       WHERE status = 'published' 
       ORDER BY created_at DESC`,
    );

    res.json({
      success: true,
      count: result.rows.length,
      posts: result.rows,
    });
  } catch (error) {
    console.error("خطأ في جلب المقالات:", error);
    res.status(500).json({ error: "حدث خطأ في جلب المقالات" });
  }
};

// جلب مقالة واحدة
exports.getPost = async (req, res) => {
  try {
    const { id } = req.params;

    // زيادة عدد المشاهدات
    await pool.query("UPDATE posts SET views = views + 1 WHERE id = $1", [id]);

    const result = await pool.query(
      `SELECT id, title, slug, excerpt, content, category, tags, 
              cover_image, author, views, status, created_at, updated_at 
       FROM posts 
       WHERE id = $1 AND status = 'published'`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "المقالة غير موجودة" });
    }

    res.json({ post: result.rows[0] });
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

    // التحقق من البيانات المطلوبة
    if (!title || !content) {
      return res.status(400).json({ error: "العنوان والمحتوى مطلوبان" });
    }

    // إنشاء slug تلقائي
    const slug = normalizeSlug(title) || "post";

    // التحقق من عدم وجود slug مكرر
    const existingSlug = await pool.query(
      "SELECT id FROM posts WHERE slug = $1",
      [slug],
    );

    let finalSlug = slug;
    if (existingSlug.rows.length > 0) {
      finalSlug = `${slug}-${Date.now().toString().slice(-6)}`;
    }

    const result = await pool.query(
      `INSERT INTO posts (
        title, slug, excerpt, content, category, tags, 
        cover_image, author, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        title,
        finalSlug,
        excerpt || content.substring(0, 200),
        content,
        category || "غير مصنف",
        tags || [],
        coverImage || null,
        author || "إسلام هداية",
        status || "published",
      ],
    );

    const newPost = result.rows[0];

    // إرسال إشعار Telegram
    await sendTelegramAlert(
      `📝 **مقالة جديدة**\n` +
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
      message: "تم إنشاء المقالة بنجاح",
      post: newPost,
    });
  } catch (error) {
    console.error("خطأ في إنشاء المقالة:", error);
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
    } = req.body;

    // التحقق من وجود المقالة
    const existingPost = await pool.query("SELECT * FROM posts WHERE id = $1", [
      id,
    ]);

    if (existingPost.rows.length === 0) {
      return res.status(404).json({ error: "المقالة غير موجودة" });
    }

    // بناء جملة التحديث
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (excerpt !== undefined) {
      updates.push(`excerpt = $${paramCount++}`);
      values.push(excerpt);
    }
    if (content) {
      updates.push(`content = $${paramCount++}`);
      values.push(content);
    }
    if (category) {
      updates.push(`category = $${paramCount++}`);
      values.push(category);
    }
    if (tags) {
      updates.push(`tags = $${paramCount++}`);
      values.push(tags);
    }
    if (coverImage !== undefined) {
      updates.push(`cover_image = $${paramCount++}`);
      values.push(coverImage);
    }
    if (author) {
      updates.push(`author = $${paramCount++}`);
      values.push(author);
    }
    if (status) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE posts 
       SET ${updates.join(", ")} 
       WHERE id = $${paramCount}
       RETURNING *`,
      values,
    );

    // تسجيل النشاط
    await pool.query(
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

    res.json({
      success: true,
      message: "تم تحديث المقالة بنجاح",
      post: result.rows[0],
    });
  } catch (error) {
    console.error("خطأ في تحديث المقالة:", error);
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

    // تسجيل النشاط
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
