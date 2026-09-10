# 海面与月光

海水使用 20 组固定种子的方向波谱。每组有独立方向、相位和非整数倍波长；频率遵循深水重力/毛细波色散关系 `omega² = g*k + (sigma/rho)*k³`。长波移动网格顶点，全部波分量的解析斜率生成水面法线。像素以下的波使用屏幕导数衰减，避免闪烁。

水的正入射反射率由折射率 1.333 计算，约 2%。直接光使用 GGX 法线分布、Smith 相关遮蔽与 Schlick 菲涅耳项；环境光以天空颜色渐变近似。太阳和月亮共用方向光计算，夜间亮度经过画面曝光标定。没有月光光带蒙版、屏幕空间圆盘或径向重复泡沫线。

当前相机为正交投影，各像素视线平行。远处月光在相近朝向的波面上反射，不会像透视相机一样总形成窄长的高光路径；转动相机时反射应减弱或消失，不强制追随画面中心。

这是实时近似，未实现完整 FFT 海洋、浅水折射/破浪求解、岛屿的水面镜像或光线追踪。近岸通过波高与岸距生成少量泡沫，并降低波高。保留原来的水墨配色，波面与反射计算遵循上述模型。

参考：

- [NVIDIA GPU Gems：Effective Water Simulation from Physical Models](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models)
- [Filament：Physically Based Rendering](https://google.github.io/filament/Filament.html)

验证：`npm test` 检查波谱色散、解析斜率与数值导数、短周期平铺、相机方向和时段切换；`npm run build` 编译 WebGPU 材质。浏览器检查还须包括夜间对光/背光方向、白昼、夕阳、手机尺寸和动态画面。
