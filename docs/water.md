# 海面、浪花与潮汐

海面改为两个独立的 Tessendorf / Phillips 波谱，替代少量正弦波叠加。173 米和 67 米的空间周期、独立种子和不同主方向，使大涌浪与较短风浪交错。每个波谱为 64×64，波高标准差分别为 0.43 和 0.105 米；高频能量经过衰减，不再额外叠加密集的小波纹。

CPU 每秒执行 15 次二维逆 FFT，得到真实高度、水平位移和法线，编码为半精度纹理。WebGPU 在相邻帧之间插值，并位移海面网格。近岛网格较密、远海较疏。这是运行时波谱演化，未使用预录的循环海浪贴图，也不是 GPU FFT。

## 深浅水与反光

WASM 地形延伸为连续的水下沙坡；256×256 高度场同时供海面和沙滩使用。深水呈深蓝色，浅水逐渐透出沙底。水深控制指数吸收与透明度，浪峰有少量透光色。透明混合是渲染近似，未计算光线穿过水面的折射偏移。

太阳/月光使用 GGX 分布、Smith 遮蔽和 Schlick 菲涅耳项，水的正入射反射率约 2%。法线来自 FFT 位移，不使用月光光带蒙版。天空反射以颜色渐变近似，随观察方向和时段变化。正交相机的视线平行，因此不会强制生成透视相机下的窄长月光路径。

## 近岸与潮汐

潮位实际改变水面顶点高度：`0.20 + 0.115 sin(2πt / 210)` 米。一个完整涨退潮周期压缩为 210 秒，便于探索时观察；这不是当地天文潮预报。

浅水会削弱远海波高，另叠加向岸传播、相位错开的涌水波。它与沙坡相交产生白色泡沫，涨水期间新生，之后逐渐消散；露出的沙滩会保留湿润颜色再缓慢变干。外海泡沫由水平位移的 Jacobian 压缩程度产生，并保留短时历史。海岸泡沫状态按地形高度与涌水波更新，不含每一项 FFT 波面的精确接触。

目前近岸是参数化涌水模型，不是完整浅水方程求解；没有翻卷浪管、飞溅粒子、绕岩绕射或体积流体。保留小岛的风格化画面，优先解决波形重复、深水质感和真正进入沙滩的潮水。

## 研究依据

- [Tessendorf：Simulating Ocean Water（作者报告目录）](https://jtessen.people.clemson.edu/reports/index.html)：随机频谱、色散演化和 FFT 海面。
- [Rare：The Technical Art of Sea of Thieves，SIGGRAPH 2018](https://history.siggraph.org/wp-content/uploads/2022/09/2018-Talks-Ang_The-Technical-Art-of-Sea-of-Thieves.pdf)：FFT 与风格化深水/浪峰透光、泡沫生成与历史消散可以结合；本项目独立实现了简化版本。
- [Filament：Physically Based Rendering](https://google.github.io/filament/Filament.html)：微表面反射和菲涅耳项。

## 验证

`npm test` 检查 FFT 往返、共轭对称性、波高、时间演化、泡沫范围、高低潮、潮水进入沙滩、退潮湿沙及岛上原有玩法。`npm run build` 检查 TypeScript、WASM 和生产构建。

浏览器检查白昼/夕阳/夜晚、海滩涨退水、桌面与手机尺寸，以及 WebGPU 实际着色器运行。开发模式的 `window.__islandTest.oceanTime(seconds)` 可定位潮汐阶段；只读 `window.__island.water` 显示当前潮位、方向与周期。
