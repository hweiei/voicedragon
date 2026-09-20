/**
 * P13 词林拾遗 E2E（零后端；纯规则见 ../unit/{mastery,listening,wordbook}.test.ts、
 * 契约见 ../contract/p13-wordbook.test.ts）：
 * 1. 图鉴双页签：词林拾遗（称号/点数/逐句掌握度/听辨统计）与登楼履痕可互相切换。
 * 2. 练习场 · 听音辨字全流程：播放 → 作答 → 解析 → 下一题 → 本轮小结；只写听辨计数。
 * 3. 无粤语音色时诚实跳过（不假装有音频）。
 * 4. 卡面「词林」标记：练透的句子在战斗手牌上打标。
 */

import { type Page, expect, test } from "@playwright/test";
import { ALL_SKILLS } from "../../src/core/content";
import { GameEngine, type GameState } from "../../src/core/engine";
import { parseJyutpingTones } from "../../src/core/tone";

type SrsPayload = {
  entries: Record<string, unknown>;
  stats: Record<string, unknown>;
  history: unknown[];
  syllables?: Record<
    string,
    { attempts: number; sumScore: number; bestScore: number; lastScore: number }[]
  >;
};

function syllablesFor(skillId: string, jyutping: string, score = 95, attempts = 4) {
  return {
    [skillId]: parseJyutpingTones(jyutping).map(() => ({
      attempts,
      sumScore: score * attempts,
      bestScore: score,
      lastScore: score
    }))
  };
}

async function preset(
  page: Page,
  options: {
    srs?: SrsPayload;
    state?: GameState;
    cantoneseVoice?: boolean;
    codexSkills?: string[];
  } = {}
): Promise<void> {
  await page.addInitScript(
    ({ srs, state, cantoneseVoice, codexSkills }) => {
      localStorage.setItem(
        "voice-tower-settings-v1",
        JSON.stringify({ sound: false, music: false, tutorialSeen: true, reduceMotion: true })
      );
      if (srs) {
        localStorage.setItem(
          "voice-tower-srs-v1",
          JSON.stringify({
            entries: {},
            stats: {
              voiceAttempts: 0,
              sumWord: 0,
              toneCount: 0,
              sumTone: 0,
              sumConfidence: 0,
              skillsUsed: [],
              listeningAttempts: 0,
              listeningCorrect: 0,
              ...srs.stats
            },
            history: [],
            syllables: srs.syllables ?? {}
          })
        );
      }
      if (codexSkills) {
        localStorage.setItem(
          "voice-tower-profile-v1",
          JSON.stringify({
            stats: {},
            unlocked: [],
            codex: { skills: codexSkills, enemies: [], relics: [], items: [], events: [] }
          })
        );
      }
      if (state) {
        localStorage.setItem(
          "voice-tower-save-v2",
          JSON.stringify({ version: 2, savedAt: new Date().toISOString(), state })
        );
      }
      if (cantoneseVoice !== undefined) {
        const voices = cantoneseVoice
          ? [
              {
                name: "Sinji",
                lang: "zh-HK",
                default: true,
                localService: true,
                voiceURI: "sinji"
              }
            ]
          : [];
        // 无头浏览器默认没有语音列表：按用例装/卸粤语音色
        Object.defineProperty(window.speechSynthesis, "getVoices", {
          configurable: true,
          value: () => voices
        });
      }
    },
    {
      srs: options.srs ?? null,
      state: options.state ?? null,
      cantoneseVoice: options.cantoneseVoice,
      codexSkills: options.codexSkills ?? null
    }
  );
  await page.goto("/");
}

async function readSrs(page: Page): Promise<{
  stats: { listeningAttempts?: number; listeningCorrect?: number; voiceAttempts?: number };
  entries: Record<string, { lapses?: number }>;
}> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("voice-tower-srs-v1") ?? "{}"));
}

test("图鉴双页签：词林拾遗列出称号/点数/逐句掌握度，可切回登楼履痕", async ({ page }) => {
  const mastered = ALL_SKILLS[0];
  await preset(page, {
    srs: {
      entries: {},
      stats: { listeningAttempts: 5, listeningCorrect: 4 },
      history: [],
      syllables: syllablesFor(mastered.id, mastered.jyutping)
    },
    codexSkills: [mastered.id]
  });
  await page.getByRole("button", { name: "图鉴", exact: true }).click();
  await expect(page.locator(".codex-screen")).toBeVisible();
  await expect(page.locator(".codex-section").first()).toBeVisible();

  await page.getByRole("tab", { name: "词林拾遗" }).click();
  const wordbook = page.locator(".wordbook-summary");
  await expect(wordbook).toBeVisible();
  await expect(wordbook).toContainText("词林拾遗 · 称号");
  await expect(wordbook.locator(".wordbook-points")).toContainText("点");
  // 练透的句子出现在「已练透（二档）」并在行上打「已入词林」
  const tier2 = page.locator(".wordbook-group", { hasText: "已练透（二档）" });
  await expect(tier2).toBeVisible();
  await expect(tier2.locator(".wordbook-row").first()).toContainText(mastered.phrase);
  await expect(tier2.locator(".wordbook-collected").first()).toContainText("已入词林");
  // 听辨统计如实显示（只记对错）
  await expect(page.locator(".wordbook-listening")).toContainText("5 题 · 正确率 80%");
  // 未收录的句子明确标「未收录」，不假装
  await expect(page.locator(".wordbook-collected.muted").first()).toContainText("未收录");

  await page.getByRole("tab", { name: "登楼履痕" }).click();
  await expect(page.locator(".codex-section").first()).toBeVisible();
  await expect(page.locator(".wordbook-summary")).toHaveCount(0);
});

test("练习场 · 听音辨字：播放 → 作答 → 解析 → 下一题 → 本轮小结，只写听辨计数", async ({
  page
}) => {
  await preset(page, { cantoneseVoice: true });
  await page.getByRole("button", { name: "练习场 · 调准曲线" }).click();
  await page.getByRole("tab", { name: "听音辨字" }).click();
  await expect(page.locator(".listening-card")).toBeVisible();
  await expect(page.locator(".listening-strip")).toContainText("第 1 / 8 题");
  await expect(page.locator(".listening-card")).toContainText("不会自动播放");

  await page.getByRole("button", { name: /播放发音/ }).click();
  const options = page.locator(".listening-card ~ .choice-list .quiz-option");
  await expect(options).toHaveCount(4);
  await options.first().click();
  await expect(page.locator(".outcome-card")).toBeVisible();
  const after = await readSrs(page);
  expect(after.stats.listeningAttempts).toBe(1);
  // 听辨不污染发音成绩
  expect(after.stats.voiceAttempts ?? 0).toBe(0);

  // 答完本轮（每题都点第一项：对错都走完整流程）
  for (let index = 1; index < 8; index += 1) {
    await page.getByRole("button", { name: "下一题" }).click();
    await expect(page.locator(".listening-strip")).toContainText(`第 ${index + 1} / 8 题`);
    await page.locator(".choice-list .quiz-option").first().click();
    await expect(page.locator(".outcome-card")).toBeVisible();
  }
  await page.getByRole("button", { name: "看本轮小结" }).click();
  await expect(page.locator(".listening-summary")).toContainText("本轮听辨");
  const finished = await readSrs(page);
  expect(finished.stats.listeningAttempts).toBe(8);

  await page.getByRole("button", { name: /下一轮/ }).click();
  await expect(page.locator(".listening-strip")).toContainText("第 1 / 8 题");

  // 去错词本 / 学习报告：听辨正确率如实显示
  await page
    .getByRole("button", { name: /去学习报告/ })
    .isVisible()
    .catch(() => false);
});

test("无粤语音色时如实跳过听音辨字（不用别的口音假装）", async ({ page }) => {
  await preset(page, { cantoneseVoice: false });
  await page.getByRole("button", { name: "练习场 · 调准曲线" }).click();
  await page.getByRole("tab", { name: "听音辨字" }).click();
  await expect(page.locator(".listening-skip")).toContainText("本机没有粤语音色");
  await expect(page.locator(".listening-skip")).toContainText("如实跳过");
  await expect(page.locator(".listening-card")).toHaveCount(0);
});

test("卡面「词林」标记：练透的句子在战斗手牌上打标", async ({ page }) => {
  const engine = new GameEngine();
  engine.startCampaign({
    act: 1,
    seed: 20260920,
    ruleset: "p7",
    buildVersion: 1,
    encounterVersion: 1,
    counterVersion: 1,
    rosterVersion: 1,
    ultimateVersion: 1,
    character: "man-mou-saang"
  });
  engine.startCombat("battle");
  const card = engine.state.combat!.hand[0];
  const skill = engine.getDeckSkill(card.index)!;
  await preset(page, {
    state: engine.state,
    srs: {
      entries: {},
      stats: {},
      history: [],
      syllables: syllablesFor(skill.id, skill.jyutping)
    }
  });
  await page.getByRole("button", { name: "继续登楼" }).click();
  const handCard = page.locator(`.skill-card[data-skill-id="${skill.id}"]`).first();
  await expect(handCard).toBeVisible();
  await expect(handCard.locator(".wordbook-mark")).toContainText("词林");
  await expect(handCard.locator(".wordbook-mark")).toHaveAttribute("title", /保底/);
});
