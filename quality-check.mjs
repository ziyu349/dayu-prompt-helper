const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:8899";

const analyzeCases = [
  {
    name: "emotion-story",
    brief: "一个女孩在医院冷库里，开始以为是恶作剧，后来发现是真的，最后绝望流泪。",
    expect: { stageMode: "full", look: ["cinematic", "noir"] },
  },
  {
    name: "product-ad",
    brief: "一只机械手表放在黑色大理石桌面上，镜头缓慢推近，展示表盘齿轮和金属质感，高端广告。",
    expect: { stageMode: "none", look: "commercial", focus: "object" },
  },
  {
    name: "dance-action",
    brief: "一位美女在繁华街头跳舞，镜头跟随她的动作，画面有电影感。",
    expect: { stageMode: "none", focus: "body" },
  },
  {
    name: "tutorial-hands",
    brief: "咖啡师演示手冲咖啡，先倒入咖啡粉，再绕圈注水，最后咖啡滴落到壶中。",
    expect: { stageMode: "none", focus: "object" },
  },
  {
    name: "cooking-process",
    brief: "厨师在开放式厨房制作一道精致甜品，镜头拍摄搅拌奶油、摆盘和最后淋上酱汁。",
    expect: { stageMode: "none", focus: "object" },
  },
  {
    name: "real-estate-tour",
    brief: "清晨阳光照进现代客厅，镜头缓慢从沙发推到落地窗，展示空间通透感和高级装修。",
    expect: { stageMode: "none", focus: "object" },
  },
  {
    name: "product-texture",
    brief: "一瓶高端香水放在黑色镜面台上，水雾和背光突出玻璃瓶质感，商业广告。",
    expect: { stageMode: "none", look: "commercial", focus: "object" },
  },
];

async function post(path, payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} ${response.status}: ${data.error || "request failed"}`);
  }
  return data;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const testCase of analyzeCases) {
  const data = await post("/api/analyze", {
    brief: testCase.brief,
    model: "deepseek-v4-flash",
    duration: "15",
    outputFormat: "text",
  });
  for (const [key, expected] of Object.entries(testCase.expect)) {
    const pass = Array.isArray(expected)
      ? expected.includes(data.settings?.[key])
      : data.settings?.[key] === expected;
    assert(pass, `${testCase.name}: expected ${key}=${expected}, got ${data.settings?.[key]}`);
  }
  console.log(`PASS analyze ${testCase.name}`);
}

const seedance = await post("/api/enhance", {
  brief: "一位美女在繁华街头跳舞，镜头跟随她的动作，画面有电影感。",
  subject: "美女",
  setting: "繁华街头",
  appearance: "时尚服装，动作自然",
  action: "跳舞、转身、摆动",
  duration: "15",
  look: "电影级写实",
  focus: "身体动作",
  stageMode: "none",
  outputFormat: "seedance",
  model: "deepseek-v4-flash",
  extra: "不跳切，不换脸，不肢体错误",
  templateDraft: "",
  jsonDraft: {},
});

assert(seedance.prompt.includes("主体锁定"), "seedance: missing subject lock");
assert(/\[0s[-~]/.test(seedance.prompt), "seedance: missing timestamp shots");
assert(!/(CFG|ControlNet|sampler|采样器|steps|步数|SDXL|Stable Diffusion)/i.test(seedance.prompt), "seedance: contains irrelevant SD params");
assert(!/(切换至|镜头切换|焦段变化|硬切|更换镜头|35mm|50mm|85mm|光圈|快门|f\/)/i.test(seedance.prompt), "seedance: contains unstable camera or model-external terms");
console.log("PASS enhance seedance");

const jsonResult = await post("/api/enhance", {
  brief: "一只机械手表放在黑色大理石桌面上，高端广告。",
  subject: "机械手表",
  setting: "黑色大理石桌面",
  appearance: "金属表壳，镂空齿轮表盘",
  action: "镜头缓慢推近、展示表盘细节",
  duration: "15",
  look: "高级广告质感",
  focus: "手部与道具",
  stageMode: "none",
  outputFormat: "json",
  model: "deepseek-v4-flash",
  extra: "不要反光过曝，不要文字水印",
  templateDraft: "",
  jsonDraft: {},
});

JSON.parse(jsonResult.prompt.replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
console.log("PASS enhance json");
