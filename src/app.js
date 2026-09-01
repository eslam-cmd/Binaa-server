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
// استيراد Middlewares
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
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  "https://binaa-managment.vercel.app,https://binaa-chi.vercel.app,http://localhost:3000,http://localhost:3001,https://binaa-server.vercel.app"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // السماح للطلبات بدون origin (مثل cURL أو أدوات السيرفر)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`⚠️ محاولة وصول من مصدر غير مسموح: ${origin}`);
    return callback(null, false);
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
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

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
    console.error("❌ خطأ في قاعدة البيانات:", error);
    res.status(503).json({
      status: "unhealthy",
      error: "قاعدة البيانات غير متصلة",
    });
  }
});

// =============================================
// مسار اختبار قاعدة البيانات
// =============================================
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      success: true,
      time: result.rows[0].now,
      message: "✅ قاعدة البيانات متصلة",
    });
  } catch (error) {
    console.error("❌ خطأ في اختبار قاعدة البيانات:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "❌ قاعدة البيانات غير متصلة",
    });
  }
});

// =============================================
// مسار اختبار الإيميل
// =============================================
app.get("/test-email", async (req, res) => {
  try {
    const { sendEmail, getOTPEmailTemplate } = require("./lib/email");
    const result = await sendEmail({
      to: "hdayaaslam34@gmail.com",
      subject: "🧪 اختبار الإيميل",
      html: "<h1>اختبار</h1><p>إذا وصلت هذه الرسالة، الإيميل شغال ✅</p>",
    });
    res.json(result);
  } catch (error) {
    console.error("❌ خطأ في اختبار الإيميل:", error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// مسارات API (توضع قبل CSRF)
// =============================================
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/visitors", visitorRoutes);

// =============================================
// حماية CSRF (للمسارات التي تحتاجها فقط)
// =============================================
app.use((req, res, next) => {
  // تخطي CSRF لطلبات API
  if (req.path.startsWith("/api/")) {
    return next();
  }
  // تطبيق CSRF للصفحات الأخرى
  csrfProtection(req, res, next);
});

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
// مسار أساسي للتحقق من أن السيرفر يعمل
// =============================================
app.get("/", (req, res) => {
  res.json({
    name: "Binaa API",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/health",
      testDb: "/test-db",
      testEmail: "/test-email",
      auth: "/api/auth",
      posts: "/api/posts",
      requests: "/api/requests",
      services: "/api/services",
      visitors: "/api/visitors",
      admin: "/api/admin",
    },
  });
});

// =============================================
// مسار API الأساسي
// =============================================
app.get("/api", (req, res) => {
  res.json({
    message: "Binaa API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      posts: "/api/posts",
      requests: "/api/requests",
      services: "/api/services",
      visitors: "/api/visitors",
      admin: "/api/admin",
    },
  });
});

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
