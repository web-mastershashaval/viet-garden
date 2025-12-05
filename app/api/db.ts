// app/api/db.ts
import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";

// Prevent creating multiple pools (Vercel hot reload fix)
declare global {
  // eslint-disable-next-line no-var
  var mysqlPool: Pool | undefined;
}

let pool: Pool;

// ----------------------
// DATABASE CONFIG
// ----------------------
const dbConfig = {
  host: process.env.DB_HOST || "old19i.h.filess.io",
  port: parseInt(process.env.DB_PORT || "3307"),
  user: process.env.DB_USER || "viet_garden_meetsaypay",
  password: process.env.DB_PASS || "3825cfa21841b58fcd27fd6ffda4db6660473676",
  database: process.env.DB_NAME || "viet_garden_meetsaypay",

  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 10000,

  // 🔥 REQUIRED FOR FILES.IO + VERCEL
  ssl: {
    rejectUnauthorized: false,
  },
};

// ----------------------
// CREATE POOL IF NOT EXIST
// ----------------------
if (!globalThis.mysqlPool) {
  console.log("🔄 Creating new MySQL connection pool...");
  console.log("📊 Database Config:", {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    database: dbConfig.database,
    passwordSet: !!dbConfig.password,
  });

  pool = mysql.createPool(dbConfig);
  globalThis.mysqlPool = pool;

  // Log new DB connections
  pool.on("connection", (connection) => {
    console.log("🔗 New database connection established");

    connection.on("error", (err) => {
      console.error("❌ Database connection error:", err.code);
    });
  });

  // Test connection
  pool
    .getConnection()
    .then((conn) => {
      console.log("✅ Database connection successful!");
      conn.release();
      return pool.query("SELECT 1");
    })
    .then(() => {
      console.log("✅ Database query test successful!");
    })
    .catch((error) => {
      console.error("❌ Database connection error:", {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
      });
    });
} else {
  console.log("♻️ Reusing existing MySQL connection pool...");
  pool = globalThis.mysqlPool;
}

// ----------------------
// QUERY HELPER WITH RETRY
// ----------------------
export async function queryWithRetry(
  sql: string,
  params?: any[],
  maxRetries = 2
) {
  let lastError;

  for (let i = 1; i <= maxRetries; i++) {
    try {
      console.log(`🔍 Query attempt ${i}/${maxRetries}`);
      const result = await pool.query(sql, params);
      console.log(`✅ Query successful on attempt ${i}`);
      return result;
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Query failed (attempt ${i}):`, error.code);

      if (
        error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT" ||
        error.code === "PROTOCOL_CONNECTION_LOST"
      ) {
        if (i < maxRetries) {
          console.log("🔄 Retrying query...");
          await new Promise((res) => setTimeout(res, 800));
          continue;
        }
      }

      throw error;
    }
  }

  throw lastError;
}

export { pool };
