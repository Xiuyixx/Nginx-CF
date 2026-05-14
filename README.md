# Nginx-CF

一个基于 Cloudflare Worker 的多上游反向代理项目，支持健康检查、故障转移、KV 配置和 Cloudflare 优选 IP 接入。

## 功能列表

- 多上游反向代理：支持配置多个上游 URL，按健康状态动态转发
- 自动故障转移：当上游 5xx、超时或网络错误时，自动重试其他上游
- Cron 健康检查：通过 Worker Scheduled/Cron Trigger 定期探测上游可用性
- Workers KV 配置存储：保存上游列表和健康状态
- 管理 API：在线查看状态、更新上游列表
- Cloudflare 优选 IP：内置分地区 IP 列表，可按需启用
- WebSocket 透传：保留 Upgrade 头，兼容常见 WebSocket 代理场景

## 目录结构

```text
Nginx-CF/
├── src/
│   ├── index.js
│   ├── proxy.js
│   ├── upstream.js
│   ├── config.js
│   └── cf-ips.js
├── wrangler.toml
├── README.md
├── package.json
└── .gitignore
```

---

## 部署方式一：Cloudflare 控制台（零命令行，推荐新手）

### 前提条件

- 拥有 [Cloudflare 账号](https://dash.cloudflare.com/sign-up)（免费即可）
- 准备好上游服务器地址（例如 `https://your-server.example.com`）

---

### 第一步：创建 Workers KV 命名空间

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 左侧菜单依次进入：**Workers & Pages** → **KV**
3. 点击右上角 **Create a namespace**
4. 命名空间名称填写 `KV`，点击 **Add**
5. 创建成功后，记录下该命名空间的 **ID**（形如 `abc123def456...`），后续会用到

---

### 第二步：创建 Worker

1. 左侧菜单进入：**Workers & Pages** → **Overview**
2. 点击 **Create application** → 选择 **Create Worker**
3. 为 Worker 起一个名字（例如 `nginx-cf`），点击 **Deploy**
4. 部署完成后，点击 **Edit code** 进入在线编辑器

---

### 第三步：上传代码

在在线编辑器中，需要将本项目的源码文件逐一创建：

> **提示**：编辑器左侧文件树支持新建文件和文件夹。

1. 创建 `src/` 文件夹（点击左侧 `+` 按钮 → New folder → 输入 `src`）
2. 在 `src/` 下依次创建以下文件并粘贴对应代码：
   - `index.js`
   - `proxy.js`
   - `upstream.js`
   - `config.js`
   - `cf-ips.js`
3. 将根目录的 `worker.js`（或默认入口文件）内容替换为 `src/index.js` 的内容

> **更简单的方式**：直接将本仓库 clone 到本地后，使用 Wrangler CLI 一键部署（见下文「部署方式二」）。

---

### 第四步：绑定 KV 命名空间

1. 回到 Worker 详情页，点击顶部 **Settings** 标签
2. 找到 **Variables** → **KV Namespace Bindings**
3. 点击 **Add binding**：
   - **Variable name**：填 `KV`
   - **KV namespace**：选择第一步创建的 `KV` 命名空间
4. 点击 **Save**

---

### 第五步：配置环境变量

在同一个 **Settings → Variables → Environment Variables** 区域，添加以下变量：

| 变量名             | 示例值                                          | 说明                                 |
| ---------------- | ---------------------------------------------- | ------------------------------------ |
| `UPSTREAMS`      | `https://a.example.com,https://b.example.com`  | 默认上游列表，多个用英文逗号分隔            |
| `ADMIN_TOKEN`    | `your-secret-token`                            | 管理 API 鉴权 token，请修改为随机强密码    |
| `USE_CF_IPS`     | `false`                                        | 是否启用 Cloudflare 优选 IP（`true/false`） |
| `PREFERRED_REGION` | `apac`                                       | 优选 IP 地区：`apac` / `europe` / `us` |

> ⚠️ **安全提示**：`ADMIN_TOKEN` 请使用随机生成的长字符串，不要使用 `change-me` 等默认值。

添加完成后点击 **Save and deploy**。

---

### 第六步：配置 Cron 触发器（健康检查）

1. 在 Worker 详情页，点击 **Triggers** 标签
2. 找到 **Cron Triggers** → 点击 **Add Cron Trigger**
3. 填写 Cron 表达式：`*/5 * * * *`（每 5 分钟执行一次健康检查）
4. 点击 **Add Trigger**

---

### 第七步：绑定自定义域名（可选）

如果你希望 Worker 使用自己的域名（而不是 `*.workers.dev`）：

1. 在 Worker 详情页，点击 **Triggers** → **Custom Domains**
2. 点击 **Add Custom Domain**
3. 输入你的域名（该域名需已托管在 Cloudflare），例如 `proxy.example.com`
4. 点击 **Add Custom Domain** 确认

> **注意**：域名必须已添加到 Cloudflare 并完成 DNS 解析才能使用。

---

### 验证部署

部署成功后，访问你的 Worker 地址并调用管理接口验证：

```bash
# 查看上游健康状态
curl -sS "https://nginx-cf.your-account.workers.dev/_admin/status" \
  -H "X-Admin-Token: your-secret-token"
```

返回类似以下 JSON 则说明部署成功：

```json
{
  "upstreams": [
    {
      "url": "https://a.example.com",
      "healthy": true,
      "latency": 98,
      "lastCheck": "2026-05-14T01:00:00.000Z",
      "status": 200
    }
  ]
}
```

---

## 部署方式二：Wrangler CLI（推荐有开发经验的用户）

### 1. 安装依赖和 Wrangler

```bash
npm install
npm install -g wrangler
wrangler login
```

### 2. 创建 Workers KV

```bash
wrangler kv namespace create KV
```

把返回的 namespace id 填到 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_NAMESPACE_ID"
```

### 3. 修改默认配置

编辑 `wrangler.toml`：

- `UPSTREAMS`：默认上游，多个用英文逗号分隔
- `ADMIN_TOKEN`：管理 API 鉴权 token
- `USE_CF_IPS`：是否启用 Cloudflare 优选 IP，`true/false`
- `PREFERRED_REGION`：优选 IP 地区，支持 `apac` / `europe` / `us`

### 4. 部署

```bash
npm run deploy
```

---

## 配置说明

### 环境变量

| 变量名             | 说明                                                   |
| ---------------- | ------------------------------------------------------ |
| `UPSTREAMS`      | 默认上游列表，例如 `https://a.example.com,https://b.example.com` |
| `ADMIN_TOKEN`    | 管理 API token                                         |
| `USE_CF_IPS`     | 是否启用内置优选 IP（`true` / `false`）                   |
| `PREFERRED_REGION` | 优选 IP 地区（`apac` / `europe` / `us`）               |

### KV 结构

- `upstreams`

```json
["https://a.example.com", "https://b.example.com"]
```

- `upstream_health`

```json
[
  {
    "url": "https://a.example.com",
    "healthy": true,
    "latency": 123,
    "lastCheck": "2026-05-14T01:00:00.000Z",
    "status": 200
  }
]
```

---

## 管理 API

所有管理接口都要求带上 `X-Admin-Token` 请求头。

### 查看健康状态

```bash
curl -sS "https://your-worker.example.workers.dev/_admin/status" \
  -H "X-Admin-Token: change-me"
```

### 更新上游列表

```bash
curl -sS -X POST "https://your-worker.example.workers.dev/_admin/upstreams" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: change-me" \
  --data '{"upstreams":["https://a.example.com","https://b.example.com"]}'
```

---

## 健康检查与选优逻辑

- Cron 每 5 分钟执行一次 `HEAD` 健康探测
- 单个上游超时为 5 秒
- 优先选择"健康且延迟最低"的上游
- 若全部不健康，则回退到第一个上游（fail-open）
- 请求转发时最多尝试 3 个上游

---

## Cloudflare 优选 IP 说明

`src/cf-ips.js` 内置了亚太、欧洲、美国三组常用优选 IP 示例。

用途：

- 在你的源站或前置网络已经支持"直连优选节点 + Host 回源"时，减少跨区绕路
- 在不同地区做简单的链路偏好控制

启用方法：

1. 将 `USE_CF_IPS` 设为 `true`
2. 将 `PREFERRED_REGION` 设为目标地区
3. Worker 转发时会把上游 hostname 替换成优选 IP，并保留原始 `Host` header

> 注意：如果你的上游是 HTTPS，且证书不支持直接用 IP 建连，可能需要你自己的源站/SNI 方案配合。这部分依赖你的实际网络架构。

---

## 与 Nginx-X 的关系

Nginx-X 偏向服务器侧的 Nginx 配置和运维自动化；Nginx-CF 则把反向代理层前移到 Cloudflare Worker：

- Nginx-X：管理本机或服务器上的 Nginx
- Nginx-CF：运行在 Cloudflare 边缘，负责请求入口、上游选优和故障切换

两者可以组合使用：

- Nginx-X 作为源站或源站管理工具
- Nginx-CF 作为公网入口代理与健康切换层

---

## 本地检查

```bash
npm install
npm run check
```
