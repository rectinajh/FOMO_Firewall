# FOMO Firewall Demo Script

Target length: 75 to 90 seconds. Record in English and add English captions.

## Before recording

- Use a clean browser window at desktop width.
- Confirm the KeeperHub wallet has Base Sepolia ETH and at least 1 test USDC.
- Keep `.env`, API keys, private keys, wallet exports, and terminal history off screen.
- Open the three BaseScan transaction links in background tabs as backup evidence.
- Use a fresh intent so the automatic settlement can be recorded end to end.
- Verify that `MARKET_MODE=historical_replay` and `DEMO_AUTO_SETTLE=true`.

## 0:00 to 0:10 | The problem

Show the intent field and say:

> ETH just moved 24% in one hour. I am afraid of missing out, so I am about to chase it with 1 USDC.

Click **Evaluate intent**.

## 0:10 to 0:23 | The policy decides

Point to `Observed` and `Your rule`.

> FOMO Firewall compares my intent with a rule I set while calm. The observed move is 24%, above my 15% limit, so a deterministic policy selects BLOCK_AND_COOLDOWN. The model cannot invent an address or move a different amount.

## 0:23 to 0:48 | KeeperHub executes

Click **Protect with FOMO Firewall** and keep the execution panel visible.

> KeeperHub is the execution and reliability layer. It simulates the USDC approval and vault lock before broadcast, uses stable idempotency keys, and returns execution IDs that the app persists before polling.

Point to the two execution IDs and BaseScan links.

> The market move is a labeled historical replay. These approve and lock transactions are real Base Sepolia transactions executed through KeeperHub.

## 0:48 to 1:05 | The agent settles automatically

Keep the cooldown and agent loop visible.

> After the onchain cooldown, the agent verifies the vault state and automatically asks KeeperHub to simulate and execute the refund. I do not need to click a second action.

Point to the refund execution ID and `Protection completed` state.

## 1:05 to 1:18 | The outcome

Scroll to the FOMO Receipt.

> In the replay, chasing the move would have left 72 cents. With the firewall, the full 1 USDC returned from the vault. The project does not predict the market. It enforces the discipline chosen before the impulse.

## 1:18 to 1:28 | Verifiable proof

Click **Download proof bundle**.

> Every step is portable evidence: policy version, market source, simulation result, KeeperHub execution ID, transaction hash, and a bundle hash.

End on the completed execution panel and product title.

## One-line submission pitch

> FOMO Firewall is an onchain behavioral circuit breaker that turns impulsive market chasing into a time-locked, observable transaction through KeeperHub.

## KeeperHub integration statement

> The agent uses KeeperHub Direct Execution to simulate, execute, recover, and verify Base Sepolia USDC approval, vault lock, and refund transactions. Stable idempotency keys prevent duplicate actions when outcomes are uncertain, while execution IDs and explorer links make every step observable.

## Accuracy statement

> Market movement in the demo is a clearly labeled historical replay for reproducibility. Every KeeperHub transaction shown is a live Base Sepolia execution.
