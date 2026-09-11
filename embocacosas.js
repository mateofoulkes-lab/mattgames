import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/+esm';

const AS='./embocacosas-assets/';
const CACHE_BUST='?v='+Date.now();
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x878b86);
scene.fog=new THREE.Fog(0x878b86,14,28);

const camera=new THREE.PerspectiveCamera(56,innerWidth/innerHeight,.05,100);
camera.position.set(0,2.2,6.5);
const cameraTarget=new THREE.Vector3(.2,1.35,-1.65);
camera.lookAt(cameraTarget);

const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
document.body.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff,0x454b46,1.8));
const sun=new THREE.DirectionalLight(0xfff1d9,2.4);sun.position.set(-4,7,5);sun.castShadow=true;scene.add(sun);

const world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.82,0)});
world.defaultContactMaterial.friction=.42;
world.defaultContactMaterial.restitution=.28;
const ground=new CANNON.Body({type:CANNON.Body.STATIC,shape:new CANNON.Plane()});ground.quaternion.setFromEuler(-Math.PI/2,0,0);world.addBody(ground);

let tacho=null,tachoBaseQuat=null,tachoAngle=0,tachoAV=0;
const loader=new GLTFLoader();
loader.load(AS+'escena.glb'+CACHE_BUST,g=>{
  scene.add(g.scene);
  g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  const candidates=[];
  g.scene.traverse(o=>{if(/tacho|tambor|bin|drum/i.test(o.name))candidates.push(o)});
  tacho=candidates.find(o=>o.isMesh||o.children.length)||candidates[0]||null;
  if(tacho){tachoBaseQuat=tacho.quaternion.clone();}
});

const arrowRoot=new THREE.Group();
scene.add(arrowRoot);
const arrowMat=new THREE.MeshStandardMaterial({color:0xffd02d,emissive:0x3c2400,roughness:.5,metalness:.05});
const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,1.0,16),arrowMat);
shaft.rotation.x=Math.PI/2;
shaft.position.z=-.5;
const tip=new THREE.Mesh(new THREE.ConeGeometry(.09,.24,20),arrowMat);
tip.rotation.x=-Math.PI/2;
tip.position.z=-1.12;
arrowRoot.add(shaft,tip);

let aimPhase=0,charging=false,charge=0;
const baseArrowScale=1;
const maxArrowScale=2.8;

function placeArrow(){
  const dir=new THREE.Vector3();camera.getWorldDirection(dir);
  const p=camera.position.clone().addScaledVector(dir,1.2);
  p.y-=.12;
  arrowRoot.position.copy(p);
  arrowRoot.quaternion.copy(camera.quaternion);
}
placeArrow();

const projectiles=[];
let attempts=0,hits=0,nextType=0;
const TYPES=[
  {name:'ESFERA',mass:1.0},
  {name:'CUBO',mass:1.6},
  {name:'DONA',mass:1.25}
];
const scoreEl=document.getElementById('score');
function score(){scoreEl.textContent=hits+' / '+attempts}

function spawnProjectile(typeIndex,dir,speed){
  let geom,shape;
  if(typeIndex===0){geom=new THREE.SphereGeometry(.16,24,16);shape=new CANNON.Sphere(.16)}
  else if(typeIndex===1){geom=new THREE.BoxGeometry(.27,.27,.27);shape=new CANNON.Box(new CANNON.Vec3(.135,.135,.135))}
  else {geom=new THREE.TorusGeometry(.18,.065,12,28);geom.rotateX(Math.PI/2);shape=new CANNON.Sphere(.19)}
  const mat=new THREE.MeshStandardMaterial({color:typeIndex===0?0x4aa5ff:typeIndex===1?0xff7043:0xf3c64f,roughness:.58});
  const mesh=new THREE.Mesh(geom,mat);mesh.castShadow=true;
  const start=arrowRoot.position.clone().addScaledVector(dir,.55);
  mesh.position.copy(start);scene.add(mesh);
  const body=new CANNON.Body({mass:TYPES[typeIndex].mass,shape,position:new CANNON.Vec3(start.x,start.y,start.z),linearDamping:.01,angularDamping:.02});
  body.velocity.set(dir.x*speed,dir.y*speed+1.0,dir.z*speed);
  body.angularVelocity.set((Math.random()-.5)*7,(Math.random()-.5)*7,(Math.random()-.5)*7);
  world.addBody(body);
  projectiles.push({mesh,body,mass:TYPES[typeIndex].mass,scored:false,age:0,lastY:start.y,hitTacho:false});
}

function currentAimDir(){
  const dir=new THREE.Vector3(0,0,-1);
  const yaw=Math.sin(aimPhase)*THREE.MathUtils.degToRad(28);
  const pitch=THREE.MathUtils.degToRad(5);
  const qYaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);
  const qPitch=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),pitch);
  dir.applyQuaternion(qPitch).applyQuaternion(qYaw).applyQuaternion(camera.quaternion).normalize();
  return dir;
}

function fire(){
  const dir=currentAimDir();
  const speed=7.5+charge*10.5;
  spawnProjectile(nextType,dir,speed);
  attempts++;score();
  nextType=(nextType+1)%TYPES.length;
  charge=0;
}

renderer.domElement.addEventListener('pointerdown',e=>{
  if(document.getElementById('editor').classList.contains('show')) return;
  charging=true;
});
renderer.domElement.addEventListener('pointerup',e=>{
  if(!charging)return;
  charging=false;fire();
});
renderer.domElement.addEventListener('pointercancel',()=>{charging=false;charge=0});

function tachoInfo(){
  if(!tacho)return null;
  const b=new THREE.Box3().setFromObject(tacho),s=new THREE.Vector3(),c=new THREE.Vector3();
  b.getSize(s);b.getCenter(c);
  return {box:b,size:s,center:c,topY:b.max.y,mouthR:Math.max(.12,Math.min(s.x,s.z)*.34)};
}

function updateTacho(dt){
  if(!tacho||!tachoBaseQuat)return;
  tachoAV+=(-7*tachoAngle-2.8*tachoAV)*dt;
  tachoAngle+=tachoAV*dt;
  tachoAngle=Math.max(-.65,Math.min(.65,tachoAngle));
  const dq=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),tachoAngle);
  tacho.quaternion.copy(tachoBaseQuat).multiply(dq);
}

function updateProjectiles(dt){
  const info=tachoInfo();
  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i];p.age+=dt;
    p.mesh.position.set(p.body.position.x,p.body.position.y,p.body.position.z);
    p.mesh.quaternion.set(p.body.quaternion.x,p.body.quaternion.y,p.body.quaternion.z,p.body.quaternion.w);
    if(info){
      const q=p.mesh.position;
      const dx=q.x-info.center.x,dz=q.z-info.center.z;
      if(!p.scored && p.lastY>info.topY+.03 && q.y<=info.topY+.03 && p.body.velocity.y<0 && Math.hypot(dx,dz)<info.mouthR){
        p.scored=true;hits++;score();
      }
      if(!p.hitTacho){
        const b=info.box,pad=.1;
        if(q.x>b.min.x-pad&&q.x<b.max.x+pad&&q.y>b.min.y-pad&&q.y<b.max.y+pad&&q.z>b.min.z-pad&&q.z<b.max.z+pad){
          const v=p.body.velocity;const speed=Math.hypot(v.x,v.y,v.z);
          const impulse=p.mass*speed;
          if(impulse>2.2){
            const side=Math.sign(q.x-info.center.x)||1;
            tachoAV+=side*Math.min(.9,(impulse-2.2)*.025);
          }
          p.hitTacho=true;
        }
      }
      p.lastY=q.y;
    }
    if(p.age>18||p.body.position.y<-3){world.removeBody(p.body);scene.remove(p.mesh);projectiles.splice(i,1)}
  }
}

const editor=document.getElementById('editor');
const editorToggle=document.getElementById('editorToggle');
function syncInputs(){
  cx.value=camera.position.x.toFixed(3);cy.value=camera.position.y.toFixed(3);cz.value=camera.position.z.toFixed(3);
  tx.value=cameraTarget.x.toFixed(3);ty.value=cameraTarget.y.toFixed(3);tz.value=cameraTarget.z.toFixed(3);fov.value=camera.fov.toFixed(1);
  cameraOut.textContent=`camera.position.set(${cx.value}, ${cy.value}, ${cz.value});\ncameraTarget.set(${tx.value}, ${ty.value}, ${tz.value});\ncamera.fov=${fov.value};`;
}
syncInputs();
const editorControls=new OrbitControls(camera,renderer.domElement);
editorControls.target.copy(cameraTarget);
editorControls.enabled=false;
editorControls.enableDamping=true;
editorToggle.onclick=()=>{
  editor.classList.toggle('show');
  editorControls.enabled=editor.classList.contains('show');
  syncInputs();
};
applyCam.onclick=()=>{
  camera.position.set(+cx.value,+cy.value,+cz.value);
  cameraTarget.set(+tx.value,+ty.value,+tz.value);
  camera.fov=+fov.value;camera.updateProjectionMatrix();camera.lookAt(cameraTarget);
  editorControls.target.copy(cameraTarget);syncInputs();placeArrow();
};
copyCam.onclick=async()=>{
  syncInputs();
  await navigator.clipboard.writeText(cameraOut.textContent);
  copyCam.textContent='Copiado ✓';setTimeout(()=>copyCam.textContent='Copiar coordenadas',1200);
};

const clock=new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(.033,clock.getDelta());
  world.step(1/60,dt,3);

  if(editorControls.enabled){
    editorControls.update();
    cameraTarget.copy(editorControls.target);
    syncInputs();
    placeArrow();
  }else{
    camera.lookAt(cameraTarget);
  }

  if(!charging) aimPhase+=dt*1.7;
  else charge=Math.min(1,charge+dt/1.45);

  const yaw=Math.sin(aimPhase)*THREE.MathUtils.degToRad(28);
  arrowRoot.rotation.set(0,yaw,0);
  const s=baseArrowScale+(maxArrowScale-baseArrowScale)*charge;
  arrowRoot.scale.set(1,1,s);

  updateTacho(dt);
  updateProjectiles(dt);
  renderer.render(scene,camera);
}
animate();

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)
});