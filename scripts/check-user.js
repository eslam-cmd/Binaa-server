const { Pool } = require("pg");

// استخدم نفس إعدادات السيرفر
const pool = new Pool({
  host: "ep-round-butterfly-aemmbpvt.c-2.us-east-2.aws.neon.tech",
  port: 5432,
  database: "neondb",
  user: "neondb_owner",
  password: "npg_EGAHMw8Ssi4u",
  ssl: {
    rejectUnauthorized: false,
  },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function checkUser() {
  try {
    await pool.connect();
    console.log("✅ تم الاتصال بقاعدة البيانات");

    const result = await pool.query("SELECT id, email, role FROM users");
    console.log("📋 المستخدمين في قاعدة البيانات:");
    console.table(result.rows);

    if (result.rows.length === 0) {
      console.log("❌ لا يوجد مستخدمين!");
    } else {
      console.log(`✅ يوجد ${result.rows.length} مستخدم`);
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ خطأ:", error.message);
    process.exit(1);
  }
}

checkUser();
