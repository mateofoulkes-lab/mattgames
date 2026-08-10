export const APP_ID='mattgames-eltopo-v1';
export const MAX_PLAYERS=12;
export const MIN_PLAYERS=3;
export const THEMES={
 escape:{name:'Aficionados a las salas de escape',antagonist:'Dueño de cadena de salas de escape',situations:[
  'Una sala muy conocida copió casi entero el acertijo estrella de una sala independiente. ¿Lo denunciamos públicamente o lo hablamos en privado?',
  'Un integrante consiguió fotos del backstage de una sala nueva antes de su estreno. ¿Las compartimos en el grupo o las borramos?',
  'Hay rumores de que una cadena paga reseñas de cinco estrellas. ¿Publicamos lo que sabemos aunque no tengamos pruebas completas?',
  'Una sala canceló una reserva grande sin devolver la seña. ¿Organizamos un escrache o intentamos negociar primero?',
  'Nos invitaron gratis a una sala a cambio de una reseña. ¿Deberíamos aclararlo públicamente?',
  'Un diseñador contó en confianza el final de una sala muy esperada. ¿Podemos discutirlo acá o es cruzar un límite?',
  'Una cadena quiere comprar una sala independiente que todos amamos. ¿Conviene apoyar la venta o presionar para que siga independiente?',
  'Un dueño pidió expulsar del grupo a alguien que dejó una reseña muy negativa. ¿Qué hacemos?'
 ]},
 empresa:{name:'Equipo de una empresa',antagonist:'Director de la competencia',situations:['Hay que elegir a quién ascender con un solo puesto disponible. ¿A quién y por qué?','Un cliente importante exige un descuento imposible. ¿Cedemos o arriesgamos perderlo?','Alguien cometió un error caro y dirección quiere un responsable. ¿Cómo actuamos?','Hay rumores de despidos. ¿Se lo contamos al resto antes del anuncio oficial?']},
 amigos:{name:'Grupo de amigos',antagonist:'La persona de la que están hablando',situations:['Una persona quiere sumarse a las vacaciones y varios no la soportan. ¿La invitamos?','Alguien rompió algo caro en la casa alquilada y nadie admite haber sido. ¿Qué hacemos?','Hay una habitación mucho mejor que las demás. ¿Quién se la queda?','Uno no llega con la plata para el viaje. ¿Cubrimos su parte?']},
 vecinos:{name:'Grupo de vecinos',antagonist:'Administrador del consorcio',situations:['Las expensas subieron muchísimo y nadie entiende por qué. ¿Qué hacemos?','Un vecino hace fiestas hasta tarde todos los fines de semana. ¿Lo denunciamos?','Hay que decidir en qué gastar el fondo común. ¿Seguridad, pintura o arreglos?','Alguien deja basura fuera de horario. ¿Publicamos las cámaras?']},
 club:{name:'Club / asociación',antagonist:'Presidente del club rival',situations:['Hay que decidir si expulsar a un socio conflictivo. ¿Qué pesa más: lo que hizo o su historia en el club?','Apareció un agujero de dinero en las cuentas. ¿Se hace público ya?','Solo alcanza el presupuesto para una actividad. ¿Cuál se salva?','Un patrocinador ofrece mucho dinero pero exige cambiar una tradición del club. ¿Aceptamos?']}
};
export const CONSEQUENCES=['La captura llegó a alguien directamente involucrado. Se sintió traicionado y rompió relaciones con el grupo.','La conversación empezó a circular fuera del grupo y dañó seriamente su reputación.','La información fue usada para presionar al grupo en una negociación.','Una persona importante se enteró antes de tiempo y tomó una decisión en contra del grupo.','El mensaje llegó a alguien con poder para complicar la situación. La confianza cayó en picada.','La captura terminó en manos equivocadas y provocó un conflicto inmediato.'];
export const ROLES=[
 {key:'investigador',emoji:'🕵️',name:'Investigador',desc:'Una vez por partida podés obtener una lista corta de sospechosos que incluye al Topo.'},
 {key:'tecnico',emoji:'💻',name:'Técnico',desc:'Una vez por partida podés pedir una pista técnica sobre cuándo se conectó el Topo.'},
 {key:'seguridad',emoji:'🛡️',name:'Seguridad',desc:'Una vez por partida podés proteger un mensaje para que no pueda filtrarse.'},
 {key:'moderador',emoji:'⚖️',name:'Moderador',desc:'Detectás votaciones impulsivas. La cancelación de expulsión se activará más adelante.'},
 {key:'analista',emoji:'🧠',name:'Analista',desc:'Ves el recuento de la encuesta y podés detectar movimientos sospechosos.'},
 {key:'administrador',emoji:'👑',name:'Administrador',desc:'Tu primer voto de la partida vale doble.'},
 {key:'confidente',emoji:'🤫',name:'Confidente',desc:'Una vez por partida podés mandar un mensaje anónimo al grupo.'},
 {key:'editor',emoji:'🧹',name:'Editor',desc:'Una vez por partida podés eliminar uno de tus propios mensajes antes de la filtración.'},
 {key:'observador',emoji:'👁️',name:'Observador',desc:'Tu ventaja es leer patrones y comportamientos.'},
 {key:'manipulador',emoji:'🎭',name:'Manipulador',desc:'No sos necesariamente malo: tu especialidad es sembrar dudas.'}
];
export const TOPO_ROLE={key:'topo',emoji:'🐀',name:'EL TOPO',desc:'Elegí una captura para filtrar. Ganás si sobrevivís hasta el final o destruís la reputación del grupo.'};
export const AVATARS=[
 ['monja-gladys','🙏','Monja Gladys'],['kenji-turista','📷','Kenji, turista'],['braian-9','⚽','Braian 9'],['actor-dramatico','🎭','Ramiro, actor'],['chef-bigotes','👨‍🍳','Chef Bigotes'],['taxista-canchero','🚕','Tito, taxista'],['influencer-fachero','📱','Influencer'],['mago-elegante','🎩','Mago elegante'],['policia-retirado','👮','Policía retirado'],['profesor-loquito','🧑‍🏫','Profesor'],['metalero','🤘','Metalero'],['senora-cheta','💎','Señora cheta'],['gamer-feliz','🎮','Gamer'],['astrologo-mistico','🔮','Astrólogo'],['runner-intenso','🏃','Runner intenso'],['vendedor-ambulante','🥜','Vendedor ambulante'],['empresario-sonrisa','💼','Empresario'],['tia-conspiranoica','👁️','Tía conspiranoica'],['dj-neon','🎧','DJ'],['personal-trainer','💪','Personal trainer'],['cosplayer-heroina','🦸','Cosplayer'],['jubilado-aventurero','🧭','Jubilado aventurero'],['guia-turismo','🗺️','Guía de turismo'],['cantante-fiesta','🎤','Cantante de fiesta']
].map(([id,emoji,name])=>({id,emoji,name,file:`./portraits/${id}.jpg`}));
