import type {
  ContractCallRequest,
  ExecutionResponse,
  ExecutionStatus,
  SimulationResponse,
} from "./types";

const DEFAULT_BASE_URL = "https://app.keeperhub.com/api";

export class KeeperHubRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly retryAfter: string | null = null,
  ) {
    super(message);
    this.name = "KeeperHubRequestError";
  }
}

export class KeeperHubSimulationError extends Error {
  readonly broadcasted = false;

  constructor(readonly simulation: SimulationResponse) {
    super(simulation.error || simulation.detail || "KeeperHub simulation would revert");
    this.name = "KeeperHubSimulationError";
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

function baseUrl(): string {
  return process.env.KEEPERHUB_BASE_URL || DEFAULT_BASE_URL;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requiredEnv("KEEPERHUB_API_KEY")}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const raw = await response.text();
  let body: T & { error?: string; detail?: string };
  try {
    body = JSON.parse(raw) as T & { error?: string; detail?: string };
  } catch {
    throw new KeeperHubRequestError(
      `KeeperHub returned an invalid response (${response.status})`,
      response.status,
      response.headers.get("Retry-After"),
    );
  }
  if (!response.ok) {
    throw new KeeperHubRequestError(
      body.error || body.detail || `KeeperHub request failed (${response.status})`,
      response.status,
      response.headers.get("Retry-After"),
    );
  }
  return body;
}

export function simulateContractCall(requestBody: ContractCallRequest) {
  return request<SimulationResponse>("/execute/contract-call", {
    method: "POST",
    body: JSON.stringify({ ...requestBody, simulate: true }),
  });
}

export function executeContractCall(requestBody: ContractCallRequest, idempotencyKey: string) {
  return request<ExecutionResponse>("/execute/contract-call", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(requestBody),
  });
}

export function getExecutionStatus(executionId: string) {
  return request<ExecutionStatus>(`/execute/${encodeURIComponent(executionId)}/status`);
}

export function readContractCall(requestBody: ContractCallRequest) {
  return request<{ result?: unknown; error?: string; detail?: string }>("/execute/contract-call", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
}

export async function simulateThenExecute(
  requestBody: ContractCallRequest,
  idempotencyKey: string,
) {
  const simulation = await simulateContractCall(requestBody);
  if (!simulation.success || simulation.wouldRevert) {
    throw new KeeperHubSimulationError(simulation);
  }
  const execution = await executeContractCall(requestBody, idempotencyKey);
  return { ...execution, simulation, broadcasted: true };
}

export async function waitForExecution(executionId: string, timeoutMs = 120_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const status = await getExecutionStatus(executionId);
    if (status.status === "completed" || status.status === "failed") return status;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`KeeperHub execution timed out: ${executionId}`);
}
