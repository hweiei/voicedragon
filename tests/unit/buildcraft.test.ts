import { describe, expect, test } from "vitest";
import {
  UPGRADE_POWER,
  buildOverview,
  capabilities,
  deckSkill,
  removalPrice,
  removalReason,
  synergyHints,
  upgradedSkill,
  upgradesAfterRemoval
} from "../../src/core/buildcraft";
import { ALL_SKILLS, lookupSkill } from "../../src/core/content";

describe("P8-A 构筑纯函数", () => {
  test("36张卡皆有实际能力标签；十二升级不会污染全局定义", () => {
    for (const skill of ALL_SKILLS) expect(capabilities(skill).length).toBeGreaterThan(0);
    expect(Object.keys(UPGRADE_POWER)).toHaveLength(12);
    for (const [id, power] of Object.entries(UPGRADE_POWER)) {
      const original = lookupSkill(id)!;
      const before = JSON.stringify(original);
      const upgraded = upgradedSkill(original)!;
      expect(upgraded).not.toBe(original);
      expect(upgraded.power).toBe(power);
      expect(upgraded.power).toBeGreaterThan(original.power);
      expect(upgraded.cost).toBe(original.cost);
      expect(upgraded.id).toBe(original.id);
      expect(upgraded.phrase).toBe(original.phrase);
      expect(JSON.stringify(original)).toBe(before);
    }
  });
  test("重复卡按槽位升级，旧局读取可显式忽略进度", () => {
    const p = { deck: ["ding-ngang-soeng", "ding-ngang-soeng"], upgradedSlots: [1] };
    expect(deckSkill(p, 0)!.power).toBe(8);
    expect(deckSkill(p, 1)!.power).toBe(10);
    expect(deckSkill(p, 1, false)!.power).toBe(8);
    for (const i of [-1, 0.5, 2, Number.NaN]) expect(deckSkill(p, i)).toBeUndefined();
  });
  test("删牌槽位平移与收费上限", () => {
    expect(upgradesAfterRemoval([0, 2, 4], 2)).toEqual([0, 3]);
    expect(upgradesAfterRemoval([0, 2, 4], 1)).toEqual([0, 1, 3]);
    expect([0, 1, 5, 20].map((n) => removalPrice({ deck: [], removedCards: n }))).toEqual([
      25, 35, 75, 75
    ]);
  });
  test("最少五张，保留最后输出，不能靠未知卡绕过", () => {
    expect(removalReason({ deck: Array(5).fill("ding-ngang-soeng") }, 0)).toContain("5");
    expect(
      removalReason({ deck: ["ding-ngang-soeng", ...Array(5).fill("m-sai-geng")] }, 0)
    ).toContain("最后");
    expect(removalReason({ deck: Array(6).fill("ding-ngang-soeng") }, 0)).toBeNull();
  });
  test("费用分布按实体计数；流派说明不承诺自动反击", () => {
    const p = { deck: ["jat-cai-soeng", "gaa-jau", "p7-jau-gung-jau-sau"] };
    const overview = buildOverview(p);
    expect(overview.costs).toEqual([0, 2, 1, 0]);
    expect(overview.counts.multi).toBe(1);
    expect(overview.flowStatus[0]).toContain("已可联动");
  });
});

describe("可解释协同提示", () => {
  test("多段↔增势双向，数字来自当前实体牌组", () => {
    expect(
      synergyHints(lookupSkill("jat-cai-soeng")!, { deck: ["gaa-jau", "gaa-jau"] })[0].text
    ).toContain("2 张增势");
    expect(synergyHints(lookupSkill("gaa-jau")!, { deck: ["jat-cai-soeng"] })[0].text).toContain(
      "1 张多段"
    );
  });
  test("缺口提示仅在确实缺少能力时出现", () => {
    const cleanse = lookupSkill("p7-wan-jyu-sin")!;
    expect(
      synergyHints(cleanse, { deck: ["ding-ngang-soeng"] }).some((h) => h.text.includes("尚无净化"))
    ).toBe(true);
    expect(
      synergyHints(cleanse, { deck: [cleanse.id] }).some((h) => h.text.includes("尚无净化"))
    ).toBe(false);
  });
  test("换手、大牌组与重复卡/费用提示，上限两条且不修改输入", () => {
    const p = { deck: Array(8).fill("p7-m-hou-fong-hei"), upgradedSlots: [1] };
    const before = JSON.stringify(p);
    const hints = synergyHints(lookupSkill("p7-m-hou-fong-hei")!, p);
    expect(hints).toHaveLength(2);
    expect(hints[0].text).toContain("8 张同名");
    expect(hints[1].text).toContain("声气");
    expect(synergyHints(lookupSkill("faai-di-zau")!, p)[0].text).toContain("不保证");
    expect(JSON.stringify(p)).toBe(before);
  });
});
