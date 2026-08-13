import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ExecutionStatus, SimulationResponse } from "../keeperhub/types";

export type IntentState =
  | "EVALUATED"
  | "APPROVAL_PENDING"
  | "APPROVAL_COMPLETE"
  | "LOCK_PENDING"
  | "LOCKED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "FAILED";

export type IntentRecord = {
  intentId: string;
  requestId: string;
  sourceText: string;
  asset: string;
  amountUsdc: string;
  decision: string;
  policyVersion: string;
  marketMode: string;
  marketSource: string;
  unlockAt: number;
  evidenceHash: string;
  evaluation: unknown;
};

export type StoredExecutionStep = {
  step: "approve" | "lock" | "refund";
  executionId: string;
  status: string;
  transactionHash: string | null;
  transactionLink: string | null;
  verified: boolean;
  payload: ExecutionStatus;
  createdAt: string;
};

export type StoredIntentRun = IntentRecord & {
  status: IntentState;
  createdAt: string;
  updatedAt: string;
  actions: Partial<Record<StoredExecutionStep["step"], ExecutionStatus>>;
};

let database: DatabaseSync | undefined;

function databaseFilename(): string {
  // Vercel serverless filesystem is read-only except /tmp.
  const configured =
    process.env.DATABASE_URL ||
    (process.env.VERCEL ? "file:/tmp/fomo-firewall.db" : "file:./data/fomo-firewall.db");
  const path = configured.replace(/^file:/, "");
  if (path.startsWith("/")) return path;
  return resolve(/* turbopackIgnore: true */ process.cwd(), path);
}

function hasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function addColumn(db: DatabaseSync, table: string, definition: string): void {
  const [column] = definition.split(/\s+/, 1);
  if (!hasColumn(db, table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

function getDatabase(): DatabaseSync {
  if (database) return database;
  const filename = databaseFilename();
  mkdirSync(dirname(filename), { recursive: true });
  database = new DatabaseSync(filename);
  database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  database.exec(`
    CREATE TABLE IF NOT EXISTS intents (
      intent_id TEXT PRIMARY KEY, source_text TEXT NOT NULL, asset TEXT NOT NULL,
      amount_usdc TEXT NOT NULL, decision TEXT NOT NULL, policy_version TEXT NOT NULL,
      market_mode TEXT NOT NULL, market_source TEXT NOT NULL, unlock_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'EVALUATED', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS execution_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT, intent_id TEXT NOT NULL, step TEXT NOT NULL,
      execution_id TEXT NOT NULL, status TEXT NOT NULL, transaction_hash TEXT,
      transaction_link TEXT, verified INTEGER NOT NULL DEFAULT 0, payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (intent_id) REFERENCES intents(intent_id)
    );
    CREATE INDEX IF NOT EXISTS idx_intents_updated_at ON intents(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_execution_steps_intent ON execution_steps(intent_id, id);
  `);
  addColumn(database, "intents", "request_id TEXT NOT NULL DEFAULT ''");
  addColumn(database, "intents", "evidence_hash TEXT NOT NULL DEFAULT ''");
  addColumn(database, "intents", "evaluation_json TEXT NOT NULL DEFAULT '{}'");
  return database;
}

export function saveIntent(record: IntentRecord): void {
  getDatabase().prepare(`INSERT INTO intents
    (intent_id, request_id, source_text, asset, amount_usdc, decision, policy_version,
     market_mode, market_source, unlock_at, evidence_hash, evaluation_json, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EVALUATED', CURRENT_TIMESTAMP)
    ON CONFLICT(intent_id) DO UPDATE SET
      request_id = excluded.request_id,
      source_text = excluded.source_text,
      asset = excluded.asset,
      amount_usdc = excluded.amount_usdc,
      decision = excluded.decision,
      policy_version = excluded.policy_version,
      market_mode = excluded.market_mode,
      market_source = excluded.market_source,
      unlock_at = CASE WHEN excluded.unlock_at > 0 THEN excluded.unlock_at ELSE intents.unlock_at END,
      evidence_hash = excluded.evidence_hash,
      evaluation_json = excluded.evaluation_json,
      updated_at = CURRENT_TIMESTAMP`)
    .run(
      record.intentId,
      record.requestId,
      record.sourceText,
      record.asset,
      record.amountUsdc,
      record.decision,
      record.policyVersion,
      record.marketMode,
      record.marketSource,
      record.unlockAt,
      record.evidenceHash,
      JSON.stringify(record.evaluation),
    );
}

export function updateIntentUnlockAt(intentId: string, unlockAt: number): void {
  getDatabase().prepare(
    "UPDATE intents SET unlock_at = ?, updated_at = CURRENT_TIMESTAMP WHERE intent_id = ?",
  ).run(unlockAt, intentId);
}

export function updateIntentStatus(intentId: string, status: IntentState): void {
  getDatabase().prepare(
    "UPDATE intents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE intent_id = ?",
  ).run(status, intentId);
}

export function saveExecutionStep(
  intentId: string,
  step: StoredExecutionStep["step"],
  status: ExecutionStatus,
): void {
  const db = getDatabase();
  const receipt = status.receipts?.[0];
  const existing = db.prepare(
    "SELECT id FROM execution_steps WHERE intent_id = ? AND step = ? ORDER BY id DESC LIMIT 1",
  ).get(intentId, step) as { id: number } | undefined;
  const values = [
    status.executionId,
    status.status,
    status.transactionHash || receipt?.hash || null,
    status.transactionLink || null,
    receipt?.verified ? 1 : 0,
    JSON.stringify(status),
  ] as const;

  if (existing) {
    db.prepare(`UPDATE execution_steps SET
      execution_id = ?, status = ?, transaction_hash = ?, transaction_link = ?,
      verified = ?, payload_json = ? WHERE id = ?`)
      .run(...values, existing.id);
  } else {
    db.prepare(`INSERT INTO execution_steps
      (execution_id, status, transaction_hash, transaction_link, verified, payload_json, intent_id, step)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(...values, intentId, step);
  }

  const nextStatus: IntentState = status.status === "failed"
    ? "FAILED"
    : status.status !== "completed"
      ? step === "approve" ? "APPROVAL_PENDING" : step === "lock" ? "LOCK_PENDING" : "REFUND_PENDING"
      : step === "approve" ? "APPROVAL_COMPLETE" : step === "lock" ? "LOCKED" : "REFUNDED";
  updateIntentStatus(intentId, nextStatus);
}

export function saveSimulationFailure(
  intentId: string,
  step: StoredExecutionStep["step"],
  simulation: SimulationResponse,
): void {
  saveExecutionStep(intentId, step, {
    executionId: `simulation-only:${step}:${intentId.slice(2, 10)}`,
    status: "failed",
    error: simulation.error || "SIMULATION_REJECTED",
    detail: simulation.detail || "KeeperHub rejected the transaction before broadcast",
    simulation,
    broadcasted: false,
  });
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readIntentRow(intentId?: string): Record<string, unknown> | undefined {
  const db = getDatabase();
  const sql = intentId
    ? `SELECT intent_id AS intentId, request_id AS requestId, source_text AS sourceText,
        asset, amount_usdc AS amountUsdc, decision, policy_version AS policyVersion,
        market_mode AS marketMode, market_source AS marketSource, unlock_at AS unlockAt,
        evidence_hash AS evidenceHash, evaluation_json AS evaluationJson, status,
        created_at AS createdAt, updated_at AS updatedAt
       FROM intents WHERE intent_id = ?`
    : `SELECT intent_id AS intentId, request_id AS requestId, source_text AS sourceText,
        asset, amount_usdc AS amountUsdc, decision, policy_version AS policyVersion,
        market_mode AS marketMode, market_source AS marketSource, unlock_at AS unlockAt,
        evidence_hash AS evidenceHash, evaluation_json AS evaluationJson, status,
        created_at AS createdAt, updated_at AS updatedAt
       FROM intents ORDER BY updated_at DESC, rowid DESC LIMIT 1`;
  return (intentId ? db.prepare(sql).get(intentId) : db.prepare(sql).get()) as Record<string, unknown> | undefined;
}

export function getIntentRun(intentId: string): StoredIntentRun | null {
  const row = readIntentRow(intentId);
  if (!row) return null;
  const stepRows = getDatabase().prepare(`SELECT step, execution_id AS executionId, status,
    transaction_hash AS transactionHash, transaction_link AS transactionLink,
    verified, payload_json AS payloadJson, created_at AS createdAt
    FROM execution_steps WHERE intent_id = ? ORDER BY id ASC`).all(intentId) as Array<Record<string, unknown>>;
  const actions: StoredIntentRun["actions"] = {};
  for (const stepRow of stepRows) {
    const step = stepRow.step as StoredExecutionStep["step"];
    actions[step] = parseJson(String(stepRow.payloadJson), {
      executionId: String(stepRow.executionId),
      status: String(stepRow.status),
      transactionHash: stepRow.transactionHash ? String(stepRow.transactionHash) : null,
      transactionLink: stepRow.transactionLink ? String(stepRow.transactionLink) : null,
    } as ExecutionStatus);
  }
  return {
    intentId: String(row.intentId),
    requestId: String(row.requestId),
    sourceText: String(row.sourceText),
    asset: String(row.asset),
    amountUsdc: String(row.amountUsdc),
    decision: String(row.decision),
    policyVersion: String(row.policyVersion),
    marketMode: String(row.marketMode),
    marketSource: String(row.marketSource),
    unlockAt: Number(row.unlockAt),
    evidenceHash: String(row.evidenceHash),
    evaluation: parseJson(String(row.evaluationJson), {}),
    status: String(row.status) as IntentState,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    actions,
  };
}

export function getLatestIntentRun(): StoredIntentRun | null {
  const row = readIntentRow();
  return row ? getIntentRun(String(row.intentId)) : null;
}

export function getLatestDueLockedIntent(nowSeconds = Math.floor(Date.now() / 1_000)): StoredIntentRun | null {
  const row = getDatabase().prepare(`SELECT intent_id AS intentId FROM intents
    WHERE status = 'LOCKED' AND unlock_at <= ? ORDER BY updated_at DESC LIMIT 1`).get(nowSeconds) as { intentId: string } | undefined;
  return row ? getIntentRun(row.intentId) : null;
}

export function buildProofBundle(intentId: string): Record<string, unknown> | null {
  const run = getIntentRun(intentId);
  if (!run) return null;
  const recentTransactions = getDatabase().prepare(`SELECT step, execution_id AS executionId,
    transaction_hash AS transactionHash, transaction_link AS transactionLink, verified,
    created_at AS createdAt FROM execution_steps
    WHERE transaction_hash IS NOT NULL ORDER BY id DESC LIMIT 3`).all();
  const payload = {
    schema: "fomo-firewall-proof/v1",
    generatedAt: new Date().toISOString(),
    network: {
      name: "Base Sepolia",
      chainId: Number(process.env.BASE_SEPOLIA_CHAIN_ID || "84532"),
      vault: process.env.FOMO_VAULT_ADDRESS || null,
      usdc: process.env.BASE_SEPOLIA_USDC_ADDRESS || null,
      executor: process.env.KEEPERHUB_WALLET_ADDRESS || null,
    },
    intent: {
      id: run.intentId,
      sourceText: run.sourceText,
      amountUsdc: run.amountUsdc,
      policyVersion: run.policyVersion,
      status: run.status,
      unlockAt: run.unlockAt,
    },
    evaluation: run.evaluation,
    evidenceHash: run.evidenceHash,
    keeperHub: {
      surface: "Direct Execution REST API",
      steps: run.actions,
    },
    latestThreeTransactions: recentTransactions,
  };
  return {
    ...payload,
    bundleHash: `0x${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`,
  };
}

export function resetDatabaseForTests(): void {
  database?.close();
  database = undefined;
}
