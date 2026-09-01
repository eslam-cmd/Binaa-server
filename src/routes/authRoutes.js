const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { loginRateLimit, otpRateLimit } = require("../middlewares/rateLimit");
const { auth } = require("../middlewares/auth");

// تسجيل الدخول - الخطوة 1 (إرسال OTP)
router.post("/login", loginRateLimit(), authController.loginStep1);

// تسجيل الدخول - الخطوة 2 (التحقق من OTP)
router.post("/verify", otpRateLimit(), authController.loginStep2);

// التحقق من حالة الجلسة
router.get("/session", authController.checkSession);

// تسجيل الخروج
router.post("/logout", auth, authController.logout);

module.exports = router;
