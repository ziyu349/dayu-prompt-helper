# 大鱼提示词助手部署说明

## 推荐方式：Render

这个工具包含前端页面和 Node.js 后端。AI 增强需要后端保存 `DEEPSEEK_API_KEY`，不要部署成纯静态网页。

### 1. 上传代码

把本文件夹上传到 GitHub 仓库，或在 Render 创建服务时直接连接这个项目仓库。

### 2. 创建 Render Web Service

在 Render 新建 `Web Service`：

- Runtime: `Node`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`

如果 Render 识别到 `render.yaml`，可以直接按配置创建。

### 3. 配置环境变量

在 Render 的 Environment 里添加：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API Key
DEEPSEEK_MODEL=deepseek-v4-flash
```

不要把 API Key 写入 `index.html`、`script.js` 或 GitHub 仓库。

### 4. 部署后检查

部署完成后打开：

```text
https://你的服务域名.onrender.com/health
```

看到下面结果说明后端正常：

```json
{
  "ok": true,
  "service": "dayu-prompt-helper",
  "aiConfigured": true
}
```

然后打开服务首页，把链接发给别人即可。

## Railway 部署

Railway 也可以直接部署：

- Build Command: `npm install`
- Start Command: `npm start`
- Variables:
  - `DEEPSEEK_API_KEY`
  - `DEEPSEEK_MODEL=deepseek-v4-flash`

Railway 会自动注入 `PORT`，项目会读取这个端口启动。

## 上线注意事项

- 建议先小范围分享，避免 API Key 被大量消耗。
- 如果公开给很多人使用，建议后续加登录、访问密码或调用次数限制。
- 你的 DeepSeek Key 只应该放在服务器环境变量里。
