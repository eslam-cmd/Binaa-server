const app = require("./app");
const pool = require("./config/database");
const User = require("./models/User");

const PORT = process.env.PORT || 5001;

// =============================================
// التحقق من المتغيرات الأساسية
// =============================================
function validateEnv() {
  const required = [
    "DATABASE_URL",
    "JWT_SECRET",
    "SMTP_USER",
    "SMTP_PASS",
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`❌ المتغيرات التالية غير موجودة في .env:`);
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error("⚠️ يرجى إضافة هذه المتغيرات قبل التشغيل");
    process.exit(1);
  }

  console.log("✅ جميع المتغيرات الأساسية موجودة");
}

// =============================================
// إنشاء Admin تلقائياً
// =============================================
async function initializeAdmin() {
  try {
    await User.createAdminIfNotExists();
  } catch (error) {
    console.error("❌ خطأ في إنشاء Admin:", error);
  }
}

// =============================================
// تشغيل الخادم
// =============================================
async function startServer() {
  try {
    // التحقق من المتغيرات
    validateEnv();

    // اختبار الاتصال بقاعدة البيانات بدون إيقاف الخادم إذا كانت غير متاحة
    try {
      await pool.query("SELECT 1");
      console.log("✅ قاعدة البيانات متصلة");

      // إنشاء Admin
      await initializeAdmin();

      // تنظيف الجلسات والـ OTP المنتهية (كل ساعة)
      setInterval(
        async () => {
          try {
            await pool.query("DELETE FROM sessions WHERE expires_at < NOW()");
            await pool.query(
              "UPDATE otp_codes SET is_used = true WHERE expires_at < NOW()",
            );
            console.log("🧹 تم تنظيف البيانات المنتهية");
          } catch (error) {
            console.error("❌ خطأ في التنظيف:", error);
          }
        },
        60 * 60 * 1000,
      );
    } catch (dbError) {
      console.warn(
        "⚠️ قاعدة البيانات غير متاحة الآن، سيتم تشغيل الخادم في وضع الاستعداد:",
        dbError.message || dbError,
      );
    }

    // تشغيل الخادم
    app.listen(PORT, () => {
      console.log(`\n🚀 الخادم يعمل على http://localhost:${PORT}`);
      console.log(`📚 البيئة: ${process.env.NODE_ENV || "development"}`);
      console.log(`👤 Admin: ${process.env.ADMIN_EMAIL}`);
      console.log(`📧 SMTP: ${process.env.SMTP_USER}`);
      console.log(
        `🤖 Telegram: ${process.env.TELEGRAM_BOT_TOKEN ? "✅ مفعل" : "❌ غير مفعل"}`,
      );
      console.log(`\n📋 المسارات المتاحة:`);
      console.log(`   POST /api/auth/login - تسجيل الدخول (الخطوة 1)`);
      console.log(`   POST /api/auth/verify - التحقق من OTP (الخطوة 2)`);
      console.log(`   GET  /api/auth/session - التحقق من الجلسة`);
      console.log(`   POST /api/auth/logout - تسجيل الخروج`);
      console.log(`   GET  /api/posts - جلب المقالات`);
      console.log(`   POST /api/posts - إنشاء مقالة (Admin)`);
      console.log(`   GET  /api/requests - جلب الطلبات (Admin)`);
      console.log(`   POST /api/requests - إنشاء طلب جديد`);
      console.log(`   GET  /api/services - جلب الخدمات`);
      console.log(`   GET  /health - التحقق من الصحة\n`);
    });
  } catch (error) {
    console.error("❌ فشل تشغيل الخادم:", error);
    process.exit(1);
  }
}

startServer();

// =============================================
// إيقاف الخادم بشكل آمن
// =============================================
process.on("SIGTERM", () => {
  console.log("🛑 جاري إيقاف الخادم...");
  pool.end(() => {
    console.log("✅ تم إغلاق اتصالات قاعدة البيانات");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\n🛑 جاري إيقاف الخادم...");
  pool.end(() => {
    console.log("✅ تم إغلاق اتصالات قاعدة البيانات");
    process.exit(0);
  });
});
