# Nginx-CF

一个基于 Cloudflare Worker 的多上游反向代理项目，支持健康检查、故障转移、KV 持久化和 Cloudflare 优选 IP。

**新手友好**：部署完成后访问 `/_admin` 页面，通过网页向导完成所有配置，无需改任何配置文件。

## 功能列表

- **多上游反向代理**：配置多个上游 URL，按健康状态动态转发
- **自动故障转移**：上游 5xx / 超时 / 网络错误时，自动重试其他上游
- **Cron 健康检查**：每 5 分钟自动探测上游可用性，HEAD 不支持时自动降级 GET
- **KV 持久化**：管理员密码、上游列表、健康状态全部存入 Workers KV
- **内存模式**：未绑定 KV 时自动降级为内存运行，无需强制配置 KV
- **首次安装向导**：首次访问 `/_admin` 自动引导设置密码和上游，无需修改任何文件
- **管理面板**：可视化查看上游状态、增删改上游、一键触发健康检查
- **Cloudflare 优选 IP**：内置亚太 / 欧洲 / 美国三组优选 IP，随机选取降低单点压力
- **WebSocket 透传**：正确处理 WebSocket 升级，兼容 ws:// 和 wss://
- **请求转发安全**：body 直通（ReadableStream），不缓冲，大文件上传无压力

## 目录结构

```text
Nginx-CF/
├── src/
│   ├── index.js       路由入口 + 管理 API
│   ├── proxy.js       请求转发 + 优选 IP
│   ├── upstream.js    健康检查 + 上游选优
│   ├── config.js      KV / 内存存储层
│   ├── cf-ips.js      Cloudflare 优选 IP 列表
│   └── admin-ui.js    管理面板 + 首次安装向导 HTML
├── wrangler.toml
├── README.md
└── package.json
```

---

## 部署方式一：Cloudflare 控制台（推荐新手，全程无命令行）

整个流程在浏览器里完成，部署好之后访问管理面板用网页向导配置，**不需要改任何文件**。

### 准备工作

- [Cloudflare 账号](https://dash.cloudflare.com/sign-up)（免费，不需要绑定域名）
- [GitHub 账号](https://github.com)（用来 Fork 本项目）
- 你的后端服务器地址（如 `https://your-server.example.com`）

---

### 第一步：Fork 本项目

1. 打开 [github.com/Xiuyixx/Nginx-CF](https://github.com/Xiuyixx/Nginx-CF)
2. 点击右上角 **Fork** → **Create fork**
3. 稍等几秒，你的账号下会出现 `你的用户名/Nginx-CF`

> Fork 完成后，所有配置都在你自己的仓库里，不会影响原项目。

---

### 第二步：将项目部署到 Cloudflare

1. 在 Cloudflare Dashboard，点击 **Workers & Pages** → **Create application** → **Pages**
2. 点击 **Connect to Git** → 选择 **GitHub** → 授权 Cloudflare 访问你的账号
3. 在仓库列表中选择 **Nginx-CF**，点击 **Begin setup**
4. 配置页：
   - **Project name**：随意，如 `nginx-cf`
   - **Production branch**：`main`
   - **Build command** 和 **Build output directory** 均留空
5. 点击 **Save and Deploy**，等待约 1~2 分钟

部署完成后会给你一个 `https://nginx-cf.xxx.pages.dev` 地址（或 `*.workers.dev`）。

---

### 第三步：绑定 KV（可选，推荐生产环境）

> 不绑定 KV 也能正常部署和使用，面板顶部会显示「KV 内存模式」。绑定后配置数据持久化，Worker 重启不丢失。

1. Cloudflare Dashboard → **Workers & Pages** → **KV** → **Create a namespace**，名称随意，点击 **Add**
2. 进入你部署的 Worker 项目 → **Settings** → **Bindings** → **Add** → **KV namespace**
3. **Variable name** 填 `KV`，选择刚创建的命名空间，点击 **Save**
4. Worker 会自动重部署，完成

---

### 第四步：访问管理面板，通过向导完成配置

1. 打开 `https://你的Worker地址/_admin`
2. 首次访问会自动进入**安装向导**：

   **第一步** — 设置管理员密码（至少 8 位，请妥善保存）

   **第二步** — 填写上游地址（每行一个，支持多个）

   **第三步** — 完成，点击「进入管理面板」

3. 之后登录面板即可管理上游、触发健康检查、查看状态

> ✅ **安全说明**：管理员密码加密存储在 KV 里，不会出现在代码或配置文件中。

---

### 第五步：配置 Cron 触发器（自动健康检查）

1. 进入 Worker/Pages 项目 → **Settings** → **Triggers / Cron Triggers**
2. 点击 **Add Cron Trigger**，填入 `*/5 * * * *`
3. 点击 **Add Trigger**

---

### 第六步：绑定自定义域名（可选）

域名需已托管在 Cloudflare：

1. 进入项目 → **Settings** → **Domains & Routes** → **Add** → **Custom domain**
2. 输入域名（如 `proxy.example.com`），点击 **Add Custom Domain**

---

### 验证部署

- 访问 `https://你的Worker地址` — 应该能看到你的后端响应
- 访问 `https://你的Worker地址/_admin` — 应该打开管理面板

---

## 部署方式二：Wrangler CLI（推荐有开发经验的用户）

```bash
# 1. 克隆仓库
git clone https://github.com/Xiuyixx/Nginx-CF.git && cd Nginx-CF

# 2. 安装依赖
npm install

# 3. 登录 Cloudflare
npx wrangler login

# 4. 创建 KV（可选）
npx wrangler kv namespace create KV
# 把返回的 id 填入 wrangler.toml 的 kv_namespaces.id

# 5. 部署
npm run deploy

# 本地开发预览
npm run dev
```

部署完成后同样访问 `/_admin` 用向导完成配置。

---

## 管理面板功能

| 功能 | 说明 |
|------|------|
| 上游列表 | 左侧侧边栏展示所有上游及健康状态 |
| 状态表格 | 延迟、最后检查时间、健康状态 |
| ⚡ 立即健康检查 | 手动触发一次所有上游的健康探测 |
| ＋ 添加上游 | 弹窗输入新的上游地址 |
| 编辑 / 删除 | 修改或移除已有上游 |
| KV 状态标签 | 顶栏显示是否已绑定 KV，内存模式会有提示 |

---

## 配置说明

所有配置均可通过管理面板或 Cloudflare 控制台的 **Variables and Secrets** 设置。

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `UPSTREAMS` | — | 上游地址，多个用逗号分隔（向导配置后无需此项） |
| `ADMIN_TOKEN` | — | 管理员密码（向导配置后存储在 KV，无需此项） |
| `USE_CF_IPS` | `false` | 是否启用 Cloudflare 优选 IP |
| `PREFERRED_REGION` | `apac` | 优选 IP 地区：`apac` / `europe` / `us` |
| `HEALTH_CHECK_PATH` | `/` | 健康检查探测路径 |
| `REQUEST_TIMEOUT_MS` | `10000` | 代理请求超时（毫秒） |
| `HEALTH_TIMEOUT_MS` | `5000` | 健康检查超时（毫秒） |
| `CF_IP_INDEX` | — | 固定使用第几个优选 IP（留空则随机） |

---

## 管理 API

所有 API 需要 `X-Admin-Token` 请求头（向导设置的密码）。

```bash
# 查看上游和健康状态
curl "https://你的Worker/_admin/status" -H "X-Admin-Token: 你的密码"

# 更新上游列表
curl -X POST "https://你的Worker/_admin/upstreams" \
  -H "X-Admin-Token: 你的密码" \
  -H "Content-Type: application/json" \
  -d '{"upstreams":["https://a.example.com","https://b.example.com"]}'

# 手动触发健康检查
curl -X POST "https://你的Worker/_admin/trigger-health" \
  -H "X-Admin-Token: 你的密码"

# 查询是否已完成初始化
curl "https://你的Worker/_admin/setup-status"
```

---

## 健康检查与选优逻辑

- Cron 每 5 分钟自动探测一次（`HEAD`，失败则降级 `GET`）
- 超时默认 5 秒，可通过 `HEALTH_TIMEOUT_MS` 调整
- 优先选择「健康且延迟最低」的上游
- 尚无健康数据时按配置顺序轮询（不退化到只用第一个）
- 全部不健康时 fail-open，退回第一个上游
- 单次请求最多重试 3 个上游
- `latency = -1` 表示探测超时

---

## Cloudflare 优选 IP 说明

`src/cf-ips.js` 内置亚太、欧洲、美国三组优选 IP，每次请求随机选取一个（或通过 `CF_IP_INDEX` 固定）。

**适用场景**：你的上游挂在 Cloudflare，可以通过指定优选节点 IP + 保留原始 `Host` header 减少跨区绕路。

**注意**：若上游 HTTPS 证书不支持直接 IP 建连，需配合自己的 SNI 方案。优选 IP 不可用时自动 fallback 到原始域名直连。

---

## 与 Nginx-X 配合使用

| 角色 | 工具 |
|------|------|
| 源站 / 服务器侧 Nginx 运维 | **Nginx-X** |
| 公网入口代理 / 上游健康切换 | **Nginx-CF** |

两者组合：Nginx-X 管理本机 Nginx，Nginx-CF 作为 Cloudflare 边缘层做入口代理和健康切换。

---

## 常见问题

**Q：首次访问 `/_admin` 没有出现向导，而是显示登录页？**
A：说明 Worker 检测到 `ADMIN_TOKEN` 环境变量已设置（视为已初始化），或 KV 中已有 `setup_done` 标记。可以用已设置的 token 登录，或清空 KV 后重新访问。

**Q：忘记管理员密码怎么办？**
A：进入 Cloudflare Dashboard → Workers KV → 找到你的命名空间 → 删除 `admin_token` 和 `setup_done` 这两个 key，然后重新访问 `/_admin` 走一遍向导。

**Q：没有创建 KV 可以用吗？**
A：可以。没有 KV 时会以内存模式运行，面板顶部会显示「KV 内存模式」提示。功能完整，但 Worker 重启后配置会丢失。建议生产环境绑定 KV。

**Q：部署后访问 `/_admin` 显示 `Setup requires KV binding`？**
A：向导需要 KV 来保存初始化数据。请先完成第二、三、五步（创建并绑定 KV），或者直接在 Cloudflare 控制台 Settings → Variables 里设置 `ADMIN_TOKEN` 和 `UPSTREAMS` 跳过向导。

**Q：Cron 触发器配置后没有自动检查？**
A：Cron 触发器需要在 Cloudflare Dashboard 的 Worker 项目 → Settings → Triggers 里手动添加 `*/5 * * * *`，确认已添加。也可以在管理面板点「立即健康检查」手动触发。
