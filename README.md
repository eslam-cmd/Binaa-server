# Backend Documentation

## نظرة عامة

هذا المشروع هو الـ Backend الخاص بمنصة العمل الحر/الاستشارات، ويعمل على Node.js + Express.js مع PostgreSQL. الهدف الرئيسي هو تقديم API موثوق لدعم:

- تسجيل دخول المدير عبر OTP
- إدارة المقالات
- إدارة الخدمات
- إدارة الطلبات
- قراءة إحصائيات لوحة التحكم
- تسجيل النشاطات والأنشطة الإدارية
- حماية الطلبات عبر CORS و Helmet و rate limit

## التقنية المستخدمة

- Node.js
- Express.js
- PostgreSQL
- pg (PostgreSQL client)
- cookie-parser
- cors
- helmet
- express-rate-limit
- bcryptjs
- jsonwebtoken
- nodemailer

## هيكل المشروع

```bash
server/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   │   └── database.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── postController.js
│   │   ├── requestController.js
│   │   └── serviceController.js
│   ├── lib/
│   │   ├── crypto.js
│   │   ├── email.js
│   │   └── telegram.js
│   ├── middlewares/
│   │   ├── auth.js
│   │   ├── rateLimit.js
│   │   └── security.js
│   ├── models/
│   │   ├── OTP.js
│   │   ├── Post.js
│   │   ├── Request.js
│   │   ├── Service.js
│   │   ├── Session.js
│   │   └── User.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── postRoutes.js
│   │   ├── requestRoutes.js
│   │   └── serviceRoutes.js
│   ├── utils/
│   │   ├── helpers.js
│   │   └── validators.js
│   └── README.MD
├── package.json
├── README.md
└── .env
```

## نقطة التشغيل

الـ entry point هو:

```bash
server/src/server.js
```

والـ app الرئيسي هو:

```bash
server/src/app.js
```

## التشغيل المحلي

1. تثبيت الحزم

```bash
cd server
npm install
```

2. إعداد المتغيرات البيئية
   أنشئ ملف `.env` داخل مجلد `server/` يحتوي على:

```env
PORT=5001
DATABASE_URL=postgresql://...your_db_url...
JWT_SECRET=your_secret_key
COOKIE_SECRET=your_cookie_secret
EMAIL_USER=your_email
EMAIL_PASS=your_email_password
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
NODE_ENV=development
```

3. تشغيل السيرفر

```bash
npm run dev
```

أو:

```bash
npm start
```

## التحقق من حالة السيرفر

يمكنك التحقق من أن السيرفر يعمل:

```bash
curl http://localhost:5001/health
```

القيمة المتوقعة:

```json
{
  "status": "healthy",
  "database": "connected"
}
```

## نظام المصادقة

النظام الحالي يعتمد على الجلسة عبر الكوكيز (cookies) وليس JWT في الـ frontend مباشرة.

### 1) تسجيل الدخول - الخطوة الأولى

مسار:

```http
POST /api/auth/login
```

الطلب:

```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

الاستجابة:

```json
{
  "success": true,
  "message": "OTP sent",
  "userId": 1
}
```

### 2) التحقق من OTP

مسار:

```http
POST /api/auth/verify
```

الطلب:

```json
{
  "userId": 1,
  "otp": "123456"
}
```

### 3) التحقق من الجلسة

مسار:

```http
GET /api/auth/session
```

إرجاع:

```json
{
  "isAuthenticated": true,
  "user": {
    "id": 1,
    "email": "admin@example.com"
  }
}
```

### 4) تسجيل الخروج

مسار:

```http
POST /api/auth/logout
```

## مسارات الـ API

### 1) المصادقة

| الطريقة | المسار            | الوصف                              |
| ------- | ----------------- | ---------------------------------- |
| POST    | /api/auth/login   | إرسال بيانات تسجيل الدخول وطلب OTP |
| POST    | /api/auth/verify  | التحقق من رمز OTP                  |
| GET     | /api/auth/session | التحقق من الجلسة الحالية           |
| POST    | /api/auth/logout  | تسجيل الخروج                       |

### 2) المقالات

| الطريقة | المسار         | الوصف                       |
| ------- | -------------- | --------------------------- |
| GET     | /api/posts     | جلب كل المقالات             |
| GET     | /api/posts/:id | جلب مقال واحد               |
| POST    | /api/posts     | إنشاء مقال جديد (Admin فقط) |
| PUT     | /api/posts/:id | تحديث مقال (Admin فقط)      |
| DELETE  | /api/posts/:id | حذف مقال (Admin فقط)        |

### 3) الطلبات

| الطريقة | المسار                   | الوصف                      |
| ------- | ------------------------ | -------------------------- |
| GET     | /api/requests            | جلب كل الطلبات (Admin فقط) |
| GET     | /api/requests/:id        | جلب طلب واحد               |
| POST    | /api/requests            | إنشاء طلب جديد من العميل   |
| PUT     | /api/requests/:id/status | تحديث حالة الطلب           |

### 4) الخدمات

| الطريقة | المسار            | الوصف                        |
| ------- | ----------------- | ---------------------------- |
| GET     | /api/services     | جلب كل الخدمات               |
| GET     | /api/services/:id | جلب خدمة واحدة               |
| POST    | /api/services     | إنشاء خدمة جديدة (Admin فقط) |
| PUT     | /api/services/:id | تحديث خدمة (Admin فقط)       |
| DELETE  | /api/services/:id | حذف خدمة (Admin فقط)         |

### 5) لوحة التحكم

| الطريقة | المسار                | الوصف                |
| ------- | --------------------- | -------------------- |
| GET     | /api/admin/stats      | إحصائيات لوحة التحكم |
| GET     | /api/admin/activities | سجل النشاطات         |
| GET     | /api/visitors         | قائمة الزوار         |

## مديرية الطلبات والأمان

### CORS

تم ضبط الـ CORS للسماح بمصادر محددة فقط، مع دعم الكوكيز:

```js
credentials: true;
```

### Rate limiting

توجد حماية للـ API عبر `rateLimit` على:

- تسجيل الدخول
- إنشاء طلبات
- الوصول إلى المقالات/الطلبات العامة

### Helmet and security

يتم تطبيق:

- رؤوس الأمان
- تنظيف الإدخالات
- منع parameter pollution
- تسجيل النشاطات

## قاعدة البيانات

يمت استخدام PostgreSQL، وهي مرتبطة عبر متغير:

```env
DATABASE_URL
```

ومن الملف:

```bash
server/src/config/database.js
```

يتم إنشاء الـ pool واستخدامه داخل كل controller.

## سجل النشاطات

كل إجراء إداري (مثل إنشاء خدمة أو تحديثها أو حذفها أو إنشاء طلب) يتم تسجيله في جدول `activity_logs` داخل قاعدة البيانات.

هذا مهم لأن لوحة التحكم تستفيد من هذه البيانات في:

- الإشعارات
- سجل النشاطات
- لوحة التحكم الإحصائية

## الأخطاء الشائعة

### 1) خطأ قاعدة البيانات

إذا ظهر:

```text
database disconnected
```

فاحقق:

- وجود `DATABASE_URL`
- صحة اسم المستخدم/كلمة المرور
- صحة عنوان قاعدة البيانات

### 2) خطأ 401 أو 403

ممكن يكون السبب أن الـ route محمي بـ `auth` أو `isAdmin` وعندها تحتاج جلسة صالحة.

### 3) CORS error

تحقق من:

- `ALLOWED_ORIGINS`
- وجود `credentials: true`
- أن frontend يعمل على localhost الصحيح

## أفضل الممارسات

- لا تستخدم القيم الثابتة للـ admin داخل frontend
- لا تضع كلمات المرور أو OTP داخل الـ URL
- استخدم cookies أو sessions للاستخدام الإداري
- حافظ على تسجيل النشاطات لكل عملية مهمة

## ملاحظات تشغيلية

- السيرفر يعمل غالبًا على `http://localhost:5001`
- تم تجهيز العديد من الـ endpoints للوصول من frontend عبر `/api/...`
- يجب أن يكون الـ frontend يرسل الطلبات مع `credentials: "include"` لتعمل الجلسات

## مثال استخدام fetch من frontend

```js
const res = await fetch("http://localhost:5001/api/services", {
  method: "GET",
  credentials: "include",
});

const data = await res.json();
console.log(data);
```

## الخلاصة

هذا الـ backend مسؤول عن:

- إدارة المنصة
- حماية البيانات
- توفير APIs للـ frontend
- تسجيل كل النشاطات المهمة
- دعم لوحة التحكم الإدارية

إذا كنت تريد، يمكنني في الخطوة التالية إضافة ملف إضافي داخل السيرفر باسم `API_REFERENCE.md` يحتوي جدول كامل لكل endpoint مع sample requests و responses.
