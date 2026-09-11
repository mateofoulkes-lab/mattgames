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
let backWallBody=null,electricalBody=null;
let extinguisherFalling=false,extinguisherExploded=false;
let extVel=new THREE.Vector3(),extAV=new THREE.Vector3();

function findByRegex(root,re){
  const hits=[];
  root.traverse(o=>{if(o.name&&re.test(o.name))hits.push(o);});
  return hits.find(o=>o.isMesh||o.children.length)||hits[0]||null;
}
function boxOf(o){if(!o)return null;o.updateMatrixWorld(true);return new THREE.Box3().setFromObject(o);}
function findElectricalObject(root){
  const named=findByRegex(root,/electr|tablero|panel|caja|box|gabinete|cabinet|switch|breaker|control/i);
  if(named)return named;
  const cands=[];
  root.traverse(o=>{
    if(!o.isMesh)return;
    const mats=Array.isArray(o.material)?o.material:[o.material];
    let blue=0;
    for(const m of mats){
      const c=m?.color;
      if(c&&c.b>c.r*1.12&&c.b>c.g*1.02)blue=Math.max(blue,c.b-c.r);
    }
    if(blue<=0)return;
    const b=boxOf(o),s=new THREE.Vector3();
    b.getSize(s);
    const vol=s.x*s.y*s.z;
    if(vol>.0005&&Math.max(s.x,s.y,s.z)<4)cands.push({o,score:blue+Math.min(vol,.5)});
  });
  cands.sort((a,b)=>b.score-a.score);
  return cands[0]?.o||null;
}

const loader=new GLTFLoader();
loader.load(AS+'escena.glb'+CACHE_BUST,g=>{
  scene.add(g.scene);
  g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  tacho=findByRegex(g.scene,/tacho|tambor|bin|drum/i);
  if(tacho)tachoBaseQuat=tacho.quaternion.clone();
  floorObj=findByRegex(g.scene,/piso|floor|suelo|ground/i);
  wallObj=findByRegex(g.scene,/pared|wall|muro/i);
  electricalObj=findElectricalObject(g.scene);
  extinguisherObj=findByRegex(g.scene,/mataf|exting|extintor|fire.?ext/i);
  floorBox=boxOf(floorObj);wallBox=boxOf(wallObj);electricalBox=boxOf(electricalObj);extinguisherBox=boxOf(extinguisherObj);

  if(wallBox){
    const ws=new THREE.Vector3(),wc=new THREE.Vector3();
    wallBox.getSize(ws);wallBox.getCenter(wc);
    backWallBody=new CANNON.Body({
      type:CANNON.Body.STATIC,
      shape:new CANNON.Box(new CANNON.Vec3(Math.max(.06,ws.x*.5),Math.max(.06,ws.y*.5),Math.max(.06,ws.z*.5))),
      position:new CANNON.Vec3(wc.x,wc.y,wc.z)
    });
    world.addBody(backWallBody);
  }
  if(electricalBox){
    const es=new THREE.Vector3(),ec=new THREE.Vector3();
    electricalBox.getSize(es);electricalBox.getCenter(ec);
    electricalBody=new CANNON.Body({
      type:CANNON.Body.STATIC,
      shape:new CANNON.Box(new CANNON.Vec3(Math.max(.035,es.x*.5),Math.max(.035,es.y*.5),Math.max(.035,es.z*.5))),
      position:new CANNON.Vec3(ec.x,ec.y,ec.z)
    });
    world.addBody(electricalBody);
  }
});

// ---------------- FLECHA ----------------
const arrowRoot=new THREE.Group();scene.add(arrowRoot);
const arrowMat=new THREE.MeshStandardMaterial({color:0xffd02d,emissive:0x3c2400,roughness:.5,metalness:.05});
const arrowCfg={rotX:14,rotY:0,rotZ:0,posX:0,posY:.200,posZ:-.920,sweep:24,curve:.200,baseLen:.200};
let arrowTube=null,arrowTip=null,previewObject=null;
let aimPhase=0,charging=false,charge=0,lastArrowCharge=-1;

function rebuildArrow(c){
  const len=arrowCfg.baseLen+c*.70,lift=arrowCfg.curve+c*.12;
  if(arrowTube){arrowRoot.remove(arrowTube);arrowTube.geometry.dispose();}
  if(arrowTip){arrowRoot.remove(arrowTip);arrowTip.geometry.dispose();}
  const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,0,0),new THREE.Vector3(0,lift,-len*.48),new THREE.Vector3(0,0,-len));
  arrowTube=new THREE.Mesh(new THREE.TubeGeometry(curve,18,.016,8,false),arrowMat);arrowRoot.add(arrowTube);
  arrowTip=new THREE.Mesh(new THREE.ConeGeometry(.040,.105,14),arrowMat);
  const end=curve.getPoint(1),tan=curve.getTangent(1).normalize();
  arrowTip.position.copy(end);arrowTip.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tan);arrowRoot.add(arrowTip);
}
function getAimQuaternion(){
  const yaw=Math.sin(aimPhase)*THREE.MathUtils.degToRad(arrowCfg.sweep);
  const qLocal=new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(arrowCfg.rotX),0,0,'XYZ'));
  const qSweep=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);
  return camera.quaternion.clone().multiply(qLocal).multiply(qSweep);
}
function placeArrow(){
  const off=new THREE.Vector3(arrowCfg.posX,arrowCfg.posY,arrowCfg.posZ).applyQuaternion(camera.quaternion);
  arrowRoot.position.copy(camera.position).add(off);arrowRoot.quaternion.copy(getAimQuaternion());
}
rebuildArrow(0);placeArrow();

// ---------------- PARTÍCULAS PRECALENTADAS ----------------
const PARTICLE_POOL_SIZE=360;
const particleGeometry=new THREE.SphereGeometry(1,6,5);
const particlePool=[];
const activeParticles=[];
for(let i=0;i<PARTICLE_POOL_SIZE;i++){
  const mat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false});
  const mesh=new THREE.Mesh(particleGeometry,mat);
  mesh.visible=false;mesh.frustumCulled=false;scene.add(mesh);particlePool.push(mesh);
}
function acquireParticle(){
  if(particlePool.length)return particlePool.pop();
  const mat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false});
  const mesh=new THREE.Mesh(particleGeometry,mat);mesh.visible=false;scene.add(mesh);return mesh;
}
function releaseParticle(mesh){mesh.visible=false;mesh.material.opacity=0;particlePool.push(mesh);}
function burstParticles(pos,count,color,speedMin,speedMax,gravity=-4,lifeMin=.5,lifeMax=1.5,size=.035){
  for(let i=0;i<count;i++){
    const mesh=acquireParticle();
    mesh.visible=true;mesh.position.copy(pos);mesh.scale.setScalar(size*THREE.MathUtils.randFloat(.65,1.35));
    mesh.material.color.setHex(color);mesh.material.opacity=1;
    const v=new THREE.Vector3(THREE.MathUtils.randFloatSpread(2),Math.random()*1.4+.15,THREE.MathUtils.randFloatSpread(2)).normalize().multiplyScalar(THREE.MathUtils.randFloat(speedMin,speedMax));
    activeParticles.push({mesh,v,gravity,life:THREE.MathUtils.randFloat(lifeMin,lifeMax),maxLife:lifeMax});
  }
}
function extinguisherBurst(pos){burstParticles(pos,95,0xffffff,1.0,4.0,-1.0,.8,2.1,.045);}
function electricBurst(pos){
  burstParticles(pos,85,0xc8f7ff,2.2,8.5,-1.2,.25,.95,.030);
  burstParticles(pos,45,0xffffff,3.0,10.5,-1.0,.16,.65,.020);
  burstParticles(pos,28,0x74b9ff,2.6,9.0,-1.4,.25,.80,.026);
  burstParticles(pos,14,0xe7d8ff,4.0,12.0,-.5,.12,.45,.016);
  const flash=new THREE.PointLight(0xc9f4ff,18,5.5,2);flash.position.copy(pos);scene.add(flash);setTimeout(()=>scene.remove(flash),85);
}
function scoreBurst(pos){
  burstParticles(pos,80,0xffd83d,1.8,6.2,-2.0,.55,1.35,.038);
  burstParticles(pos,48,0xffffff,1.5,5.2,-1.8,.45,1.15,.028);
  burstParticles(pos,42,0x75ff8a,1.6,5.8,-2.1,.50,1.25,.032);
  burstParticles(pos,24,0xff8ae8,2.0,6.8,-1.7,.42,1.05,.026);
  const flash=new THREE.PointLight(0xffe47a,12,4.5,2);flash.position.copy(pos);scene.add(flash);setTimeout(()=>scene.remove(flash),120);
}
function updateParticles(dt){
  for(let i=activeParticles.length-1;i>=0;i--){
    const p=activeParticles[i];p.life-=dt;p.v.y+=p.gravity*dt;p.mesh.position.addScaledVector(p.v,dt);
    p.mesh.material.opacity=Math.max(0,p.life/p.maxLife);
    if(p.life<=0){releaseParticle(p.mesh);activeParticles.splice(i,1);}
  }
}

let audioCtx=null;
function ensureAudio(){if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx;}
function victorySound(){
  try{
    const ctx=ensureAudio(),now=ctx.currentTime,master=ctx.createGain();
    master.gain.setValueAtTime(.0001,now);master.gain.exponentialRampToValueAtTime(.18,now+.015);master.gain.exponentialRampToValueAtTime(.0001,now+.48);master.connect(ctx.destination);
    [659.25,783.99,1046.5].forEach((freq,i)=>{
      const o=ctx.createOscillator(),g=ctx.createGain(),t=now+i*.065;
      o.type='triangle';o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.8,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.17);
      o.connect(g);g.connect(master);o.start(t);o.stop(t+.19);
    });
  }catch{}
}

// ---------------- PROYECTILES ----------------
const projectiles=[];let attempts=0,hits=0,nextType=0;
const TYPES=[{name:'ESFERA',mass:1.0,color:0x4aa5ff},{name:'CUBO',mass:1.6,color:0xff7043},{name:'DONA',mass:1.25,color:0xf3c64f}];
const MATERIALS=[
  {name:'TELGOPOR',density:.28,metalness:0,roughness:.78},{name:'PLÁSTICO',density:.55,metalness:0,roughness:.48},
  {name:'MADERA',density:.82,metalness:0,roughness:.72},{name:'ALUMINIO',density:1.25,metalness:.72,roughness:.28},
  {name:'ACERO',density:1.90,metalness:.88,roughness:.22},{name:'PLOMO',density:2.65,metalness:.55,roughness:.42}
];
const scoreEl=document.getElementById('score');function score(){scoreEl.textContent=hits+' / '+attempts;}
function randomSpec(typeIndex){
  const scale=THREE.MathUtils.lerp(.42,1.90,Math.random()),material=MATERIALS[Math.floor(Math.random()*MATERIALS.length)];
  const density=material.density,mass=TYPES[typeIndex].mass*Math.pow(scale,3)*density;
  return {typeIndex,scale,density,mass,material};
}
let nextSpec=randomSpec(nextType);
function makeVisual(spec,preview=false){
  const {typeIndex,scale}=spec;let geom,radius;
  if(typeIndex===0){radius=.16*scale;geom=new THREE.SphereGeometry(radius,24,16);}
  else if(typeIndex===1){const sz=.27*scale;radius=sz*.87;geom=new THREE.BoxGeometry(sz,sz,sz);}
  else{const major=.18*scale,tube=.065*scale;radius=(major+tube)*.82;geom=new THREE.TorusGeometry(major,tube,12,28);geom.rotateX(Math.PI/2);}
  const mesh=new THREE.Mesh(geom,new THREE.MeshStandardMaterial({color:TYPES[typeIndex].color,roughness:spec.material?.roughness??.58,metalness:spec.material?.metalness??0,transparent:preview,opacity:preview?.92:1}));
  mesh.castShadow=!preview;return {mesh,radius};
}
function makeShape(spec){
  const {typeIndex,scale}=spec;
  if(typeIndex===0)return new CANNON.Sphere(.16*scale);
  if(typeIndex===1){const sz=.27*scale;return new CANNON.Box(new CANNON.Vec3(sz/2,sz/2,sz/2));}
  const major=.18*scale,tube=.065*scale;return new CANNON.Sphere((major+tube)*.82);
}
function refreshPreview(){
  if(previewObject){arrowRoot.remove(previewObject);previewObject.geometry.dispose();previewObject.material.dispose();}
  const v=makeVisual(nextSpec,true);previewObject=v.mesh;previewObject.scale.setScalar(.25);previewObject.position.set(0,0,.035);arrowRoot.add(previewObject);
  const info=document.getElementById('nextInfo');if(info)info.textContent=`PRÓXIMO: ${TYPES[nextSpec.typeIndex].name} · ${nextSpec.material.name}`;
}
refreshPreview();
function spawnProjectile(spec,dir,speed){
  const {mesh,radius}=makeVisual(spec,false),shape=makeShape(spec),start=arrowRoot.position.clone().addScaledVector(dir,.38+radius);
  mesh.position.copy(start);scene.add(mesh);
  const body=new CANNON.Body({mass:spec.mass,shape,position:new CANNON.Vec3(start.x,start.y,start.z),linearDamping:.01,angularDamping:.025});
  body.velocity.set(dir.x*speed,dir.y*speed,dir.z*speed);body.angularVelocity.set((Math.random()-.5)*7,(Math.random()-.5)*7,(Math.random()-.5)*7);world.addBody(body);
  projectiles.push({mesh,body,mass:spec.mass,radius,scale:spec.scale,density:spec.density,materialName:spec.material.name,scored:false,enteredThroughMouth:false,lockedIn:false,age:0,lastY:start.y,electricalHit:false,extinguisherHit:false});
}
function currentAimDir(){placeArrow();arrowRoot.updateMatrixWorld(true);if(arrowTip){const tip=new THREE.Vector3();arrowTip.getWorldPosition(tip);return tip.sub(camera.position).normalize();}return new THREE.Vector3(0,0,-1).applyQuaternion(arrowRoot.quaternion).normalize();}
function fire(){ensureAudio();const dir=currentAimDir(),speed=8.0+charge*15.5;spawnProjectile(nextSpec,dir,speed);attempts++;score();nextType=(nextType+1)%TYPES.length;nextSpec=randomSpec(nextType);refreshPreview();charge=0;}
renderer.domElement.addEventListener('pointerdown',()=>{ensureAudio();charging=true;});
renderer.domElement.addEventListener('pointerup',()=>{if(!charging)return;charging=false;fire();});
renderer.domElement.addEventListener('pointercancel',()=>{charging=false;charge=0;});

function expanded(box,r){return box.clone().expandByScalar(r);}
function collideAABBProjectile(p,box,restitution=.48){
  if(!box)return false;
  const q=new THREE.Vector3(p.body.position.x,p.body.position.y,p.body.position.z),ex=expanded(box,p.radius);if(!ex.containsPoint(q))return false;
  const d=[{v:Math.abs(q.x-ex.min.x),axis:'x',sign:-1},{v:Math.abs(ex.max.x-q.x),axis:'x',sign:1},{v:Math.abs(q.y-ex.min.y),axis:'y',sign:-1},{v:Math.abs(ex.max.y-q.y),axis:'y',sign:1},{v:Math.abs(q.z-ex.min.z),axis:'z',sign:-1},{v:Math.abs(ex.max.z-q.z),axis:'z',sign:1}].sort((a,b)=>a.v-b.v)[0];
  if(d.axis==='x'){p.body.position.x=d.sign<0?ex.min.x:ex.max.x;p.body.velocity.x*=-restitution;}
  else if(d.axis==='y'){p.body.position.y=d.sign<0?ex.min.y:ex.max.y;p.body.velocity.y*=-restitution;}
  else{p.body.position.z=d.sign<0?ex.min.z:ex.max.z;p.body.velocity.z*=-restitution;}
  return true;
}

function tachoInfo(){
  if(!tacho)return null;const b=boxOf(tacho),s=new THREE.Vector3(),c=new THREE.Vector3();b.getSize(s);b.getCenter(c);
  const outerR=Math.max(.12,Math.min(s.x,s.z)*.48),mouthR=Math.max(.10,outerR*.72);return {box:b,size:s,center:c,topY:b.max.y,bottomY:b.min.y,outerR,mouthR};
}
function updateTacho(dt){
  if(!tacho||!tachoBaseQuat)return;tachoAV+=(-7*tachoAngle-2.8*tachoAV)*dt;tachoAngle+=tachoAV*dt;tachoAngle=Math.max(-.65,Math.min(.65,tachoAngle));
  const dq=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),tachoAngle);tacho.quaternion.copy(tachoBaseQuat).multiply(dq);
}
function collideOuterBinWall(p,info){
  if(p.enteredThroughMouth)return;const q=p.body.position,dx=q.x-info.center.x,dz=q.z-info.center.z,dist=Math.hypot(dx,dz);if(dist<1e-5)return;
  const contactR=info.outerR+p.radius,inWallHeight=q.y<info.topY-p.radius*.18&&q.y>info.bottomY+p.radius*.20;
  if(inWallHeight&&dist<contactR){
    const nx=dx/dist,nz=dz/dist;q.x=info.center.x+nx*contactR;q.z=info.center.z+nz*contactR;
    const vn=p.body.velocity.x*nx+p.body.velocity.z*nz;if(vn<0){p.body.velocity.x-=(1+.58)*vn*nx;p.body.velocity.z-=(1+.58)*vn*nz;}
    const speed=Math.hypot(p.body.velocity.x,p.body.velocity.y,p.body.velocity.z),impulse=p.mass*speed;
    if(impulse>2.2){const side=Math.sign(q.x-info.center.x)||1;tachoAV+=side*Math.min(.9,(impulse-2.2)*.02);}
  }
}
function detectTrueMouthEntry(p,info){
  if(p.enteredThroughMouth)return;const q=p.body.position,dx=q.x-info.center.x,dz=q.z-info.center.z,safeMouth=Math.max(.03,info.mouthR-p.radius*.55);
  const crossedDown=p.lastY>info.topY+p.radius*.18&&q.y<=info.topY+p.radius*.18&&p.body.velocity.y<0;
  if(crossedDown&&Math.hypot(dx,dz)<safeMouth){
    p.enteredThroughMouth=true;p.scored=true;hits++;score();
    const at=new THREE.Vector3(info.center.x,info.topY+.10,info.center.z);scoreBurst(at);victorySound();
  }
}
function reinforceInsideBin(p,info){
  if(!p.enteredThroughMouth)return;const q=p.body.position,dx=q.x-info.center.x,dz=q.z-info.center.z,dist=Math.hypot(dx,dz),innerR=Math.max(.06,info.mouthR-p.radius*.72);
  if(!p.lockedIn&&q.y<info.topY-p.radius*.65)p.lockedIn=true;if(!p.lockedIn)return;
  if(dist>innerR&&dist>1e-5){const nx=dx/dist,nz=dz/dist;q.x=info.center.x+nx*innerR;q.z=info.center.z+nz*innerR;const outward=p.body.velocity.x*nx+p.body.velocity.z*nz;if(outward>0){p.body.velocity.x-=(1+.48)*outward*nx;p.body.velocity.z-=(1+.48)*outward*nz;}}
  const floorY=info.bottomY+p.radius*.9;if(q.y<floorY){q.y=floorY;if(p.body.velocity.y<0)p.body.velocity.y=Math.abs(p.body.velocity.y)*.12;p.body.velocity.x*=.84;p.body.velocity.z*=.84;}
}

function hitSpecials(p){
  const q=new THREE.Vector3(p.body.position.x,p.body.position.y,p.body.position.z);
  if(electricalBox&&(p.electricalCooldown||0)<=0&&expanded(electricalBox,p.radius).containsPoint(q)){
    p.electricalHit=true;p.electricalCooldown=.14;const c=new THREE.Vector3();electricalBox.getCenter(c);electricBurst(q.clone().lerp(c,.20));collideAABBProjectile(p,electricalBox,.62);
  }
  if(extinguisherObj&&!p.extinguisherHit&&!extinguisherFalling){
    extinguisherBox=boxOf(extinguisherObj);
    if(expanded(extinguisherBox,p.radius).containsPoint(q)){
      p.extinguisherHit=true;extinguisherFalling=true;extVel.set(p.body.velocity.x,p.body.velocity.y,p.body.velocity.z).multiplyScalar(.18);extVel.y+=.4;
      extAV.set(THREE.MathUtils.randFloat(-4,4),THREE.MathUtils.randFloat(-2,2),THREE.MathUtils.randFloat(-4,4));p.body.velocity.multiplyScalar(.45);
    }
  }
}
function updateExtinguisher(dt){
  if(!extinguisherObj||!extinguisherFalling||extinguisherExploded)return;
  extVel.y-=9.82*dt;extinguisherObj.position.addScaledVector(extVel,dt);extinguisherObj.rotation.x+=extAV.x*dt;extinguisherObj.rotation.y+=extAV.y*dt;extinguisherObj.rotation.z+=extAV.z*dt;extinguisherBox=boxOf(extinguisherObj);
  if(wallBox&&extinguisherBox.intersectsBox(wallBox)){
    const ec=new THREE.Vector3(),wc=new THREE.Vector3(),ws=new THREE.Vector3(),es=new THREE.Vector3();extinguisherBox.getCenter(ec);wallBox.getCenter(wc);wallBox.getSize(ws);extinguisherBox.getSize(es);
    let axis='x';if(ws.y<ws.x&&ws.y<ws.z)axis='y';else if(ws.z<ws.x&&ws.z<ws.y)axis='z';
    const sign=(ec[axis]-wc[axis])>=0?1:-1,target=wc[axis]+sign*(ws[axis]*.5+es[axis]*.5+.01);extinguisherObj.position[axis]+=target-ec[axis];extVel[axis]*=-.42;extAV.multiplyScalar(.86);extinguisherBox=boxOf(extinguisherObj);
  }
  const floorY=floorBox?floorBox.max.y:0;
  if(extinguisherBox.min.y<=floorY){extinguisherObj.position.y+=floorY-extinguisherBox.min.y;extinguisherExploded=true;const p=new THREE.Vector3();extinguisherBox.getCenter(p);p.y=floorY+.08;extinguisherBurst(p);}
}

function updateProjectiles(dt){
  const info=tachoInfo();
  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i];p.age+=dt;p.electricalCooldown=Math.max(0,(p.electricalCooldown||0)-dt);
    if(floorBox)collideAABBProjectile(p,floorBox,.34);hitSpecials(p);
    if(info){detectTrueMouthEntry(p,info);if(p.enteredThroughMouth)reinforceInsideBin(p,info);else collideOuterBinWall(p,info);p.lastY=p.body.position.y;}
    p.mesh.position.set(p.body.position.x,p.body.position.y,p.body.position.z);p.mesh.quaternion.set(p.body.quaternion.x,p.body.quaternion.y,p.body.quaternion.z,p.body.quaternion.w);
    if(p.age>18||p.body.position.y<-6){world.removeBody(p.body);scene.remove(p.mesh);projectiles.splice(i,1);}
  }
}

const clock=new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);const dt=Math.min(.025,clock.getDelta());world.step(1/120,dt,8);
  camera.position.set(18.219,6.239,0.898);cameraTarget.set(-0.433,3.538,0.504);camera.fov=56;camera.updateProjectionMatrix();camera.lookAt(cameraTarget);
  placeArrow();if(!charging)aimPhase+=dt*1.7;else charge=Math.min(1,charge+dt/1.45);
  if(Math.abs(charge-lastArrowCharge)>.01){rebuildArrow(charge);lastArrowCharge=charge;}
  updateTacho(dt);updateExtinguisher(dt);updateProjectiles(dt);updateParticles(dt);renderer.render(scene,camera);
}
animate();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});