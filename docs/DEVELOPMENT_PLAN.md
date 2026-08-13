# FOMO Firewall 开发计划

## 1. 目标

在提交截止前完成一个小而真实的闭环：

```text
自然语言意图
→ 确定性 FOMO 判断
→ KeeperHub 预演
→ Base Sepolia USDC 锁仓
→ KeeperHub 状态与交易证据
→ 冷静期后退款
→ 双时间线结果卡
```

判断优先级时遵守：真实交易证据 > 执行可靠性 > Agent 解释 > 页面美化 > 扩展功能。

## 2. 计划目录

```text
KeeperHub/
├── README.md
├── package.json
├── foundry.toml
├── next.config.ts
├── app/
│   ├── page.tsx
│   └── api/
│       └── intents/
│           ├── evaluate/route.ts
│           └── [id]/
│               ├── route.ts
│               ├── execute/route.ts
│               └── refund/route.ts
├── components/
│   ├── IntentForm.tsx
│   ├── DecisionCard.tsx
│   ├── ExecutionTimeline.tsx
│   ├── TwinTimeline.tsx
│   └── FomoReceipt.tsx
├── lib/
│   ├── agent/
│   │   ├── orchestrator.ts
│   │   ├── intent-parser.ts
│   │   └── prompts.ts
│   ├── policy/
│   │   ├── evaluate.ts
│   │   └── evaluate.test.ts
│   ├── keeperhub/
│   │   ├── client.ts
│   │   ├── execute.ts
│   │   ├── status.ts
│   │   └── types.ts
│   ├── market/
│   │   ├── adapter.ts
│   │   └── replay.ts
│   ├── evidence/
│   │   ├── canonicalize.ts
│   │   └── store.ts
│   ├── contracts/
│   │   ├── addresses.ts
│   │   └── abi.ts
│   └── schema.ts
├── src/
│   └── FomoVault.sol
├── test/
│   └── FomoVault.t.sol
├── scripts/
│   ├── DeployVault.s.sol
│   └── KeeperHubSmokeTest.s.sol
├── data/
│   └── scenarios/eth-pump-reversal.json
├── public/
│   └── evidence/
│       └── transactions.json
└── docs/
    ├── PRD.md
    ├── TECHNICAL_DESIGN.md
    ├── DEVELOPMENT_PLAN.md
    └── SUBMISSION_CHECKLIST.md
```

## 3. 环境与账户

### 必需

- Node.js 20 或更高版本。
- npm。
- KeeperHub 账户和组织级 API key，格式为 `kh_...`。
- KeeperHub 自动创建的 Turnkey 钱包地址。
- Base Sepolia ETH，用于 Gas。
- Base Sepolia 测试 USDC。
- 一个 LLM API key。
- Base Sepolia RPC URL。

### 计划环境变量

```text
KEEPERHUB_API_KEY=<server-only>
KEEPERHUB_BASE_URL=https://app.keeperhub.com/api
OPENAI_API_KEY=<server-only>
BASE_SEPOLIA_RPC_URL=<rpc-url>
BASE_SEPOLIA_CHAIN_ID=84532
BASE_SEPOLIA_USDC_ADDRESS=<verified-address>
FOMO_VAULT_ADDRESS=<deployed-address>
MAX_GUARD_AMOUNT_USDC=100
DATABASE_URL=file:./data/fomo-firewall.db
```

任何真实 secret 都不得写入 `.env.example`、README、截图、视频或 git 历史。

## 4. 实现顺序

### 阶段 0：先证明 KeeperHub 能真实执行

在构建页面前完成：

1. 创建 KeeperHub API key。
2. 获取 KeeperHub 钱包地址。
3. 向该地址充值 Base Sepolia ETH 和测试 USDC。
4. 通过 KeeperHub 执行一个最小测试网动作。
5. 保存 execution ID 和 BaseScan 链接。

退出条件：已经拥有一条可打开的真实交易链接。若这一步失败，暂停所有 UI 工作。

### 阶段 1：合约

实现 `FomoVault.sol`：

- 固定 USDC。
- `createIntent`。
- `refund`。
- `getIntent`。
- 事件和重入保护。

完成全部合约单元测试后部署到 Base Sepolia，并在代码中固定部署地址。

退出条件：直接使用部署钱包完成一次 lock/refund 测试。

### 阶段 2：KeeperHub Adapter

实现：

- Bearer authentication。
- 合约调用预演。
- 带稳定重试键的广播。
- 状态查询和终态判断。
- 请求体哈希。
- 错误分类和日志脱敏。

然后使用 KeeperHub 钱包完成：

1. approve。
2. createIntent。
3. refund。

退出条件：三笔动作均保存 execution ID、交易哈希和 BaseScan 链接。

### 阶段 3：Policy 与 Agent

先实现并测试纯函数 Policy，再接 LLM：

1. `intent-parser.ts` 把自然语言转成 schema。
2. 服务端校验资产和金额。
3. `evaluate.ts` 根据规则输出动作。
4. Agent 生成一段只引用实际输入的解释。
5. Orchestrator 根据动作调用 KeeperHub Adapter。

退出条件：LLM 输出异常时不会触发交易；相同输入得到相同资金决策。

### 阶段 4：双时间线 UI

只做一个单页：

- 顶部：自然语言意图与规则。
- 左侧：没有防火墙的假设时间线。
- 右侧：真实防火墙执行时间线。
- 底部：FOMO Receipt 和链上链接。

退出条件：评委不读 README，也能在 30 秒内解释发生了什么。

### 阶段 5：证据与提交

- 把最终交易证据写入 `public/evidence/transactions.json`。
- README 补充实际部署地址和交易链接。
- 在干净环境运行一次完整流程。
- 录制 60 至 90 秒 Demo。
- 创建公开 GitHub 仓库并验证匿名窗口可访问。

## 5. 截止前 12 小时计划

| 时间 | 任务 | 必须产出 |
|---|---|---|
| 0–1 小时 | KeeperHub 账户、钱包、Gas、USDC | 一条 KeeperHub 测试交易链接 |
| 1–3 小时 | Vault 合约、测试、部署 | 合约地址和测试通过记录 |
| 3–5 小时 | KeeperHub approve/lock/refund | 三个 execution 证据 |
| 5–7 小时 | Policy、Agent 和 API | 可重复的端到端脚本 |
| 7–9 小时 | 单页双时间线 UI | 浏览器可演示闭环 |
| 9–10 小时 | 错误恢复和重复点击测试 | 无重复锁仓或退款 |
| 10–11 小时 | README、证据、截图 | 公开仓库可审查 |
| 11–12 小时 | 录视频并提交 | 三项主赛道要求齐全 |

如果进度落后，依次删除：动画、实时行情、动态规则、LLM 润色。不得删除 KeeperHub 真实交易、证据和 README。

## 6. 测试清单

### 合约

- [ ] 正常锁仓。
- [ ] 重复 intent 被拒绝。
- [ ] 冷静期前退款被拒绝。
- [ ] 非 owner 退款被拒绝。
- [ ] 正常退款。
- [ ] 重复退款被拒绝。
- [ ] Vault 和 owner 余额守恒。

### Policy

- [ ] 阈值边界正确。
- [ ] 金额边界正确。
- [ ] 非法输入不会进入执行层。
- [ ] 解释中的数值与规则输入一致。

### KeeperHub

- [ ] 链 ID 只允许 84532。
- [ ] 所有写操作先预演。
- [ ] 预演会回滚时不广播。
- [ ] 同一业务动作复用稳定重试键。
- [ ] 不同请求体不能复用同一键。
- [ ] 超时后先恢复，不生成第二笔交易。
- [ ] execution ID 和交易链接持久化。
- [ ] 日志没有 secret。

### 用户体验

- [ ] 历史行情和真实链上执行标签始终可见。
- [ ] 假设结果不会被误认为真实交易。
- [ ] 页面显示 Agent 使用的规则。
- [ ] 页面显示交易状态、哈希和外部链接。
- [ ] 价格上涨时正确显示错过收益。
- [ ] 页面刷新后能恢复当前状态。

## 7. Demo 数据

历史回放场景至少包含：

```json
{
  "id": "eth-pump-reversal-demo",
  "asset": "ETH",
  "mode": "historical_replay",
  "source": "<public-source-url>",
  "points": [
    { "offsetSeconds": 0, "priceUsd": "10.00", "change1hBps": 2400 },
    { "offsetSeconds": 60, "priceUsd": "7.20", "change1hBps": -2800 }
  ]
}
```

数值可以缩放用于解释，但必须标明是回放。若使用真实历史资产名称，保存可公开访问的数据来源和时间范围。

## 8. Definition of Done

开发完成必须同时满足：

- [ ] 一条自然语言意图能触发确定性规则。
- [ ] KeeperHub 预演 approve、lock 和 refund。
- [ ] KeeperHub 在 Base Sepolia 广播至少一笔真实交易。
- [ ] 页面展示最终交易链接。
- [ ] 重复点击不会重复锁仓。
- [ ] 双时间线明确区分假设和真实结果。
- [ ] README 解释架构、决策逻辑、安全边界和交易证据。
- [ ] Demo 视频、公开仓库和交易链接全部准备完成。

## 9. 下一步

实现开始时先执行阶段 0，不要先搭建完整 UI。第一条 KeeperHub 真实交易是当前项目最大的外部风险，也是有效提交的硬门槛。
