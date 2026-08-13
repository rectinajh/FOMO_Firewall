import { ERC20_APPROVE_ABI, FOMO_VAULT_ABI } from "../contracts/abi";
import { readContractCall, simulateThenExecute } from "./client";
import type { ExecutionResponse } from "./types";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

function args(values: unknown[]): string {
  return JSON.stringify(values);
}

function abiJson(abi: readonly unknown[]): string {
  return JSON.stringify(abi);
}

export function approveUsdc(amountBaseUnits: string, idempotencyKey: string): Promise<ExecutionResponse> {
  return simulateThenExecute(
    {
      contractAddress: env("BASE_SEPOLIA_USDC_ADDRESS"),
      chainId: Number(env("BASE_SEPOLIA_CHAIN_ID")),
      functionName: "approve",
      functionArgs: args([env("FOMO_VAULT_ADDRESS"), amountBaseUnits]),
      abi: abiJson(ERC20_APPROVE_ABI),
    },
    idempotencyKey,
  );
}

export function createIntent(
  intentId: string,
  amountBaseUnits: string,
  unlockAt: number,
  evidenceHash: string,
  idempotencyKey: string,
): Promise<ExecutionResponse> {
  return simulateThenExecute(
    {
      contractAddress: env("FOMO_VAULT_ADDRESS"),
      chainId: Number(env("BASE_SEPOLIA_CHAIN_ID")),
      functionName: "createIntent",
      functionArgs: args([intentId, amountBaseUnits, String(unlockAt), evidenceHash]),
      abi: abiJson(FOMO_VAULT_ABI),
    },
    idempotencyKey,
  );
}

export function refundIntent(intentId: string, idempotencyKey: string): Promise<ExecutionResponse> {
  return simulateThenExecute(
    {
      contractAddress: env("FOMO_VAULT_ADDRESS"),
      chainId: Number(env("BASE_SEPOLIA_CHAIN_ID")),
      functionName: "refund",
      functionArgs: args([intentId]),
      abi: abiJson(FOMO_VAULT_ABI),
    },
    idempotencyKey,
  );
}

export function readIntent(intentId: string) {
  return readContractCall({
    contractAddress: env("FOMO_VAULT_ADDRESS"),
    chainId: Number(env("BASE_SEPOLIA_CHAIN_ID")),
    functionName: "getIntent",
    functionArgs: args([intentId]),
    abi: abiJson(FOMO_VAULT_ABI),
  });
}

export function readUsdcBalance(owner: string) {
  return readContractCall({
    contractAddress: env("BASE_SEPOLIA_USDC_ADDRESS"),
    chainId: Number(env("BASE_SEPOLIA_CHAIN_ID")),
    functionName: "balanceOf",
    functionArgs: args([owner]),
    abi: JSON.stringify([{
      type: "function",
      name: "balanceOf",
      stateMutability: "view",
      inputs: [{ name: "account", type: "address" }],
      outputs: [{ name: "", type: "uint256" }],
    }]),
  });
}
