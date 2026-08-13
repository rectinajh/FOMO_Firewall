export type KeeperHubStatus = "pending" | "running" | "completed" | "failed" | "unconfirmed";

export type ContractCallRequest = {
  contractAddress: string;
  chainId: number;
  functionName: string;
  functionArgs?: string;
  abi: string;
};

export type SimulationResponse = {
  success: boolean;
  status: "simulated";
  wouldRevert: boolean;
  from?: string;
  gasEstimate?: string;
  error?: string | null;
  detail?: string | null;
};

export type ExecutionResponse = {
  executionId: string;
  status: KeeperHubStatus;
  transactionHash?: string | null;
  transactionLink?: string | null;
  error?: string | null;
  detail?: string | null;
  simulation?: SimulationResponse;
  broadcasted?: boolean;
};

export type ExecutionReceipt = {
  hash: string;
  chainId: number;
  gasUsed?: string;
  verified: boolean;
  receiptStatus: "success" | "reverted" | "safe_inner_failure" | "not_found" | "timeout";
};

export type ExecutionStatus = ExecutionResponse & {
  receipts?: ExecutionReceipt[];
  result?: unknown;
};
