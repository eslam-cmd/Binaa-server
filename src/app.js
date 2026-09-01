const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

// =============================================
// استيراد المسارات (Routes)
// =============================================
const authRoutes = require("./routes/authRoutes");
const postRoutes = require("./routes/postRoutes");
const requestRoutes = require("./routes/requestRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const visitorRoutes = require("./routes/visitorRoutes");

// =============================================
// استيراد Middlewares (انتبه: middleware وليس middlewares)
// =============================================
const {
  securityHeaders,
  sanitizeInput,
  preventParameterPollution,
  logActivity,
} = require("./middleware/security");

const { csrfProtection } = require("./middleware/auth");
const { rateLimit } = require("./middleware/rateLimit");

// =============================================
// استيراد قاعدة البيانات و Auth
// =============================================
const pool = require("./config/database");
const { auth, isAdmin } = require("./middleware/auth");

// =============================================
// تهيئة Express
// =============================================
const app = express();

// =============================================
// إعدادات CORS
// =============================================
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://binaa-managment.vercel.app",
  "https://binaa-chi.vercel.app",
  "https://binaa-server.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️ محاولة وصول من مصدر غير مسموح: ${origin}`);
        callback(new Error("غير مسموح من هذا المصدر"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
    exposedHeaders: ["Set-Cookie"],
    maxAge: 86400,
  }),
);

// =============================================
// Middlewares الأمان
// =============================================
app.use(securityHeaders);
app.use(cookieParser(process.env.COOKIE_SECRET || "default-secret"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(sanitizeInput);
app.use(preventParameterPollution);
app.use(logActivity);

// =============================================
// معدل الطلبات العام
// =============================================
app.use(rateLimit({ max: 500, windowMs: 60 * 60 * 1000 }));

// =============================================
// حماية CSRF
// =============================================
app.use(csrfProtection);

// =============================================
// مسار صحي للتحقق (Health Check)
// =============================================
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: "connected",
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: "قاعدة البيانات غير متصلة",
    });
  }
});

// =============================================
// مسارات API
// =============================================
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/visitors", visitorRoutes);

// =============================================
// مسار إضافي للإحصائيات (Admin فقط)
// =============================================
app.get("/api/admin/stats", auth, isAdmin, async (req, res) => {
  try {
    const [postsCount, requestsCount, pendingRequests, servicesCount] =
      await Promise.all([
        pool.query("SELECT COUNT(*) FROM posts"),
        pool.query("SELECT COUNT(*) FROM requests"),
        pool.query("SELECT COUNT(*) FROM requests WHERE status = 'pending'"),
        pool.query("SELECT COUNT(*) FROM services WHERE is_active = true"),
      ]);

    res.json({
      success: true,
      stats: {
        posts: parseInt(postsCount.rows[0].count),
        requests: parseInt(requestsCount.rows[0].count),
        pendingRequests: parseInt(pendingRequests.rows[0].count),
        services: parseInt(servicesCount.rows[0].count),
      },
    });
  } catch (error) {
    console.error("خطأ في جلب الإحصائيات:", error);
    res.status(500).json({ error: "حدث خطأ في جلب الإحصائيات" });
  }
});

// =============================================
// مسار النشاطات (Admin فقط)
// =============================================
app.get("/api/admin/activities", auth, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT al.*, u.email 
       FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC 
       LIMIT 20`,
    );

    res.json({ success: true, activities: result.rows || [] });
  } catch (error) {
    console.error("خطأ في جلب النشاطات:", error);
    res.json({ success: true, activities: [] });
  }
});

// =============================================
// مسار جلب الزوار (Admin فقط) - تجنب التكرار
// =============================================
// ملاحظة: هذا المسار موجود بالفعل في visitorRoutes
// لذلك نعلق عليه أو ندمجه مع visitorRoutes
// app.get("/api/visitors", auth, isAdmin, async (req, res) => { ... });

// =============================================
// معالج الأخطاء العالمي (Global Error Handler)
// =============================================
app.use((err, req, res, next) => {
  console.error("❌ خطأ:", err);

  if (err.name === "UnauthorizedError") {
    return res.status(401).json({ error: "غير مصرح" });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({
    error:
      process.env.NODE_ENV === "production" ? "حدث خطأ في الخادم" : err.message,
  });
});

// =============================================
// معالج 404 (المسارات غير الموجودة)
// =============================================
app.use((req, res) => {
  res.status(404).json({ error: "المسار غير موجود" });
});

module.exports = app;
