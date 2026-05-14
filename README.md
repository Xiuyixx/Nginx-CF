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

## 部署方式一：Cloudflare 控制台（推荐新手，全程不需要命令行）

这套流程完全在浏览器里完成，不需要安装任何工具，跟着步骤一步一步做就行。

### 准备工作

在开始之前，你需要准备好以下内容：

1. **Cloudflare 账号**：没有的话去 [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) 免费注册一个，填邮箱和密码即可，不需要绑定域名
2. **GitHub 账号**：用来 Fork 本项目。没有的话去 [github.com](https://github.com) 免费注册
3. **上游服务器地址**：也就是你真正的后端服务地址，例如 `https://your-server.example.com`

---

### 第一步：Fork 本项目到你的 GitHub

Fork 的意思是把这个项目复制一份到你自己的 GitHub 账号下，这样 Cloudflare 才能读取你的代码来部署。

1. 打开本项目页面：[github.com/Xiuyixx/Nginx-CF](https://github.com/Xiuyixx/Nginx-CF)
2. 点击页面右上角的 **Fork** 按钮
3. 在弹出的页面中，直接点击 **Create fork**
4. 稍等几秒，你的 GitHub 账号下就会出现一个同名的仓库副本，例如 `你的用户名/Nginx-CF`

> Fork 完成后，后续所有配置修改都在你自己的仓库里进行，不会影响原项目。

---

### 第二步：修改配置文件

在部署之前，需要先在你 Fork 的仓库里填好配置。

1. 打开你 Fork 的仓库（`github.com/你的用户名/Nginx-CF`）
2. 点击仓库文件列表中的 **`wrangler.toml`** 文件
3. 点击右上角的铅笔图标（✏️）进入编辑模式
4. 找到 `[vars]` 部分，修改以下内容：

```toml
[vars]
UPSTREAMS = "https://你的服务器地址.com"        # 替换成你的真实上游地址，多个地址用英文逗号分隔
ADMIN_TOKEN = "请改成一个随机的长密码"            # 用于保护管理 API，不要用默认值
USE_CF_IPS = "false"                           # 暂时不需要优选 IP 的话保持 false
PREFERRED_REGION = "apac"                      # 地区：apac（亚太）/ europe / us
```

5. 修改完成后，滚动到页面底部，点击 **Commit changes**，再点击 **Commit changes** 确认保存

> ⚠️ **安全提示**：`ADMIN_TOKEN` 一定要改成自己设定的强密码，否则任何人都能调用你的管理接口。

---

### 第三步：创建 Workers KV 命名空间

KV 是 Cloudflare 提供的键值存储，用来保存上游列表和健康检查结果。

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 在左侧菜单中，点击 **Workers & Pages**，再点击 **KV**
3. 点击右上角 **Create a namespace**
4. 名称填写 `KV`，点击 **Add** 创建
5. 创建成功后，在列表中可以看到这个命名空间，旁边有一串 **ID**（形如 `a1b2c3d4...`）
6. **复制这个 ID**，后面第四步要用到

---

### 第四步：在 GitHub 仓库里填入 KV 的 ID

1. 回到你 Fork 的 GitHub 仓库
2. 再次打开 `wrangler.toml` 文件，点击铅笔图标编辑
3. 找到以下这段内容：

```toml
[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_NAMESPACE_ID"
```

4. 把 `YOUR_KV_NAMESPACE_ID` 替换成第三步复制的 KV 命名空间 ID
5. 滚动到底部，点击 **Commit changes** 保存

---

### 第五步：将项目连接到 Cloudflare Pages 并部署

Cloudflare Pages 可以直接读取你 GitHub 仓库的代码，自动构建并部署为 Worker。

1. 在 Cloudflare Dashboard 左侧点击 **Workers & Pages**
2. 点击 **Create application**，选择 **Pages** 标签
3. 点击 **Connect to Git**
4. 选择 **GitHub**，授权 Cloudflare 访问你的 GitHub 账号
5. 在仓库列表中找到并选择 **Nginx-CF**，点击 **Begin setup**
6. 在构建配置页面，填写以下内容：
   - **Project name**：随意起名，例如 `nginx-cf`
   - **Production branch**：选 `main`
   - **Build command**：填 `npm run build`（如果没有 build 脚本，留空也可以）
   - **Build output directory**：留空
7. 点击 **Save and Deploy**，等待部署完成（通常 1~2 分钟）

> 如果部署失败，可以尝试改用下面的「直接创建 Worker」方式（见备选方案）。

---

### 第六步：绑定 KV 命名空间到 Worker

部署完成后，还需要让 Worker 能访问第三步创建的 KV。

1. 在 Cloudflare Dashboard，进入 **Workers & Pages** → 找到你刚部署的项目，点击进入
2. 点击顶部的 **Settings** 标签
3. 找到 **Bindings** 区域，点击 **Add** → 选择 **KV namespace**
4. 填写：
   - **Variable name**：`KV`（必须完全一致，区分大小写）
   - **KV namespace**：从下拉列表中选择第三步创建的 `KV`
5. 点击 **Save** 保存

---

### 第七步：配置 Cron 触发器（自动健康检查）

这一步让 Worker 每 5 分钟自动探测一次上游是否可用。

1. 在 Worker 项目页面，点击 **Settings** → **Triggers**（或 **Cron Triggers**）
2. 点击 **Add Cron Trigger**
3. 在输入框中填写：`*/5 * * * *`
4. 点击 **Add Trigger** 保存

---

### 第八步：绑定自定义域名（可选）

默认情况下，你的 Worker 会分配一个 `*.workers.dev` 的地址，可以直接使用。如果你想用自己的域名（例如 `proxy.example.com`），需要满足以下条件：该域名已经托管在 Cloudflare（即已添加到你的 Cloudflare 账号并将 DNS 解析交给 Cloudflare 管理）。

1. 进入 Worker 项目页面，点击 **Settings** → **Domains & Routes**
2. 点击 **Add** → 选择 **Custom domain**
3. 输入你的域名，例如 `proxy.example.com`
4. 点击 **Add Custom Domain** 确认

Cloudflare 会自动配置好 DNS，通常几分钟内生效。

---

### 验证是否部署成功

打开浏览器，访问你的 Worker 地址（形如 `https://nginx-cf.你的账号.workers.dev`），如果页面能正常打开，说明基本部署成功。

进一步验证管理接口是否工作，可以用以下方式：

**方式 A（推荐新手）**：在浏览器地址栏访问
```
https://nginx-cf.你的账号.workers.dev/_admin/status
```
会提示需要鉴权（返回 401），这是正常的，说明接口已上线。

**方式 B（命令行）**：
```bash
curl -sS "https://nginx-cf.你的账号.workers.dev/_admin/status" \
  -H "X-Admin-Token: 你设置的ADMIN_TOKEN"
```

返回类似以下内容则说明一切正常：

```json
{
  "upstreams": [
    {
      "url": "https://你的服务器.com",
      "healthy": true,
      "latency": 98,
      "lastCheck": "2026-05-14T01:00:00.000Z",
      "status": 200
    }
  ]
}
```

---

### 备选方案：直接在控制台粘贴代码

如果不想用 Pages 连接 GitHub，也可以直接手动创建 Worker 并粘贴代码：

1. 在 Cloudflare Dashboard，进入 **Workers & Pages** → **Create application** → **Create Worker**
2. 给 Worker 起个名字（例如 `nginx-cf`），点击 **Deploy**
3. 部署后点击 **Edit code** 进入在线编辑器
4. 在编辑器左侧文件树中，点击 `+` 按钮新建 `src/` 文件夹
5. 在 `src/` 下依次新建以下文件，并将 GitHub 仓库中对应文件的内容**完整复制粘贴**进去：
   - `src/index.js`
   - `src/proxy.js`
   - `src/upstream.js`
   - `src/config.js`
   - `src/cf-ips.js`
   - `src/admin-ui.js`
6. 点击编辑器右上角 **Save and deploy**
7. 然后继续执行上面的第六、七、八步（绑定 KV、配置 Cron、绑定域名）

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
