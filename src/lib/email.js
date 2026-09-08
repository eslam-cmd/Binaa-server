const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
      pool: true,
      maxConnections: 5,
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, html, text }) {
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `"إسلام هداية" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: html || text,
      text: text || html?.replace(/<[^>]*>/g, "") || "",
    });
    return { success: true, info };
  } catch (error) {
    console.error("❌ خطأ في إرسال الإيميل:", error);
    return { success: false, error: error.message };
  }
}

// قالب إيميل رمز التحقق
function getOTPEmailTemplate(otp, expiresIn = 10) {
  return `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>رمز التحقق</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; background: #f5f5f5; padding: 40px 20px;">
      <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3b82f6; font-size: 28px; margin: 0;">🔐 إسلام هداية</h1>
          <p style="color: #6b7280; font-size: 14px; margin-top: 5px;">رمز التحقق لتسجيل الدخول</p>
        </div>
        
        <div style="background: #f0f7ff; border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 25px;">
          <p style="color: #4b5563; font-size: 14px; margin-bottom: 10px;">رمز التحقق الخاص بك هو:</p>
          <div style="font-size: 48px; font-weight: bold; color: #3b82f6; letter-spacing: 8px; font-family: monospace; direction: ltr;">
            ${otp}
          </div>
        </div>
        
        <p style="color: #6b7280; font-size: 13px; text-align: center; margin-bottom: 5px;">
          ⏳ هذا الرمز صالح لمدة <strong>${expiresIn} دقائق</strong>
        </p>
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          إذا لم تطلب هذا الرمز، يرجى تجاهل هذا البريد.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
          هذا البريد مرسل من نظام إدارة إسلام هداية.
        </p>
      </div>
    </body>
    </html>
  `;
}

// قالب إيميل تأكيد تسجيل الدخول
function getLoginAlertEmailTemplate(ip, userAgent, time) {
  return `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تنبيه تسجيل دخول</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; background: #f5f5f5; padding: 40px 20px;">
      <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <span style="font-size: 48px;">🔔</span>
          <h1 style="color: #1f2937; font-size: 24px; margin: 10px 0 5px;">تسجيل دخول جديد</h1>
        </div>
        
        <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <p style="color: #4b5563; font-size: 14px; margin: 5px 0;">
            <strong>🕐 الوقت:</strong> ${time}
          </p>
          <p style="color: #4b5563; font-size: 14px; margin: 5px 0;">
            <strong>🌐 IP:</strong> ${ip}
          </p>
          <p style="color: #4b5563; font-size: 14px; margin: 5px 0;">
            <strong>💻 الجهاز:</strong> ${userAgent?.substring(0, 100) || "غير معروف"}
          </p>
        </div>
        
        <p style="color: #6b7280; font-size: 13px; text-align: center;">
          إذا لم تكن أنت، يرجى تغيير كلمة المرور فوراً.
        </p>
      </div>
    </body>
    </html>
  `;
}
// ... الكود السابق ...

// قالب إيميل استلام الطلب
function getRequestReceivedEmail(request) {
  return `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>تم استلام طلبك</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; background: #f5f5f5; padding: 40px 20px;">
      <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <span style="font-size: 48px;">✅</span>
          <h1 style="color: #1f2937; font-size: 24px; margin: 10px 0 5px;">تم استلام طلبك</h1>
          <p style="color: #6b7280; font-size: 14px;">شكراً لتواصلك معنا</p>
        </div>
        
        <div style="background: #f0f7ff; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <p style="color: #4b5563; font-size: 14px; margin: 5px 0;">
            <strong>👤 الاسم:</strong> ${request.name}
          </p>
          <p style="color: #4b5563; font-size: 14px; margin: 5px 0;">
            <strong>📂 نوع المشروع:</strong> ${request.project_type}
          </p>
          <p style="color: #4b5563; font-size: 14px; margin: 5px 0;">
            <strong>🆔 رقم الطلب:</strong> #${request.id}
          </p>
        </div>
        
        <div style="background: #fef3c7; border-radius: 12px; padding: 15px; margin-bottom: 20px; border-right: 4px solid #f59e0b;">
          <p style="color: #92400e; font-size: 13px; margin: 0;">
            ⏳ سنتواصل معك خلال <strong>24 ساعة</strong> لمناقشة مشروعك بالتفصيل
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
          هذا إيميل آلي، يرجى عدم الرد عليه.
        </p>
      </div>
    </body>
    </html>
  `;
}

// قالب إيميل تحديث حالة الطلب
function getRequestStatusEmail(request) {
  const statusMessages = {
    pending: "⏳ طلبك قيد المراجعة",
    accepted: "✅ تم قبول طلبك! سنتواصل معك قريباً",
    rejected: "❌ نأسف، لم نتمكن من قبول طلبك حالياً",
    completed: "🎉 تم إنجاز طلبك بنجاح!",
  };

  const statusColors = {
    pending: "#f59e0b",
    accepted: "#10b981",
    rejected: "#ef4444",
    completed: "#3b82f6",
  };

  const projectEndDate = request.project_end_date
    ? new Date(request.project_end_date).toLocaleDateString("ar-EG")
    : null;

  return `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>تحديث حالة الطلب</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; background: #f5f5f5; padding: 40px 20px;">
      <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <span style="font-size: 48px;">📋</span>
          <h1 style="color: #1f2937; font-size: 24px; margin: 10px 0 5px;">تحديث حالة الطلب</h1>
          <p style="color: #6b7280; font-size: 14px;">رقم الطلب: #${request.id}</p>
        </div>
        
        <div style="background: ${statusColors[request.status]}10; border-radius: 12px; padding: 20px; text-align: center; border: 2px solid ${statusColors[request.status]}30;">
          <p style="font-size: 20px; color: ${statusColors[request.status]}; font-weight: bold; margin: 0;">
            ${statusMessages[request.status] || "تم تحديث حالة طلبك"}
          </p>
        </div>

        ${
          projectEndDate
            ? `
          <div style="background: #ecfeff; border-radius: 12px; padding: 15px; margin: 20px 0; border-right: 4px solid #06b6d4;">
            <p style="color: #0f172a; font-size: 14px; margin: 0;">
              <strong>📅 تاريخ نهاية المشروع:</strong> ${projectEndDate}
            </p>
          </div>
        `
            : ""
        }
        
        ${
          request.notes
            ? `
          <div style="background: #f3f4f6; border-radius: 12px; padding: 15px; margin: 20px 0;">
            <p style="color: #4b5563; font-size: 14px; margin: 0;">
              <strong>📝 ملاحظات:</strong><br>
              ${request.notes}
            </p>
          </div>
        `
            : ""
        }
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
          هذا إيميل آلي، يرجى عدم الرد عليه.
        </p>
      </div>
    </body>
    </html>
  `;
}

function getRequestFollowUpEmail(request, message) {
  return `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>رسالة متابعة</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; background: #f5f5f5; padding: 40px 20px;">
      <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <span style="font-size: 48px;">✉️</span>
          <h1 style="color: #1f2937; font-size: 24px; margin: 10px 0 5px;">رسالة متابعة</h1>
          <p style="color: #6b7280; font-size: 14px;">رقم الطلب: #${request.id}</p>
        </div>

        <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <p style="color: #374151; font-size: 14px; line-height: 1.8; margin: 0; white-space: pre-line;">
            ${message}
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
          هذا إيميل آلي، يرجى عدم الرد عليه.
        </p>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  sendEmail,
  getOTPEmailTemplate,
  getLoginAlertEmailTemplate,
  getRequestReceivedEmail,
  getRequestStatusEmail,
  getRequestFollowUpEmail,
};
