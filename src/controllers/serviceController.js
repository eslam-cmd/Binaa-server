const pool = require("../config/database");

async function getServiceColumns() {
  try {
    const result = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'services'`,
    );
    return new Set(result.rows.map((row) => row.column_name));
  } catch (error) {
    return new Set();
  }
}

// جلب جميع الخدمات (عام)
exports.getAllServices = async (req, res) => {
  try {
    const columns = await getServiceColumns();
    const selectFields = [
      "id",
      "name",
      "description",
      "price",
      "features",
      "emoji",
      "is_active",
      "is_highlighted",
      "display_order",
    ];

    if (columns.has("category")) {
      selectFields.push("category");
    }

    const result = await pool.query(
      `SELECT ${selectFields.join(", ")} 
       FROM services 
       WHERE is_active = true 
       ORDER BY display_order ASC, id ASC`,
    );

    res.json({
      success: true,
      services: result.rows,
    });
  } catch (error) {
    console.error("خطأ في جلب الخدمات:", error);
    res.status(500).json({ error: "حدث خطأ في جلب الخدمات" });
  }
};

// جلب خدمة واحدة (عام)
exports.getService = async (req, res) => {
  try {
    const { id } = req.params;
    const columns = await getServiceColumns();
    const selectFields = [
      "id",
      "name",
      "description",
      "price",
      "features",
      "emoji",
      "is_active",
      "is_highlighted",
      "display_order",
    ];

    if (columns.has("category")) {
      selectFields.push("category");
    }

    const result = await pool.query(
      `SELECT ${selectFields.join(", ")} 
       FROM services 
       WHERE id = $1 AND is_active = true`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "الخدمة غير موجودة" });
    }

    res.json({ service: result.rows[0] });
  } catch (error) {
    console.error("خطأ في جلب الخدمة:", error);
    res.status(500).json({ error: "حدث خطأ في جلب الخدمة" });
  }
};

// تحديث خدمة (Admin فقط)
exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      features,
      emoji,
      category,
      isActive,
      isHighlighted,
      displayOrder,
    } = req.body;
    const columns = await getServiceColumns();

    // التحقق من وجود الخدمة
    const existingService = await pool.query(
      "SELECT * FROM services WHERE id = $1",
      [id],
    );

    if (existingService.rows.length === 0) {
      return res.status(404).json({ error: "الخدمة غير موجودة" });
    }

    // بناء جملة التحديث
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (price !== undefined) {
      updates.push(`price = $${paramCount++}`);
      values.push(price);
    }
    if (features !== undefined) {
      updates.push(`features = $${paramCount++}`);
      values.push(features);
    }
    if (emoji !== undefined) {
      updates.push(`emoji = $${paramCount++}`);
      values.push(emoji);
    }
    if (columns.has("category") && category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(category);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(isActive);
    }
    if (isHighlighted !== undefined) {
      updates.push(`is_highlighted = $${paramCount++}`);
      values.push(isHighlighted);
    }
    if (displayOrder !== undefined) {
      updates.push(`display_order = $${paramCount++}`);
      values.push(displayOrder);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE services 
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
        "update_service",
        req.ip,
        req.headers["user-agent"],
        JSON.stringify({ serviceId: id }),
      ],
    );

    res.json({
      success: true,
      message: "تم تحديث الخدمة بنجاح",
      service: result.rows[0],
    });
  } catch (error) {
    console.error("خطأ في تحديث الخدمة:", error);
    res.status(500).json({ error: "حدث خطأ في تحديث الخدمة" });
  }
};

// إنشاء خدمة جديدة (Admin فقط)
exports.createService = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      features,
      emoji,
      category,
      isActive,
      isHighlighted,
      displayOrder,
    } = req.body;
    const columns = await getServiceColumns();

    if (!name) {
      return res.status(400).json({ error: "اسم الخدمة مطلوب" });
    }

    const insertColumns = [
      "name",
      "description",
      "price",
      "features",
      "emoji",
      "is_active",
      "is_highlighted",
      "display_order",
    ];
    const insertValues = [
      name,
      description || null,
      price || null,
      features || [],
      emoji || "📦",
      isActive !== undefined ? isActive : true,
      isHighlighted || false,
      displayOrder || 99,
    ];

    if (columns.has("category")) {
      insertColumns.push("category");
      insertValues.push(category || "عام");
    }

    const placeholders = insertColumns
      .map((_, index) => `$${index + 1}`)
      .join(", ");

    const result = await pool.query(
      `INSERT INTO services (${insertColumns.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      insertValues,
    );

    // تسجيل النشاط
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        "create_service",
        req.ip,
        req.headers["user-agent"],
        JSON.stringify({ serviceId: result.rows[0].id }),
      ],
    );

    res.status(201).json({
      success: true,
      message: "تم إنشاء الخدمة بنجاح",
      service: result.rows[0],
    });
  } catch (error) {
    console.error("خطأ في إنشاء الخدمة:", error);
    res.status(500).json({ error: "حدث خطأ في إنشاء الخدمة" });
  }
};

// حذف خدمة (Admin فقط)
exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM services WHERE id = $1 RETURNING *",
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "الخدمة غير موجودة" });
    }

    // تسجيل النشاط
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        "delete_service",
        req.ip,
        req.headers["user-agent"],
        JSON.stringify({ serviceId: id }),
      ],
    );

    res.json({
      success: true,
      message: "تم حذف الخدمة بنجاح",
    });
  } catch (error) {
    console.error("خطأ في حذف الخدمة:", error);
    res.status(500).json({ error: "حدث خطأ في حذف الخدمة" });
  }
};
