const ARCHETYPES = {
  'monja-gladys': {names:['Hermana Beatriz','Hermana Gladys','Hermana Marta'], occupations:['monja y directora de colegio parroquial','coordinadora de un hogar religioso']},
  'kenji-turista': {names:['Kenji Sato','Hiro Tanaka','Akira Mori'], occupations:['fotógrafo de viajes','guía de turismo internacional']},
  'braian-9': {names:['Braian Ferreyra','Nico Barreto','Lautaro Funes'], occupations:['futbolista retirado','ex delantero de primera división']},
  'actor-dramatico': {names:['Ramiro Valdés','Leandro Ferri','Tomás Bellini'], occupations:['actor teatral','director de una compañía de teatro']},
  'chef-bigotes': {names:['Osvaldo Mancini','Héctor Belloso','Bruno Salvatierra'], occupations:['chef de restaurante','cocinero de hotel cinco estrellas']},
  'taxista-canchero': {names:['Tito Roldán','Beto Soria','Rubén Mansilla'], occupations:['taxista nocturno','chofer particular']},
  'influencer-fachero': {names:['Thiago Costa','Kevin Duarte','Franco Vidal'], occupations:['influencer de lifestyle','creador de contenido']},
  'mago-elegante': {names:['Renzo Magnani','Víctor Merlín','Damián Volta'], occupations:['ilusionista profesional','mago de eventos privados']},
  'policia-retirado': {names:['Hugo Benítez','Raúl Pereyra','Carlos Medina'], occupations:['policía retirado','ex comisario']},
  'profesor-loquito': {names:['Ernesto Ledesma','Fabián Quiroga','Marcelo Fontana'], occupations:['profesor de historia','docente universitario']},
  'metalero': {names:['Rocco Acosta','Damián Black','Leo Barrera'], occupations:['guitarrista de heavy metal','dueño de una disquería']},
  'senora-cheta': {names:['Patricia Anchorena','Silvina Estrada','Verónica Alvear'], occupations:['organizadora de eventos de lujo','dueña de una boutique']},
  'gamer-feliz': {names:['Nico Pixel','Facundo Ríos','Tomás Vega'], occupations:['streamer de videojuegos','jugador profesional de esports']},
  'astrologo-mistico': {names:['Alex Eclipse','Dani Luna','Cris Solari'], occupations:['especialista en astrología','lector de cartas astrales']},
  'runner-intenso': {names:['Mariano Rivas','Santi Torres','Diego Ferraro'], occupations:['entrenador de running','preparador físico de maratón']},
  'vendedor-ambulante': {names:['Charly Gómez','Pablo Vera','Oscar Núñez'], occupations:['vendedor ambulante','feriante itinerante']},
  'empresario-sonrisa': {names:['Federico Lagos','Gonzalo Paredes','Martín del Campo'], occupations:['empresario inmobiliario','dueño de una agencia de autos']},
  'tia-conspiranoica': {names:['Norma Falcón','Mabel Cardozo','Mirta Luján'], occupations:['administradora de grupos vecinales','vendedora de productos naturales']},
  'dj-neon': {names:['Alex Neon','Dani Volt','Nico Beat'], occupations:['DJ de boliches','productor de música electrónica']},
  'personal-trainer': {names:['Maxi Correa','Lucas Ferri','Germán Roca'], occupations:['personal trainer','entrenador de celebridades']},
  'cosplayer-heroina': {names:['Lola Vega','Mica Centella','Agus Nova'], occupations:['cosplayer profesional','creadora de vestuario fantástico']},
  'jubilado-aventurero': {names:['Roberto Altamirano','Eduardo Varela','Cacho Molina'], occupations:['jubilado y viajero aventurero','ex guía de montaña']},
  'guia-turismo': {names:['Sergio Costa','Dani Molina','Alex Funes'], occupations:['guía de turismo','coordinador de excursiones']},
  'cantante-fiesta': {names:['Tony Falcón','Leo Tropical','Nico Diamante'], occupations:['cantante de fiestas','animador musical']},
  'conductora-tv': {names:['Victoria Rey','Carolina Montes','Lucía Ferrer'], occupations:['conductora de televisión','presentadora de un magazine de TV']},
  'cumbiero-keytar': {names:['Damián Tropical','Leo Santoro','Fabián Ráfaga'], occupations:['cantante de cumbia','tecladista y líder de una banda tropical']},
  'maquilladora-funeraria': {names:['Mónica Nocturna','Elvira Salvatierra','Claudia Montenegro'], occupations:['maquilladora funeraria','tanatoesteticista']},
  'empleada-municipal': {names:['Graciela Funes','Sandra Medina','Mónica Ferreyra'], occupations:['empleada administrativa municipal','encargada de atención al público en una municipalidad']}
};

const DETAILS = [
  'colecciona llaves de lugares donde nunca vivió',
  'tiene tres teléfonos y nunca explica para qué usa cada uno',
  'está convencido de que su mascota entiende conversaciones humanas',
  'guarda tickets de todos los lugares importantes de su vida',
  'odia los audios largos pero manda audios de siete minutos',
  'tiene un talento sorprendente para imitar voces por teléfono',
  'se niega a sentarse de espaldas a una puerta',
  'anota en una libreta las frases sospechosas que escucha',
  'cambia de perfume según su estado de ánimo',
  'dice reconocer a una persona mentirosa por cómo sostiene una taza',
  'asegura haber rechazado una propuesta para entrar a un reality',
  'aparece en una publicidad vieja que nadie logra encontrar en internet',
  'cada vez que cuenta su edad da un número ligeramente distinto',
  'lleva siempre encima una baraja española incompleta',
  'jamás admite haberse perdido aunque claramente no sepa dónde está',
  'tiene una caja llena de fotos impresas de gente que ya no recuerda',
  'no soporta que otra persona maneje su auto',
  'cree que todos los grupos necesitan un líder y suele proponerse para el puesto',
  'puede dormirse en cualquier transporte en menos de cinco minutos',
  'recuerda las patentes de autos con una facilidad inquietante',
  'nunca toma café después de las seis porque dice que le cambia la personalidad',
  'lleva siempre efectivo escondido en un lugar distinto',
  'tiene una cicatriz de la que cuenta una historia diferente según quién pregunte',
  'hace listas para absolutamente todo',
  'tiene una canción que escucha antes de tomar decisiones importantes',
  'dice haber visto un ovni y se pone muy serio cuando se lo discuten',
  'no presta libros porque asegura que nunca vuelven',
  'guarda un traje elegante preparado para emergencias inexplicables'
];

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const sample = (arr, count) => {
  const copy=[...arr];
  for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}
  return copy.slice(0,count);
};

export function makeIncognitoPersona(avatar){
  const base=ARCHETYPES[avatar.id] || {names:[avatar.name],occupations:['personaje misterioso']};
  const details=sample(DETAILS, Math.random()<0.5?2:3);
  return {name:pick(base.names),occupation:pick(base.occupations),details,detail:details.join(' · '),avatar:avatar.id};
}
