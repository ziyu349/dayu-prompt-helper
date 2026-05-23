import { getAiConfig, sendJson } from "./_prompt.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    service: "dayu-prompt-helper",
    aiConfigured: getAiConfig().configured,
  });
}
