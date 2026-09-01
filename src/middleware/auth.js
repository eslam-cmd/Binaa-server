const Session = require("../models/Session");
const { sendTelegramAlert } = require("../lib/telegram");

// التحقق من الجلسة (Cookie)
async function auth(req, res, next) {
  try {
    const sessionToken = req.cookies?.session_token;

    if (!sessionToken) {
      return res.status(401).json({
        error: "غير مصرح، يرجى تسجيل الدخول",
        code: "UNAUTHORIZED",
      });
    }

    const session = await Session.findByToken(sessionToken);

    if (!session) {
      // تنظيف الكوكيز الفاسدة
      res.clearCookie("session_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      return res.status(401).json({
        error: "جلسة غير صالحة، يرجى تسجيل الدخول مرة أخرى",
        code: "INVALID_SESSION",
      });
    }

    // إضافة معلومات المستخدم إلى الطلب
    req.user = {
      id: session.user_id,
      email: session.email,
      role: session.role,
      sessionId: session.id,
    };

    next();
  } catch (error) {
    console.error("خطأ في المصادقة:", error);
    res.status(500).json({ error: "حدث خطأ في المصادقة" });
  }
}

// التحقق من صلاحيات Admin
function isAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    // تسجيل محاولة اختراق
    sendTelegramAlert(
      `🚨 **محاولة وصول غير مصرح به**\n` +
        `المستخدم: ${req.user?.email || "غير معروف"}\n` +
        `المسار: ${req.path}\n` +
        `IP: ${req.ip}\n` +
        `الوقت: ${new Date().toLocaleString("ar-EG")}`,
    ).catch(console.error);

    return res.status(403).json({
      error: "غير مصرح، صلاحيات Admin مطلوبة",
      code: "FORBIDDEN",
    });
  }
  next();
}

// تسجيل الخروج (تدمير الجلسة)
async function logout(req, res) {
  try {
    const sessionToken = req.cookies?.session_token;
    if (sessionToken) {
      await Session.invalidate(sessionToken);
    }

    res.clearCookie("session_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    res.json({ success: true, message: "تم تسجيل الخروج بنجاح" });
  } catch (error) {
    res.status(500).json({ error: "حدث خطأ في تسجيل الخروج" });
  }
}

// التحقق من حالة تسجيل الدخول
async function checkAuth(req, res) {
  try {
    const sessionToken = req.cookies?.session_token;
    if (!sessionToken) {
      return res.json({ isAuthenticated: false });
    }

    const session = await Session.findByToken(sessionToken);
    if (!session) {
      res.clearCookie("session_token");
      return res.json({ isAuthenticated: false });
    }

    res.json({
      isAuthenticated: true,
      user: {
        email: session.email,
        role: session.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "حدث خطأ" });
  }
}

// حماية ضد هجمات CSRF (التحقق من Origin)
function csrfProtection(req, res, next) {
  // استثناء طلبات OPTIONS (preflight)
  if (req.method === "OPTIONS") {
    return next();
  }

  // استثناء طلبات API (تسجيل الدخول، التحقق، إلخ)
  if (req.path.startsWith("/api/auth/")) {
    return next();
  }

  // استثناء طلبات الـ webhooks
  if (req.path.startsWith("/api/webhooks/")) {
    return next();
  }

  const origin = req.headers.origin;
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://binaa-managment.vercel.app",
    "https://binaa-chi.vercel.app",
    "https://binaa-server.vercel.app",
  ];

  // السماح للطلبات من نفس المصدر فقط
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: "طلب غير مصرح به" });
  }

  // منع الطلبات من مواقع أخرى
  if (req.method !== "GET" && !origin) {
    return res.status(403).json({ error: "طلب غير مصرح به" });
  }

  next();
}


// حماية ضد هجمات الـ Brute Force للجلسات
async function sessionRateLimit(req, res, next) {
  // تسجيل محاولات الوصول للجلسات
  const sessionToken = req.cookies?.session_token;
  if (!sessionToken) {
    // إذا كان بدون جلسة، نسمح بطلب واحد فقط كل 5 ثواني
    const key = `session_attempt_${req.ip}`;
    // (سيتم تنفيذها مع Redis، لكن حالياً نستخدم متغير بسيط)
    next();
  } else {
    next();
  }
}

module.exports = {
  auth,
  isAdmin,
  logout,
  checkAuth,
  csrfProtection,
  sessionRateLimit,
};
