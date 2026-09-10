"""Editable, low-poly cave shell. Coordinates below are the game's X/Y-up/Z-front.
Run with scripts/blender.sh --script blender/scripts/cave.py.
"""
import bpy, math, random, json
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'blender/output'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
random.seed(720)
asset = bpy.data.collections.new('CAVE_ASSET'); bpy.context.scene.collection.children.link(asset)
preview = bpy.data.collections.new('PREVIEW_ONLY'); bpy.context.scene.collection.children.link(preview)

def mat(name, rgb):
    m=bpy.data.materials.new(name); m.diffuse_color=(*rgb,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*rgb,1); p.inputs['Roughness'].default_value=.94
    return m
# Linear material values; the GLB and Blender preview share this palette.
materials=[mat('Slate',(.28,.35,.30)),mat('Weathered_edges',(.39,.44,.35)),mat('Cool_inner_stone',(.16,.23,.21)),mat('Moss',(.24,.34,.20)),mat('Pale_strata',(.47,.48,.37))]
def xyz(v): return (v[0],-v[2],v[1])
def mesh(name, verts, faces, slots, collection=asset):
    g=bpy.data.meshes.new(name+'_geometry');g.from_pydata([xyz(v) for v in verts],[],faces);g.update()
    o=bpy.data.objects.new(name,g);collection.objects.link(o)
    for m in materials:g.materials.append(m)
    for p,slot in zip(g.polygons,slots):p.material_index=slot;p.use_smooth=False
    # Ensure consistent outward normals on each closed rock volume.
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)
    return o
angles=[0,.22,.48,.75,1.03,1.3,1.57,1.83,2.1,2.38,2.66,2.92,math.pi]
depths=[-5.05,-3.8,-2.15,-.45,1.35,3.2,5.05]

def point(j,i,outer):
    a=angles[i];z=depths[j]
    wobble=math.sin(j*1.6+i*2.1)
    width=3.78+.065*math.sin(j*1.7) if not outer else 5.0+.3*wobble+.3*math.sin(a)**2
    height=3.72+.09*math.sin(j*.9)+.08*math.sin(i*1.7+j) if not outer else 4.45+.24*wobble+.38*math.sin(a-.7)
    x=width*math.cos(a)+(.08*math.sin(j) if outer else 0)
    y=.18+height*math.sin(a)
    if i in [0,len(angles)-1]:y=-.45
    return (x,y,z+(.38*math.sin(i*1.3)+.13*math.cos(i*.7) if outer else 0))
# Roof and walls meet at the same vertices. Individual sections are closed volumes.
for name,lo,hi in [('Cave_Wall_Right',0,2),('Cave_Roof_Shell',2,10),('Cave_Wall_Left',10,12)]:
    verts=[];index={};faces=[];slots=[]
    for shell in [0,1]:
        for j in range(len(depths)):
            for i in range(lo,hi+1):index[shell,j,i]=len(verts);verts.append(point(j,i,shell==1))
    def quad(ids,slot,split=False):
        if split:faces.extend([(ids[0],ids[1],ids[2]),(ids[0],ids[2],ids[3])]);slots.extend([slot,slot if random.random()<.7 else 1])
        else:faces.append(tuple(ids));slots.append(slot)
    for shell in [0,1]:
        for j in range(len(depths)-1):
            for i in range(lo,hi):quad([index[shell,j,i],index[shell,j+1,i],index[shell,j+1,i+1],index[shell,j,i+1]],2 if not shell else (1 if (i+j)%4==0 else 0),shell==1)
    for j in [0,len(depths)-1]:
        for i in range(lo,hi):quad([index[0,j,i],index[0,j,i+1],index[1,j,i+1],index[1,j,i]],1)
    for i in [lo,hi]:
        for j in range(len(depths)-1):quad([index[0,j,i],index[1,j,i],index[1,j+1,i],index[0,j+1,i]],0)
    mesh(name,verts,faces,slots)
# Rear wall follows the arch rather than capping the entrance.
verts=[]
for z in [-5.72,-5.06]:
    for i in range(len(angles)):
        x,y,_=point(0,i,True);verts.append((x,y,z))
n=len(angles);faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))];slots=[0,2]
for i in range(n):faces.append((i,(i+1)%n,(i+1)%n+n,i+n));slots.append(0)
mesh('Cave_Back',verts,faces,slots)

def rock(name,center,scale,slot=0,seed=0):
    r=random.Random(seed);verts=[];sides=7
    for y,rad in [(-.5,.8),(.15,1),(.5,.67)]:
        for i in range(sides):
            a=i/sides*math.tau;f=1+r.uniform(-.1,.1)
            verts.append((center[0]+math.cos(a)*scale[0]*rad*f,center[1]+y*scale[1],center[2]+math.sin(a)*scale[2]*rad*f))
    faces=[tuple(range(sides-1,-1,-1)),tuple(range(sides*2,sides*3))]
    for j in range(2):
        for i in range(sides):faces.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
    return mesh(name,verts,faces,[slot]*len(faces))
# Eroded rim pieces stay outside the walking envelope, with a few broad strata on top.
for i,(x,y,z,sx,sy,sz) in enumerate([(-4.6,.75,4.3,.75,1.7,1.1),(4.65,.55,4.5,.65,1.1,.9),(-4.8,1.25,-2.1,.65,.75,1.8),(4.65,1.3,.3,.8,.65,1.9)]):
    rock('Cave_Stratum_'+str(i),(x,y,z),(sx,sy,sz),1,50+i)
# Moss patches are inset into the crest, not floating plates.
for i,(x,y,z,sx,sz) in enumerate([(-2,4.48,-2,1.25,1.5),(1.8,4.38,1,1.1,1.4),(-.7,4.8,3.3,1.3,.8)]):
    rock('Cave_Roof_Moss_'+str(i),(x,y,z),(sx,.14,sz),3,70+i)
# Flat top at 5.33 matches two bird feet at y=roofHeight+.13.
rock('Cave_Roof_Perch',(.3,5.13,-.6),(2.05,.4,.85),1,91)
rock('Cave_Roof_Perch_Moss',(-1,5.27,-.9),(.35,.08,.25),3,92)
for name,p in [('Anchor_Fox_Bed',(-1.4,0,-1.4)),('Anchor_Bird_0',(1.1,5.33,-.6)),('Anchor_Bird_1',(-.5,5.33,-.6))]:
    o=bpy.data.objects.new(name,None);o.location=xyz(p);o.empty_display_type='SPHERE';o.empty_display_size=.12;asset.objects.link(o)
# Export only game assets, excluding studio lights and the inspection camera.
bpy.ops.object.select_all(action='DESELECT')
for o in asset.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'cave.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in asset.objects if o.type=='MESH')
(OUT/'cave-stats.json').write_text(json.dumps({'triangles':triangles,'materials':len({p.material_index for o in asset.objects if o.type=='MESH' for p in o.data.polygons}),'bytes':(OUT/'cave.glb').stat().st_size,'roofHeight':5.2,'anchors':{'bed':[-1.4,0,-1.4],'birds':[[1.1,5.33,-.6],[-.5,5.33,-.6]]}},indent=2))
# Reusable inspection studio, saved in the editable .blend.
mesh('Studio_Ground',[(-14,-.5,-14),(14,-.5,-14),(14,-.5,14),(-14,-.5,14)],[(0,1,2,3)],[4],preview)
scene=bpy.context.scene
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
engines={e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items}
scene.render.engine='BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x=1280;scene.render.resolution_y=960;scene.render.resolution_percentage=100
scene.world.color=(.35,.35,.35)
scene.view_settings.view_transform='AgX'
def light(name,loc,power,size,color):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    obj=bpy.data.objects.new(name,data);preview.objects.link(obj);obj.location=xyz(loc);obj.rotation_euler=(Vector(xyz((0,1,0)))-obj.location).to_track_quat('-Z','Y').to_euler()
light('Warm_window',(-6,12,10),1800,9,(1,.86,.69));light('Cool_fill',(9,7,1),1000,8,(.7,.85,1));light('Rim',(-2,10,-9),1500,7,(1,.94,.8))
data=bpy.data.cameras.new('Cave_Inspection');camera=bpy.data.objects.new('Cave_Inspection',data);preview.objects.link(camera);camera.location=xyz((11,8,16));camera.rotation_euler=(Vector(xyz((0,1.6,0)))-camera.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=17.6;scene.camera=camera
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'cave-exterior.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'cave.blend'));bpy.ops.render.render(write_still=True)
for o in asset.objects:
    if o.name.startswith('Cave_Roof'):o.hide_render=True
scene.render.filepath=str(OUT/'cave-cutaway.png');bpy.ops.render.render(write_still=True)
print('CAVE_EXPORT',triangles,'triangles',OUT)
