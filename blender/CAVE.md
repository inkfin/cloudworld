# 岩洞模型

洞穴岩壳在 Blender 中用 `bpy` 生成并保存为可编辑网格，网页加载导出的 `public/models/cave.glb`。建模脚本是制作工具，浏览器不会运行 Blender。树木、地形、洞内石地、草窝和木平台仍由 TypeScript / WASM 生成。

## 制作与检查

本机已有的调用入口：

```sh
scripts/blender.sh --script blender/scripts/cave.py
scripts/blender.sh --script blender/scripts/verify_cave.py
cp blender/output/cave.glb public/models/cave.glb
npm test
npm run build
# 另一个终端启动 npm run dev 后，检查实际 WebGPU 画面：
node scripts/qa.mjs --suite cave
```

没有包装脚本的机器可以直接运行 `blender --background --factory-startup --python blender/scripts/cave.py`，然后同样运行检查脚本。生成文件位于 `blender/output/`：`cave.blend`、`cave.glb`、外观/剖面预览、重新打开场景后的检查渲染，以及 `cave-stats.json`。

`cave.py` 会重新生成场景。若要手动修改，请另存 `.blend`，避免再次运行生成脚本覆盖手工修改。导出时仅选择 `CAVE_ASSET` 集合，使用 GLB、应用变换、Y Up。`PREVIEW_ONLY` 的相机、灯光和地面不进入网页。

## 场景与网页约定

- Blender 使用米和 Z Up；脚本将游戏的 `(x,y,z)` 转成 Blender 的 `(x,-z,y)`。GLB 导出后恢复游戏坐标。
- 模型原点对应 `CAVE.x / CAVE.z`。网页按现有 WASM 高度函数贴合岩壳下方地形。
- `Cave_Roof*` 名称表示可淡出的洞顶。导出时保留命名，进入洞穴后只淡出这些部分。
- `Cave_Roof_Perch*` 是固定高度的鸟类落脚平台，不做地形变形。两个鸟锚点的局部高度为 5.33 米，对应 `CAVE.roofHeight + .13`。
- 碰撞仍是简化的侧墙和后壁区域，动物导航仍使用洞口路径点。模型更改后须检查通道净空，不能只看预览图。
- 网页用模型基础色重建现有 `ink()` 材质，保留水墨分段着色、昼夜光色与遮挡淡出。Blender 预览灯光不会直接成为网页灯光。

当前模型 798 个三角形、20 个材质子网格，GLB 约 56 KiB，无贴图。自动测试读取真实 GLB，检查通道、鸟的支撑平台和洞顶淡出。增加建模细节不会自动提升性能；这里以轮廓改善和可编辑性为目标。

## 如何选择

| 方式 | 适合 | 代价 |
| --- | --- | --- |
| 浏览器代码生成 | 地形、重复植被、随机分布、快速参数调整 | 精细轮廓、拓扑和局部雕形不直观 |
| Blender 资产 | 洞穴、地标建筑、主角等需要精细外形的对象 | 多一道导出与加载流程，需管理面数、材质、碰撞和坐标 |
| 混合使用 | 资产负责外形，代码负责地形贴合与交互 | 需明确模型与游戏的接口约定 |
