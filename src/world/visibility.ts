import * as THREE from 'three/webgpu';
export class VisibilitySystem {
  private ray=new THREE.Raycaster();
  private direction=new THREE.Vector3();
  private materials=new Map<THREE.Mesh,THREE.Material>();
  private fading=new Set<THREE.Object3D>();
  private timer=0;
  constructor(private camera: THREE.Camera, private canopies: THREE.Mesh[], private roof: THREE.Group) {
    for(const mesh of [...canopies,...roof.children.filter(m=>m instanceof THREE.Mesh) as THREE.Mesh[]]){
      const material=(mesh.material as THREE.Material).clone();material.transparent=true;material.depthWrite=false;
      mesh.material=material;this.materials.set(mesh,material);
    }
  }
  isVisible=(point:THREE.Vector3):boolean=>{
    const projected=point.clone().project(this.camera);
    if(Math.abs(projected.x)>.97||Math.abs(projected.y)>.95)return false;
    return this.hits(point).every(hit=>(hit.object as THREE.Mesh).material && ((hit.object as THREE.Mesh).material as THREE.Material).opacity<.25);
  };
  private hits(point:THREE.Vector3){
    this.camera.getWorldDirection(this.direction);
    this.ray.set(point.clone().addScaledVector(this.direction,-70),this.direction);this.ray.far=69.85;
    return this.ray.intersectObjects(this.canopies,false);
  }
  update(dt:number,subjects:THREE.Vector3[],insideCave:boolean){
    this.timer-=dt;
    if(this.timer<=0){
      this.fading.clear();for(const subject of subjects)for(const hit of this.hits(subject))this.fading.add(hit.object);
      this.timer=.2;
    }
    for(const [mesh,material] of this.materials){
      const isRoof=mesh.parent===this.roof;
      const target=(isRoof?insideCave:this.fading.has(mesh))?.16:1;
      material.opacity+=(target-material.opacity)*(1-Math.exp(-dt*5));
    }
  }
}
