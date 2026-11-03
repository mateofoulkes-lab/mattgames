# RADIANOID ✦ Orbital Neon Breaker

Rompebloques arcade radial en HTML Canvas (sin build, frameworks ni dependencias JS). Los hexágonos están en el centro; defendés una órbita completa con una paleta móvil. Diseñado para publicarse en GitHub Pages como subcarpeta de `mattgames`.

## Controles

- **Mouse (predeterminado):** el paddle sigue directamente el ángulo del cursor respecto del centro de la arena.
- **Opciones (⚙ o tecla O):** se puede elegir **movimiento horizontal**, que convierte X en los 360° y conserva el sentido previo. Se guarda en `localStorage`.
- **Clic izquierdo / Espacio:** lanzar bolas retenidas y disparar cuando hay láser.
- **Clic derecho sobre la arena:** cancelar el poder pegajoso (C) y liberar las pelotas capturadas.
- **Mantener click / Espacio:** disparo repetido del láser.
- **A/D / ←/→:** girar la paleta.
- **P / Esc:** pausar / reanudar.
- **Táctil:** arrastrar sobre la arena para ubicar la paleta alrededor del círculo; tocar para lanzar.

## Sobrecarga cinética (v1.2)

Cada pelota suma **una carga de cinco** cada vez que sale del paddle y regresa sin tocar ningún ladrillo durante ese vuelo. Golpear ladrillos no suma ni quita cargas ya acumuladas. Los cinco segmentos luminosos alrededor de cada bola muestran su energía; el indicador de la arena muestra la mayor carga de las bolas activas.

Con **5/5**, la bola brilla dorada. Su siguiente impacto rompe el ladrillo alcanzado y sus **hasta dieciocho vecinos** en dos anillos hexagonales (hasta 19 ladrillos por explosión), incluyendo ladrillos resistentes, con una onda expansiva neón. Cada ladrillo destruido suma puntos y puede soltar power-ups. La bola vuelve a 0/5 tras detonar y puede cargarse de nuevo. La carga es individual, incluso con multibola; se pierde al perder la pelota o al comenzar otro sector. Los disparos láser no cuentan como impactos de bola.

## Power-ups

| Letra | Efecto | Duración |
| :-- | :-- | :-- |
| G | Paleta grande | 20 s |
| T | Paleta chica (riesgo) | 14 s |
| E | Rebote elástico y turbo | 18 s |
| D | Paleta doble a 180° | 21 s |
| C | Paleta pegajosa; click para soltar | 20 s |
| L | Láser desde la paleta (click sostenido) | 19 s |
| P | Bolas perforantes | 17 s |
| M | Triplica las bolas | Instantáneo |
| H | Hipermultibola | Instantáneo |
| X | Hipermultibola perforante | Instantáneo + perforación |
| V | Vida extra (raro, verde-lima brillante) | +1 vida durante la partida |

Los hexágonos, la pelota, la paleta y las cápsulas usan el 80% de su tamaño original; la órbita se mantiene a su radio anterior para ampliar la zona libre entre centro y paddle.

Las mejoras pueden coexistir salvo G y T, que se reemplazan mutuamente. Las cápsulas salen del hexágono roto en ángulo aleatorio y se atrapan en el perímetro. El récord se guarda en `localStorage`.

## Ejecutar

Abrir `index.html` en un navegador o servir con un servidor estático (`python -m http.server` desde la raíz del repo). No requiere conexión una vez descargados los archivos (las tipografías externas tienen alternativas locales).
## Pantalla de escritorio (v1.3)

El área de juego y los paneles se ajustan a la altura visible de la ventana del navegador, sin scroll en PC. En móvil se mantiene el desplazamiento normal.

## Interfaz v1.5

En el panel izquierdo, puntuación y récord ocupan filas independientes para que los números no se superpongan. En la arena, el cursor del sistema se sustituye por un punto pequeño con halo cian neón centrado en la posición real del mouse. Los botones y la pantalla de inicio conservan sus cursores normales.

## Vida extra (v1.6)

Nuevo power-up **V**: aparece en promedio en una de cada 42 cápsulas que efectivamente caen de un ladrillo, además de la probabilidad normal de que aparezca una cápsula. Más raro que cada una de las letras habituales. Tamaño ligeramente mayor, pulsación, rayos blancos y halo verde-lima. Al capturarlo otorga +1 vida inmediatamente; en el HUD aparece «◆ ×N» al superar tres vidas. No se modificaron las reglas de acumulación de los demás power-ups, pendientes de aprobación.
