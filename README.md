# 文生视频提示词扩写工具

这是一个文生视频提示词扩写工具，支持两种模式：

- 模板模式：纯前端，不需要联网、不需要账号。
- AI增强模式：通过后端调用 DeepSeek V4，把简单描述扩写成更细腻的文生视频提示词。

## 本地使用

如果只用模板模式，双击打开 `index.html`，输入简单的视频描述，点击“生成提示词”。

如果要用 AI增强模式，需要通过后端启动：

```bash
export DEEPSEEK_API_KEY="你的 DeepSeek API Key"
npm start
```

然后打开：

```text
http://localhost:8787
```

默认模型是 `deepseek-v4-flash`，也可以在网页里切换到 `deepseek-v4-pro`。

## 分享给别人

如果只分享模板模式，把整个文件夹发给别人即可，里面需要包含：

- `index.html`
- `styles.css`
- `script.js`

对方解压后双击 `index.html` 就能使用。

如果要分享 AI增强模式，不能把 API Key 写进前端文件。需要把这个项目部署到服务器，在服务器环境变量里配置 `DEEPSEEK_API_KEY`，再把网页链接发给别人。

## 放到网上

模板模式是静态网页，可以直接上传到 GitHub Pages、Netlify、Vercel、Cloudflare Pages 或任何普通网站空间。

AI增强模式需要支持 Node.js 后端的部署环境，例如 Render、Railway、Fly.io、Vercel Serverless、Cloudflare Workers 改造版或自己的服务器。

入口文件是 `index.html`。
