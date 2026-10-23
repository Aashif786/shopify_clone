import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import type { DatabaseConfig } from "@shopify-clone/config";
import { DatabaseUnavailableError, toSafeDatabaseError } from "./errors.js";

const HEALTH_CHECK_TIMEOUT_MS = 2_000;
const POOL_MAX_CONNECTIONS = 20;
const CONNECTION_TIMEOUT_MS = 5_000;
const IDLE_TIMEOUT_MS = 10_000;
const SLOW_QUERY_THRESHOLD_MS = 1_000;

export interface SqlQueryResult<T extends QueryResultRow = QueryResultRow> {
  rows: T[];
  rowCount: number;
}

export interface DatabaseClient {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<SqlQueryResult<T>>;
}

export type TransactionCallback<T> = (client: DatabaseClient) => Promise<T>;

export interface DatabaseHealth {
  ok: boolean;
}

export interface PoolStats {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

export interface Database {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<SqlQueryResult<T>>;
  withTransaction<T>(callback: TransactionCallback<T>): Promise<T>;
  withExclusiveConnection<T>(callback: TransactionCallback<T>): Promise<T>;
  healthCheck(): Promise<DatabaseHealth>;
  getPoolStats(): PoolStats;
  close(): Promise<void>;
}

function mapQueryResult<T extends QueryResultRow>(
  result: QueryResult<T>
): SqlQueryResult<T> {
  return {
    rows: result.rows,
    rowCount: result.rowCount ?? 0,
  };
}

function wrapClient(client: PoolClient): DatabaseClient {
  return {
    async query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[]
    ): Promise<SqlQueryResult<T>> {
      const result = await client.query<T>(text, values);
      return mapQueryResult(result);
    },
  };
}

function rethrowSafely(error: unknown, connectionString: string): never {
  if (error instanceof Error) {
    const message = error.message;
    if (
      message.includes(connectionString) ||
      /\/\/[^/\s]+:[^/\s]+@/i.test(message)
    ) {
      throw new DatabaseUnavailableError();
    }
    throw error;
  }

  throw toSafeDatabaseError(error);
}

export function createDatabase(config: DatabaseConfig): Database {
  const pool = new Pool({
    connectionString: config.url,
    max: POOL_MAX_CONNECTIONS,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
  });

  pool.on("error", () => {
    // Idle client errors are handled by subsequent operations.
  });

  async function query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<SqlQueryResult<T>> {
    const startTime = performance.now();
    try {
      const result = await pool.query<T>(text, values);
      return mapQueryResult(result);
    } catch (error) {
      throw rethrowSafely(error, config.url);
    } finally {
      const durationMs = performance.now() - startTime;
      if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
        console.warn(
          `[SLOW_QUERY] duration=${durationMs.toFixed(1)}ms text=${text.slice(0, 100).replace(/\s+/g, " ").trim()}`
        );
      }
    }
  }

  async function withExclusiveConnection<T>(
    callback: TransactionCallback<T>
  ): Promise<T> {
    let client: PoolClient;
    try {
      client = await pool.connect();
    } catch (error) {
      rethrowSafely(error, config.url);
    }

    try {
      return await callback(wrapClient(client));
    } finally {
      client.release();
    }
  }

  async function withTransaction<T>(callback: TransactionCallback<T>): Promise<T> {
    return withExclusiveConnection(async (client) => {
      await client.query("BEGIN");
      try {
        const result = await callback(client);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Preserve the original error.
        }
        throw error;
      }
    });
  }

  async function healthCheck(): Promise<DatabaseHealth> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new DatabaseUnavailableError());
        }, HEALTH_CHECK_TIMEOUT_MS);
      });

      await Promise.race([pool.query("SELECT 1"), timeout]);
      return { ok: true };
    } catch {
      return { ok: false };
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  function getPoolStats(): PoolStats {
    return {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };
  }

  async function close(): Promise<void> {
    await pool.end();
  }

  return {
    query,
    withTransaction,
    withExclusiveConnection,
    healthCheck,
    getPoolStats,
    close,
  };
}
