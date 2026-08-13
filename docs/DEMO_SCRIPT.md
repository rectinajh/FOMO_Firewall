# FOMO Firewall — Silent Demo Script

Target length: **5:12**. The video has no voiceover, so use the English text below as timed captions or on-screen callouts. Keep each caption visible long enough to read. Do not show API keys, private keys, terminal secrets, or wallet exports.

## Caption style

- Use white text with a dark translucent background.
- Use green for verified or completed states.
- Use coral/red only for the blocked decision and safety warnings.
- Keep captions to two or three short lines.
- When a screen already contains a lot of text, show only the `Caption` column.

## 0:00–0:24 — The problem

### Screen

Open on the FOMO Firewall landing screen. Hold on the headline before scrolling.

### Caption

```text
Crypto wallets are optimized to execute quickly.
They are not designed to protect decisions made under pressure.
```

```text
After a sudden price surge, a user may chase the market,
approve a transaction, and regret it only after confirmation.
```

## 0:24–0:48 — The vision

### Screen

Show the product headline and subtitle. Slowly scroll to the intent form.

### Caption

```text
Our vision:
make the pause before irreversible onchain action a built-in primitive.
```

```text
FOMO Firewall is an onchain behavioral circuit breaker.
It turns impulse into a transparent, time-delayed decision.
```

## 0:48–1:12 — What the product does

### Screen

Show the two main panels: `State your intent` and `Evidence snapshot`.

### Caption

```text
The user sets a rule while calm.
The agent evaluates a later intent against that rule.
```

```text
The agent can explain the decision,
but it cannot override the user's policy.
```

## 1:12–1:36 — Enter the intent

### Screen

Click into the text field and show:

```text
ETH has pumped a lot, and I’m afraid of missing out.
I want to buy with 1 USDC now.
```

### Caption

```text
This is a natural-language purchase intent.
The current MVP supports ETH and USDC on Base Sepolia.
```

```text
The parser extracts the asset, action, and amount.
It does not receive a wallet address or transaction calldata from the user text.
```

## 1:36–2:00 — Show the evidence snapshot

### Screen

Point to `ETH`, `1 USDC`, `24%`, `$3,200`, `historical replay`, and `fomo-v1`.

### Caption

```text
The market snapshot is intentionally labeled historical replay.
This makes the demo reproducible for every judge.
```

```text
The market story is simulated for repeatability.
The later lock and refund transactions are real Base Sepolia transactions.
```

## 2:00–2:22 — Evaluate the policy

### Screen

Click **Evaluate intent**. Show the five-second observation countdown.

### Caption

```text
The policy is deterministic:
block when the one-hour move is at least 15% and the amount reaches the guard limit.
```

```text
No floating-point or free-form model output controls the protected amount.
```

## 2:22–2:48 — Explain the block

### Screen

Show `BLOCK_AND_COOLDOWN` and the signal table.

### Caption

```text
Observed: +24% in one hour
Your rule: maximum +15%
Decision: BLOCK_AND_COOLDOWN
```

```text
This is not a price prediction.
It is a precommitted behavioral rule protecting the user's future self.
```

## 2:48–3:12 — Introduce KeeperHub

### Screen

Scroll or focus on `Agent loop · KeeperHub execution`.

### Caption

```text
KeeperHub is the execution and reliability layer.
It is not the policy engine and not the vault contract.
```

```text
FOMO Firewall decides what the policy allows.
KeeperHub safely carries out the approved onchain calls.
```

## 3:12–3:42 — Simulation before broadcast

### Screen

Click **Protect with FOMO Firewall**. Show the simulation and execution states.

### Caption

```text
Every write follows the same safety path:
simulate → reject if it would revert → broadcast → verify.
```

```text
If simulation fails, the system stops with:
SAFETY STOP · NOT BROADCAST
```

## 3:42–4:06 — Approval and vault lock

### Screen

Show `Simulation`, `Approve`, and `Lock` changing to green. Keep the execution rows visible.

### Caption

```text
First, KeeperHub approves the exact USDC amount.
Then it locks that amount in FomoVault.
```

```text
The app stores each execution ID before polling for the final result.
Refreshing the page does not create a duplicate transaction.
```

## 4:06–4:28 — Show the protected state

### Screen

Show `Protection locked`, the intent ID, and the cooldown timer.

### Caption

```text
The funds are now protected by an onchain cooldown.
The contract, not the browser, enforces ownership and unlock time.
```

```text
The user has time to reconsider before an irreversible trade could happen.
```

## 4:28–4:48 — Automatic settlement

### Screen

Let the countdown reach zero. Show `Agent is automatically settling through KeeperHub…`.

### Caption

```text
When the cooldown ends, the agent checks the vault state.
It does not ask the user to remember a second manual step.
```

```text
The settlement service simulates and executes the refund through KeeperHub.
```

## 4:48–5:00 — Completed refund

### Screen

Show `Refunded`, `Protection completed`, and the three execution rows.

### Caption

```text
The full 1 USDC is returned from the vault.
Protection completed on Base Sepolia.
```

```text
Approve → Lock → Refund
Simulation passed · broadcast verified
```

## 5:00–5:12 — Proof and closing message

### Screen

Click **Download proof bundle**. Briefly show the JSON file, then return to the completed page.

### Caption

```text
The result is portable proof, not just a success message:
policy, market snapshot, execution IDs, transaction hashes, and bundle hash.
```

```text
We do not predict the market.
We protect users from impulsive execution.
```

## Optional end card

If the video editor allows a one-second end card, use:

```text
FOMO Firewall
Your policy decides. KeeperHub executes.
```

## Current run evidence

If the recording shows the latest run, these are the corresponding KeeperHub execution IDs:

| Step | Execution ID | BaseScan |
|---|---|---|
| USDC approve | `5a6k0oew8cb5qehamx8wj` | [Transaction](https://sepolia.basescan.org/tx/0x64cd70bf691db96440a14e24b1c48ccd15481d6ceef7209dfa6b28b6fb58322c) |
| Vault lock | `p2wop1npe4stt3sdedshz` | [Transaction](https://sepolia.basescan.org/tx/0x4913bab4ce769266b0d9c1f859903d3f03dbd72eba7e4d1cc1548098fc411551) |
| Vault refund | `xbdwcsx3gmhy00wezsvmu` | [Transaction](https://sepolia.basescan.org/tx/0x874c0aee99d7d6294aedd45ada21a3fbe1e413b955ebbd02540e3a4861680d73) |

Use these links only if the video shows this exact run. Otherwise replace them with the three links generated by the recorded run.
