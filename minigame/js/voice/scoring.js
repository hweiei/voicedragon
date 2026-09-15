const CHAR_EQUIVALENTS = new Map([
  ["頂", "顶"], ["驚", "惊"], ["齊", "齐"], ["執", "执"],
  ["問題", "问题"], ["過", "过"], ["蔗", "蔗"], ["閒", "闲"],
  ["飲", "饮"], ["錯", "错"], ["飯", "饭"], ["嚟", "嚟"],
  ["咗", "咗"], ["啲", "啲"], ["冇", "冇"], ["唔", "唔"]
]);

export function normalizeSpeechText(value = "") {
  let text = String(value).trim().toLowerCase();
  for (const [from, to] of CHAR_EQUIVALENTS) {
    text = text.split(from).join(to);
  }
  return text
    .replace(/[，。！？、,.!?;；:：'"“”‘’\s-]/g, "")
    .replace(/兒/g, "")
    .replace(/左/g, "咗")
    .replace(/地/g, "啲");
}

export function levenshteinDistance(a, b) {
  const left = normalizeSpeechText(a);
  const right = normalizeSpeechText(b);
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array(right.length + 1).fill(0);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }
    for (let j = 0; j <= right.length; j += 1) previous[j] = current[j];
  }
  return previous[right.length];
}

export function textSimilarity(target, transcript) {
  const expected = normalizeSpeechText(target);
  const actual = normalizeSpeechText(transcript);
  if (!expected || !actual) return 0;
  if (expected === actual) return 1;
  if (actual.includes(expected)) return 0.96;
  if (expected.includes(actual)) return Math.max(0.35, actual.length / expected.length * 0.9);
  const distance = levenshteinDistance(expected, actual);
  return Math.max(0, 1 - distance / Math.max(expected.length, actual.length));
}

export function scorePronunciation(targets, transcript, confidence = 0.72) {
  const expectedList = Array.isArray(targets) ? targets : [targets];
  const similarities = expectedList.map((target) => ({
    target,
    value: textSimilarity(target, transcript)
  }));
  const best = similarities.sort((a, b) => b.value - a.value)[0] || { target: "", value: 0 };
  const safeConfidence = Math.max(0, Math.min(1, Number.isFinite(confidence) ? confidence : 0.72));
  const raw = 100 * (best.value * 0.76 + safeConfidence * 0.24);
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  return {
    score,
    similarity: Math.round(best.value * 100),
    confidence: Math.round(safeConfidence * 100),
    matchedTarget: best.target,
    transcript: String(transcript || "")
  };
}

export function scoreLabel(score) {
  if (score >= 85) return "正音";
  if (score >= 65) return "清晰";
  if (score >= 40) return "入门";
  return "未稳";
}
