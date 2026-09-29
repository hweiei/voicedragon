/// <reference path="./wx.d.ts" />
/** 微信小游戏入口（打包为 dist/game.js） */
import { startGame } from "./game";
import { createWxPlatform } from "./platform-wx";

startGame(createWxPlatform());
