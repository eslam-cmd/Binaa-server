const pool = require("../config/database");

// تسجيل زائر جديد
exports.trackVisitor = async (req, res) => {
  try {
    const { visitorId, page, email, ip, browser, os, device, userAgent } =
      req.body;

    if (!visitorId) {
      return res.status(400).json({ error: "معرف الزائر مطلوب" });
    }

    // التحقق من وجود الزائر
    const existingVisitor = await pool.query(
      "SELECT * FROM visitors WHERE visitor_id = $1",
      [visitorId],
    );

    if (existingVisitor.rows.length > 0) {
      // تحديث الزائر الموجود
      const visitor = existingVisitor.rows[0];
      const pagesVisited = visitor.pages_visited || [];
      if (!pagesVisited.includes(page)) {
        pagesVisited.push(page);
      }

      await pool.query(
        `UPDATE visitors 
         SET last_visit = CURRENT_TIMESTAMP,
             visit_count = visit_count + 1,
             pages_visited = $1,
             email = COALESCE($2, email),
             ip_address = COALESCE($3, ip_address),
             browser = COALESCE($4, browser),
             os = COALESCE($5, os),
             device = COALESCE($6, device)
         WHERE visitor_id = $7`,
        [pagesVisited, email, ip, browser, os, device, visitorId],
      );

      return res.json({
        success: true,
        message: "تم تحديث الزائر",
        isNew: false,
      });
    } else {
      // إضافة زائر جديد
      await pool.query(
        `INSERT INTO visitors (
          visitor_id, ip_address, user_agent, browser, os, device,
          email, pages_visited
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [visitorId, ip, userAgent, browser, os, device, email || null, [page]],
      );

      return res.json({
        success: true,
        message: "تم تسجيل زائر جديد",
        isNew: true,
      });
    }
  } catch (error) {
    console.error("خطأ في تسجيل الزائر:", error);
    res.status(500).json({ error: "حدث خطأ في تسجيل الزائر" });
  }
};

// جلب جميع الزوار (Admin فقط)
exports.getVisitors = async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT id, visitor_id, ip_address, browser, os, device, email,
              visit_count, first_visit, last_visit, pages_visited
       FROM visitors 
       ORDER BY last_visit DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    const countResult = await pool.query("SELECT COUNT(*) FROM visitors");

    res.json({
      success: true,
      visitors: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit),
      },
    });
  } catch (error) {
    console.error("خطأ في جلب الزوار:", error);
    res.status(500).json({ error: "حدث خطأ في جلب الزوار" });
  }
};

// جلب إحصاءات الزوار (Admin فقط)
exports.getVisitorStats = async (req, res) => {
  try {
    // إجمالي الزوار
    const totalResult = await pool.query("SELECT COUNT(*) FROM visitors");

    // الزوار اليوم
    const todayResult = await pool.query(
      "SELECT COUNT(*) FROM visitors WHERE DATE(last_visit) = CURRENT_DATE",
    );

    // الزوار هذا الشهر
    const monthResult = await pool.query(
      "SELECT COUNT(*) FROM visitors WHERE DATE_TRUNC('month', last_visit) = DATE_TRUNC('month', CURRENT_DATE)",
    );

    // متوسط الزيارات لكل زائر
    const avgResult = await pool.query("SELECT AVG(visit_count) FROM visitors");

    // أكثر المتصفحات استخداماً
    const browsersResult = await pool.query(
      `SELECT browser, COUNT(*) as count 
       FROM visitors 
       WHERE browser IS NOT NULL 
       GROUP BY browser 
       ORDER BY count DESC 
       LIMIT 5`,
    );

    res.json({
      success: true,
      stats: {
        total: parseInt(totalResult.rows[0].count),
        today: parseInt(todayResult.rows[0].count),
        thisMonth: parseInt(monthResult.rows[0].count),
        avgVisits: parseFloat(avgResult.rows[0].avg) || 0,
        topBrowsers: browsersResult.rows,
      },
    });
  } catch (error) {
    console.error("خطأ في جلب إحصاءات الزوار:", error);
    res.status(500).json({ error: "حدث خطأ في جلب الإحصاءات" });
  }
};
