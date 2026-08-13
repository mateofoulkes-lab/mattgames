from pathlib import Path
import trimesh

out = Path('a-ware/assets/models')
out.mkdir(parents=True, exist_ok=True)

def box(extents, center):
    mesh = trimesh.creation.box(extents=extents)
    mesh.apply_translation(center)
    return mesh

bed = [
    box((2.0,.18,1.0),(0,.28,0)),
    box((1.92,.26,.95),(0,.50,0)),
    box((.55,.16,.72),(-.62,.72,0)),
    box((.12,.95,1.10),(-1.02,.72,0)),
]
for x in (-.86,.86):
    for z in (-.38,.38):
        bed.append(box((.12,.38,.12),(x,.10,z)))
trimesh.util.concatenate(bed).export(out/'cama.glb')

night = [
    box((.58,.68,.52),(0,.40,0)),
    box((.66,.08,.60),(0,.78,0)),
    box((.50,.18,.03),(0,.52,.275)),
    box((.16,.05,.05),(0,.52,.315)),
]
for x in (-.23,.23):
    for z in (-.20,.20):
        night.append(box((.08,.22,.08),(x,.11,z)))
trimesh.util.concatenate(night).export(out/'mesadenoche.glb')

frame = [
    box((.14,2.20,.18),(-.57,1.10,0)),
    box((.14,2.20,.18),(.57,1.10,0)),
    box((1.28,.14,.18),(0,2.13,0)),
]
trimesh.util.concatenate(frame).export(out/'doorway.glb')
