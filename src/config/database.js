const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL && process.env.DATABASE_URL.includes("neon")
      ? { rejectUnauthorized: false }
      : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

pool.on("connect", () => {
  console.log("✅ تم الاتصال بقاعدة البيانات");
});

pool.on("error", (err) => {
  console.error("❌ خطأ في قاعدة البيانات:", err.message);
});

module.exports = pool;
