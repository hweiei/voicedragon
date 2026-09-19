/**
 * P5 内容包架构：每幕一份同构数据包（技能/敌人/精英/Boss/遗物/事件/楼层名）。
 * 第一幕直接包裹 data.ts 既有数据（行为逐位不变）；第二、三幕为新增差分包。
 * 引擎经 content/index.ts 注册表取当前幕内容，新幕只加文件、不改内核机制。
 */

import type { EnemyBlueprint, GameEventContent, Relic, Skill } from "../data";

export interface ActContentPack {
  /** 幕号（1 起） */
  act: number;
  /** 幕主题名（标题屏 / 地图眉头 / 结算屏共用） */
  theme: string;
  /** 幕氛围副题 */
  subtitle: string;
  /** 开局公告（startCampaign notice，含主题名引导文案） */
  notice: string;
  /** 战役楼层名（按行 1~15；行号超出时回退 fallbackName） */
  floorNames: string[];
  /** 楼层名回退（战役地图行号超出 floorNames 时） */
  fallbackName: string;
  /** 幕 Boss 落幕后的胜利文案（结算屏副题） */
  victoryText: string;
  /** 本幕新技能（进本幕及之后的奖励/商店卡池） */
  skills: Skill[];
  /** 本幕普通敌人池（按楼层逐步解锁，沿用 ENEMIES.slice 规则） */
  enemies: EnemyBlueprint[];
  /** 本幕精英池 */
  elites: EnemyBlueprint[];
  /** 本幕 Boss（地图顶点唯一） */
  boss: EnemyBlueprint;
  /** 本幕遗物池（精英掉落/商店/宝箱抽取） */
  relics: Relic[];
  /** 本幕事件池 */
  events: GameEventContent[];
}
