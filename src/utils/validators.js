// التحقق من البريد الإلكتروني
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// التحقق من كلمة المرور (قوية)
function isStrongPassword(password) {
  // على الأقل 8 حروف، حرف كبير، حرف صغير، رقم، رمز خاص
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}

// التحقق من اسم المستخدم
function isValidName(name) {
  return name && name.trim().length >= 2 && name.trim().length <= 100;
}

// التحقق من النص (منع الـ HTML)
function sanitizeText(text) {
  if (!text) return "";
  return text
    .replace(/<[^>]*>/g, "") // إزالة HTML tags
    .replace(/&[^;]+;/g, "") // إزالة HTML entities
    .trim();
}

// التحقق من الرابط
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// التحقق من الطول
function isValidLength(text, min = 1, max = 10000) {
  return text && text.length >= min && text.length <= max;
}

// التحقق من الأرقام
function isNumeric(value) {
  return /^\d+$/.test(value);
}

// تنظيف المدخلات
function sanitizeInput(input) {
  if (typeof input === "string") {
    return input.trim().replace(/[<>]/g, "");
  }
  return input;
}

module.exports = {
  isValidEmail,
  isStrongPassword,
  isValidName,
  sanitizeText,
  isValidUrl,
  isValidLength,
  isNumeric,
  sanitizeInput,
};
