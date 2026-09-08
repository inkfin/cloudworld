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
- 右下角音符开启或关闭海浪与钢琴；声音默认关闭。

七种动物：兔子、狐狸、海鸥、小鸟、蝴蝶、螃蟹、海蟑螂。手札仅保留在当前页面会话中。

## 实现

| 部分 | 实现 |
| --- | --- |
| 页面、输入、相机、动物行为 | TypeScript |
| 渲染 | Three.js WebGPURenderer，真实 WebGPU 后端 |
| 自定义着色 | TSL 编译到 WGSL，分段光照、颜料颗粒、海岸波纹 |
| 地形与角色运动 | AssemblyScript 编译成 WebAssembly；地表网格和角色共用高度查询 |
| 碰撞 | WASM 岸线限制，TypeScript 树干与石块的圆形碰撞 |
| 模型 | 程序化低多边形地形、树木、岩洞、孩子和动物 |
| 音景 | Web Audio 滤波噪声海浪、衰减谐波钢琴音色 |
| 构建 | Vite，纯静态 `dist/` |

本版是视觉与交互 demo。动物采用简单漫游和转向，没有导航网格、完整生态模拟或存档。音景是合成音色，不是真实钢琴录音。水墨效果采用程序化近似，尚未使用手绘资产或屏幕空间墨线。模型和音景均由代码生成，无需下载美术或音频素材。字体可从 Google Fonts 加载，离线或加载失败时使用系统字体。

主要文件：

```text
assembly/world.ts        WASM 地形、位移、速度和岸线
src/main.ts              应用、输入、相机、交互循环
src/simulation.ts        WASM 加载与接口
src/world/island.ts      地形、植被、岩洞与动物分布
src/world/models.ts      角色和动物模型
src/world/materials.ts   TSL 水墨、赛璐珞与海水材质
src/audio.ts             合成海浪与钢琴
src/style.css            页面与移动端布局
```

## 验证与打包

```sh
npm test                 # WASM 地形、边界、移动与时间步长测试
npm run test:browser     # 本机安装 Chrome；验证 WebGPU、交互、移动端与不支持提示
npm run build            # 编译 WASM、TypeScript 检查、生成静态站
npm run preview          # 预览生产构建
```

浏览器测试以 headless Chrome 执行并启用 WebGPU 测试开关，截图放在 `.playwright/`。手机用 Chrome 触屏模拟验收，实际设备的性能和 WebGPU 支持需要另测。

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
