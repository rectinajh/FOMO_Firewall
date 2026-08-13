# KeeperHub Hackathon 提交清单

## 1. 主赛道硬性要求

以下三项缺一不可：

- [ ] 公开 GitHub、GitLab 或 Bitbucket 仓库链接。
- [ ] Demo 视频链接。
- [x] Agent 通过 KeeperHub 执行的真实链上交易链接。

测试网交易可以使用 Base Sepolia。提交前在未登录的浏览器窗口打开每个链接，确认评委可以访问。

## 2. 推荐交易证据

最低要求是一笔真实交易；FOMO Firewall 推荐提供三笔：

| 动作 | KeeperHub execution ID | 交易哈希 | BaseScan 链接 | 状态 |
|---|---|---|---|---|
| USDC approve | `t3keq600j6apb5ibvg87b` | `0x11d5…c0a5` | [BaseScan](https://sepolia.basescan.org/tx/0x11d5a0ebf4d9bc4ce78ecdfe3057f3063ee11ab37b927115d6dccec69d8ec0a5) | verified |
| Vault lock | `xyyj3ytpazsj5iaoxk3qv` | `0x272f…bcac` | [BaseScan](https://sepolia.basescan.org/tx/0x272f808e6c057df0ea205e059e8d8e4b47104f4bac34b3071f40ef34716abcac) | verified |
| Vault refund | `dscug75pah1esj73bq6uc` | `0x85cc…d9ad` | [BaseScan](https://sepolia.basescan.org/tx/0x85cc55de01f476ae7868ed6ef19928cd17e6a8755ee1b644133416e35604d9ad) | verified |

同时记录：

- [x] Base Sepolia chain ID `84532`。
- [x] KeeperHub 钱包地址。
- [x] FomoVault 合约地址。
- [x] 测试 USDC 地址。
- [ ] KeeperHub 请求时间。
- [ ] 预演结果。
- [ ] 最终链上状态。
- [ ] Vault 创建和退款事件。

## 3. README 检查

- [x] 一句话说明产品。
- [x] 30 秒内能理解的核心机制。
- [x] 架构图。
- [x] Agent 读取什么信息。
- [x] Agent 如何做决定。
- [x] 哪些判断由确定性规则完成。
- [x] KeeperHub 使用的 surface 和端点。
- [x] KeeperHub 为什么不是普通钱包 SDK 的替代品。
- [x] 安全限制。
- [x] 失败恢复策略。
- [x] 本地运行说明。
- [x] 环境变量说明，不包含真实 secret。
- [x] 合约地址和网络。
- [x] 真实交易证据。
- [ ] Demo 视频链接。
- [x] 历史回放和真实链上执行的区别。
- [x] 非投资建议声明。
- [x] SQLite 恢复最近一次 intent 和 KeeperHub execution。
- [x] Proof Bundle 包含 policy、行情、execution ID、交易哈希和最新三笔交易。
- [x] Simulation 拒绝时明确显示 `SAFETY STOP · NOT BROADCAST`。

## 4. 60–90 秒 Demo 脚本

### 0–10 秒：问题

> “资产在一小时内上涨了 24%。我担心错过，准备投入 1 USDC。”

展示自然语言输入和历史回放标签。

### 10–20 秒：Agent 判断

展示：

```text
Observed: +24% in 1 hour
Your limit: +15%
Amount: 1 USDC
Decision: BLOCK_AND_COOLDOWN
```

说明模型负责解析和解释，确定性规则负责资金决策。

### 20–45 秒：KeeperHub 真实执行

展示：

- approve 模拟成功。
- lock 模拟成功。
- KeeperHub execution ID。
- Base Sepolia 交易哈希。
- BaseScan 页面。

说出：

> “行情是历史回放，但这笔 USDC 锁仓是 Agent 刚刚通过 KeeperHub 执行的真实测试网交易。”

### 45–60 秒：双时间线

左侧显示没有防火墙的假设价值从 1 USDC 变为 0.72 USDC；右侧显示 1 USDC 仍在 Vault 中。

### 60–78 秒：退款

倒计时结束后，页面上的 Agent loop 自动调用结算端点，KeeperHub 执行 `refund`。不要点击人工退款按钮；它只用于自动结算失败后的重试。展示第三个 execution ID 和 BaseScan 链接。

### 78–90 秒：结果

展示 FOMO Receipt：

```text
Without Firewall: 0.72 USDC hypothetical value
With Firewall:    1.00 USDC returned
Loss avoided:     0.28 USDC
```

点击 `Download proof bundle`，用一秒钟展示 policy、行情快照、三个 KeeperHub execution ID、交易哈希和 bundle hash 已被打包为可验证 JSON。

收尾：

> “FOMO Firewall doesn’t predict the market. It enforces the discipline you chose before emotions took over.”

## 5. 录制前检查

- [ ] 清除页面中的调试数据和无关标签页。
- [ ] KeeperHub 钱包有足够 ETH 和测试 USDC。
- [ ] 使用新的 intent ID，避免与旧重试键冲突。
- [ ] Vault 冷静期设置为 Demo 可接受的时长。
- [ ] BaseScan 可以打开。
- [ ] 不展示 API key、环境变量、钱包导出或私钥。
- [ ] 先完整彩排一次并保存备用交易链接。
- [ ] 录制过程中明确说出 KeeperHub。
- [ ] 视频中能看到真实交易哈希，而不只是成功提示。
- [ ] 视频长度不超过平台限制。

## 6. 仓库发布检查

- [ ] 仓库为 public。
- [ ] 默认分支包含最新 README。
- [ ] `.env`、数据库和日志未提交。
- [x] `npm install` 能完成。
- [x] 测试命令通过。
- [x] `.env.example` 只包含占位符。
- [x] License 已选择。
- [ ] 截图和视频链接可公开访问。
- [ ] 提交描述与仓库中的实际功能一致。

## 7. 提交表单建议文案

### 一句话

> FOMO Firewall is an onchain behavioral circuit breaker that turns impulsive market-chasing into a time-locked, observable transaction through KeeperHub.

### KeeperHub 集成

> The agent uses KeeperHub Direct Execution to simulate, execute, recover, and verify Base Sepolia USDC approval, vault lock, and refund transactions. Stable idempotency keys prevent duplicate actions when outcomes are uncertain, while execution IDs and explorer links make every step observable.

### AI Agent 作用

> The agent parses a natural-language purchase intent, reads the user’s precommitted policy and market snapshot, explains the breach, and selects the guarded execution path. A deterministic policy controls all fund-moving parameters.

### 重要说明

> Market movement in the demo is a clearly labeled historical replay for reproducibility. All KeeperHub transactions shown are live Base Sepolia executions.

## 8. 最终五分钟检查

- [ ] GitHub 链接可打开。
- [ ] Demo 视频可播放。
- [ ] 至少一个真实交易链接可打开。
- [ ] 提交页面选择了正确赛道。
- [ ] 所有表单字段已保存。
- [ ] 截止时间和时区再次确认。

额外的 Best Onboarding UX Improvement bounty 必须作为独立 BUIDL 从 Bounty 页面提交，不能替代主赛道材料。
