import { describe, expect, it } from "vitest";
import { CARDS, NPCS } from "../src/street/data";
import {
  currentIntent,
  endTurn,
  genMap,
  hasMTail,
  hasRusheng,
  newRun,
  playCard,
  reachable,
  rng,
  startCombat
} from "../src/street/engine";

describe("street engine", () => {
  it("地图每个节点都可达，终点是 Boss", () => {
    for (let s = 1; s < 200; s++) {
      const map = genMap(rng(s));
      const boss = map.filter((n) => n.type === "boss");
      expect(boss).toHaveLength(1);
      for (const n of map.filter((k) => k.row > 0)) {
        expect(map.some((m) => m.next.includes(n.id))).toBe(true);
      }
    }
  });

  it("所有卡牌和意图都有粤拼", () => {
    for (const c of Object.values(CARDS)) expect(c.jp).toMatch(/\d/);
    for (const n of Object.values(NPCS)) for (const i of n.intents) expect(i.jp).toMatch(/\d/);
  });

  it("密码卡判定", () => {
    expect(hasRusheng("ngo5 jiu3 jat1")).toBe(true);
    expect(hasRusheng("nei5 hou2")).toBe(false);
    expect(hasMTail("jam2 mat1")).toBe(true);
    expect(hasMTail("m4 goi1")).toBe(false);
  });

  it("贪心策略能打完一局且不卡死", () => {
    let wins = 0;
    for (let s = 1; s <= 60; s++) {
      const run = newRun(s);
      let over = false;
      while (!over) {
        const next = reachable(run);
        if (!next.length) break;
        const node = run.map.find((n) => n.id === next[0]);
        if (!node) break;
        run.at = node.id;
        run.visited.push(node.id);
        if (node.type !== "fight" && node.type !== "boss") continue;
        startCombat(run, node.npc ?? "auntie");
        let guard = 0;
        while (run.combat && guard++ < 60) {
          const c = run.combat;
          const intent = currentIntent(run);
          let played = true;
          while (played) {
            played = false;
            const order = c.hand
              .map((id, i) => ({ i, card: CARDS[id] }))
              .filter((x) => x.card.cost <= c.energy)
              .sort(
                (a, b) =>
                  Number(b.card.tags?.includes(intent?.need ?? "raise") ?? 0) -
                  Number(a.card.tags?.includes(intent?.need ?? "raise") ?? 0)
              );
            if (order.length) {
              const r = playCard(run, order[0].i, s % 2 === 0, true);
              played = r.ok;
              if (r.won) break;
            }
          }
          if (c.progress >= c.target) {
            run.combat = null;
            if (node.type === "boss") {
              wins++;
              over = true;
            }
            break;
          }
          if (endTurn(run).lost) {
            over = true;
            break;
          }
        }
        expect(guard).toBeLessThan(60);
      }
    }
    expect(wins).toBeGreaterThan(0);
  });
});
