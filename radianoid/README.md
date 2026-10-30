# RADIANOID ✦ Orbital Neon Breaker

Rompebloques arcade radial en HTML Canvas (sin build, frameworks ni dependencias JS). Los hexágonos están en el centro; defendés una órbita completa con una paleta móvil. Diseñado para publicarse en GitHub Pages como subcarpeta de `mattgames`.

## Controles

- **Mouse (predeterminado):** el paddle sigue directamente el ángulo del cursor respecto del centro de la arena.
- **Opciones (⚙ o tecla O):** se puede elegir **movimiento horizontal**, que convierte X en los 360° y conserva el sentido previo. Se guarda en `localStorage`.
- **Click / Espacio:** lanzar bolas retenidas y disparar cuando hay láser.
- **Mantener click / Espacio:** disparo repetido del láser.
- **A/D / ←/→:** girar la paleta.
- **P / Esc:** pausar / reanudar.
- **Táctil:** arrastrar sobre la arena para ubicar la paleta alrededor del círculo; tocar para lanzar.

## Sobrecarga cinética (v1.2)

Cada pelota suma **una carga de cinco** cada vez que sale del paddle y regresa sin tocar ningún ladrillo durante ese vuelo. Golpear ladrillos no suma ni quita cargas ya acumuladas. Los cinco segmentos luminosos alrededor de cada bola muestran su energía; el indicador de la arena muestra la mayor carga de las bolas activas.

Con **5/5**, la bola brilla dorada. Su siguiente impacto rompe el ladrillo alcanzado y sus **hasta seis vecinos hexagonales inmediatos**, incluyendo ladrillos resistentes, con una onda expansiva neón. Cada ladrillo destruido suma puntos y puede soltar power-ups. La bola vuelve a 0/5 tras detonar y puede cargarse de nuevo. La carga es individual, incluso con multibola; se pierde al perder la pelota o al comenzar otro sector. Los disparos láser no cuentan como impactos de bola.

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

Los hexágonos, la pelota, la paleta y las cápsulas usan el 80% de su tamaño original; la órbita se mantiene a su radio anterior para ampliar la zona libre entre centro y paddle.

Las mejoras pueden coexistir salvo G y T, que se reemplazan mutuamente. Las cápsulas salen del hexágono roto en ángulo aleatorio y se atrapan en el perímetro. El récord se guarda en `localStorage`.

## Ejecutar

Abrir `index.html` en un navegador o servir con un servidor estático (`python -m http.server` desde la raíz del repo). No requiere conexión una vez descargados los archivos (las tipografías externas tienen alternativas locales).