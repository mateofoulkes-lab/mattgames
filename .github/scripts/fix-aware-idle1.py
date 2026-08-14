from pathlib import Path
p=Path('a-ware/index.html')
s=p.read_text()
s=s.replace("let currentHumanMode='typing',roomCloud=null;","let currentHumanMode='idle',roomCloud=null;")
s=s.replace("humanRoot=await new FBXLoader().loadAsync(A+'Y Bot@Typing.fbx')","humanRoot=await new FBXLoader().loadAsync(A+'Y Bot@Idle.fbx')")
s=s.replace("if(humanRoot.animations[0])humanClips.typing=humanRoot.animations[0];","if(humanRoot.animations[0]){humanClips.idle=humanRoot.animations[0];currentAction=humanMixer.clipAction(humanClips.idle);currentAction.reset().play();}")
p.write_text(s)
