const helmet = require("helmet");
const xss = require("xss");

// حماية الرؤوس
function securityHeaders(req, res, next) {
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    xFrameOptions: { action: "deny" },
    xssFilter: true,
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })(req, res, next);
}

// تنظيف المدخلات من XSS
function sanitizeInput(req, res, next) {
  if (req.body) {
    for (let key in req.body) {
      if (typeof req.body[key] === "string") {
        req.body[key] = xss(req.body[key], {
          whiteList: {}, // منع كل الـ HTML
          stripIgnoreTag: true,
          stripIgnoreTagBody: ["script", "style"],
        });
      }
    }
  }
  next();
}

// منع هجمات الـ Parameter Pollution
function preventParameterPollution(req, res, next) {
  for (let key in req.query) {
    if (Array.isArray(req.query[key]) && req.query[key].length > 1) {
      return res.status(400).json({ error: "طلب غير صالح" });
    }
  }
  next();
}

// تسجيل النشاطات
async function logActivity(req, res, next) {
  const startTime = Date.now();

  // حفظ وقت البدء
  req._startTime = startTime;

  // تسجيل بعد انتهاء الطلب
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    console.log(
      `📝 ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`,
    );
  });

  next();
}

module.exports = {
  securityHeaders,
  sanitizeInput,
  preventParameterPollution,
  logActivity,
};
