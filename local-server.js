import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 8787);
const apiKey = process.env.DEEPSEEK_API_KEY;
const defaultModel = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function buildSystemPrompt() {
  return `你是专业的文生视频提示词导演和镜头调度专家。
你的任务是把用户的简单描述扩写成中文视频生成提示词。
必须输出完整成品，不要解释，不要寒暄。

当输出格式为 text 时，必须使用以下结构：
【环境与摄影设定】
【人物设定】
【连续动作与表情调度】
【微表情与动作重点】
【镜头语言与限制】
【负面约束】

当输出格式为 json 时，只输出合法 JSON，不要 Markdown 代码块，不要解释。
当输出格式为 seedance 时，必须输出【Seedance 2.0专用提示词】，使用主体锁定、场景与风格、时间码分镜、镜头控制、画面稳定约束、输出参数建议。
当输出格式为 both 时，先输出【文案提示词】，再输出【Seedance 2.0专用】，最后输出【JSON结构】。

写法要求：
1. 强化电影质感、摄影机、镜头焦段、色调、光线、景深、背景。
2. 人物设定要稳定，避免换脸、换衣服、身份漂移。
3. 按时间轴拆分动作和情绪，必须写清楚每个阶段的秒数。
4. 多写可被画面表现的微表情，不要只写抽象情绪。
5. 重点控制连续镜头、焦点、镜头推进、景别变化。
6. 表演真实克制，避免夸张、卡通、跳切、突然换景。
7. 输出适合直接复制到文生视频工具。
8. Seedance 输出默认采用单镜头连续跟随；除非用户明确要求多镜头，不要写镜头切换、焦段变化、硬切或更换镜头。`;
}

function buildUserPrompt(input) {
  return `请基于下面信息，生成一个高控制力文生视频提示词。

用户简单描述：
${input.brief || "未填写"}

结构化信息：
- 主体人物：${input.subject || "请从简单描述推断"}
- 场景环境：${input.setting || "请从简单描述推断"}
- 服装外观：${input.appearance || "请从简单描述推断"}
- 核心动作：${input.action || "请从简单描述推断"}
- 视频时长：${input.duration || "15"}秒
- 画面质感：${input.look || "电影级写实"}
- 镜头焦点：${input.focus || "面部微表情"}
- 初始情绪：${input.emotionStart || "请从简单描述推断"}
- 中段情绪：${input.emotionMiddle || "请从简单描述推断"}
- 最终情绪：${input.emotionEnd || "请从简单描述推断"}
- 阶段模式：${input.stageMode || "full"}
- 输出格式：${input.outputFormat || "text"}
- 额外要求：${input.extra || "无"}

JSON结构草稿：
${input.jsonDraft ? JSON.stringify(input.jsonDraft, null, 2) : "无"}

参考模板草稿：
${input.templateDraft || "无"}

请在参考模板基础上进一步丰富，但不要偏离用户原意。
如果输出格式是 json，请保留清晰字段：prompt_type、visual_style、subject、scene、camera_control、stages、negative_constraints。
如果输出格式是 seedance，请把同一份设定改写成 Seedance 2.0 更稳定的结构：
1. 主体锁定写清楚，避免人物/服装/脸部漂移。
2. 时间码分镜使用 [0s-2s] 这种格式。
3. 每个时间段只写一个主要动作。
4. 镜头控制单独成段。
5. 画面稳定约束单独成段，加入不要跳切、不要换脸、不要肢体错误、不要闪烁、不要文字水印。
6. 不要编造用户没有提供的年龄、国籍、具体服装品牌、具体鞋子、具体身高。
6a. 如果用户只写“时尚服装”“休闲服装”“自然外观”等泛称，必须保留泛称，不要展开成连衣裙、高跟鞋、夹克、牛仔裤等具体款式。
7. 不要输出 Stable Diffusion / SDXL / ControlNet / CFG / sampler / steps 等无关参数。
8. 输出参数建议只允许包含：时长、画面比例、清晰度、镜头连续性、主体一致性。
9. Seedance 2.0 专用提示词默认优先稳定连续镜头。成品里不要出现“切换至”“镜头切换”“焦段变化”“更换镜头”“硬切”等词，即使是负面约束也不要写这些词。
10. 如需景别或视角变化，只能写“同一镜头内平滑推进、平滑跟随、轻微环绕、构图自然变化”。
11. 不要输出具体光圈、快门、35mm/50mm/85mm 焦段序列、CFG、采样器等模型外参数。`;
}

function extractJsonObject(text) {
  const cleaned = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("AI分析结果不是有效 JSON");
  }
}

function buildAnalysisPrompt(input) {
  return `你是文生视频提示词工具的“意图理解与设定规划”模块。
请读取用户的中文描述，识别并补全视频生成需要的关键设定。

只输出合法 JSON，不要 Markdown，不要解释。

字段要求：
{
  "settings": {
    "subject": "主体人物或主体对象",
    "setting": "场景环境",
    "appearance": "外观、服装、道具或主体质感",
    "action": "核心动作，用顿号分隔",
    "look": "cinematic|noir|soft|commercial|documentary",
    "focus": "face|eyes|body|object",
    "stageMode": "none|simple|full",
    "duration": 15,
    "emotionStart": "第一阶段状态",
    "emotionMiddle": "第二阶段状态",
    "impactEmotion": "第三阶段状态",
    "emotionEnd": "最终阶段状态",
    "extra": "负面约束",
    "reasoning": "一句话说明为什么这样设定"
  }
}

判断规则：
1. 如果描述是情绪短片、剧情反转、人物心理变化，stageMode 用 full。
2. 如果只有简单状态变化，stageMode 用 simple。
3. 如果是产品展示、场景漫游、教程、物体展示、动作展示，stageMode 用 none。
4. 如果描述包含产品、高端广告、商业广告、质感展示、品牌广告，look 优先用 commercial。
5. 如果描述是教程、手部操作、制作过程、咖啡制作、烹饪、倒入、注水、组装、产品展示、物体细节，focus 必须用 object，不要用 body。
6. 如果描述是跳舞、运动、身体动作，focus 优先用 body。
7. 如果描述是强情绪、哭泣、惊讶、恐惧、表情变化，focus 优先用 eyes 或 face。
8. look 必须从枚举中选最合适的一个。
9. focus 必须从枚举中选最合适的一个。
10. 不要编造离用户描述很远的剧情，只补充有助于视频稳定生成的摄影、场景和动作信息。
11. 不要生成最终提示词，最终提示词由工具根据 settings 统一生成。

用户描述：
${input.brief || "未填写"}

默认视频时长：${input.duration || 15}秒
输出格式偏好：${input.outputFormat || "text"}`;
}

async function callDeepSeek(messages, model, maxTokens = 2200) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.45,
      max_tokens: maxTokens,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || `DeepSeek 接口错误：${response.status}`);
  }
  return data.choices?.[0]?.message?.content?.trim() || "";
}

function sanitizeSeedancePrompt(prompt) {
  return String(prompt || "")
    .replace(/一位年轻女性/g, "一位女性")
    .replace(/一位\d+多岁[、，]?/g, "一位")
    .replace(/\d+多岁[、，]?/g, "")
    .replace(/亚洲女性/g, "女性")
    .replace(/亚洲面孔[，,]?/g, "")
    .replace(/长发[^，。\n]*[，,]?/g, "")
    .replace(/身材匀称[，,。]?/g, "")
    .replace(/面部轮廓清晰的/g, "")
    .replace(/自然妆容[、，,]?/g, "")
    .replace(/黑发[^，。\n]*[，,]?/g, "")
    .replace(/无眼镜、无夸张配饰[，,]?/g, "")
    .replace(/身高体型中等[，,]?/g, "")
    .replace(/肤色自然[，,。]?/g, "")
    .replace(/（上衣与裤装或裙装，颜色协调但非特定品牌）/g, "")
    .replace(/年轻女性/g, "女性主体")
    .replace(/年轻美女/g, "女性主体")
    .replace(/年轻女孩/g, "女孩")
    .replace(/[，,]?\s*身高约?\s*\d{2,3}(?:-\d{2,3})?cm/g, "")
    .replace(/[，,]?\s*年龄约?\s*\d{1,2}(?:-\d{1,2})?岁/g, "")
    .replace(/[，,]?\s*\d{1,2}(?:-\d{1,2})?岁/g, "")
    .replace(/裙摆或衣摆/g, "服装布料")
    .replace(/裙摆/g, "服装布料")
    .replace(/无硬切、无焦段变化、无镜头更换/g, "同一镜头连续完成，画面过渡顺滑")
    .replace(/禁止跳切、硬切、镜头更换、焦段瞬间变化。?/g, "画面全程连续顺滑，镜头运动稳定自然。")
    .replace(/无切换/g, "全程连续")
    .replace(/无硬切/g, "画面连续顺滑")
    .replace(/硬切/g, "突然断开")
    .replace(/焦段变化/g, "镜头参数突变")
    .replace(/焦段瞬间变化/g, "镜头参数突变")
    .replace(/镜头切换/g, "画面断开")
    .replace(/更换镜头/g, "画面断开")
    .replace(/\b(35mm|50mm|85mm)\b/gi, "固定焦段")
    .replace(/光圈[^，。\n]*/g, "清晰稳定")
    .replace(/快门[^，。\n]*/g, "运动自然")
    .replace(/Stable Diffusion|SDXL|ControlNet|CFG|sampler|steps/gi, "")
    .replace(/采样器|步数/g, "")
    .replace(/^\s*[-*]?\s*(模型参数|生成参数|技术参数)[：:].*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeAnalyzedSettings(settings, input) {
  const normalized = { ...(settings || {}) };
  const text = `${input.brief || ""} ${normalized.subject || ""} ${normalized.action || ""} ${normalized.setting || ""}`;
  const hasAny = (patterns) => patterns.some((pattern) => pattern.test(text));

  if (hasAny([/产品|商品|广告|品牌|高端|质感|材质|香水|手表|表盘|齿轮|玻璃瓶|金属/])) {
    normalized.stageMode = "none";
    normalized.focus = "object";
    normalized.look = "commercial";
  }

  if (hasAny([/教程|演示|制作|手冲|咖啡|厨师|烹饪|搅拌|倒入|注水|摆盘|组装|道具|物体|空间|客厅|装修|落地窗/])) {
    normalized.stageMode = "none";
    normalized.focus = "object";
  }

  if (hasAny([/跳舞|舞蹈|运动|跑步|打球|瑜伽|健身|身体动作|转身|摆动/])) {
    normalized.stageMode = "none";
    normalized.focus = "body";
  }

  if (hasAny([/崩溃|绝望|恐惧|哭|流泪|惊讶|发现是真的|恶作剧|情绪|反转|心理/])) {
    normalized.stageMode = "full";
    if (!["face", "eyes"].includes(normalized.focus)) normalized.focus = "eyes";
    if (!["cinematic", "noir"].includes(normalized.look)) normalized.look = "cinematic";
  }

  return normalized;
}

async function analyzeSettings(req, res) {
  if (!apiKey) {
    sendJson(res, 500, { error: "后端未配置 DEEPSEEK_API_KEY" });
    return;
  }

  let input;
  try {
    input = JSON.parse(await readBody(req));
  } catch {
    sendJson(res, 400, { error: "请求内容不是有效 JSON" });
    return;
  }

  try {
    const model = input.model || defaultModel;
    const content = await callDeepSeek(
      [
        { role: "system", content: "你只输出合法 JSON。不要输出 Markdown 代码块。" },
        { role: "user", content: buildAnalysisPrompt(input) },
      ],
      model,
      1800,
    );
    const parsed = extractJsonObject(content);
    const settings = normalizeAnalyzedSettings(parsed.settings || {}, input);
    sendJson(res, 200, {
      model,
      settings,
      prompt: parsed.prompt || "",
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "AI分析失败" });
  }
}

async function enhancePrompt(req, res) {
  if (!apiKey) {
    sendJson(res, 500, { error: "后端未配置 DEEPSEEK_API_KEY" });
    return;
  }

  let input;
  try {
    input = JSON.parse(await readBody(req));
  } catch {
    sendJson(res, 400, { error: "请求内容不是有效 JSON" });
    return;
  }

  const model = input.model || defaultModel;
  try {
    const rawPrompt = await callDeepSeek(
      [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(input) },
      ],
      model,
      2200,
    );
    const prompt = input.outputFormat === "seedance" || input.outputFormat === "both"
      ? sanitizeSeedancePrompt(rawPrompt)
      : rawPrompt;

    sendJson(res, 200, { model, prompt });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "AI生成失败" });
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(decodeURIComponent(pathname))
    .replace(/^[/\\]+/, "")
    .replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);

  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, {
        ok: true,
        service: "dayu-prompt-helper",
        aiConfigured: Boolean(apiKey),
      });
      return;
    }

    if (req.method === "POST" && req.url === "/api/enhance") {
      await enhancePrompt(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/analyze") {
      await analyzeSettings(req, res);
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      await serveStatic(req, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "服务器错误" });
  }
});

server.listen(port, () => {
  console.log(`Prompt tool running at http://localhost:${port}`);
});
