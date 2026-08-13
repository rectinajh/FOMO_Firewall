export const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const FOMO_VAULT_ABI = [
  {
    type: "function",
    name: "createIntent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "intentId", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "unlockAt", type: "uint64" },
      { name: "evidenceHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "refund",
    stateMutability: "nonpayable",
    inputs: [{ name: "intentId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getIntent",
    stateMutability: "view",
    inputs: [{ name: "intentId", type: "bytes32" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "amount", type: "uint128" },
      { name: "createdAt", type: "uint64" },
      { name: "unlockAt", type: "uint64" },
      { name: "evidenceHash", type: "bytes32" },
      { name: "status", type: "uint8" },
    ],
  },
] as const;
