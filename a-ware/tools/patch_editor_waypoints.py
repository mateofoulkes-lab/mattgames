from pathlib import Path

p=Path('a-ware/editor.html')
s=p.read_text(encoding='utf-8')

# Add procedural room props to selector.
s=s.replace("'door.glb','ac_indoor.glb'","'door.glb','cama.glb','mesadenoche.glb','doorway.glb','ac_indoor.glb'")

# Insert waypoint UI before export button.
needle='<button id="home">Vista general</button><button id="out">Generar texto</button>'
insert='''<button id="home">Vista general</button><hr><h3>WAYPOINTS HUMANO</h3><input id="wpName" placeholder="nombre: usando_pc"><select id="wpAnim"></select><button id="wpCreate">Crear waypoint</button><ul id="wpList"></ul><button id="wpDelete">Borrar waypoint</button><hr><button id="out">Generar texto</button>'''
s=s.replace(needle,insert)

# Runtime procedural objects: editor treats them as models.
old="async function load(file){return file.endsWith('.glb')?(await g.loadAsync(B+file)).scene:await f.loadAsync(B+file)}"
new=r'''async function load(file){
 if(file==='cama.glb'){const q=new T.Group(),m=new T.MeshNormalMaterial();const add=(e,p)=>{const x=new T.Mesh(new T.BoxGeometry(...e),m);x.position.set(...p);q.add(x)};add([2,.18,1],[0,.28,0]);add([1.92,.26,.95],[0,.5,0]);add([.55,.16,.72],[-.62,.72,0]);add([.12,.95,1.1],[-1.02,.72,0]);for(const x of[-.86,.86])for(const z of[-.38,.38])add([.12,.38,.12],[x,.1,z]);return q}
 if(file==='mesadenoche.glb'){const q=new T.Group(),m=new T.MeshNormalMaterial();const add=(e,p)=>{const x=new T.Mesh(new T.BoxGeometry(...e),m);x.position.set(...p);q.add(x)};add([.58,.68,.52],[0,.4,0]);add([.66,.08,.6],[0,.78,0]);add([.5,.18,.03],[0,.52,.275]);add([.16,.05,.05],[0,.52,.315]);for(const x of[-.23,.23])for(const z of[-.2,.2])add([.08,.22,.08],[x,.11,z]);return q}
 if(file==='doorway.glb'){const q=new T.Group(),m=new T.MeshNormalMaterial();const add=(e,p)=>{const x=new T.Mesh(new T.BoxGeometry(...e),m);x.position.set(...p);q.add(x)};add([.14,2.2,.18],[-.57,1.1,0]);add([.14,2.2,.18],[.57,1.1,0]);add([1.28,.14,.18],[0,2.13,0]);return q}
 return file.endsWith('.glb')?(await g.loadAsync(B+file)).scene:await f.loadAsync(B+file)
}'''
s=s.replace(old,new)

# Add waypoint engine before button bindings.
needle="$('add').onclick=()=>add($('model').value);"
wp=r'''const wpAnims={typing:'Y Bot@Typing.fbx',idle:'Y Bot@Idle.fbx',sitting:'Y Bot@Sitting.fbx',phone:'Y Bot@Texting While Standing.fbx',walk:'Y Bot@Standard Walk.fbx',stairs:'Y Bot@Descending Stairs.fbx',sleep:'Y Bot@Sleeping Idle.fbx',interact:'Y Bot@Sending Fax.fbx'};
Object.entries(wpAnims).forEach(([k,v])=>{$('wpAnim').add(new Option(k+' — '+v,k))});
const waypoints=[];let wpSelected=null,wpMixer=null;
function drawWp(){const u=$('wpList');u.innerHTML='';waypoints.forEach(w=>{const l=document.createElement('li');l.textContent=w.userData.wpName+' ['+w.userData.wpAnim+']';if(w===wpSelected)l.className='on';l.onclick=()=>pickWp(w);u.append(l)})}
function pickWp(w){wpSelected=w;sel=null;x.detach();if(w)x.attach(w);draw();drawWp()}
async function createWp(){const name=$('wpName').value.trim()||('waypoint_'+(waypoints.length+1)),anim=$('wpAnim').value,file=wpAnims[anim];const root=await f.loadAsync(B+file);norm(root,3.15);root.traverse(m=>{if(m.isMesh){m.material=new T.MeshBasicMaterial({color:0x66ffff,transparent:true,opacity:.35,wireframe:true})}});const w=new T.Group();w.name='WP_'+name;w.userData={isWaypoint:true,wpName:name,wpAnim:anim,file};w.add(root);S.add(w);waypoints.push(w);if(root.animations?.[0]){wpMixer=new T.AnimationMixer(root);wpMixer.clipAction(root.animations[0]).play()}pickWp(w)}
function delWp(){if(!wpSelected)return;const i=waypoints.indexOf(wpSelected);if(i>=0)waypoints.splice(i,1);S.remove(wpSelected);x.detach();wpSelected=null;drawWp()}
function wpData(w){let q=v=>Math.round(v*1000)/1000;return{name:w.userData.wpName,animation:w.userData.wpAnim,file:w.userData.file,position:[q(w.position.x),q(w.position.y),q(w.position.z)],rotation:[q(w.rotation.x),q(w.rotation.y),q(w.rotation.z)]}}
$('wpCreate').onclick=createWp;$('wpDelete').onclick=delWp;
$('add').onclick=()=>add($('model').value);'''
s=s.replace(needle,wp)

# Export waypoints too.
s=s.replace("JSON.stringify({version:'a-ware-layout-v1',instances:objs.map(data)},null,2)","JSON.stringify({version:'a-ware-layout-v2',instances:objs.map(data),waypoints:waypoints.map(wpData)},null,2)")

# animate mixer
s=s.replace("(function loop(){requestAnimationFrame(loop);R.render(S,C)})();","let last=performance.now();(function loop(){requestAnimationFrame(loop);const now=performance.now(),dt=(now-last)/1000;last=now;if(wpMixer)wpMixer.update(dt);R.render(S,C)})();")

p.write_text(s,encoding='utf-8')
