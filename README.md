# 声震龙楼 · 粤语开口闯关

**v0.3.0 · 第一章完整测试版**。面向会普通话的粤语初学者：听示范、开口录音、走分支路线，在茶餐厅完成一次三轮点单。

## 已包含
- 六层入门教学、教学巷/实战街两种路线、五种不重复学习锦囊。
- 十段内置粤语合成示范，正常/慢速与分句朗读；PWA 缓存完成后可离线使用。
- 本地录音、回放、明确标注的阅读模式；不会制造发音评分。
- 终层三轮对话：招呼店员、点单、感谢服务；中途刷新可恢复。
- 跨局学习手账、每日回忆、自评调度、JSON 备份与确认恢复。
- `?mode=classic` 保留原版 Roguelike 冒险与独立存档；旧挑战链接兼容。

## 本地运行
```bash
npm ci
npm run dev -- --host 0.0.0.0
```
录音需要 HTTPS 或 localhost 安全上下文。语音示范通过真实按钮点击播放，不自动播放。

## 验收与构建
```bash
npx playwright install --with-deps chromium firefox webkit
npm run release:check
npm run build
```
生产文件在 `dist/`。完整验收包含逻辑/仿真、业务 E2E、浏览器发布矩阵、Lighthouse、视觉基线、产物和体积检查。

## 发布
- **GitHub Pages**：管理员先在 Settings → Pages → Source 选择 **GitHub Actions**。`main` 的 `ci` 工作流成功后，`pages` 工作流才会部署。首次配置后也可 Actions → pages → Run workflow。
- **Cloudflare Pages / 其他静态托管**：上传 `dist/` 内容，根目录须包含 `index.html`。不需要后端或 API key。
- 仓库 SSH deploy key 只提供 Git 访问，不能替代 Pages 管理权限。私有仓库是否支持 Pages 取决于账户方案。
- 不要双击本地 `index.html` 作为验收方式；需 HTTP/HTTPS 服务。

## 数据与教学边界
- 新手塔录音只在当前页面内存中暂存，不上传，不导入备份。
- 学习手账仅保存在当前网站/浏览器；切换网站或设备前请导出备份。
- 录音文件生成不证明有效开口；阅读、回忆自评、通关都不等于发音合格。
- 示范为用户选声后生成的粤语合成音频，来源清单见 `public/audio/yue/provenance.json`；尚未完成独立母语审校。
- 浏览器自动化不等于真实手机、Safari 真机或学习效果验证。
- 原版冒险中的 Web Speech 识别可能使用浏览器提供的在线服务，与新手塔的纯本地录音不同。

最新首章交付说明：`docs/P21-FIRST-CHAPTER-RELEASE.md`。
