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

推荐生产环境绑定 Workers KV，这样管理员密码、Emby 上游、健康检查结果、优选 IP 都会持久保存，不会因为 Worker 重启丢失。

> Cloudflare 新版控制台里，KV 入口通常在：**构建 → 存储和数据库 → Workers KV**。

### 第一步：创建 KV 命名空间

1. 打开 Cloudflare Dashboard
2. 左侧进入 **构建 → 存储和数据库 → Workers KV**
3. 点击 **创建命名空间 / Create namespace**
4. 名称随便填，例如：`EMBY_CF_KV`
5. 创建完成后进入该 KV，可以看到「KV 对 / 设置」页面

注意：

- **不需要手动在 KV 里添加条目**
- 「密钥 / 值 / 添加条目」可以留空
- EMBY-CF 会自动写入需要的键值

### 第二步：把 KV 绑定到 Worker

1. 左侧进入 **构建 → 计算 → Workers 和 Pages**
2. 打开你的 EMBY-CF Worker / Pages 项目
3. 进入 **设置 / Settings**
4. 找到 **绑定 / Bindings**
5. 点击 **添加绑定 / Add binding**
6. 类型选择：**KV namespace / KV 命名空间**
7. 变量名必须填写：`KV`
8. KV 命名空间选择第一步创建的 `EMBY_CF_KV`
9. 保存并重新部署

关键点：

- 变量名必须是大写 `KV`
- KV 命名空间名称可以随便起
- 绑定后重新部署，管理面板右上角应显示 `KV ✓`

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
| `PREFERRED_IP` | — | 优选 IP / 优选代理，详见下方说明 |

## 优选 IP 使用说明

### 什么是优选 IP？

当你的 Emby 上游域名解析到 Cloudflare 节点时（即你的 Emby 开了 Cloudflare 代理），Cloudflare 全球有很多节点，不同节点对你的延迟差异很大。「优选 IP」就是用工具测出延迟最低的 Cloudflare 节点 IP，让请求强制走这个最快的 IP。

### 如何获取优选 IP

**工具推荐：**
- [CloudflareSpeedTest](https://github.com/XIU2/CloudflareSpeedTest)（最常用，开源）
- [CF-Workers-SpeedTest](https://github.com/cmliu/CF-Workers-SpeedTest)（在线测速版）

**步骤：**

1. 下载 [CloudflareSpeedTest](https://github.com/XIU2/CloudflareSpeedTest/releases) 对应你系统的版本
2. 运行测速：
   ```bash
   # Windows
   CloudflareST.exe

   # Linux / macOS
   ./CloudflareST
   ```
3. 程序会自动测试大量 CF IP，最终输出延迟最低的一组 IP
4. 取前 1–5 个延迟最低的 IP 备用

### 配置方法

得到优选 IP 后，有三种配置方式：

**方式一：管理面板配置（推荐）**

1. 打开 `https://你的Worker地址/_admin`
2. 登录管理面板
3. 在首页找到 **「优选 IP / 优选代理」** 配置框
4. 每行填写一个优选 IP、IP:端口或代理域名
5. 点击 **「保存优选 IP」**

示例：
```text
104.16.0.1
104.17.0.1
162.159.128.1
proxy.example.com:443
```

保存后立即生效。绑定 KV 时会持久保存；未绑定 KV 时只在当前 Worker 内存中临时生效，Worker 重启后会丢失。

注意：Cloudflare Workers 对直接 fetch IP 有限制。若填写的纯 IP 触发 Cloudflare `1003 Direct IP access not allowed`，EMBY-CF 会自动回退到原上游域名，避免 Emby 客户端登录失败。需要强制走优选线路时，建议填写可解析到优选 IP 的代理域名 / 中转域名。

**方式二：Cloudflare Dashboard 配置**

1. Cloudflare Dashboard → Workers & Pages → 你的 Worker
2. 点击 **Settings** → **Variables and Secrets**
3. 点击 **Add** ，添加环境变量：
   - **Variable name**: `PREFERRED_IP`
   - **Value**: 优选 IP 地址，多个用英文逗号分隔
4. 点击 **Save and deploy**

**示例内容：**
```
# 单个 IP
104.16.0.1

# 多个 IP，Worker 每次请求随机选一个
104.16.0.1,104.17.0.1,162.159.128.1

# 带端口（HTTPS 非标准端口时用）
104.16.0.1:8443

# 代理域名（中转代理）
proxy.example.com
```

**方式三：wrangler.toml 配置**

取注释 `wrangler.toml` 里的 `PREFERRED_IP` 行：
```toml
[vars]
PREFERRED_IP = "104.16.0.1,104.17.0.1"
```

### 与优选代理配合使用

如果你使用的是中转代理地址（而不是直接的 CF IP），同样填入 `PREFERRED_IP` 即可：
```
PREFERRED_IP = "你的代理地址:端口"
```

### 注意事项

- 优选 IP 适用于上游域名在 Cloudflare 上的场景，如果你的 Emby 是直连服务器 IP（没有过 CF）则不需要配置
- 多个 IP 是随机选一，如需固定用某个可设置 `CF_IP_INDEX`（从 0 开始）
- 优选 IP 默认不启用，不配置 `PREFERRED_IP` 就不会影响任何请求

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
