# EMBY-CF

一个专为 **Emby 媒体服务器反代加速** 优化的 Cloudflare Worker。

你只需要在 Emby 客户端里填写一个 Worker 地址，后端多个 Emby 上游会自动健康检查、按健康度与延迟选优，并在 API 请求失败时自动切换节点。

## 功能列表

- **Emby 专用路由**：自动区分媒体流请求与 API/普通请求
- **媒体流优化**：跟随 301/302、透传 `Range`、保留 `Content-Length` / `Content-Range` / `Accept-Ranges`
- **API 故障转移**：仅对 5xx / 网络错误重试，最多 3 次
- **Emby 健康检查**：优先检查 `/health`，再回落 `/` 的 `HEAD` / `GET`
- **智能选优**：优先健康节点，再按延迟排序
- **KV 持久化**：管理员密码、上游列表、健康状态持久保存到 Workers KV
- **内存模式**：未绑定 KV 也可运行，适合快速试用
- **网页管理面板**：首次安装向导、节点管理、健康检查、状态展示
- **WebSocket 透传**：兼容 Emby 相关长连接场景

## 项目结构

```text
EMBY-CF/
├── src/
│   ├── index.js       入口与管理 API
│   ├── router.js      Emby 请求分类
│   ├── proxy.js       媒体流 / API 代理逻辑
│   ├── upstream.js    Emby 健康检查与选优
│   ├── config.js      KV / 内存存储
│   └── admin-ui.js    管理面板
├── wrangler.toml
├── package.json
└── README.md
```

## 部署方式

### 方式一：Fork → Cloudflare Workers / Pages

1. Fork 本项目到你自己的 GitHub 账号
2. Cloudflare Dashboard → **Workers & Pages** → **Create application**
3. 连接 GitHub，选择你 Fork 的仓库
4. 保持默认构建配置，直接部署
5. 部署完成后访问：`https://你的Worker地址/_admin`

> 首次访问会进入向导，不需要手改代码。

### 方式二：Wrangler CLI

```bash
git clone https://github.com/Xiuyixx/EMBY-CF.git
cd EMBY-CF
npm install
npm run deploy
```

本地检查语法：

```bash
npm run check
```

## Emby 客户端怎么填 Worker 地址

核心思路：**把 Worker 地址当成你的 Emby 服务地址**。

例如你的 Worker 地址是：

```text
https://emby-cf.example.workers.dev
```

那么在 Emby 客户端 / TV / 手机 / Web 里：

- 服务器地址填写 `https://emby-cf.example.workers.dev`
- 用户名、密码仍然填写你原来的 Emby 账号
- 客户端后续所有 API、图片、音视频流请求都会走 Worker

这样用户侧只连一个入口，Worker 自动帮你挑最快、最健康的 Emby 上游。

## 管理面板

部署完成后访问：

```text
https://你的Worker地址/_admin
```

可完成：

- 首次初始化管理员密码
- 添加 / 编辑 / 删除 Emby 上游
- 手动触发健康检查
- 查看延迟、健康状态、最后检查时间
- 查看 `/health` 返回的 Emby 状态 / 版本信息（如有）

## KV 绑定说明

推荐生产环境绑定 KV，这样配置不会因为 Worker 重启丢失。

1. Cloudflare Dashboard → **Workers & Pages** → **KV** → 创建命名空间
2. 进入当前 Worker → **Settings** → **Bindings** → **Add** → **KV namespace**
3. 变量名填写：`KV`
4. 保存后重新部署

如果不绑定 KV：

- 项目仍然可用
- 但配置只保存在内存里
- Worker 重启后需要重新配置

## 环境变量说明

可通过 Cloudflare Dashboard 的 Variables / Secrets 配置：

| 变量名 | 默认值 | 说明 |
|---|---|---|
| `UPSTREAMS` | — | Emby 上游地址，多个用逗号分隔 |
| `ADMIN_TOKEN` | — | 管理面板密码；设置后可跳过初始化向导 |
| `REQUEST_TIMEOUT_MS` | `10000` | API/普通请求超时，单位毫秒 |
| `HEALTH_TIMEOUT_MS` | `5000` | 健康检查超时，单位毫秒 |

## 健康检查逻辑

按以下顺序执行：

1. `GET /health`
2. 如果不符合 Emby 健康格式，则回落 `HEAD /`
3. 如果源站不支持 `HEAD`，再回落 `GET /`

健康判定规则：

- **仅 `HTTP 200` 视为健康**
- `/health` 还要求返回 `{"Status":"Healthy"}`
- 排序优先级：**健康 > 延迟**

## 请求处理逻辑

### 媒体流请求

自动识别典型 Emby 流媒体路径，例如：

- `/videos/*/stream*`
- `/Items/*/Download*`
- `/Audio/*/stream*`

处理特性：

- 跟随 301 / 302 重定向
- 透传 `Range` 头
- 不做超时截断
- 不做重试，避免媒体流被重复消费

### API / 普通请求

其余请求均视为 API / 普通请求：

- 默认 10 秒超时
- 仅 5xx / 网络错误触发重试
- 最多尝试 3 个上游
- 请求体会预读为 `ArrayBuffer`，保证重试可复用

## 管理 API

所有管理 API 都需要 `X-Admin-Token`。

```bash
curl "https://你的Worker/_admin/status" -H "X-Admin-Token: 你的密码"

curl -X POST "https://你的Worker/_admin/upstreams" \
  -H "X-Admin-Token: 你的密码" \
  -H "Content-Type: application/json" \
  -d '{"upstreams":["https://emby-a.example.com","https://emby-b.example.com"]}'

curl -X POST "https://你的Worker/_admin/trigger-health" \
  -H "X-Admin-Token: 你的密码"
```

## 适用场景

适合这些情况：

- 多个 Emby 节点，需要统一入口
- 不希望把真实源站直接暴露给客户端
- 想让客户端自动享受节点故障切换
- 需要更稳的跨区域流媒体访问体验

## 注意事项

- Worker 只是反代与调度层，不替代 Emby 本身认证
- 若你的 Emby 上游依赖内网地址，请先保证 Worker 能访问到它
- 大部分 Emby 客户端都能直接把 Worker 地址当服务器地址使用
- 如果你有自定义域名，建议给 Worker 绑定自己的域名再提供给用户
