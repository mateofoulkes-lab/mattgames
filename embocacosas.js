import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/+esm';

const AS='./embocacosas-assets/';
const CACHE_BUST='?v='+Date.now();

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x878b86);

const camera=new THREE.PerspectiveCamera(56,innerWidth/innerHeight,.05,150);
camera.position.set(18.219,6.239,0.898);
const cameraTarget=new THREE.Vector3(-0.433,3.538,0.504);
camera.lookAt(cameraTarget);

const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.0;
document.body.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff,0x454b46,1.8));
const sun=new THREE.DirectionalLight(0xfff1d9,2.4);
sun.position.set(-4,7,5);
sun.castShadow=true;
sun.shadow.camera.near=.1;
sun.shadow.camera.far=80;
sun.shadow.camera.left=-20;
sun.shadow.camera.right=20;
sun.shadow.camera.top=20;
sun.shadow.camera.bottom=-20;
scene.add(sun);

const world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.82,0)});
world.defaultContactMaterial.friction=.5;
world.defaultContactMaterial.restitution=.2;
const ground=new CANNON.Body({type:CANNON.Body.STATIC,shape:new CANNON.Plane()});
ground.quaternion.setFromEuler(-Math.PI/2,0,0);
world.addBody(ground);

let tacho=null,tachoBaseQuat=null,tachoAngle=0,tachoAV=0;
const loader=new GLTFLoader();
loader.load(AS+'escena.glb'+CACHE_BUST,g=>{
  scene.add(g.scene);
  g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  const candidates=[];
  g.scene.traverse(o=>{if(/tacho|tambor|bin|drum/i.test(o.name)) candidates.push(o);});
  tacho=candidates.find(o=>o.isMesh||o.children.length)||candidates[0]||null;
  if(tacho) tachoBaseQuat=tacho.quaternion.clone();
});

const arrowRoot=new THREE.Group();
scene.add(arrowRoot);
const arrowMat=new THREE.MeshStandardMaterial({color:0xffd02d,emissive:0x3c2400,roughness:.5,metalness:.05});
const arrowCfg={rotX:14,rotY:0,rotZ:0,posX:0,posY:.58,posZ:-.82,sweep:24,curve:.10,baseLen:.36};
let arrowTube=null,arrowTip=null,aimPhase=0,charging=false,charge=0,lastArrowCharge=-1;
function readArrowEditor(){const q=id=>document.getElementById(id);if(!q('arx'))return;arrowCfg.rotX=+q('arx').value||0;arrowCfg.rotY=+q('ary').value||0;arrowCfg.rotZ=+q('arz').value||0;arrowCfg.posX=+q('apx').value||0;arrowCfg.posY=+q('apy').value||0;arrowCfg.posZ=+q('apz').value||0;arrowCfg.sweep=Math.max(0,+q('asweep').value||0);arrowCfg.curve=Math.max(0,+q('acurve').value||0);arrowCfg.baseLen=Math.max(.12,+q('alen').value||.36);}
function writeArrowOutput(){const out=document.getElementById('arrowOut');if(!out)return;out.textContent=`arrow.rot.set(${arrowCfg.rotX.toFixed(1)}, ${arrowCfg.rotY.toFixed(1)}, ${arrowCfg.rotZ.toFixed(1)});\narrow.pos.set(${arrowCfg.posX.toFixed(3)}, ${arrowCfg.posY.toFixed(3)}, ${arrowCfg.posZ.toFixed(3)});\narrow.sweep=${arrowCfg.sweep.toFixed(1)};\narrow.curve=${arrowCfg.curve.toFixed(3)};\narrow.baseLen=${arrowCfg.baseLen.toFixed(3)};`;}
function rebuildArrow(chargeNow){readArrowEditor();const len=arrowCfg.baseLen+chargeNow*.65;const curveLift=arrowCfg.curve+chargeNow*.11;if(arrowTube){arrowRoot.remove(arrowTube);arrowTube.geometry.dispose();}if(arrowTip){arrowRoot.remove(arrowTip);arrowTip.geometry.dispose();}const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,0,0),new THREE.Vector3(0,curveLift,-len*.48),new THREE.Vector3(0,0,-len));arrowTube=new THREE.Mesh(new THREE.TubeGeometry(curve,18,.016,8,false),arrowMat);arrowRoot.add(arrowTube);arrowTip=new THREE.Mesh(new THREE.ConeGeometry(.040,.105,14),arrowMat);const end=curve.getPoint(1),tangent=curve.getTangent(1).normalize();arrowTip.position.copy(end);arrowTip.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tangent);arrowRoot.add(arrowTip);}
rebuildArrow(0);
function getAimQuaternion(){readArrowEditor();const yaw=Math.sin(aimPhase)*THREE.MathUtils.degToRad(arrowCfg.sweep);const qLocal=new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(arrowCfg.rotX),THREE.MathUtils.degToRad(arrowCfg.rotY),THREE.MathUtils.degToRad(arrowCfg.rotZ),'XYZ'));const qSweep=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);return camera.quaternion.clone().multiply(qLocal).multiply(qSweep);}
function placeArrow(){readArrowEditor();const localOffset=new THREE.Vector3(arrowCfg.posX,arrowCfg.posY,arrowCfg.posZ).applyQuaternion(camera.quaternion);arrowRoot.position.copy(camera.position).add(localOffset);arrowRoot.quaternion.copy(getAimQuaternion());}
placeArrow();
const arrowEditor=document.getElementById('arrowEditor'),arrowEditorToggle=document.getElementById('arrowEditorToggle');
if(arrowEditorToggle){arrowEditorToggle.onclick=()=>{arrowEditor.classList.toggle('show');writeArrowOutput();};}
for(const id of ['arx','ary','arz','apx','apy','apz','asweep','acurve','alen']){const el=document.getElementById(id);if(el){el.addEventListener('input',()=>{readArrowEditor();rebuildArrow(charge);placeArrow();writeArrowOutput();});}}
const copyArrow=document.getElementById('copyArrow');if(copyArrow){copyArrow.onclick=async()=>{readArrowEditor();writeArrowOutput();try{await navigator.clipboard.writeText(document.getElementById('arrowOut').textContent);copyArrow.textContent='Copiado ✓';setTimeout(()=>copyArrow.textContent='Copiar configuración',1200);}catch{}};}
writeArrowOutput();

const projectiles=[];let attempts=0,hits=0,nextType=0;
const TYPES=[{name:'ESFERA',mass:1.0},{name:'CUBO',mass:1.6},{name:'DONA',mass:1.25}];
const scoreEl=document.getElementById('score');function score(){scoreEl.textContent=hits+' / '+attempts;}
function spawnProjectile(typeIndex,dir,speed){const scale=THREE.MathUtils.lerp(.65,1.45,Math.random());const base=TYPES[typeIndex];const mass=base.mass*Math.pow(scale,3);let geom,shape,radius;if(typeIndex===0){radius=.16*scale;geom=new THREE.SphereGeometry(radius,24,16);shape=new CANNON.Sphere(radius);}else if(typeIndex===1){const s=.27*scale;radius=s*.87;geom=new THREE.BoxGeometry(s,s,s);shape=new CANNON.Box(new CANNON.Vec3(s/2,s/2,s/2));}else{const major=.18*scale,tube=.065*scale;radius=(major+tube)*.82;geom=new THREE.TorusGeometry(major,tube,12,28);geom.rotateX(Math.PI/2);shape=new CANNON.Sphere(radius);}const mat=new THREE.MeshStandardMaterial({color:typeIndex===0?0x4aa5ff:typeIndex===1?0xff7043:0xf3c64f,roughness:.58});const mesh=new THREE.Mesh(geom,mat);mesh.castShadow=true;const start=arrowRoot.position.clone().addScaledVector(dir,.38+radius);mesh.position.copy(start);scene.add(mesh);const body=new CANNON.Body({mass,shape,position:new CANNON.Vec3(start.x,start.y,start.z),linearDamping:.012,angularDamping:.025});body.velocity.set(dir.x*speed,dir.y*speed,dir.z*speed);body.angularVelocity.set((Math.random()-.5)*7,(Math.random()-.5)*7,(Math.random()-.5)*7);world.addBody(body);projectiles.push({mesh,body,mass,radius,scale,scored:false,enteredThroughMouth:false,lockedIn:false,age:0,lastY:start.y,lastRadial:Infinity});}
function currentAimDir(){return new THREE.Vector3(0,0,-1).applyQuaternion(getAimQuaternion()).normalize();}
function fire(){const dir=currentAimDir();const speed=6.8+charge*8.7;spawnProjectile(nextType,dir,speed);attempts++;score();nextType=(nextType+1)%TYPES.length;charge=0;}
renderer.domElement.addEventListener('pointerdown',()=>{if(arrowEditor?.classList.contains('show'))return;charging=true;});
renderer.domElement.addEventListener('pointerup',()=>{if(!charging)return;charging=false;fire();});
renderer.domElement.addEventListener('pointercancel',()=>{charging=false;charge=0;});

function tachoInfo(){if(!tacho)return null;const b=new THREE.Box3().setFromObject(tacho),s=new THREE.Vector3(),c=new THREE.Vector3();b.getSize(s);b.getCenter(c);const outerR=Math.max(.12,Math.min(s.x,s.z)*.48);const mouthR=Math.max(.10,outerR*.72);return{box:b,size:s,center:c,topY:b.max.y,bottomY:b.min.y,outerR,mouthR};}
function updateTacho(dt){if(!tacho||!tachoBaseQuat)return;tachoAV+=(-7*tachoAngle-2.8*tachoAV)*dt;tachoAngle+=tachoAV*dt;tachoAngle=Math.max(-.65,Math.min(.65,tachoAngle));const dq=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),tachoAngle);tacho.quaternion.copy(tachoBaseQuat).multiply(dq);}
function reflectHorizontal(body,nx,nz,restitution=.48){const vn=body.velocity.x*nx+body.velocity.z*nz;if(vn<0){body.velocity.x-=(1+restitution)*vn*nx;body.velocity.z-=(1+restitution)*vn*nz;}}
function collideOuterBinWall(p,info){if(p.enteredThroughMouth)return;const q=p.body.position,dx=q.x-info.center.x,dz=q.z-info.center.z,dist=Math.hypot(dx,dz);if(dist<1e-5)return;const nx=dx/dist,nz=dz/dist,contactR=info.outerR+p.radius;const inWallHeight=q.y<info.topY-p.radius*.18&&q.y>info.bottomY+p.radius*.25;if(inWallHeight&&dist<=contactR&&p.lastRadial>contactR*.96){q.x=info.center.x+nx*contactR;q.z=info.center.z+nz*contactR;reflectHorizontal(p.body,nx,nz,.52);const speed=Math.hypot(p.body.velocity.x,p.body.velocity.y,p.body.velocity.z),impulse=p.mass*speed;if(impulse>2.2){const side=Math.sign(q.x-info.center.x)||1;tachoAV+=side*Math.min(.9,(impulse-2.2)*.02);}}p.lastRadial=dist;}
function reinforceInsideBin(p,info){if(!p.enteredThroughMouth)return;const q=p.body.position,dx=q.x-info.center.x,dz=q.z-info.center.z,dist=Math.hypot(dx,dz);const innerR=Math.max(.06,info.mouthR-p.radius*.72);if(!p.lockedIn&&q.y<info.topY-p.radius*.65)p.lockedIn=true;if(!p.lockedIn)return;if(dist>innerR&&dist>1e-5){const nx=dx/dist,nz=dz/dist;q.x=info.center.x+nx*innerR;q.z=info.center.z+nz*innerR;const outward=p.body.velocity.x*nx+p.body.velocity.z*nz;if(outward>0){p.body.velocity.x-=(1+.42)*outward*nx;p.body.velocity.z-=(1+.42)*outward*nz;}}const floorY=info.bottomY+p.radius*.9;if(q.y<floorY){q.y=floorY;if(p.body.velocity.y<0)p.body.velocity.y=Math.abs(p.body.velocity.y)*.10;p.body.velocity.x*=.82;p.body.velocity.z*=.82;}}
function detectTrueMouthEntry(p,info){if(p.enteredThroughMouth)return;const q=p.body.position,dx=q.x-info.center.x,dz=q.z-info.center.z;const safeMouth=Math.max(.03,info.mouthR-p.radius*.55);const crossedDown=p.lastY>info.topY+p.radius*.20&&q.y<=info.topY+p.radius*.20&&p.body.velocity.y<0;if(crossedDown&&Math.hypot(dx,dz)<safeMouth){p.enteredThroughMouth=true;p.scored=true;hits++;score();}}
function updateProjectiles(dt){const info=tachoInfo();for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.age+=dt;if(info){detectTrueMouthEntry(p,info);if(p.enteredThroughMouth)reinforceInsideBin(p,info);else collideOuterBinWall(p,info);p.lastY=p.body.position.y;}p.mesh.position.set(p.body.position.x,p.body.position.y,p.body.position.z);p.mesh.quaternion.set(p.body.quaternion.x,p.body.quaternion.y,p.body.quaternion.z,p.body.quaternion.w);if(p.age>18||p.body.position.y<-3){world.removeBody(p.body);scene.remove(p.mesh);projectiles.splice(i,1);}}}
const clock=new THREE.Clock();
function animate(){requestAnimationFrame(animate);const dt=Math.min(.025,clock.getDelta());world.step(1/120,dt,8);camera.position.set(18.219,6.239,0.898);cameraTarget.set(-0.433,3.538,0.504);camera.fov=56;camera.updateProjectionMatrix();camera.lookAt(cameraTarget);placeArrow();if(!charging)aimPhase+=dt*1.7;else charge=Math.min(1,charge+dt/1.45);if(Math.abs(charge-lastArrowCharge)>.01){rebuildArrow(charge);lastArrowCharge=charge;}updateTacho(dt);updateProjectiles(dt);renderer.render(scene,camera);}
animate();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});