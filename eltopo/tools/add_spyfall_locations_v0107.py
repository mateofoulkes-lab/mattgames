from pathlib import Path

p=Path('eltopo/social-game.js')
s=p.read_text(encoding='utf-8')
s=s.replace("import { AVATARS } from './game-data.js?v=0.10.6';","import { AVATARS } from './game-data.js?v=0.10.7';",1)
s=s.replace("const VERSION = '0.10.6';","const VERSION = '0.10.7';",1)
old="  {name:'Circo', roles:['payaso','trapecista','domador','vendedor','director','espectador']}\n];"
new="""  {name:'Circo', roles:['payaso','trapecista','domador','vendedor','director','espectador']},
  {name:'Banco', roles:['cajero','gerente','cliente','guardia','asesor financiero','mensajero']},
  {name:'Biblioteca', roles:['bibliotecaria','estudiante','investigador','visitante','archivista','encargado de sala']},
  {name:'Parque de diversiones', roles:['operador de montaña rusa','visitante','vendedor de golosinas','seguridad','mascota del parque','técnico']},
  {name:'Estudio de televisión', roles:['conductora','camarógrafo','productora','invitado','maquilladora','asistente de piso']},
  {name:'Tribunal', roles:['juez','abogada','acusado','testigo','secretario','periodista']},
  {name:'Submarino', roles:['capitán','sonarista','ingeniera','cocinero','marinero','científica']},
  {name:'Campamento', roles:['coordinador','campista','cocinero','guía','guardaparque','fotógrafo']},
  {name:'Spa', roles:['masajista','cliente','recepcionista','esteticista','gerente','personal de limpieza']},
  {name:'Casamiento', roles:['novia','novio','fotógrafo','DJ','invitado','wedding planner']},
  {name:'Estación de tren', roles:['maquinista','pasajero','guarda','vendedor de boletos','seguridad','turista']},
  {name:'Granja', roles:['granjero','veterinaria','peón','comprador','transportista','visitante']},
  {name:'Laboratorio científico', roles:['investigadora','técnico','jefa de laboratorio','voluntario','seguridad','inspector']},
  {name:'Discoteca', roles:['DJ','bartender','cliente','seguridad','bailarín','encargado']},
  {name:'Cine', roles:['proyeccionista','espectador','acomodador','vendedor de pochoclos','gerente','crítico']},
  {name:'Cuartel de bomberos', roles:['bombero','jefa de guardia','operador de radio','mecánico','visitante','paramédico']},
  {name:'Peluquería', roles:['peluquera','cliente','colorista','recepcionista','aprendiz','proveedor']},
  {name:'Gimnasio', roles:['entrenador','socio','recepcionista','instructor de spinning','personal trainer','encargado']},
  {name:'Universidad', roles:['profesor','alumna','decano','investigadora','bedel','visitante']},
  {name:'Puerto', roles:['capitán','estibador','aduanera','pescador','turista','operador de grúa']},
  {name:'Avión en vuelo', roles:['piloto','copiloto','azafata','pasajero','comisario de a bordo','mecánico que viaja']}
];"""
if old not in s: raise SystemExit('SPY_LOCATIONS tail not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

idx=Path('eltopo/index.html')
h=idx.read_text(encoding='utf-8').replace('v0.10.6','v0.10.7')
idx.write_text(h,encoding='utf-8')

shim=Path('eltopo/mixed-avatar-sync.js')
if shim.exists():
    t=shim.read_text(encoding='utf-8').replace("const BUILD_VERSION = '0.10.6';","const BUILD_VERSION = '0.10.7';")
    shim.write_text(t,encoding='utf-8')
