from pathlib import Path
p=Path('a-ware/index.html')
s=p.read_text()
s=s.replace("for(const [k,f] of Object.entries({idle:'Y Bot@Idle.fbx',phone:'Y Bot@Texting While Standing.fbx'","for(const [k,f] of Object.entries({typing:'Y Bot@Typing.fbx',phone:'Y Bot@Texting While Standing.fbx'")
s=s.replace("setTimeout(()=>playHuman('typing'),350);","")
s=s.replace("function playHuman(name){const clip=humanClips[name];if(!clip||!humanMixer)return;","function playHuman(name){if(!humanMixer)return;const clip=humanClips[name]||humanClips.idle;if(!clip)return;")
s=s.replace("A-WARE v0.24 · EMERGENT CONTROL","A-WARE v0.24.1 · IDLE BASE")
p.write_text(s)
