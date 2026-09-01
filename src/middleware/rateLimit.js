// مخزون بسيط للمعدل (بدون Redis)
const requestCounts = {};
const CLEANUP_INTERVAL = 60000; // تنظيف كل دقيقة

// تنظيف الذاكرة المؤقتة
setInterval(() => {
  const now = Date.now();
  for (const key in requestCounts) {
    if (requestCounts[key].resetTime < now) {
      delete requestCounts[key];
    }
  }
}, CLEANUP_INTERVAL);

function rateLimit(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 دقيقة
    max = 100, // 100 طلب لكل IP
    message = "عدد كبير من الطلبات، يرجى المحاولة لاحقاً",
    statusCode = 429,
  } = options;

  return (req, res, next) => {
    const key = `${req.ip}-${req.path}`;
    const now = Date.now();

    if (!requestCounts[key]) {
      requestCounts[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return next();
    }

    const data = requestCounts[key];

    if (now > data.resetTime) {
      data.count = 1;
      data.resetTime = now + windowMs;
      return next();
    }

    data.count++;

    if (data.count > max) {
      const resetTime = new Date(data.resetTime).toLocaleTimeString("ar-EG");
      return res.status(statusCode).json({
        error: message,
        resetTime,
        retryAfter: Math.ceil((data.resetTime - now) / 1000),
      });
    }

    next();
  };
}

// معدل خاص لتسجيل الدخول (أكثر صرامة)
function loginRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "عدد كبير من محاولات تسجيل الدخول، حاول بعد 15 دقيقة",
  });
}

// معدل خاص للـ OTP (أكثر صرامة)
function otpRateLimit() {
  return rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 3,
    message: "عدد كبير من محاولات التحقق، حاول بعد 10 دقائق",
  });
}

module.exports = {
  rateLimit,
  loginRateLimit,
  otpRateLimit,
};
