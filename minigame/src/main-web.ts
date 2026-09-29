/** 浏览器预览入口（打包为 preview/game.js） */
import { startGame } from "./game";
import { createWebPlatform } from "./platform-web";

const canvas = document.getElementById("stage") as HTMLCanvasElement;
startGame(createWebPlatform(canvas, "./"));
