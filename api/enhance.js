import { enhancePrompt, readJson, sendJson } from "./_prompt.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const input = await readJson(req);
    const result = await enhancePrompt(input);
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, error.message?.includes("有效 JSON") ? 400 : 500, {
      error: error.message || "AI生成失败",
    });
  }
}
