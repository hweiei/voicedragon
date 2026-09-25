import "./style.css";
import { SpeechTts } from "../adapters/tts";
import { LESSONS, canAdvance, routeFor } from "./curriculum";

const tts = new SpeechTts();
const KEY = "voice-dragon-beginner-v1";
type Progress = {
  floor: number;
  completed: string[];
  spoken: string[];
  relics: string[];
  seed: number;
  done: boolean;
};
const fresh = (): Progress => ({
  floor: 0,
  completed: [],
  spoken: [],
  relics: [],
  seed: Date.now() % 100000,
  done: false
});
let progress = fresh();
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "null");
  if (
    saved &&
    Number.isInteger(saved.floor) &&
    saved.floor >= 0 &&
    saved.floor < 6 &&
    ["completed", "spoken", "relics"].every(
      (k) => Array.isArray(saved[k]) && saved[k].every((x: unknown) => typeof x === "string")
    ) &&
    Number.isFinite(saved.seed)
  )
    progress = saved;
} catch {
  /* Storage unavailable: session still works. */
}
let started = false;
let answered = false;
let recorded = false;
let readingOnly = false;
let showHint = false;
let stage: "lesson" | "reward" = "lesson";
let recorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let audioUrl = "";
let activeAudio: HTMLAudioElement | null = null;
let requesting = false;
let generation = 0;
let message = "";
const root = document.body;
const esc = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    message = "本机存储不可用，进度仅在本次页面保留。";
  }
}
function clearAudio() {
  generation++;
  clearTimeout(timer);
  if (recorder?.state === "recording") recorder.stop();
  recorder = null;
  for (const track of stream?.getTracks() ?? []) track.stop();
  stream = null;
  activeAudio?.pause();
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = "";
  tts.stop();
}
function toast(text: string) {
  message = text;
  const node = document.querySelector("#notice");
  if (node) node.textContent = text;
}
function skyline() {
  return `<div class="city" aria-hidden="true">${Array.from({ length: 19 }, (_, i) => `<i style="--h:${80 + ((i * 67) % 180)}px;--w:${30 + ((i * 13) % 36)}px"></i>`).join("")}</div><div class="moon" aria-hidden="true"></div><div class="sign sign-one" aria-hidden="true">龍樓冰室<small>OPEN ALL NIGHT</small></div><div class="sign sign-two" aria-hidden="true">開口有賞</div>`;
}
function render() {
  const lesson = LESSONS[progress.floor];
  const routes = routeFor(progress.seed);
  root.innerHTML = `<div class="world">${skyline()}<header class="header"><a class="brand" href="./"><span class="seal">龍</span><span>声震龙楼<small>VOICE DRAGON / 粤语冒险</small></span></a><nav><span class="active">新手教学塔</span><a href="?mode=classic">自由冒险 ↗</a><button data-action="help" class="text-button">玩法说明</button></nav><div class="local"><span></span>本地练习 · 无需登录</div></header>
  <main class="layout"><aside class="rail"><div class="eyebrow">YOUR FIRST ASCENT</div><h2>一层一句，<br>粤讲粤有底气。</h2><p>第一章 / 霓虹初声</p><div class="route">${[
    ...LESSONS
  ]
    .reverse()
    .map((l, j) => {
      const i = 5 - j;
      return `<div class="route-item ${i === progress.floor && !progress.done ? "current" : ""} ${progress.completed.includes(l.id) ? "cleared" : ""}"><span class="node">${progress.completed.includes(l.id) ? "✓" : i === 5 ? "♜" : `0${i + 1}`}</span><span>${routes[i]}<small>${i === 5 ? "BOSS · 综合表达" : ["问候 · 初次开口", "礼貌 · 请求帮助", "点单 · 完整短句", "问价 · 日常应用", "感谢 · 分清场景"][i]}</small></span>${i === progress.floor && !progress.done ? "<b>←</b>" : ""}</div>`;
    })
    .join(
      ""
    )}</div><div class="rail-bottom"><span>本局路线</span><b>#${progress.seed}</b><p>知识循序渐进，街角每局不同。</p></div></aside>
  <section class="main-column"><div class="chapter"><span><i></i> 骑楼长街 / CHAPTER 01</span><span>新手友好 · 无扣血练习</span></div>
  <div class="hero-heading"><div><div class="eyebrow">LEARN IT. SAY IT. OWN IT.</div><h1>${progress.done ? "把粤语，带进生活。" : "今夜，从一句粤语开始。"}</h1><p>听一听，讲一句。让你的声音，点亮这座城。</p></div><span class="chapter-stamp">初<br>声</span></div>
  <div class="stats"><div><small>当前楼层</small><strong>${progress.done ? "06" : `0${progress.floor + 1}`}<em> / 06</em></strong></div><div><small>已接触表达</small><strong>${String(progress.completed.length).padStart(2, "0")}<em> 句</em></strong></div><div><small>已录音练习</small><strong>${String(progress.spoken.length).padStart(2, "0")}<em> 句</em></strong></div><div class="hearts"><small>冒险状态</small><strong>✦ ✦ ✦</strong><em>勇气满格，不怕讲错</em></div></div>
  ${
    progress.done
      ? summary()
      : stage === "reward"
        ? reward()
        : `<article class="lesson-card"><div class="card-top"><span class="tag">${progress.floor === 5 ? "终层 · 情境挑战" : "教学房 · 学会再出发"}</span><span class="card-number">FLOOR 0${progress.floor + 1}</span></div>
  <div class="lesson-title">${lesson.title}</div><div class="phrase ${progress.floor === 5 && !showHint ? "hidden-phrase" : ""}">${progress.floor === 5 && !showHint ? "试着向店员点一杯冰奶茶" : lesson.phrase}</div><div class="jyutping">${progress.floor === 5 && !showHint ? "用上本局学过的礼貌表达" : lesson.jyutping}</div><p class="meaning">${lesson.meaning}</p>
  <div class="listen-actions"><button data-action="listen" class="soft-button">▷ 听示范</button><button data-action="slow" class="soft-button">◷ 慢速听</button><button data-action="hint" class="text-button">${showHint ? "收起提示" : "查看发音提示"} ↗</button></div>
  ${showHint ? `<div class="hint">${lesson.tip}</div>` : ""}
  ${!tts.cantoneseAvailable ? '<div class="voice-warning">当前设备未检测到粤语音色，不会用普通话替代示范。可先阅读与录音，或在安装粤语音色后重试。</div>' : '<div class="voice-ready">● 设备粤语示范可用 · 浏览器系统朗读</div>'}
  <div class="practice"><div class="step-label"><b>01</b> 开口跟读 <span>先练习，不评分</span></div><button data-action="record" class="record-button ${recorder?.state === "recording" ? "recording" : ""}" ${requesting ? "disabled" : ""}><span>◉</span>${requesting ? "等待麦克风权限…" : recorder?.state === "recording" ? "录音中 · 点击结束" : recorded ? "再说一次" : "点击开始跟读"}<small>${recorder?.state === "recording" ? "最长 12 秒 · 音频仅本机暂存" : "麦克风录音 · 不上传"}</small></button>${audioUrl ? '<button data-action="play" class="soft-button playback">▷ 回听我的录音</button><span class="record-ok">✓ 已完成录音，未评测发音</span>' : ""}<button data-action="reading" class="reading-link">${readingOnly ? "✓ 当前为阅读模式（不计口语完成）" : "暂时不方便开口？切换阅读模式"}</button></div>
  <div class="understanding"><div class="step-label"><b>02</b> ${progress.floor === 5 ? "完成最后的情境任务" : "听懂了，也用对了"}</div><h3>${lesson.question}</h3><div class="answers">${lesson.answers.map((a, i) => `<button data-answer="${i}" class="answer ${answered && i === lesson.correct ? "correct" : ""}" ${answered ? "disabled" : ""}><span>${["A", "B", "C"][i]}</span>${a}${answered && i === lesson.correct ? " ✓" : ""}</button>`).join("")}</div></div>
  <footer class="card-footer"><span>${answered ? "✓ 场景理解完成" : "完成跟读与场景选择，点亮下一层"}</span><button data-action="next" class="primary" ${canAdvance(answered, recorded, readingOnly) ? "" : "disabled"}>${progress.floor === 5 ? "完成登塔" : "收下奖励，继续登塔"} <span>↗</span></button></footer></article>`
  }
  <div id="notice" role="status" aria-live="polite">${esc(message)}</div><div class="bottom-note"><span>✧ 每一次开口，都算数。</span><span>学习原型 · 粤拼与内容待母语审校</span></div></section>
  <aside class="side"><div class="daily panel"><div class="eyebrow">TONIGHT’S QUEST</div><h3>今晚，迈出第一步</h3><p>完成六层练习，走进霓虹冰室，独立尝试一次点单。</p><div class="progress-track"><i style="width:${(progress.completed.length / 6) * 100}%"></i></div><small>${progress.completed.length} / 6 层已完成</small><div class="quest-icon">茶</div></div><div class="panel bag"><div class="eyebrow">YOUR INVENTORY</div><h3>随身锦囊 <span>${progress.relics.length.toString().padStart(2, "0")}</span></h3>${progress.relics.length ? progress.relics.map((r) => `<div class="bag-item">✧ <span>${esc(r)}<small>${r === "慢声耳机" ? "慢速示范调至更慢语速" : r === "粤拼灯牌" ? "后续关卡默认展开提示" : "记录奖励 · 可随时回听本层录音"}</small></span></div>`).join("") : '<div class="empty-bag">◇<p>每次过关，带走一份奖励。<br>让下一次开口更从容。</p></div>'}</div><div class="tip-panel"><span>街坊小贴士</span><p>「讲错唔紧要，<br>最紧要肯开口。」</p><small>说错没关系，愿意开口最重要。</small></div><button data-action="restart" class="text-button restart">↻ 重新开始一局</button></aside></main><footer class="site-footer"><span>声震龙楼 / VOICE DRAGON</span><span>用声音探索一座城，用一句话靠近一种生活。</span><span>粤语 · 普通话学习者入门</span></footer></div>`;
  for (const el of root.querySelectorAll<HTMLElement>("[data-action]")) {
    el.onclick = () => void action(el.dataset.action!);
  }
  for (const el of root.querySelectorAll<HTMLButtonElement>("[data-answer]")) {
    el.onclick = () => {
      if (Number(el.dataset.answer) === lesson.correct) {
        answered = true;
        message = "答对了！这句表达适合这个场景。";
        render();
      } else {
        el.classList.add("wrong");
        toast("再想一想：回看普通话释义，选一句适合这个场景的表达。不扣分。");
      }
    };
  }
  for (const el of root.querySelectorAll<HTMLElement>("[data-relic]")) {
    el.onclick = () => {
      progress.relics.push(el.dataset.relic!);
      progress.floor++;
      stage = "lesson";
      answered = false;
      recorded = false;
      showHint = progress.relics.includes("粤拼灯牌");
      clearAudio();
      save();
      message = "奖励已收下，下一句继续！";
      render();
    };
  }
}
function reward() {
  return `<article class="lesson-card reward"><div class="tag">楼层完成 / CHOOSE YOUR REWARD</div><div class="reward-symbol">✦</div><h2>一句入袋，一步向上。</h2><p>选一个锦囊，带进下一层。奖励不改变学习评分。</p><div class="reward-options">${[
    ["慢声耳机", "◷", "更慢一点，听清每个音节。"],
    ["粤拼灯牌", "灯", "后续自动展开发音提示。"],
    ["回声纪念章", "↺", "记录这次尝试，回听无需消耗。"]
  ]
    .map(
      ([name, icon, desc]) =>
        `<button data-relic="${name}"><b>${icon}</b><strong>${name}</strong><span>${desc}</span></button>`
    )
    .join("")}</div></article>`;
}
function summary() {
  return `<article class="lesson-card summary"><div class="tag">CHAPTER COMPLETE / 今夜成功登顶</div><div class="reward-symbol">♜</div><h2>这座城，听见你了。</h2><p>接触了 ${progress.completed.length} 句表达，其中 ${progress.spoken.length} 句完成录音尝试。<br>完成练习不代表已掌握；明天记得再说一遍。</p><div class="summary-phrases">${LESSONS.map((l) => `<div><strong>${l.phrase}</strong><small>${progress.spoken.includes(l.id) ? "已录音练习" : "阅读练习"}</small></div>`).join("")}</div><button data-action="restart" class="primary">再练一局 ↗</button><a class="soft-button" href="?mode=classic">探索原版自由冒险 ↗</a></article>`;
}
async function action(name: string) {
  started = true;
  if (name === "help") {
    toast(
      "每层：听示范 → 录音跟读或选择阅读模式 → 回答场景题 → 领取锦囊。录音只在当前页面暂存，不做自动发音评测。原版自由冒险有独立存档与语音设置。"
    );
    return;
  }
  if (name === "hint") {
    showHint = !showHint;
    render();
    return;
  }
  if (name === "listen" || name === "slow") {
    if (recorder?.state === "recording") {
      toast("请先结束录音，再播放示范。");
      return;
    }
    if (!tts.cantoneseAvailable) {
      toast("未找到粤语音色。请在系统语音设置中安装粤语声音，再刷新页面；本页不会播放非粤语示范。");
      return;
    }
    activeAudio?.pause();
    tts.speak(LESSONS[progress.floor].phrase, {
      rate: name === "slow" ? (progress.relics.includes("慢声耳机") ? 0.55 : 0.7) : 0.9
    });
    return;
  }
  if (name === "reading") {
    if (recorder?.state === "recording" || requesting) return;
    readingOnly = !readingOnly;
    message = readingOnly
      ? "可通过阅读和场景题继续。阅读不会记作口语训练。"
      : "已返回开口练习模式。";
    render();
    return;
  }
  if (name === "play" && audioUrl) {
    if (recorder?.state === "recording") return;
    tts.stop();
    activeAudio?.pause();
    activeAudio = new Audio(audioUrl);
    try {
      await activeAudio.play();
    } catch {
      toast("播放失败，请重新录制。");
    }
    return;
  }
  if (name === "record") {
    if (recorder?.state === "recording") {
      recorder.stop();
      return;
    }
    if (requesting) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast("当前浏览器或页面环境不能录音。请用 HTTPS 页面和支持录音的浏览器，或选择阅读模式。");
      return;
    }
    clearAudio();
    const token = generation;
    requesting = true;
    render();
    try {
      const capture = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (token !== generation) {
        for (const track of capture.getTracks()) track.stop();
        return;
      }
      stream = capture;
      const chunks: Blob[] = [];
      recorder = new MediaRecorder(capture);
      const current = recorder;
      current.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      current.onstop = () => {
        for (const track of capture.getTracks()) track.stop();
        clearTimeout(timer);
        if (token !== generation) return;
        const blob = new Blob(chunks, { type: current.mimeType || "audio/webm" });
        if (blob.size > 0) {
          audioUrl = URL.createObjectURL(blob);
          recorded = true;
          readingOnly = false;
          message = "录音已保存到当前页面。请回听对比；系统未判断是否开口或发音是否准确。";
        } else message = "没有生成可回放音频，请重试。";
        render();
      };
      current.onerror = () => {
        clearAudio();
        toast("录音中断，请重新尝试。");
        render();
      };
      current.start();
      requesting = false;
      message = "正在录音，点击按钮结束。";
      render();
      timer = setTimeout(() => {
        if (current.state === "recording") current.stop();
      }, 12000);
    } catch {
      if (token === generation) {
        for (const track of stream?.getTracks() ?? []) track.stop();
        message = "无法访问麦克风。请检查网站权限，或切换阅读模式。";
      }
    } finally {
      requesting = false;
      render();
    }
    return;
  }
  if (name === "next" && canAdvance(answered, recorded, readingOnly)) {
    const id = LESSONS[progress.floor].id;
    if (!progress.completed.includes(id)) progress.completed.push(id);
    if (recorded && !progress.spoken.includes(id)) progress.spoken.push(id);
    clearAudio();
    if (progress.floor === 5) progress.done = true;
    else stage = "reward";
    save();
    message = "";
    render();
    return;
  }
  if (name === "restart") {
    if (!confirm("重新开始本局？这会清除新手塔进度，不影响原版冒险存档。")) return;
    clearAudio();
    progress = fresh();
    answered = false;
    recorded = false;
    readingOnly = false;
    stage = "lesson";
    showHint = false;
    message = "";
    save();
    render();
  }
}
window.addEventListener("pagehide", clearAudio);
if (typeof speechSynthesis !== "undefined")
  speechSynthesis.addEventListener("voiceschanged", () => {
    if (!started) render();
  });
render();
