# cloudworld.island · 岛屿来信

Cloudworld 的第一座可交互个人世界：森林、花原、沙滩营地与岩洞，经历白昼、夕阳和夜晚。以纸张颗粒、墨绿配色和赛璐珞分段着色呈现一个可以散步的小岛。

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

岛面约为初版的 4.84 倍，角色和动物保持原尺寸。两条相连的环路与望海坡支路串联营地、花原、林地和扩大后的岩洞；小径两侧有花，靠近路牌会显示去向。出生沙滩设有棉布帐篷和营火。

七种动物：兔子、狐狸、海鸥、小鸟、蝴蝶、螃蟹、海蟑螂。10 只可交互动物分散在各自栖息地，附近动物优先选择清楚、空旷的落脚点。接近时，兔子跳着逃开，鸟和海鸥起飞，狐狸趔趄后退让；碰撞不会由玩家连续推着动物滑行。反应有冷却，离开一段距离后才重新触发。镜头与附近角色之间的树冠会淡出，进洞时洞顶淡出。

动物作息跟随右上角时段和六分钟自动循环。切换后，各只动物错开约 0.3–3 秒改变目的地，速度平滑过渡，走回或飞回休息处，不传送。接触反应优先，受惊后继续当前作息。手札仅保留在当前页面会话中。

| 动物 | 白昼 | 夕阳 | 夜晚 |
| --- | --- | --- | --- |
| 兔子 | 林间觅食 | 更活跃，活动范围稍大 | 回栖息地睡觉 |
| 狐狸 | 经洞口回草窝休息 | 离洞巡游 | 更快、更广的林边巡游 |
| 小鸟 | 觅食，偶尔在洞顶歇脚 | 飞往洞顶归巢 | 收翼停歇 |
| 海鸥 | 海岸觅食 | 回海滩休息 | 留在休息地 |
| 蝴蝶 | 花原飞舞 | 回到花间收翅 | 低处收翅休息 |
| 螃蟹 | 缓慢巡视海岸 | 活动增多 | 继续夜间觅食 |
| 海蟑螂 | 原地休息 | 开始觅食 | 活动更频繁 |

休息有轻微呼吸动作，近处互动提示显示当前活动。空中作为背景的海鸥在黄昏逐渐飞向远海。这些作息服务于小岛体验，不是完整的野生动物生态模拟。

## 实现

| 部分 | 实现 |
| --- | --- |
| 页面、输入、相机、动物行为 | TypeScript |
| 渲染 | Three.js WebGPURenderer，真实 WebGPU 后端 |
| 自定义着色 | TSL 编译到 WGSL，分段光照、颜料颗粒、海岸波纹 |
| 地形与角色运动 | AssemblyScript 编译成 WebAssembly；地表网格和角色共用高度查询 |
| 碰撞 | WASM 岸线限制；动物圆形分离、玩家避让、树石圆形与洞壁矩形碰撞 |
| 模型 | Blender GLB 岩洞；程序化地形、树木、孩子和动物 |
| 音景 | 立体声海浪与材质脚步采样；轻风与琴曲合成；脚步短反射、喊声长混响分别处理 |
| 时段 | 共享 TSL 光色与海水参数；夕阳使用低空红霞、暖冷侧光、贴地长树影及波纹高光，三个时段各有琴曲 |
| 构建 | Vite，纯静态 `dist/` |

本版是视觉与交互 demo。动物使用候选落点评分、局部避障与洞口路径点，没有导航网格、完整生态模拟或存档。可见性优先适用于当前镜头内的活动动物，不会把岛上所有动物传送到玩家周围。长树影和红霞是风格化程序效果，海面高光随视角与波纹变化，未采用光线追踪。琴曲与风声仍为合成音色，不是真实钢琴录音。海潮采用 Jasinski 的海浪录音，脚步采用 Kenney 的 CC0 素材，来源、处理和授权见 [音频说明](public/audio/CREDITS.md)。沙地使用经过滤波的颗粒脚步素材进行拟音。水墨效果采用程序化近似，尚未使用手绘资产或屏幕空间墨线。洞穴岩壳使用 Blender 导出的 GLB，其余模型由代码生成；约 1.6 MB 音频采样随仓库分发，首次开启声音时从本站加载，不依赖第三方音频服务。字体可从 Google Fonts 加载，离线或加载失败时使用系统字体。

岩洞的可编辑源文件、导出方法、碰撞与落脚点约定见 [Blender 岩洞说明](blender/CAVE.md)。

主要文件：

```text
assembly/world.ts        WASM 地形、位移、速度和岸线
src/main.ts              应用、输入、相机、交互循环
src/simulation.ts        WASM 加载与接口
shared/terrain.ts        WASM 与渲染共用岛屿尺寸
src/world/trails.ts       连通小径、区域与营地位置
src/world/island.ts      地形、植被、营地、岩洞与动物分布
src/world/models.ts      角色和动物模型
src/world/materials.ts   TSL 水墨、赛璐珞与海水材质
src/world/cave-model.ts  加载 Blender GLB、地形贴合与材质转换
src/world/creatures.ts    动物落点、碰撞、小睡与停歇
src/world/routines.ts     各物种的昼夜作息、速度与活动范围
src/world/visibility.ts   镜头遮挡查询与树冠淡出
src/world/spatial.ts      地面材质、洞穴区域与碰撞查询
src/environment.ts       时段与画面、风力过渡
src/audio.ts             脚步、海浪、琴曲、洞风与喊声回音
src/style.css            页面与移动端布局
```

## 验证与打包

```sh
npm test                 # WASM、动物接触/分离、睡眠/停歇、整条小径与洞口通行测试
npm run test:ego         # 已安装 Ego Lite，且 npm run dev 正在运行；完整交互与音频验收
npm run test:browser     # 原版 Chrome/Playwright 冒烟测试
npm run build            # 编译 WASM、TypeScript 检查、生成静态站
npm run preview          # 预览生产构建
```

本次使用 Ego Lite 实际 WebGPU 验收时段切换、四种脚步声、动物接触反应、洞内喊叫、静音及手机触控，截图放在 `.playwright/`。`tests/audio.qa.js` 通过 OfflineAudioContext 渲染并比较洞内外喊声尾音；`tests/audio-quality.qa.js` 分别渲染音乐、海潮、风声与四种脚步，检查实际时段差异、风与琴声比例、实时切换和石地短尾。`npm test` 固定随机种子，加速模拟两分钟动物行为，也覆盖两只兔子完全重叠的情况。

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
