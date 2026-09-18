/**
 * 应用入口：组装内核 + 适配器 + 渲染层（组合根）。
 */

import "./ui/styles.css";
import { setKeepScreenOn } from "./adapters/platform";
import { saveGame } from "./adapters/storage";
import { createVoiceAdapter } from "./adapters/voice";
import { GameEngine } from "./core/engine";
import type { EmitOptions, GameState } from "./core/engine";
import { GameUI } from "./ui/ui";

const engine = new GameEngine();
const voiceAdapter = createVoiceAdapter();
const ui = new GameUI({ engine, voiceAdapter });

engine.subscribe((state: GameState, options: EmitOptions) => {
  if (options.save && state.phase !== "title") saveGame(state);
  ui.render(state, options);
});

void setKeepScreenOn();
ui.render(engine.state);

// 调试/自动化验收钩子：Playwright 与仿真工具从此读取/驱动引擎。
(globalThis as Record<string, unknown>).__VOICE_TOWER__ = {
  engine,
  voiceAdapter,
  getState: () => engine.state
};
