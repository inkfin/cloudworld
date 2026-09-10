import bpy, json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
path=root/'blender/output/cave.blend'
bpy.ops.wm.open_mainfile(filepath=str(path))
asset=bpy.data.collections['CAVE_ASSET']
assert bpy.data.objects['Anchor_Bird_0'].location.z==bpy.data.objects['Anchor_Bird_1'].location.z
assert all(not o.hide_render for o in asset.objects)
assert bpy.data.objects['Cave_Roof_Shell'].type=='MESH'
assert bpy.data.objects['Cave_Wall_Left'].type=='MESH'
scene=bpy.context.scene;scene.render.resolution_percentage=60
scene.render.filepath=str(root/'blender/output/cave-reopened.png')
bpy.ops.render.render(write_still=True)
print('REOPEN_RENDER_OK',path)
