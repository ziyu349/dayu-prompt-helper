const form = document.querySelector("#promptForm");
const fields = {
  brief: document.querySelector("#brief"),
  subject: document.querySelector("#subject"),
  setting: document.querySelector("#setting"),
  appearance: document.querySelector("#appearance"),
  action: document.querySelector("#action"),
  duration: document.querySelector("#duration"),
  look: document.querySelector("#look"),
  focus: document.querySelector("#focus"),
  mode: document.querySelector("#mode"),
  model: document.querySelector("#model"),
  stageMode: document.querySelector("#stageMode"),
  outputFormat: document.querySelector("#outputFormat"),
  autoAnalyze: document.querySelector("#autoAnalyze"),
  emotionStart: document.querySelector("#emotionStart"),
  emotionMiddle: document.querySelector("#emotionMiddle"),
  impactEmotion: document.querySelector("#impactEmotion"),
  emotionEnd: document.querySelector("#emotionEnd"),
  extra: document.querySelector("#extra"),
};

const output = document.querySelector("#output");
const statusEl = document.querySelector("#status");
const sampleBtn = document.querySelector("#sampleBtn");
const clearBtn = document.querySelector("#clearBtn");
const copyBtn = document.querySelector("#copyBtn");
const regenerateBtn = document.querySelector("#regenerateBtn");
const analyzeBtn = document.querySelector("#analyzeBtn");
const analysisSummary = document.querySelector("#analysisSummary");
const resultCard = document.querySelector(".result-card");
const loadingOverlay = document.querySelector("#loadingOverlay");
const loadingTitle = document.querySelector("#loadingTitle");
const loadingText = document.querySelector("#loadingText");
const briefCount = document.querySelector("#briefCount");
const wordCount = document.querySelector("#wordCount");
const presetCards = [...document.querySelectorAll(".preset-card")];
const modeTabs = [...document.querySelectorAll(".mode-tab")];
const builderPanel = document.querySelector("#promptForm");
let analyzeTimer = null;
let isAnalyzing = false;
let lastAnalyzedBrief = "";

const lookPresets = {
  cinematic: {
    camera: "ARRI Alexa 65",
    lens: "50mm",
    tone: "冷峻的蓝灰色调，带有青橙色调的冷极对比",
    light: "顶部微弱刺眼的冷白色荧光灯",
    texture: "电影级质感，写实、克制、压抑",
    background: "背景保持轻微虚化，空间有真实空气感",
  },
  soft: {
    camera: "ARRI Alexa Mini LF",
    lens: "65mm",
    tone: "柔和低饱和色调，肤色自然，暗部保留细节",
    light: "侧前方柔光，边缘有轻微轮廓光",
    texture: "电影级唯美写实质感，细腻、安静、情绪化",
    background: "背景柔和虚化，层次干净",
  },
  noir: {
    camera: "Sony Venice 2",
    lens: "40mm",
    tone: "低照度暗调，高反差阴影，局部冷色高光",
    light: "狭窄方向性的顶光与侧逆光",
    texture: "悬疑电影质感，紧张、克制、危险感强",
    background: "背景沉入暗部，只保留关键轮廓",
  },
  commercial: {
    camera: "RED V-Raptor",
    lens: "50mm",
    tone: "高级低饱和商业色调，清透但不过曝",
    light: "柔和主光配合干净轮廓光",
    texture: "高级广告质感，画面干净、精致、稳定",
    background: "背景简洁虚化，主体清晰突出",
  },
  documentary: {
    camera: "手持纪录片摄影机",
    lens: "35mm",
    tone: "自然写实色彩，保留环境杂色和真实光比",
    light: "现场自然光与环境光",
    texture: "纪录片真实感，轻微手持呼吸，表演自然",
    background: "背景保留现场信息，但不抢主体",
  },
};

const focusMap = {
  face: "面部微表情",
  eyes: "眼神变化与眼眶细节",
  body: "身体姿态、肩颈紧绷和呼吸节奏",
  object: "手部动作、道具触碰和局部细节",
};

const sample = {
  brief:
    "一个年轻女孩在医院冷库里，开始以为是恶作剧，露出不相信的浅笑。她环顾四周，发现医生和警察都很严肃，笑容慢慢消失，最后被现实击垮，绝望流泪。",
  subject: "清纯美丽的年轻女孩",
  setting: "冰冷压抑的医院冷库房间",
  appearance: "侧边麻花辫，浅米色吊带连衣裙，气质干净美好",
  action: "低头浅笑、左右环顾、抬头确认、低头沉默、眼眶泛红落泪",
  emotionStart: "难以置信的防御性浅笑",
  emotionMiddle: "尴尬、不安、慌乱和局促",
  emotionEnd: "绝望感彻底击中身体，情绪防线崩溃",
  extra: "15秒连续镜头，不跳切，不要夸张表演，最后缓慢推至极致特写",
};

function valueOf(key) {
  return fields[key].value.trim();
}

function syncUiStats() {
  if (briefCount) briefCount.textContent = `${fields.brief.value.length} / 300`;
  if (wordCount) wordCount.textContent = output.value.trim().length.toLocaleString("zh-CN");
}

function firstUseful(...items) {
  return items.find((item) => item && item.trim())?.trim() || "";
}

function setBusy(isBusy, title = "AI 正在处理", text = "正在理解你的描述并生成高控制力提示词") {
  resultCard?.classList.toggle("is-loading", isBusy);
  statusEl.classList.toggle("is-loading", isBusy);
  if (loadingOverlay) loadingOverlay.setAttribute("aria-hidden", String(!isBusy));
  if (loadingTitle) loadingTitle.textContent = title;
  if (loadingText) loadingText.textContent = text;
  [analyzeBtn, regenerateBtn, copyBtn, document.querySelector("#generateBtn")].forEach((button) => {
    if (button) button.disabled = isBusy;
  });
}

function inferSubject(brief) {
  const match = brief.match(/(?:一个|一位|这位|这个)?([^，。,.]{2,18}(?:女孩|男孩|女人|男人|老人|孩子|学生|医生|警察|母亲|父亲|店主|客人|少年|少女))/);
  return match?.[1] || "";
}

function inferSetting(brief) {
  const patterns = [
    /在([^，。,.]{2,24}(?:里|中|内|房间|街道|餐厅|办公室|医院|学校|车里|海边|雨夜))/,
    /环境是([^，。,.]{2,24})/,
    /场景是([^，。,.]{2,24})/,
  ];
  for (const pattern of patterns) {
    const match = brief.match(pattern);
    if (match) return match[1];
  }
  return "";
}

function inferAction(brief) {
  const verbs = ["看", "笑", "哭", "跑", "走", "抬头", "低头", "回头", "环顾", "握住", "放下", "转身", "沉默", "流泪", "颤抖"];
  const found = verbs.filter((verb) => brief.includes(verb));
  return found.length ? found.join("、") : "";
}

function splitActions(actionText) {
  return actionText
    .split(/[、,，/；;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildTimeline(duration) {
  const total = Number(duration);
  if (total <= 6) return [0, 1.5, 3.5, total];
  if (total <= 8) return [0, 2, 5, total];
  if (total <= 10) return [0, 2, 6, total];
  return [0, 2, 5, 9, total];
}

function formatTime(value) {
  return Number.isInteger(value) ? String(value) : String(value).replace(".5", ".5");
}

function withPersonPrefix(subject) {
  return /^(一位|一个|一名|这位|这个)/.test(subject) ? subject : `一位${subject}`;
}

function isHumanSubject(subject) {
  return /(人|女孩|男孩|女人|男人|美女|帅哥|老人|孩子|学生|医生|警察|母亲|父亲|咖啡师|舞者|演员|模特|店主|客人|少年|少女)/.test(subject);
}

function subjectLabel(subject) {
  return isHumanSubject(subject) ? withPersonPrefix(subject) : subject;
}

function lightTarget(subject, focus) {
  if (focus.includes("面部") || focus.includes("眼神")) return `打在${subjectLabel(subject)}的脸部与眼睛上`;
  if (focus.includes("手部") || focus.includes("道具")) return `强调${subject}的手部动作、道具边缘和材质细节`;
  if (focus.includes("身体")) return `勾勒${subjectLabel(subject)}的身体轮廓、动作线条和运动轨迹`;
  return `强调${subject}的关键轮廓、材质和空间层次`;
}

function enrichPrompt() {
  const brief = valueOf("brief");
  const preset = lookPresets[valueOf("look")];
  const subject = firstUseful(valueOf("subject"), inferSubject(brief), "核心人物");
  const setting = firstUseful(valueOf("setting"), inferSetting(brief), "符合剧情的真实场景");
  const appearance = firstUseful(valueOf("appearance"), "外观干净自然，服装贴合人物身份");
  const action = firstUseful(valueOf("action"), inferAction(brief), "观察、停顿、表情变化、情绪爆发");
  const emotionStart = firstUseful(valueOf("emotionStart"), "克制的初始情绪");
  const emotionMiddle = firstUseful(valueOf("emotionMiddle"), "情绪逐渐动摇和失控");
  const emotionEnd = firstUseful(valueOf("emotionEnd"), "最终情绪彻底爆发");
  const stageMode = valueOf("stageMode");
  const extra = valueOf("extra");
  const focus = focusMap[valueOf("focus")];
  const actions = splitActions(action);
  const times = buildTimeline(valueOf("duration"));
  const total = Number(valueOf("duration"));

  const firstAction = actions[0] || "保持静止并观察画面外";
  const secondAction = actions[1] || actions[0] || "出现细微迟疑";
  const thirdAction = actions[2] || "试图确认眼前发生的事情";
  const fourthAction = actions[3] || "沉默低头，情绪明显下坠";
  const finalAction = actions[4] || actions[actions.length - 1] || "情绪彻底释放";

  const sections = [
    `【环境与摄影设定】
${preset.texture}，使用 ${preset.camera} 拍摄，${preset.lens} 镜头。
整体色调为${preset.tone}，环境是${setting}。
光线来自${preset.light}，${lightTarget(subject, focus)}。
${preset.background}，景深极浅，背景只保留氛围和空间轮廓。
视觉焦点始终锁定在${focus}上，避免无意义的镜头漂移。`,

    `【人物设定】
${subjectLabel(subject)}。
${appearance}。
${isHumanSubject(subject) ? "人物的第一印象要清晰，气质、年龄感、身份感都要稳定，不要在镜头中改变长相或服装。" : "主体的形态、材质、位置和比例要稳定，不要在镜头中变形、漂移或替换。"}`,

    stageMode === "none" ? `【${total}秒连续动作与镜头调度】` : `【${total}秒连续动作与表情调度】`,
  ];

  if (stageMode === "none") {
    sections.push(`（0-${total}秒：连续动作与镜头控制）
镜头围绕${subject}展开，重点呈现${action}。
动作节奏自然连贯，不强行设计情绪转折，不制造无意义的戏剧化变化。
画面从稳定的中近景开始，逐渐把视觉注意力引导到${focus}。
人物状态保持一致，所有动作都服务于“${brief || `${subject}在${setting}中的连续画面`}”。`);
  } else if (stageMode === "simple") {
    sections.push(`（${times[0]}-${times[2]}秒：${emotionStart}）
镜头从正面或略侧面的中近景拍摄${subject}。
她/他${firstAction}，动作自然克制，表情和身体状态保持稳定。
视觉焦点集中在${focus}，背景只提供场景信息。`);

    sections.push(`（${times[2]}-${total}秒：${emotionEnd}）
她/他${finalAction}，状态从前一阶段自然过渡到最终状态。
不要出现突兀跳变，嘴角、眼神、眉头、呼吸和身体姿态只做符合剧情的细微变化。
最后镜头缓慢推进或稳定停留在${focus}。`);
  } else if (times.length === 5) {
    sections.push(`（${times[0]}-${times[1]}秒：${emotionStart}）
镜头从正面特写${subject}，画面稳定，呼吸感很轻。
她/他${firstAction}，起初像是在压住真实情绪。
嘴角、眼神和眉头只出现轻微变化，不要夸张表演，重点表现${focus}。`);

    sections.push(`（${times[1]}-${times[2]}秒：${emotionMiddle}开始浮现）
她/他${secondAction}，表情突然短暂凝固。
眼神开始游移，迅速看向画面外或周围环境，试图确认局势。
面部肌肉略微紧绷，呼吸变浅，原本的表情开始不稳定。`);

    sections.push(`（${times[2]}-${times[3]}秒：现实冲击）
她/他${thirdAction}，情绪从内部慢慢压上来。
眼睛重新落回前方，脸上的伪装表情逐渐消失。
嘴角放松下坠，眉头轻微收紧，下巴出现不受控制的细小颤动。`);

    sections.push(`（${times[3]}-${times[4]}秒：${emotionEnd}）
她/他${fourthAction}，随后${finalAction}。
眼眶迅速泛红，泪光覆盖眼里的高光，呼吸开始微微颤抖。
情绪由内而外浮现，泪水顺着脸颊滑落，眼神里充满压抑、心碎和无法逃避的痛感。
最后镜头缓慢推至极致特写，只保留${focus}和最细微的表情变化。`);
  } else {
    sections.push(`（${formatTime(times[0])}-${formatTime(times[1])}秒：${emotionStart}）
镜头从正面特写${subject}，她/他${firstAction}。
表情克制，情绪只通过${focus}轻微浮现。`);

    sections.push(`（${formatTime(times[1])}-${formatTime(times[2])}秒：${emotionMiddle}）
她/他${secondAction}，随后${thirdAction}。
眼神开始变化，眉头和嘴角出现细微失控，呼吸变浅。`);

    sections.push(`（${formatTime(times[2])}-${formatTime(times[3])}秒：${emotionEnd}）
她/他${finalAction}，情绪最终爆发。
面部肌肉松动，眼眶泛红，泪光或情绪高光覆盖眼睛。
最后镜头缓慢推进，锁定${focus}。`);
  }

  if (stageMode === "none") {
    sections.push(`【动作与节奏重点】
不要强行加入情绪递进，重点表现“${action}”的动作节奏、身体重心、姿态变化、运动轨迹和画面连续性。
动作要自然、流畅、符合真实物理惯性；镜头跟随要稳定，不要突然跳切或改变主体位置。
所有动作都要服务于“${brief || `${subject}在${setting}中的连续动作展示`}”。`);
  } else {
    sections.push(`【微表情与动作重点】
不要只表现“${emotionEnd}”这个抽象情绪，要通过可见细节呈现：
嘴角轻微上扬或下坠、笑容凝固、眼神游移、瞳孔微动、眉头收紧、下巴颤抖、肩颈僵硬、呼吸变浅、眼眶泛红、泪光聚集或泪水滑落。
所有动作都要服务于“${brief || `${subject}在${setting}中经历${emotionStart}到${emotionEnd}的变化`}”。`);
  }

  sections.push(`【镜头语言与限制】
全程保持连续镜头，不要跳切，不要突然换景，不要改变人物身份。
镜头运动以缓慢推进为主，画面稳定，焦点始终锁定${focus}。
背景只提供环境压力和空间信息，不要抢走主体注意力。
表演真实、克制、细腻，避免夸张哭喊、夸张肢体动作和卡通化表情。`);

  if (extra) {
    sections.push(`【额外要求】
${extra}`);
  }

  return sections.join("\n\n");
}

function buildPromptJson() {
  const brief = valueOf("brief");
  const preset = lookPresets[valueOf("look")];
  const subject = firstUseful(valueOf("subject"), inferSubject(brief), "核心人物");
  const setting = firstUseful(valueOf("setting"), inferSetting(brief), "符合剧情的真实场景");
  const action = firstUseful(valueOf("action"), inferAction(brief), "观察、停顿、表情变化、情绪表达");
  const total = Number(valueOf("duration"));
  const stageMode = valueOf("stageMode");
  const focus = focusMap[valueOf("focus")];

  const stages =
    stageMode === "none"
      ? [
          {
            time: `0-${total}s`,
            type: "continuous_action",
            goal: "不使用情绪递进，只控制动作、镜头和画面质感",
            action,
            focus,
          },
        ]
      : stageMode === "simple"
        ? [
            {
              time: "0-5s",
              type: "start_state",
              emotion_or_action: firstUseful(valueOf("emotionStart"), "初始状态"),
            },
            {
              time: `5-${total}s`,
              type: "end_state",
              emotion_or_action: firstUseful(valueOf("emotionEnd"), "最终状态"),
            },
          ]
        : [
            {
              time: "0-2s",
              type: "stage_1",
              emotion_or_action: firstUseful(valueOf("emotionStart"), "初始状态"),
            },
            {
              time: "2-5s",
              type: "stage_2",
              emotion_or_action: firstUseful(valueOf("emotionMiddle"), "中段变化"),
            },
            {
              time: "5-9s",
              type: "stage_3",
              emotion_or_action: firstUseful(valueOf("impactEmotion"), "关键冲击"),
            },
            {
              time: `9-${total}s`,
              type: "stage_4",
              emotion_or_action: firstUseful(valueOf("emotionEnd"), "最终状态"),
            },
          ];

  return {
    prompt_type: "text_to_video",
    language: "zh-CN",
    brief,
    duration_seconds: total,
    visual_style: {
      preset: fields.look.options[fields.look.selectedIndex].text,
      texture: preset.texture,
      camera: preset.camera,
      lens: preset.lens,
      color_tone: preset.tone,
      lighting: preset.light,
      depth_of_field: "shallow",
    },
    subject: {
      description: subject,
      appearance: firstUseful(valueOf("appearance"), "外观自然，服装贴合身份"),
      consistency: "保持人物身份、长相、服装和发型稳定，不要换脸或漂移",
    },
    scene: {
      setting,
      background: preset.background,
    },
    camera_control: {
      shot_type: "continuous_take",
      focus,
      movement: "缓慢推进或稳定跟随，避免无意义镜头漂移",
    },
    stages,
    negative_constraints: firstUseful(
      valueOf("extra"),
      "不要跳切，不要突然换景，不要夸张表演，不要卡通化，不要改变人物身份",
    ),
  };
}

function buildSeedancePrompt() {
  const brief = valueOf("brief");
  const preset = lookPresets[valueOf("look")];
  const total = Number(valueOf("duration"));
  const subject = firstUseful(valueOf("subject"), inferSubject(brief), "核心主体");
  const setting = firstUseful(valueOf("setting"), inferSetting(brief), "符合剧情的真实场景");
  const appearance = firstUseful(valueOf("appearance"), "外观自然，服装和道具与身份一致");
  const action = firstUseful(valueOf("action"), inferAction(brief), "自然连续动作");
  const focus = focusMap[valueOf("focus")];
  const stageMode = valueOf("stageMode");
  const negative = firstUseful(
    valueOf("extra"),
    "不要跳切，不要突然换景，不要改变人物身份，不要多手多脚，不要画面闪烁，不要文字水印，不要夸张表演",
  );

  const first = firstUseful(valueOf("emotionStart"), "初始状态稳定");
  const middle = firstUseful(valueOf("emotionMiddle"), "中段状态变化");
  const impact = firstUseful(valueOf("impactEmotion"), "关键动作或状态变化");
  const end = firstUseful(valueOf("emotionEnd"), "最终状态稳定");

  const timeline =
    stageMode === "none"
      ? [
          `[0s-${Math.round(total * 0.34)}s] 中近景建立主体：${subjectLabel(subject)}位于${setting}，${appearance}，开始${action}。动作清晰、节奏稳定，背景只提供空间氛围。`,
          `[${Math.round(total * 0.34)}s-${Math.round(total * 0.67)}s] 镜头缓慢跟随主体，保持同一主体/同一外观/同一场景，突出${focus}。每个镜头只表达一个主要动作，避免动作堆叠。`,
          `[${Math.round(total * 0.67)}s-${total}s] 镜头轻微推进到主体关键细节，动作自然收束，画面保持稳定、真实、连续。`,
        ]
      : stageMode === "simple"
        ? [
            `[0s-${Math.round(total * 0.5)}s] 起始状态：${subjectLabel(subject)}在${setting}中，${appearance}，表现为${first}。镜头稳定，动作克制。`,
            `[${Math.round(total * 0.5)}s-${total}s] 结束状态：主体自然过渡到${end}，重点呈现${focus}，不要突兀变脸、换衣或切换场景。`,
          ]
        : [
            `[0s-2s] ${first}：正面或略侧中近景，锁定${subjectLabel(subject)}，动作轻微，画面稳定。`,
            `[2s-5s] ${middle}：主体完成一个明确动作，镜头缓慢跟随，不新增无关人物和无关道具。`,
            `[5s-9s] ${impact}：关键变化出现，重点表现${focus}，背景保持虚化，运动轨迹真实。`,
            `[9s-${total}s] ${end}：动作或情绪收束，镜头缓慢推进到关键细节，保持同一主体一致性。`,
          ];

  return `【Seedance 2.0专用提示词】

【主体锁定】
主体：${subjectLabel(subject)}
外观：${appearance}
一致性要求：全程保持同一主体、同一外观、同一材质/服装、同一场景关系；不要换脸、不要换衣服、不要主体漂移。

【场景与风格】
场景：${setting}
画面风格：${preset.texture}
色调：${preset.tone}
光线：${preset.light}
背景：${preset.background}
		摄影参考：${preset.camera}质感，同一镜头连续拍摄，浅景深，主体清晰，背景弱化。

【时间码分镜】
${timeline.join("\n")}

【镜头控制】
		镜头类型：单镜头连续跟随，稳定跟随或缓慢推进。
		运动规则：每个时间段只表达一个主要动作；动作从上一段自然过渡到下一段；画面保持连续顺滑，不出现突然断开、突然换景或镜头参数突变。
		景别变化：只允许同一镜头内平滑推进、平滑跟随、轻微环绕或构图自然变化。
视觉焦点：${focus}。

【画面稳定约束】
${negative}
避免主体变形、肢体错误、面部漂移、背景闪烁、镜头抖动、画面过曝、动作物理不合理。

【输出参数建议】
时长：${total}秒
比例：16:9
风格：写实电影感，高质量，清晰稳定。`;
}

function buildFormattedPrompt() {
  const textPrompt = enrichPrompt();
  const seedancePrompt = buildSeedancePrompt();
  const jsonPrompt = JSON.stringify(buildPromptJson(), null, 2);
  const format = valueOf("outputFormat");

  if (format === "seedance") return seedancePrompt;
  if (format === "json") return jsonPrompt;
  if (format === "both") {
    return `【文案提示词】\n${textPrompt}\n\n【Seedance 2.0专用】\n${seedancePrompt}\n\n【JSON结构】\n${jsonPrompt}`;
  }
  return textPrompt;
}

function collectPayload() {
  return {
    brief: valueOf("brief"),
    subject: firstUseful(valueOf("subject"), inferSubject(valueOf("brief"))),
    setting: firstUseful(valueOf("setting"), inferSetting(valueOf("brief"))),
    appearance: valueOf("appearance"),
    action: firstUseful(valueOf("action"), inferAction(valueOf("brief"))),
    duration: valueOf("duration"),
    look: fields.look.options[fields.look.selectedIndex].text,
    focus: fields.focus.options[fields.focus.selectedIndex].text,
    emotionStart: valueOf("emotionStart"),
    emotionMiddle: valueOf("emotionMiddle"),
    impactEmotion: valueOf("impactEmotion"),
    emotionEnd: valueOf("emotionEnd"),
    stageMode: valueOf("stageMode"),
    extra: valueOf("extra"),
    model: valueOf("model"),
    outputFormat: valueOf("outputFormat"),
    templateDraft: buildFormattedPrompt(),
    jsonDraft: buildPromptJson(),
  };
}

async function generateWithAI() {
  statusEl.textContent = "AI生成中";
  setBusy(true, "AI 正在生成", "正在按照当前设定输出高控制力提示词");
  const response = await fetch("/api/enhance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(collectPayload()),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "AI接口调用失败");
  }

  output.value = data.prompt || "";
  statusEl.textContent = "AI已生成";
  setBusy(false);
  syncUiStats();
}

async function generate() {
  if (valueOf("mode") === "ai") {
    try {
      await generateWithAI();
      return;
    } catch (error) {
      setBusy(false);
      output.value = buildFormattedPrompt();
      statusEl.textContent = "AI失败，已用模板";
      output.value += `\n\n【AI接口提示】\n${error.message}\n如果你是双击 index.html 打开的页面，AI模式需要通过后端服务启动，不能直接用 file:// 调用。`;
      syncUiStats();
      return;
    }
  }

  output.value = buildFormattedPrompt();
  statusEl.textContent = "已生成";
  syncUiStats();
}

function setSelectValue(select, value) {
  if (!select || !value) return;
  const hasValue = [...select.options].some((option) => option.value === value);
  if (hasValue) select.value = value;
}

function renderAnalysisSummary(settings, state = "success") {
  if (!analysisSummary) return;
  analysisSummary.dataset.state = state;
  if (state === "error") {
    analysisSummary.innerHTML = `<strong>AI理解设定</strong><p>${settings}</p>`;
    return;
  }

  const subject = settings.subject || "未识别";
  const setting = settings.setting || "未识别";
  const action = settings.action || "未识别";
  const reason = settings.reasoning || "已根据描述回填可编辑参数。";
  analysisSummary.innerHTML = `<strong>AI理解设定</strong><p>人物：${subject}　场景：${setting}　动作：${action}</p><p>${reason}</p>`;
}

function applyAnalyzedSettings(settings) {
  if (!settings) return;
  const brief = valueOf("brief");
  const actionText = [brief, settings.action || ""].join(" ");
  if (/(教程|演示|手部|制作|咖啡|手冲|倒入|注水|烹饪|组装|产品|表盘|齿轮|材质|道具|器具)/.test(actionText)) {
    settings.focus = "object";
  }
  if (/(高端广告|商业广告|产品|品牌|质感展示)/.test(actionText)) {
    settings.look = "commercial";
  }
  if (settings.subject) fields.subject.value = settings.subject;
  if (settings.setting) fields.setting.value = settings.setting;
  if (settings.appearance) fields.appearance.value = settings.appearance;
  if (settings.action) fields.action.value = settings.action;
  if (settings.extra) fields.extra.value = settings.extra;
  if (settings.emotionStart) fields.emotionStart.value = settings.emotionStart;
  if (settings.emotionMiddle) fields.emotionMiddle.value = settings.emotionMiddle;
  if (settings.impactEmotion) fields.impactEmotion.value = settings.impactEmotion;
  if (settings.emotionEnd) fields.emotionEnd.value = settings.emotionEnd;
  setSelectValue(fields.look, settings.look);
  setSelectValue(fields.focus, settings.focus);
  setSelectValue(fields.stageMode, settings.stageMode);
  if (settings.duration) fields.duration.value = String(settings.duration);

  syncPresetCards();
  syncStageMode();
}

async function analyzeDescription({ manual = false } = {}) {
  const brief = valueOf("brief");
  if (brief.length < 8 || isAnalyzing) return;
  if (!manual && brief === lastAnalyzedBrief) return;

  isAnalyzing = true;
  lastAnalyzedBrief = brief;
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "分析中";
  statusEl.textContent = "AI分析中";
  setBusy(true, "AI 正在分析", "正在识别人物、场景、动作、风格和阶段设定");

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brief,
        model: valueOf("model"),
        duration: valueOf("duration"),
        outputFormat: valueOf("outputFormat"),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "AI分析失败");

    applyAnalyzedSettings(data.settings);
    renderAnalysisSummary(data.settings);
    output.value = buildFormattedPrompt();
    statusEl.textContent = "分析已回填";
    setBusy(false);
    syncUiStats();
  } catch (error) {
    setBusy(false);
    renderAnalysisSummary(`${error.message}。已保留本地基础识别结果，你也可以直接生成提示词。`, "error");
    output.value = buildFormattedPrompt();
    statusEl.textContent = "分析失败";
    syncUiStats();
  } finally {
    isAnalyzing = false;
    analyzeBtn.textContent = "AI分析设定";
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  generate();
});

sampleBtn.addEventListener("click", () => {
  for (const [key, value] of Object.entries(sample)) {
    fields[key].value = value;
  }
  fields.duration.value = "15";
  fields.look.value = "cinematic";
  fields.focus.value = "face";
  fields.mode.value = "ai";
  fields.model.value = "deepseek-v4-flash";
  fields.stageMode.value = "full";
  fields.outputFormat.value = "seedance";
  syncPresetCards();
  syncModeTabs();
  syncStageMode();
  generate();
});

clearBtn.addEventListener("click", () => {
  Object.values(fields).forEach((field) => {
    if (field.tagName === "SELECT") return;
    field.value = "";
  });
  fields.duration.value = "15";
  fields.look.value = "cinematic";
  fields.focus.value = "face";
  fields.mode.value = "ai";
  fields.model.value = "deepseek-v4-flash";
  fields.stageMode.value = "full";
  fields.outputFormat.value = "seedance";
  output.value = "";
  statusEl.textContent = "等待输入";
  lastAnalyzedBrief = "";
  if (analysisSummary) {
    analysisSummary.dataset.state = "";
    analysisSummary.innerHTML = "<strong>AI理解设定</strong><p>输入描述后，系统会识别人物、场景、动作、风格、镜头和阶段设定，并自动回填到下方参数。</p>";
  }
  syncPresetCards();
  syncModeTabs();
  syncStageMode();
  syncUiStats();
});

regenerateBtn.addEventListener("click", () => generate());

copyBtn.addEventListener("click", async () => {
  if (!output.value.trim()) await generate();
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(output.value);
    } else {
      throw new Error("clipboard unavailable");
    }
    statusEl.textContent = "已复制";
  } catch {
    output.focus();
    output.select();
    const copied = document.execCommand?.("copy");
    statusEl.textContent = copied ? "已复制" : "已选中，请手动复制";
  }
  setTimeout(() => {
    if (["已复制", "已选中，请手动复制"].includes(statusEl.textContent)) {
      statusEl.textContent = "已生成";
    }
  }, 1600);
});

fields.brief.addEventListener("input", () => {
  const brief = valueOf("brief");
  if (!valueOf("subject")) fields.subject.value = inferSubject(brief);
  if (!valueOf("setting")) fields.setting.value = inferSetting(brief);
  if (!valueOf("action")) fields.action.value = inferAction(brief);
  syncUiStats();

  clearTimeout(analyzeTimer);
  if (fields.autoAnalyze.checked && brief.length >= 12) {
    analyzeTimer = setTimeout(() => analyzeDescription(), 1200);
  }
});

analyzeBtn.addEventListener("click", () => analyzeDescription({ manual: true }));

function syncPresetCards() {
  presetCards.forEach((card) => {
    const active = card.dataset.look === valueOf("look");
    card.classList.toggle("active", active);
    let check = card.querySelector(".check");
    if (active && !check) {
      check = document.createElement("span");
      check.className = "check";
      check.textContent = "✓";
      card.append(check);
    }
    if (!active && check) check.remove();
  });
}

function syncModeTabs() {
  modeTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === valueOf("mode"));
  });
}

function syncStageMode() {
  builderPanel.dataset.stageMode = valueOf("stageMode");
}

presetCards.forEach((card) => {
  card.addEventListener("click", () => {
    fields.look.value = card.dataset.look;
    syncPresetCards();
  });
});

modeTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    fields.mode.value = tab.dataset.mode;
    syncModeTabs();
  });
});

fields.stageMode.addEventListener("change", syncStageMode);
fields.outputFormat.addEventListener("change", () => {
  output.value = buildFormattedPrompt();
  syncUiStats();
  statusEl.textContent = "格式已切换";
});

fields.mode.value = "ai";
fields.outputFormat.value = "seedance";
syncPresetCards();
syncModeTabs();
syncStageMode();
output.value = buildFormattedPrompt();
statusEl.textContent = "已完成";
syncUiStats();
