# cloudworld.island · 岛屿来信

Cloudworld 的第一座可交互个人世界：白昼、森林、沙滩与岩洞。以纸张颗粒、墨绿配色和赛璐珞分段着色呈现一个可以散步的小岛。

## 本地运行

需要 Node.js 22 或更新版本，以及支持 WebGPU 的浏览器。

```sh
npm ci
npm run dev
```

打开终端打印的 localhost 地址。WebGPU 需要安全上下文，请用 `localhost` 或 HTTPS；直接双击 HTML、通过普通 HTTP 的局域网 IP 打开，可能无法使用 WebGPU。项目在缺少 WebGPU 时显示说明，不静默回退到 WebGL。

## 操作

- 点击「走进小岛」，用 WASD / 方向键漫步，Shift 小跑。
- 拖动鼠标环顾，滚轮缩放；右下角准星切换全岛远景与角色跟随。
- 靠近动物按 E，或点击互动提示，记录一次偶遇。
- 触屏用屏幕方向键移动，单指环顾、双指缩放。
- 右下角音符开启或关闭声音；旁边的「≋」可分别调整音乐、海潮、风声和脚步，设置保存在当前浏览器。风声默认较轻。
- 沙地、草地、木板与石地使用不同采样，每种四个变体轮换。石地保留短促落脚声，洞内只加入少量短反射。
- 走上东侧木平台进入岩洞，按 Q 或洞内按钮喊一声，听海潮与喊声的回音。声音为合成元音，不需要麦克风。
- 右上角切换白昼、夕阳、夜晚；「流转」开启六分钟循环。手动选择时段会停止自动流转。

七种动物：兔子、狐狸、海鸥、小鸟、蝴蝶、螃蟹、海蟑螂。动物优先选择可见、空旷的落脚点，相互避让并避开玩家、树干和洞壁。镜头与附近角色之间的树冠会淡出，进洞时洞顶淡出。

狐狸会经过入口返回草窝小睡，再回到林间；小鸟会收翼停在洞顶。当前小睡、停歇使用独立短周期，完整的昼夜动物作息留待下一步。手札仅保留在当前页面会话中。

## 实现

| 部分 | 实现 |
| --- | --- |
| 页面、输入、相机、动物行为 | TypeScript |
| 渲染 | Three.js WebGPURenderer，真实 WebGPU 后端 |
| 自定义着色 | TSL 编译到 WGSL，分段光照、颜料颗粒、海岸波纹 |
| 地形与角色运动 | AssemblyScript 编译成 WebAssembly；地表网格和角色共用高度查询 |
| 碰撞 | WASM 岸线限制；动物圆形分离、玩家避让、树石圆形与洞壁矩形碰撞 |
| 模型 | 程序化低多边形地形、树木、岩洞、孩子和动物 |
| 音景 | 立体声海浪与材质脚步采样；轻风与琴曲合成；脚步短反射、喊声长混响分别处理 |
| 时段 | 共享 TSL 光色与海水参数平滑变化；白昼、夕阳和夜晚各有琴曲与节奏 |
| 构建 | Vite，纯静态 `dist/` |

本版是视觉与交互 demo。动物使用候选落点评分、局部避障与洞口路径点，没有导航网格、完整生态模拟或存档。可见性优先适用于当前镜头内的活动动物，不会把岛上所有动物传送到玩家周围。琴曲与风声仍为合成音色，不是真实钢琴录音。海潮采用 Jasinski 的海浪录音，脚步采用 Kenney 的 CC0 素材，来源、处理和授权见 [音频说明](public/audio/CREDITS.md)。沙地使用经过滤波的颗粒脚步素材进行拟音。水墨效果采用程序化近似，尚未使用手绘资产或屏幕空间墨线。模型由代码生成，约 1.6 MB 音频采样随仓库分发，首次开启声音时从本站加载，不依赖第三方音频服务。字体可从 Google Fonts 加载，离线或加载失败时使用系统字体。

主要文件：

```text
assembly/world.ts        WASM 地形、位移、速度和岸线
src/main.ts              应用、输入、相机、交互循环
src/simulation.ts        WASM 加载与接口
src/world/island.ts      地形、植被、岩洞与动物分布
src/world/models.ts      角色和动物模型
src/world/materials.ts   TSL 水墨、赛璐珞与海水材质
src/world/creatures.ts    动物落点、碰撞、小睡与停歇
src/world/visibility.ts   镜头遮挡查询与树冠淡出
src/world/spatial.ts      地面材质、洞穴区域与碰撞查询
src/environment.ts       时段与画面、风力过渡
src/audio.ts             脚步、海浪、琴曲、洞风与喊声回音
src/style.css            页面与移动端布局
```

## 验证与打包

```sh
npm test                 # WASM、动物重叠/可见性、睡眠/停歇、洞口通行测试
npm run test:ego         # 已安装 Ego Lite，且 npm run dev 正在运行；完整交互与音频验收
npm run test:browser     # 原版 Chrome/Playwright 冒烟测试
npm run build            # 编译 WASM、TypeScript 检查、生成静态站
npm run preview          # 预览生产构建
```

本次使用 Ego Lite 实际 WebGPU 验收时段切换、四种脚步声、洞内喊叫、静音及手机触控，截图放在 `.playwright/`。`tests/audio.qa.js` 通过 OfflineAudioContext 渲染并比较洞内外喊声尾音；`tests/audio-quality.qa.js` 分别渲染音乐、海潮、风声与四种脚步，检查实际时段差异、风与琴声比例、实时切换和石地短尾。`npm test` 固定随机种子，加速模拟两分钟动物行为，也覆盖两只兔子完全重叠的情况。

原版 Playwright 冒烟脚本保留在项目中。手机验收使用触屏模拟，真实手机性能与 WebGPU 支持需要另测。

## GitHub Pages

项目已包含 `.github/workflows/pages.yml`，推送到 `main` 后执行测试、构建、部署。

1. 将本目录提交到你的 GitHub 仓库，默认分支使用 `main`。
2. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 推送 `main`，或手动运行 **Deploy island to GitHub Pages**。
4. 等待 Actions 成功后，使用部署任务输出的 Pages 地址。

Vite 使用相对资源路径，WASM 也从站点基路径加载，因此可部署在 `https://<user>.github.io/<repo>/`。不需要后端、数据库或跨域隔离头。

源码仓库：[inkfin/cloudworld](https://github.com/inkfin/cloudworld)。GitHub Pages 地址为 `https://inkfin.github.io/cloudworld/`，部署状态以仓库 Actions 为准。`cloudworld.island` 在本项目中是世界名称，尚未配置同名自定义域名。

## 技术参考

- [Three.js WebGPU renderer](https://threejs.org/manual/en/webgpurenderer)
- [Three.js shading language](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)
- [AssemblyScript](https://www.assemblyscript.org/)

## 声音与时段

白昼使用高音区分解和弦，近岸潮声约每 6.8 秒一轮；夕阳切换到较低的和弦，海潮间隔约 9.5 秒；夜晚使用稀疏柔音，潮声更远、约 13 秒一轮，风声也进一步降低。这是用于美学表达的时段配乐，不模拟真实潮汐物理。切换时段时旧声层淡出，新编排从第一句进入。

海潮、风、音乐、脚步分别经过独立混音通道。木板和石地没有附加电子音高滑动，四种脚步都不送入喊叫使用的长混响。录音保存为原采样率的 PCM WAV，避免再增加一轮有损编码；WAV 转换不会恢复源 Ogg 已丢失的信息。
