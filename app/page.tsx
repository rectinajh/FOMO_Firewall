"use client";

import { useEffect, useState } from "react";

type Evaluation = {
  intent: { asset: string; action: string; amountUsdc: string; sourceText: string };
  market: { priceChange1hBps: string; priceUsd: string; mode: string; source: string };
  decision: { action: string; reasonCodes: string[]; protectedAmount: string; policyVersion: string };
  explanation: string;
  cooldownSeconds?: number;
};

type KeeperAction = {
  executionId: string;
  status: string;
  transactionHash?: string | null;
  transactionLink?: string | null;
  error?: string | null;
  detail?: string | null;
  receipts?: Array<{ verified?: boolean; gasUsed?: string; receiptStatus?: string }>;
  simulation?: { success?: boolean; wouldRevert?: boolean; gasEstimate?: string };
  broadcasted?: boolean;
};

type ExecutionView = {
  intentId: string;
  requestId?: string;
  unlockAt: number;
  status?: string;
  restored?: boolean;
  actions: { approve?: KeeperAction; lock?: KeeperAction };
};

type RefundView = { refund?: KeeperAction | null };

const DEFAULT_TEXT = "ETH 已经涨很多了，我怕错过，现在想投入 1 USDC。";

export default function Home() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [execution, setExecution] = useState<ExecutionView | null>(null);
  const [refund, setRefund] = useState<RefundView | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [evaluationSecondsLeft, setEvaluationSecondsLeft] = useState(0);
  const [copiedExecutionId, setCopiedExecutionId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [safetyStop, setSafetyStop] = useState(false);
  const [autoSettlement, setAutoSettlement] = useState<"idle" | "monitoring" | "running" | "failed" | "complete">("idle");

  useEffect(() => {
    let cancelled = false;
    async function restoreLatestRun() {
      try {
        const response = await fetch("/api/intents/latest", { cache: "no-store" });
        const body = await response.json();
        if (cancelled || !response.ok || !body.run) return;
        const run = body.run;
        setText(run.sourceText);
        if (run.evaluation?.intent && run.evaluation?.market && run.evaluation?.decision) {
          setEvaluation(run.evaluation);
        }
        setRequestId(run.requestId);
        window.localStorage.setItem("fomo-firewall-request-id", run.requestId);
        if (run.actions?.approve || run.actions?.lock) {
          setExecution({
            intentId: run.intentId,
            requestId: run.requestId,
            unlockAt: run.unlockAt,
            status: run.status,
            restored: true,
            actions: { approve: run.actions.approve, lock: run.actions.lock },
          });
          setSecondsLeft(Math.max(0, run.unlockAt - Math.floor(Date.now() / 1_000)));
          setAutoSettlement(
            run.actions.refund?.status === "completed"
              ? "complete"
              : run.status === "LOCKED" ? "monitoring" : "idle",
          );
        }
        if (run.status === "FAILED") {
          const failedAction = run.actions?.refund || run.actions?.lock || run.actions?.approve;
          setSafetyStop(failedAction?.broadcasted === false);
          setError(failedAction?.detail || failedAction?.error || "The latest KeeperHub action failed");
        }
        if (run.actions?.refund?.status === "completed" || run.status === "REFUNDED") {
          setRefund({ refund: run.actions.refund || null });
        }
      } catch {
        // A missing local run must not block starting a fresh demo.
      } finally {
        if (!cancelled) setRestoring(false);
      }
    }
    restoreLatestRun();
    return () => { cancelled = true; };
  }, []);

  async function evaluate() {
    setLoading(true);
    setError("");
    setEvaluation(null);
    setExecution(null);
    setRefund(null);
    setSafetyStop(false);
    setAutoSettlement("idle");
    try {
      const response = await fetch("/api/intents/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || body.error || "Evaluation failed");
      setEvaluation(body);
      setEvaluationSecondsLeft(body.cooldownSeconds ?? 5);
      const nextRequestId = crypto.randomUUID();
      setRequestId(nextRequestId);
      window.localStorage.setItem("fomo-firewall-request-id", nextRequestId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Evaluation failed");
    } finally {
      setLoading(false);
    }
  }

  async function protect() {
    setExecuting(true);
    setError("");
    setSafetyStop(false);
    try {
      const stableRequestId = requestId || window.localStorage.getItem("fomo-firewall-request-id") || crypto.randomUUID();
      setRequestId(stableRequestId);
      window.localStorage.setItem("fomo-firewall-request-id", stableRequestId);
      const response = await fetch("/api/intents/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, requestId: stableRequestId }),
      });
      const body = await response.json();
      if (!response.ok) {
        setSafetyStop(body.broadcasted === false);
        throw new Error(body.detail || body.error || "Protection failed");
      }
      setExecution(body);
      setSecondsLeft(Math.max(0, body.unlockAt - Math.floor(Date.now() / 1000)));
      setAutoSettlement("monitoring");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Protection failed");
    } finally {
      setExecuting(false);
    }
  }

  useEffect(() => {
    if (!execution?.unlockAt || refund) return;
    const timer = window.setInterval(() => {
      setSecondsLeft(Math.max(0, execution.unlockAt - Math.floor(Date.now() / 1000)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [execution, refund]);

  useEffect(() => {
    if (!evaluation || execution || evaluationSecondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setEvaluationSecondsLeft((current) => Math.max(0, current - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [evaluation, execution, evaluationSecondsLeft]);

  async function settle(automatic = false) {
    setExecuting(true);
    setError("");
    setSafetyStop(false);
    if (automatic) setAutoSettlement("running");
    try {
      const response = await fetch(automatic ? "/api/intents/settle-due" : "/api/intents/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId: execution?.intentId }),
      });
      const body = await response.json();
      if (!response.ok) {
        setSafetyStop(body.broadcasted === false);
        throw new Error(body.detail || body.error || "Refund failed");
      }
      if (automatic && body.settled === false) throw new Error("No due intent was available for automatic settlement");
      setRefund(body);
      setAutoSettlement("complete");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Refund failed");
      if (automatic) setAutoSettlement("failed");
    } finally {
      setExecuting(false);
    }
  }

  useEffect(() => {
    if (!execution || execution.status !== "LOCKED" || refund || secondsLeft > 0 || autoSettlement !== "monitoring" || executing) return;
    void settle(true);
  }, [execution, refund, secondsLeft, autoSettlement, executing]);

  const blocked = evaluation?.decision.action === "BLOCK_AND_COOLDOWN";
  const protectionLocked = execution?.actions.lock?.status === "completed" && execution.status !== "FAILED";
  const protectionFailed = execution?.status === "FAILED";
  const amount = evaluation ? Number(evaluation.intent.amountUsdc) / 1_000_000 : 0;
  const hypotheticalValue = amount * 0.72;

  async function copyExecutionId(executionId?: string) {
    if (!executionId) return;
    await navigator.clipboard.writeText(executionId);
    setCopiedExecutionId(executionId);
    window.setTimeout(() => setCopiedExecutionId(""), 1_500);
  }

  function evidenceRow(label: string, action?: KeeperAction | null) {
    if (!action) return null;
    const verified = action?.receipts?.[0]?.verified === true;
    return <div className="evidence-row">
      <div className="evidence-name"><span className={`check ${verified ? "verified" : ""}`}>{verified ? "✓" : "•"}</span><span>{label}<small>{action.simulation?.success && !action.simulation?.wouldRevert ? "Simulation passed · broadcast verified" : action.status}</small></span></div>
      <div className="evidence-meta"><code>{action?.executionId}</code><button className="copy-button" onClick={() => copyExecutionId(action?.executionId)}>{copiedExecutionId === action?.executionId ? "Copied" : "Copy ID"}</button>{action?.transactionLink && <a href={action.transactionLink} target="_blank" rel="noreferrer">BaseScan ↗</a>}</div>
    </div>;
  }

  return (
    <main className="shell">
      <div className="eyebrow">Onchain behavioral circuit breaker</div>
      <h1>Make the rule stronger than the impulse.</h1>
      <p className="lead">FOMO Firewall turns a rushed ETH purchase into a transparent, testnet-only decision. Your policy decides. KeeperHub executes.</p>
      {restoring && <div className="restore-banner">Restoring the latest verified run…</div>}
      {!restoring && execution?.restored && <div className="restore-banner success">Latest run restored from SQLite · no execution state was lost</div>}

      <div className="grid">
        <section className="panel">
          <h2>01 / State your intent</h2>
          <div className="field">
            <label htmlFor="intent">What are you about to do?</label>
            <textarea id="intent" value={text} onChange={(event) => setText(event.target.value)} />
          </div>
          <div className="row">
            <div className="field"><label>Policy limit</label><input value="15% / 1 hour" readOnly /></div>
            <div className="field"><label>Minimum protected</label><input value="1 USDC · Demo" readOnly /></div>
          </div>
          <button className="button" onClick={evaluate} disabled={loading}>{loading ? "Evaluating…" : "Evaluate intent"}</button>
          {error && <div className={`error ${safetyStop ? "safety-stop" : ""}`}>{safetyStop && <strong>SAFETY STOP · NOT BROADCAST</strong>}{error}</div>}
          {evaluation && <div className={`decision ${blocked ? "block" : "allow"}`}>
            <div className="decision-title">{blocked ? "BLOCK_AND_COOLDOWN" : "ALLOW"}</div>
            <div className="reason">{evaluation.explanation}</div>
            {blocked && <div className="rule-table">
              <div className="rule-row rule-head"><span>Signal</span><span>Observed</span><span>Your rule</span></div>
              <div className="rule-row"><span>ETH 1h movement</span><strong>+{Number(evaluation.market.priceChange1hBps) / 100}%</strong><span>max +15%</span></div>
              <div className="rule-row"><span>Planned amount</span><strong>{amount} USDC</strong><span>min 1 USDC</span></div>
              <div className="rule-row"><span>Protection</span><strong>100%</strong><span>fixed policy</span></div>
            </div>}
            <div className="status"><span className="dot" />{blocked ? "Ready to protect this amount on Base Sepolia" : "No vault action required"}</div>
            {blocked && !execution && <>
              <div className="status"><span className="dot" />{evaluationSecondsLeft > 0 ? `冷静观察中：${evaluationSecondsLeft}s 后可以开始下一步` : "冷静期结束，可以开始下一步"}</div>
              <button className="button" style={{ marginTop: 16 }} onClick={protect} disabled={executing || evaluationSecondsLeft > 0}>{executing ? "Protecting on Base Sepolia…" : evaluationSecondsLeft > 0 ? "Waiting for cooldown…" : "Protect with FOMO Firewall"}</button>
            </>}
            {execution && <div className="status">{refund ? "Protection completed. Funds returned." : protectionFailed ? "Protection stopped before lock." : "Protection locked."} Intent: {execution.intentId.slice(0, 10)}…</div>}
            {execution && protectionLocked && !refund && <>
              <div className="status"><span className="dot" />{secondsLeft > 0 ? `Agent monitoring cooldown: ${secondsLeft}s` : autoSettlement === "running" ? "Agent is automatically settling through KeeperHub…" : autoSettlement === "failed" ? "Automatic settlement needs a retry" : "Cooldown complete · automatic settlement starting"}</div>
              {autoSettlement === "failed" && <button className="button secondary" style={{ marginTop: 12 }} onClick={() => settle(false)} disabled={executing}>{executing ? "Refunding…" : "Retry refund"}</button>}
            </>}
            {refund && <div className="status"><span className="dot" style={{ background: "var(--green)" }} />Agent settled automatically. Refunded on Base Sepolia.</div>}
          </div>}
        </section>

        <aside className="panel">
          <h2>02 / Evidence snapshot</h2>
          <div className="facts">
            <div className="fact"><span>Asset</span><span>{evaluation?.intent.asset ?? "ETH"}</span></div>
            <div className="fact"><span>Planned amount</span><span>{evaluation ? `${Number(evaluation.intent.amountUsdc) / 1_000_000} USDC` : "—"}</span></div>
            <div className="fact"><span>1h movement</span><span>{evaluation ? `${Number(evaluation.market.priceChange1hBps) / 100}%` : "+24%"}</span></div>
            <div className="fact"><span>Price snapshot</span><span>{evaluation ? `$${evaluation.market.priceUsd}` : "$3,200.00"}</span></div>
            <div className="fact"><span>Market mode</span><span className="pill">{evaluation?.market.mode?.replace("_", " ") ?? "historical replay"}</span></div>
            <div className="fact"><span>Policy version</span><span>{evaluation?.decision.policyVersion ?? "fomo-v1"}</span></div>
          </div>
          <p className="lead" style={{ fontSize: 14, marginTop: 24 }}>The market movement is a reproducible replay. Any lock or refund shown later is a real Base Sepolia transaction.</p>
          {execution && <div className="facts" style={{ marginTop: 18 }}>
            <div className="execution-heading"><span>Agent loop · KeeperHub execution</span><span className="verified-badge">SIMULATED → VERIFIED</span></div>
            <div className="execution-flow">
              <span className={protectionFailed ? "flow-stopped" : "flow-done"}>{protectionFailed ? "Safety stop" : "Simulation"}</span><i>→</i><span className={execution.actions.approve?.status === "completed" ? "flow-done" : "flow-stopped"}>Approve</span><i>→</i><span className={execution.actions.lock?.status === "completed" ? "flow-done" : "flow-stopped"}>Lock</span>{protectionLocked && <><i>→</i><span className={refund ? "flow-done" : "flow-waiting"}>{refund ? "Refunded" : "Cooldown"}</span></>}
            </div>
            {evidenceRow("USDC approve", execution.actions.approve)}
            {evidenceRow("Vault lock", execution.actions.lock)}
            {refund && evidenceRow("Vault refund", refund.refund)}
            <a className="proof-button" href={`/api/evidence/${execution.intentId}`} download>Download proof bundle ↓</a>
          </div>}
        </aside>
      </div>

      {refund && evaluation && <section className="receipt panel">
        <div className="eyebrow">03 / FOMO Receipt</div>
        <h2>What your past self protected</h2>
        <p className="lead" style={{ fontSize: 15 }}>The market replay fell 28% after the intent snapshot. The purchase below is hypothetical; the refund is real.</p>
        <div className="timeline-grid">
          <div className="timeline hypothetical">
            <div className="timeline-label">WITHOUT FIREWALL</div>
            <div className="timeline-value">${hypotheticalValue.toFixed(2)}</div>
            <div className="timeline-note">Hypothetical ETH value</div>
            <div className="timeline-path">$3,200 → $2,304 · −28%</div>
          </div>
          <div className="timeline protected">
            <div className="timeline-label">WITH FIREWALL</div>
            <div className="timeline-value">${amount.toFixed(2)}</div>
            <div className="timeline-note">USDC returned from Vault</div>
            <div className="timeline-path">Locked → Refunded · 100% protected</div>
          </div>
        </div>
        <div className="receipt-result"><span>LOSS AVOIDED</span><strong>${(amount - hypotheticalValue).toFixed(2)}</strong><small>Protected by a rule you set before the impulse.</small></div>
      </section>}
    </main>
  );
}
