const User = require("../models/User");
const Session = require("../models/Session");
const OTP = require("../models/OTP");
const { generateOTP, generateSessionToken } = require("../lib/crypto");
const {
  sendEmail,
  getOTPEmailTemplate,
  getLoginAlertEmailTemplate,
} = require("../lib/email");
const { sendTelegramAlert } = require("../lib/telegram");

// الخطوة 1: تسجيل الدخول - التحقق من البريد وكلمة المرور + إرسال OTP
exports.loginStep1 = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "البريد الإلكتروني وكلمة المرور مطلوبة" });
    }

    // التحقق من الحظر
    const isLocked = await User.isLocked(email);
    if (isLocked) {
      return res.status(403).json({
        error: "تم حظر حسابك مؤقتاً بسبب كثرة المحاولات، حاول بعد 30 دقيقة",
        code: "ACCOUNT_LOCKED",
      });
    }

    // جلب المستخدم
    const user = await User.findByEmail(email);
    if (!user) {
      const attempts = await User.getFailedAttempts(email);
      await User.updateFailedAttempts(email, attempts + 1);
      return res
        .status(401)
        .json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    }

    // التحقق من كلمة المرور
    const isValid = await User.comparePassword(password, user.password);
    if (!isValid) {
      const attempts = await User.getFailedAttempts(email);
      await User.updateFailedAttempts(email, attempts + 1);
      return res
        .status(401)
        .json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    }

    // التحقق من أن المستخدم Admin
    if (user.role !== "admin") {
      return res.status(403).json({ error: "غير مصرح، هذا الحساب ليس Admin" });
    }

    // إعادة تعيين محاولات الفشل
    await User.resetFailedAttempts(email);

    // إنشاء رمز OTP
    const otpCode = generateOTP();
    await OTP.create(user.id, otpCode, "login");

    // إرسال OTP عبر الإيميل
    const emailSent = await sendEmail({
      to: email,
      subject: "🔐 رمز التحقق لتسجيل الدخول - إسلام هداية",
      html: getOTPEmailTemplate(otpCode, process.env.OTP_EXPIRY_MINUTES || 10),
    });

    if (!emailSent.success) {
      return res
        .status(500)
        .json({ error: "حدث خطأ في إرسال رمز التحقق، حاول مرة أخرى" });
    }

    // تسجيل محاولة تسجيل الدخول
    await sendTelegramAlert(
      `🔐 **محاولة تسجيل دخول**\n` +
        `البريد: ${email}\n` +
        `IP: ${req.ip}\n` +
        `الجهاز: ${req.headers["user-agent"]?.substring(0, 100) || "غير معروف"}\n` +
        `الوقت: ${new Date().toLocaleString("ar-EG")}`,
    ).catch(console.error);

    // إرسال إيميل تنبيه للمستخدم
    await sendEmail({
      to: email,
      subject: "🔔 تنبيه: تسجيل دخول جديد",
      html: getLoginAlertEmailTemplate(
        req.ip,
        req.headers["user-agent"],
        new Date().toLocaleString("ar-EG"),
      ),
    }).catch(console.error);

    res.json({
      success: true,
      message: "تم إرسال رمز التحقق إلى بريدك الإلكتروني",
      requireOTP: true,
      userId: user.id,
    });
  } catch (error) {
    console.error("خطأ في تسجيل الدخول:", error);
    res.status(500).json({ error: "حدث خطأ في تسجيل الدخول" });
  }
};

// الخطوة 2: التحقق من OTP وإنشاء الجلسة
exports.loginStep2 = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res
        .status(400)
        .json({ error: "معرف المستخدم ورمز التحقق مطلوبان" });
    }

    // التحقق من OTP
    const otpRecord = await OTP.verify(userId, otp, "login");
    if (!otpRecord) {
      return res.status(401).json({
        error: "رمز التحقق غير صحيح أو منتهي الصلاحية",
        code: "INVALID_OTP",
      });
    }

    // جلب المستخدم
    const user = await User.findById(userId);
    if (!user || !user.is_active) {
      return res.status(401).json({ error: "المستخدم غير موجود أو غير نشط" });
    }

    // إنشاء جلسة جديدة
    const sessionToken = generateSessionToken();
    const session = await Session.create(
      user.id,
      sessionToken,
      req.ip,
      req.headers["user-agent"],
    );

    // تحديث آخر تسجيل دخول
    await User.updateLastLogin(user.id);

    // تسجيل النشاط
    const pool = require("../config/database");
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.id,
        "login",
        req.ip,
        req.headers["user-agent"],
        JSON.stringify({ success: true }),
      ],
    );

    // إرسال إشعار نجاح
    await sendTelegramAlert(
      `✅ **تسجيل دخول ناجح**\n` +
        `البريد: ${user.email}\n` +
        `IP: ${req.ip}\n` +
        `الوقت: ${new Date().toLocaleString("ar-EG")}`,
    ).catch(console.error);

    // تعيين الكوكيز
    const isSecureCookie =
      process.env.NODE_ENV === "production" ||
      req.secure ||
      req.headers["x-forwarded-proto"] === "https";

    res.cookie("session_token", sessionToken, {
      httpOnly: true,
      secure: isSecureCookie,
      sameSite: isSecureCookie ? "none" : "lax",
      path: "/",
      maxAge:
        parseInt(process.env.SESSION_EXPIRY_DAYS || 7) * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: "تم تسجيل الدخول بنجاح",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("خطأ في التحقق من OTP:", error);
    res.status(500).json({ error: "حدث خطأ في التحقق من الرمز" });
  }
};

// التحقق من حالة الجلسة
exports.checkSession = async (req, res) => {
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
        id: session.user_id || session.id,
        email: session.email,
        role: session.role,
      },
    });
  } catch (error) {
    console.error("خطأ في التحقق من الجلسة:", error);
    res.status(500).json({ error: "حدث خطأ" });
  }
};

// تسجيل الخروج
exports.logout = async (req, res) => {
  try {
    const sessionToken = req.cookies?.session_token;
    if (sessionToken) {
      await Session.invalidate(sessionToken);

      const pool = require("../config/database");
      await pool.query(
        `INSERT INTO activity_logs (user_id, action, ip_address, user_agent)
         VALUES ($1, $2, $3, $4)`,
        [req.user?.id, "logout", req.ip, req.headers["user-agent"]],
      );
    }

    const isSecureCookie =
      process.env.NODE_ENV === "production" ||
      req.secure ||
      req.headers["x-forwarded-proto"] === "https";

    res.clearCookie("session_token", {
      httpOnly: true,
      secure: isSecureCookie,
      sameSite: isSecureCookie ? "none" : "lax",
      path: "/",
    });

    res.json({ success: true, message: "تم تسجيل الخروج بنجاح" });
  } catch (error) {
    console.error("خطأ في تسجيل الخروج:", error);
    res.status(500).json({ error: "حدث خطأ في تسجيل الخروج" });
  }
};
