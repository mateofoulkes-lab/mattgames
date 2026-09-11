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
world.defaultContactMaterial.restitution=.24;

const ground=new CANNON.Body({type:CANNON.Body.STATIC,shape:new CANNON.Plane()});
ground.quaternion.setFromEuler(-Math.PI/2,0,0);
world.addBody(ground);

let tacho=null,tachoBaseQuat=null,tachoAngle=0,tachoAV=0;
let floorObj=null,wallObj=null,electricalObj=null,extinguisherObj=null;
let floorBox=null,wallBox=null,electricalBox=null,extinguisherBox=null;
let extinguisherFalling=false,extinguisherExploded=false;
let extVel=new THREE.Vector3(),extAV=new THREE.Vector3();

function findByRegex(root,re){const hits=[];root.traverse(o=>{if(o.name&&re.test(o.name))hits.push(o);});return hits.find(o=>o.isMesh||o.children.length)||hits[0]||null;}
function boxOf(o){if(!o)return null;o.updateMatrixWorld(true);return new THREE.Box3().setFromObject(o);}

const loader=new GLTFLoader();
loader.load(AS+'escena.glb'+CACHE_BUST,g=>{
  scene.add(g.scene);
  g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  tacho=findByRegex(g.scene,/tacho|tambor|bin|drum/i);if(tacho)tachoBaseQuat=tacho.quaternion.clone();
  floorObj=findByRegex(g.scene,/piso|floor|suelo|ground/i);
  wallObj=findByRegex(g.scene,/pared|wall|muro/i);
  electricalObj=findByRegex(g.scene,/electr|tablero|panel|caja.*(azul|elect)/i);
  extinguisherObj=findByRegex(g.scene,/mataf|exting|extintor|fire.?ext/i);
  floorBox=boxOf(floorObj);wallBox=boxOf(wallObj);electricalBox=boxOf(electricalObj);extinguisherBox=boxOf(extinguisherObj);
});

const arrowRoot=new THREE.Group();scene.add(arrowRoot);
const arrowMat=new THREE.MeshStandardMaterial({color:0xffd02d,emissive:0x3c2400,roughness:.5,metalness:.05});
const arrowCfg={rotX:14,rotY:0,rotZ:0,posX:0,posY:.200,posZ:-.920,sweep:24,curve:.200,baseLen:.200};
let arrowTube=null,arrowTip=null,aimPhase=0,charging=false,charge=0,lastArrowCharge=-1;
const arrowBase=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.016,24),arrowMat);arrowBase.rotation.x=Math.PI/2;arrowRoot.add(arrowBase);
function readArrowEditor(){const q=id=>document.getElementById(id);if(!q('arx'))return;arrowCfg.rotX=+q('arx').value||0;arrowCfg.rotY=+q('ary').value||0;arrowCfg.rotZ=+q('arz').value||0;arrowCfg.posX=+q('apx').value||0;arrowCfg.posY=+q('apy').value||0;arrowCfg.posZ=+q('apz').value||0;arrowCfg.sweep=Math.max(0,+q('asweep').value||0);arrowCfg.curve=Math.max(0,+q('acurve').value||0);arrowCfg.baseLen=Math.max(.10,+q('alen').value||.20);}
function writeArrowOutput(){const out=document.getElementById('arrowOut');if(!out)return;out.textContent=`arrow.rot.set(${arrowCfg.rotX.toFixed(1)}, ${arrowCfg.rotY.toFixed(1)}, ${arrowCfg.rotZ.toFixed(1)});\narrow.pos.set(${arrowCfg.posX.toFixed(3)}, ${arrowCfg.posY.toFixed(3)}, ${arrowCfg.posZ.toFixed(3)});\narrow.sweep=${arrowCfg.sweep.toFixed(1)};\narrow.curve=${arrowCfg.curve.toFixed(3)};\narrow.baseLen=${arrowCfg.baseLen.toFixed(3)};`;}
function rebuildArrow(chargeNow){readArrowEditor();const len=arrowCfg.baseLen+chargeNow*.70,curveLift=arrowCfg.curve+chargeNow*.12;if(arrowTube){arrowRoot.remove(arrowTube);arrowTube.geometry.dispose();}if(arrowTip){arrowRoot.remove(arrowTip);arrowTip.geometry.dispose();}const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,0,0),new THREE.Vector3(0,curveLift,-len*.48),new THREE.Vector3(0,0,-len));arrowTube=new THREE.Mesh(new THREE.TubeGeometry(curve,18,.016,8,false),arrowMat);arrowRoot.add(arrowTube);arrowTip=new THREE.Mesh(new THREE.ConeGeometry(.040,.105,14),arrowMat);const end=curve.getPoint(1),tangent=curve.getTangent(1).normalize();arrowTip.position.copy(end);arrowTip.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tangent);arrowRoot.add(arrowTip);}
rebuildArrow(0);
function getAimQuaternion(){readArrowEditor();const yaw=Math.sin(aimPhase)*THREE.MathUtils.degToRad(arrowCfg.sweep);const qLocal=new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(arrowCfg.rotX),THREE.MathUtils.degToRad(arrowCfg.rotY),THREE.MathUtils.degToRad(arrowCfg.rotZ),'XYZ'));const qSweep=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);return camera.quaternion.clone().multiply(qLocal).multiply(qSweep);}
function placeArrow(){readArrowEditor();const localOffset=new THREE.Vector3(arrowCfg.posX,arrowCfg.posY,arrowCfg.posZ).applyQuaternion(camera.quaternion);arrowRoot.position.copy(camera.position).add(localOffset);arrowRoot.quaternion.copy(getAimQuaternion());}
placeArrow();
const arrowEditor=document.getElementById('arrowEditor'),arrowEditorToggle=document.getElementById('arrowEditorToggle');if(arrowEditorToggle){arrowEditorToggle.onclick=()=>{arrowEditor.classList.toggle('show');writeArrowOutput();};}for(const id of ['arx','ary','arz','apx','apy','apz','asweep','acurve','alen']){const el=document.getElementById(id);if(el)el.addEventListener('input',()=>{readArrowEditor();rebuildArrow(charge);placeArrow();writeArrowOutput();});}const copyArrow=document.getElementById('copyArrow');if(copyArrow){copyArrow.onclick=async()=>{readArrowEditor();writeArrowOutput();try{await navigator.clipboard.writeText(document.getElementById('arrowOut').textContent);copyArrow.textContent='Copiado ✓';setTimeout(()=>copyArrow.textContent='Copiar configuración',1200);}catch{}};}writeArrowOutput();

const particles=[];
function burstParticles(pos,count,color,speedMin,speedMax,gravity=-4,lifeMin=.5,lifeMax=1.5,size=.035){for(let i=0;i<count;i++){const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:1});const mesh=new THREE.Mesh(new THREE.SphereGeometry(size,6,5),mat);mesh.position.copy(pos);scene.add(mesh);const v=new THREE.Vector3(THREE.MathUtils.randFloatSpread(2),Math.random()*1.4+.15,THREE.MathUtils.randFloatSpread(2)).normalize().multiplyScalar(THREE.MathUtils.randFloat(speedMin,speedMax));particles.push({mesh,v,gravity,life:THREE.MathUtils.randFloat(lifeMin,lifeMax),maxLife:lifeMax});}}
function extinguisherBurst(pos){burstParticles(pos,95,0xffffff,1.0,4.0,-1.0,.8,2.1,.045);}
function electricBurst(pos){burstParticles(pos,24,0xbfefff,1.3,4.8,-2.0,.18,.55,.025);burstParticles(pos,10,0xffffff,1.8,5.5,-2.0,.12,.35,.018);}
function updateParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.v.y+=p.gravity*dt;p.mesh.position.addScaledVector(p.v,dt);p.mesh.material.opacity=Math.max(0,p.life/p.maxLife);if(p.life<=0){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();particles.splice(i,1);}}}

const projectiles=[];let attempts=0,hits=0,nextType=0;const TYPES=[{name:'ESFERA',mass:1.0},{name:'CUBO',mass:1.6},{name:'DONA',mass:1.25}];const scoreEl=document.getElementById('score');function score(){scoreEl.textContent=hits+' / '+attempts;}
function spawnProjectile(typeIndex,dir,speed){const scale=THREE.MathUtils.lerp(.65,1.45,Math.random()),base=TYPES[typeIndex],mass=base.mass*Math.pow(scale,3);let geom,shape,radius;if(typeIndex===0){radius=.16*scale;geom=new THREE.SphereGeometry(radius,24,16);shape=new CANNON.Sphere(radius);}else if(typeIndex===1){const s=.27*scale;radius=s*.87;geom=new THREE.BoxGeometry(s,s,s);shape=new CANNON.Box(new CANNON.Vec3(s/2,s/2,s/2));}else{const major=.18*scale,tube=.065*scale;radius=(major+tube)*.82;geom=new THREE.TorusGeometry(major,tube,12,28);geom.rotateX(Math.PI/2);shape=new CANNON.Sphere(radius);}const mesh=new THREE.Mesh(geom,new THREE.MeshStandardMaterial({color:typeIndex===0?0x4aa5ff:typeIndex===1?0xff7043:0xf3c64f,roughness:.58}));mesh.castShadow=true;const start=arrowRoot.position.clone().addScaledVector(dir,.38+radius);mesh.position.copy(start);scene.add(mesh);const body=new CANNON.Body({mass,shape,position:new CANNON.Vec3(start.x,start.y,start.z),linearDamping:.01,angularDamping:.025});body.velocity.set(dir.x*speed,dir.y*speed,dir.z*speed);body.angularVelocity.set((Math.random()-.5)*7,(Math.random()-.5)*7,(Math.random()-.5)*7);world.addBody(body);projectiles.push({mesh,body,mass,radius,scale,scored:false,enteredThroughMouth:false,lockedIn:false,age:0,lastY:start.y,prevPos:start.clone(),electricalHit:false,extinguisherHit:false});}
function currentAimDir(){return new THREE.Vector3(0,0,-1).applyQuaternion(getAimQuaternion()).normalize();}
function fire(){const dir=currentAimDir();const speed=8.0+charge*15.5;spawnProjectile(nextType,dir,speed);attempts++;score();nextType=(nextType+1)%TYPES.length;charge=0;}
renderer.domElement.addEventListener('pointerdown',()=>{if(arrowEditor?.classList.contains('show'))return;charging=true;});renderer.domElement.addEventListener('pointerup',()=>{if(!charging)return;charging=false;fire();});renderer.domElement.addEventListener('pointercancel',()=>{charging=false;charge=0;});

function expanded(box,r){return box.clone().expandByScalar(r);}
function collideAABBProjectile(p,box,restitution=.48){if(!box)return false;const q=new THREE.Vector3(p.body.position.x,p.body.position.y,p.body.position.z),ex=expanded(box,p.radius);if(!ex.containsPoint(q))return false;const d=[{v:Math.abs(q.x-ex.min.x),axis:'x',sign:-1},{v:Math.abs(ex.max.x-q.x),axis:'x',sign:1},{v:Math.abs(q.y-ex.min.y),axis:'y',sign:-1},{v:Math.abs(ex.max.y-q.y),axis:'y',sign:1},{v:Math.abs(q.z-ex.min.z),axis:'z',sign:-1},{v:Math.abs(ex.max.z-q.z),axis:'z',sign:1}].sort((a,b)=>a.v-b.v)[0];if(d.axis==='x'){p.body.position.x=d.sign<0?ex.min.x:ex.max.x;p.body.velocity.x*=-restitution;}else if(d.axis==='y'){p.body.position.y=d.sign<0?ex.min.y:ex.max.y;p.body.velocity.y*=-restitution;}else{p.body.position.z=d.sign<0?ex.min.z:ex.max.z;p.body.velocity.z*=-restitution;}return true;}

function tachoInfo(){if(!tacho)return null;const b=boxOf(tacho),s=new THREE.Vector3(),c=new THREE.Vector3();b.getSize(s);b.getCenter(c);const outerR=Math.max(.12,Math.min(s.x,s.z)*.48),mouthR=Math.max(.10,outerR*.72);return{box:b,size:s,center:c,topY:b.max.y,bottomY:b.min.y,outerR,mouthR};}
function updateTacho(dt){if(!tacho||!tachoBaseQuat)return;tachoAV+=(-7*tachoAngle-2.8*tachoAV)*dt;tachoAngle+=tachoAV*dt;tachoAngle=Math.max(-.65,Math.min(.65,tachoAngle));const dq=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),tachoAngle);tacho.quaternion.copy(tachoBaseQuat).multiply(dq);}
function collideOuterBinWall(p,info){if(p.enteredThroughMouth)return;const q=p.body.position,dx=q.x-info.center.x,dz=q.z-info.center.z,dist=Math.hypot(dx,dz);if(dist<1e-5)return;const contactR=info.outerR+p.radius;const inWallHeight=q.y<info.topY-p.radius*.18&&q.y>info.bottomY+p.radius*.20;if(inWallHeight&&dist<contactR){const nx=dx/dist,nz=dz/dist;q.x=info.center.x+nx*contactR;q.z=info.center.z+nz*contactR;const vn=p.body.velocity.x*nx+p.body.velocity.z*nz;if(vn<0){p.body.velocity.x-=(1+.58)*vn*nx;p.body.velocity.z-=(1+.58)*vn*nz;}const speed=Math.hypot(p.body.velocity.x,p.body.velocity.y,p.body.velocity.z),impulse=p.mass*speed;if(impulse>2.2){const side=Math.sign(q.x-info.center.x)||1;tachoAV+=side*Math.min(.9,(impulse-2.2)*.02);}}}
function detectTrueMouthEntry(p,info){if(p.enteredThroughMouth)return;const q=p.body.position,dx=q.x-info.center.x,dz=q.z-info.center.z,safeMouth=Math.max(.03,info.mouthR-p.radius*.55);const crossedDown=p.lastY>info.topY+p.radius*.18&&q.y<=info.topY+p.radius*.18&&p.body.velocity.y<0;if(crossedDown&&Math.hypot(dx,dz)<safeMouth){p.enteredThroughMouth=true;p.scored=true;hits++;score();}}
function reinforceInsideBin(p,info){if(!p.enteredThroughMouth)return;const q=p.body.position,dx=q.x-info.center.x,dz=q.z-info.center.z,dist=Math.hypot(dx,dz),innerR=Math.max(.06,info.mouthR-p.radius*.72);if(!p.lockedIn&&q.y<info.topY-p.radius*.65)p.lockedIn=true;if(!p.lockedIn)return;if(dist>innerR&&dist>1e-5){const nx=dx/dist,nz=dz/dist;q.x=info.center.x+nx*innerR;q.z=info.center.z+nz*innerR;const outward=p.body.velocity.x*nx+p.body.velocity.z*nz;if(outward>0){p.body.velocity.x-=(1+.48)*outward*nx;p.body.velocity.z-=(1+.48)*outward*nz;}}const floorY=info.bottomY+p.radius*.9;if(q.y<floorY){q.y=floorY;if(p.body.velocity.y<0)p.body.velocity.y=Math.abs(p.body.velocity.y)*.12;p.body.velocity.x*=.84;p.body.velocity.z*=.84;}}

function hitSpecials(p){const q=new THREE.Vector3(p.body.position.x,p.body.position.y,p.body.position.z);if(electricalObj&&!p.electricalHit){electricalBox=boxOf(electricalObj);if(expanded(electricalBox,p.radius).containsPoint(q)){p.electricalHit=true;const c=new THREE.Vector3();electricalBox.getCenter(c);electricBurst(q.clone().lerp(c,.35));p.body.velocity.multiplyScalar(.55);p.body.velocity.x*=-.7;p.body.velocity.z*=-.7;}}if(extinguisherObj&&!p.extinguisherHit&&!extinguisherFalling){extinguisherBox=boxOf(extinguisherObj);if(expanded(extinguisherBox,p.radius).containsPoint(q)){p.extinguisherHit=true;extinguisherFalling=true;extVel.set(p.body.velocity.x,p.body.velocity.y,p.body.velocity.z).multiplyScalar(.18);extVel.y+=.4;extAV.set(THREE.MathUtils.randFloat(-4,4),THREE.MathUtils.randFloat(-2,2),THREE.MathUtils.randFloat(-4,4));p.body.velocity.multiplyScalar(.45);}}}
function updateExtinguisher(dt){if(!extinguisherObj||!extinguisherFalling||extinguisherExploded)return;extVel.y-=9.82*dt;extinguisherObj.position.addScaledVector(extVel,dt);extinguisherObj.rotation.x+=extAV.x*dt;extinguisherObj.rotation.y+=extAV.y*dt;extinguisherObj.rotation.z+=extAV.z*dt;extinguisherBox=boxOf(extinguisherObj);let floorY=0;if(floorBox)floorY=floorBox.max.y;if(extinguisherBox.min.y<=floorY){extinguisherObj.position.y+=floorY-extinguisherBox.min.y;extinguisherExploded=true;const p=new THREE.Vector3();extinguisherBox.getCenter(p);p.y=floorY+.08;extinguisherBurst(p);}}

function updateProjectiles(dt){const info=tachoInfo();for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.age+=dt;if(floorBox)collideAABBProjectile(p,floorBox,.34);if(wallBox)collideAABBProjectile(p,wallBox,.52);hitSpecials(p);if(info){detectTrueMouthEntry(p,info);if(p.enteredThroughMouth)reinforceInsideBin(p,info);else collideOuterBinWall(p,info);p.lastY=p.body.position.y;}p.mesh.position.set(p.body.position.x,p.body.position.y,p.body.position.z);p.mesh.quaternion.set(p.body.quaternion.x,p.body.quaternion.y,p.body.quaternion.z,p.body.quaternion.w);p.prevPos.copy(p.mesh.position);if(p.age>18||p.body.position.y<-6){world.removeBody(p.body);scene.remove(p.mesh);projectiles.splice(i,1);}}}

const clock=new THREE.Clock();
function animate(){requestAnimationFrame(animate);const dt=Math.min(.025,clock.getDelta());world.step(1/120,dt,8);camera.position.set(18.219,6.239,0.898);cameraTarget.set(-0.433,3.538,0.504);camera.fov=56;camera.updateProjectionMatrix();camera.lookAt(cameraTarget);placeArrow();if(!charging)aimPhase+=dt*1.7;else charge=Math.min(1,charge+dt/1.45);if(Math.abs(charge-lastArrowCharge)>.01){rebuildArrow(charge);lastArrowCharge=charge;}updateTacho(dt);updateExtinguisher(dt);updateProjectiles(dt);updateParticles(dt);renderer.render(scene,camera);}
animate();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});