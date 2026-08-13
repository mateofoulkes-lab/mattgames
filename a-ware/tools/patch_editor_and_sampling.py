from pathlib import Path

editor = Path('a-ware/editor.html')
e = editor.read_text(encoding='utf-8')
marker = "'door.glb','ac_indoor.glb'"
if marker in e:
    e = e.replace(marker, "'door.glb','cama.glb','mesadenoche.glb','doorway.glb','ac_indoor.glb'")
editor.write_text(e, encoding='utf-8')

index = Path('a-ware/index.html')
s = index.read_text(encoding='utf-8')
start = s.index('function staticCloudFromObject(')
end = s.index('\nasync function loadStatic', start)
replacement = r'''function staticCloudFromObject(obj,color,maxPts=15000){
  obj.updateMatrixWorld(true);
  const tris=[];const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
  obj.traverse(n=>{if(!n.isMesh||!n.geometry?.attributes?.position)return;const pos=n.geometry.attributes.position,idx=n.geometry.index;const triCount=idx?idx.count/3:pos.count/3;for(let t=0;t<triCount;t++){const ia=idx?idx.getX(t*3):t*3,ib=idx?idx.getX(t*3+1):t*3+1,ic=idx?idx.getX(t*3+2):t*3+2;a.fromBufferAttribute(pos,ia).applyMatrix4(n.matrixWorld);b.fromBufferAttribute(pos,ib).applyMatrix4(n.matrixWorld);c.fromBufferAttribute(pos,ic).applyMatrix4(n.matrixWorld);const area=ab.subVectors(b,a).cross(ac.subVectors(c,a)).length()*.5;if(area>1e-7)tris.push({a:a.clone(),b:b.clone(),c:c.clone(),area});}}});
  if(!tris.length)return null;
  const cumulative=[];let sum=0;for(const tr of tris){sum+=tr.area;cumulative.push(sum)}
  const target=new Float32Array(maxPts*3),p=new THREE.Vector3();
  for(let i=0;i<maxPts;i++){let r=Math.random()*sum,lo=0,hi=cumulative.length-1;while(lo<hi){const m=(lo+hi)>>1;if(cumulative[m]<r)lo=m+1;else hi=m}const tr=tris[lo];let u=Math.random(),v=Math.random();if(u+v>1){u=1-u;v=1-v}p.copy(tr.a).addScaledVector(ab.subVectors(tr.b,tr.a),u).addScaledVector(ac.subVectors(tr.c,tr.a),v);target[i*3]=p.x;target[i*3+1]=p.y;target[i*3+2]=p.z}
  const scatter=new Float32Array(target.length);for(let i=0;i<target.length;i+=3){scatter[i]=(Math.random()-.5)*12;scatter[i+1]=Math.random()*7-1;scatter[i+2]=(Math.random()-.5)*10}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(scatter,3));const pts=new THREE.Points(g,mat(color,.018,.78));scene.add(pts);buildClouds.push({pts,target,t0:clock.elapsedTime+Math.random()*.8,dur:1.4+Math.random()*.7});return pts;
}'''
s = s[:start] + replacement + s[end:]
s = s.replace('A-WARE v0.21 · POINT-CLOUD PROTOTYPE','A-WARE v0.22 · POINT-CLOUD PROTOTYPE')
index.write_text(s, encoding='utf-8')
