const pool = require("../config/database");

// تسجيل زائر جديد
exports.trackVisitor = async (req, res) => {
  try {
    const {
      visitorId,
      page,
      email,
      ip,
      browser,
      os,
      device,
      userAgent,
      source, // جديد
      referrer, // جديد
      utm, // جديد: { utm_source, utm_medium, utm_campaign }
    } = req.body;

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
             page = $2,
             source = COALESCE($3, source, 'direct'),
             referrer = COALESCE($4, referrer),
             utm_source = COALESCE($5, utm_source),
             utm_medium = COALESCE($6, utm_medium),
             utm_campaign = COALESCE($7, utm_campaign),
             email = COALESCE($8, email),
             ip_address = COALESCE($9, ip_address),
             browser = COALESCE($10, browser),
             os = COALESCE($11, os),
             device = COALESCE($12, device)
         WHERE visitor_id = $13`,
        [
          pagesVisited,
          page,
          source,
          referrer,
          utm?.utm_source || null,
          utm?.utm_medium || null,
          utm?.utm_campaign || null,
          email,
          ip,
          browser,
          os,
          device,
          visitorId,
        ],
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
          email, source, referrer, page, 
          utm_source, utm_medium, utm_campaign, pages_visited
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          visitorId,
          ip,
          userAgent,
          browser,
          os,
          device,
          email || null,
          source || "direct",
          referrer || null,
          page || "/",
          utm?.utm_source || null,
          utm?.utm_medium || null,
          utm?.utm_campaign || null,
          [page || "/"],
        ],
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
              source, referrer, page, visit_count, 
              utm_source, utm_medium, utm_campaign,
              first_visit, last_visit, pages_visited
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

    // الزوار حسب المصدر
    const sourceResult = await pool.query(
      `SELECT source, COUNT(*) as count 
       FROM visitors 
       WHERE source IS NOT NULL
       GROUP BY source 
       ORDER BY count DESC`,
    );

    // الزوار حسب المتصفح
    const browserResult = await pool.query(
      `SELECT browser, COUNT(*) as count 
       FROM visitors 
       WHERE browser IS NOT NULL
       GROUP BY browser 
       ORDER BY count DESC 
       LIMIT 5`,
    );

    // الزوار حسب الجهاز
    const deviceResult = await pool.query(
      `SELECT device, COUNT(*) as count 
       FROM visitors 
       WHERE device IS NOT NULL
       GROUP BY device 
       ORDER BY count DESC`,
    );

    res.json({
      success: true,
      stats: {
        total: parseInt(totalResult.rows[0].count),
        today: parseInt(todayResult.rows[0].count),
        bySource: sourceResult.rows,
        byBrowser: browserResult.rows,
        byDevice: deviceResult.rows,
      },
    });
  } catch (error) {
    console.error("خطأ في جلب إحصاءات الزوار:", error);
    res.status(500).json({ error: "حدث خطأ في جلب الإحصاءات" });
  }
};
