import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ink } from './materials';
import { CAVE } from './spatial';
import type { Simulation } from '../simulation';

/** Keep mesh authoring independent of the terrain and gameplay coordinates. */
export function installCaveModel(model:THREE.Group,cave:THREE.Group,roof:THREE.Group,sim:Simulation){
  model.updateMatrixWorld(true);
  const meshes:THREE.Mesh[]=[];model.traverse(o=>{if(o instanceof THREE.Mesh)meshes.push(o);});
  if(!meshes.length)throw new Error('The cave asset contains no meshes');
  cave.clear();roof.clear();cave.add(roof);
  let triangles=0;
  for(const source of meshes){
    const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld);
    let node:THREE.Object3D|null=source,roofPart=false,ledge=false;
    while(node){roofPart ||= node.name.startsWith('Cave_Roof');ledge ||= node.name.startsWith('Cave_Roof_Perch');node=node.parent;}
    const position=geometry.getAttribute('position');
    for(let i=0;i<position.count;i++){
      if(!ledge)position.setY(i,position.getY(i)+sim.height(CAVE.x+position.getX(i),CAVE.z+position.getZ(i))-sim.height(CAVE.x,CAVE.z));
    }
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const original=source.material as THREE.MeshStandardMaterial;
    const material=ink(`#${original.color.getHexString()}`);
    const mesh=new THREE.Mesh(geometry,material);mesh.name=source.name;
    (roofPart?roof:cave).add(mesh);triangles+=(geometry.index?.count??position.count)/3;
  }
  return {source:'blender-glb',meshes:meshes.length,triangles};
}
export async function loadCaveModel(cave:THREE.Group,roof:THREE.Group,sim:Simulation){
  const gltf=await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/cave.glb`);
  return installCaveModel(gltf.scene,cave,roof,sim);
}
