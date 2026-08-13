import sql from "mssql";

declare global {
  // Reuse the pool during local hot reloads and across requests in one Node process.
  var familyHistoryMssqlPool: Promise<sql.ConnectionPool> | undefined;
}

function getConfig(): string | sql.config {
  const connectionString = process.env.MSSQL_CONNECTION_STRING?.trim();
  if (connectionString) return connectionString;

  const server = process.env.MSSQL_SERVER?.trim();
  const database = process.env.MSSQL_DATABASE?.trim();
  const user = process.env.MSSQL_USER?.trim();
  const password = process.env.MSSQL_PASSWORD;
  if (!server || !database || !user || !password) {
    throw new Error(
      "MSSQL is not configured. Set MSSQL_CONNECTION_STRING or MSSQL_SERVER, MSSQL_DATABASE, MSSQL_USER, and MSSQL_PASSWORD."
    );
  }

  return {
    server,
    database,
    user,
    password,
    port: Number(process.env.MSSQL_PORT || 1433),
    options: {
      encrypt: process.env.MSSQL_ENCRYPT !== "false",
      trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE === "true",
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30_000,
    },
  };
}

export function getMssqlPool(): Promise<sql.ConnectionPool> {
  if (!global.familyHistoryMssqlPool) {
    const pool = new sql.ConnectionPool(getConfig());
    global.familyHistoryMssqlPool = pool.connect().catch((error) => {
      global.familyHistoryMssqlPool = undefined;
      throw error;
    });
  }
  return global.familyHistoryMssqlPool;
}
