import { GameEngine } from "./engine.js";
import { GameUI } from "./ui.js";
import { createVoiceAdapter } from "./voice/adapters.js";
import { saveGame } from "./storage.js";
import { setKeepScreenOn } from "./platform.js";

const engine = new GameEngine();
const voiceAdapter = createVoiceAdapter();
const ui = new GameUI({ engine, voiceAdapter });

engine.subscribe((state, options) => {
  if (options.save && state.phase !== "title") saveGame(state);
  ui.render(state, options);
});

setKeepScreenOn();
ui.render(engine.state);

// Exposed for automated acceptance checks and mini-game shell integration.
globalThis.__VOICE_TOWER__ = {
  engine,
  voiceAdapter,
  getState: () => engine.state
};
