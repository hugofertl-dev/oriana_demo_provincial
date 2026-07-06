# progress/current/ — handoffs de trabajo a medias

> **Un archivo por feature**: `current/<feature_id>.md`. Lo escribe el skill
> `handoff` con su protocolo (estado exacto, decisiones y por qué, archivos
> tocados, próximo paso concreto, verificación, trampas). Lo borra el skill
> `feature-close` al cerrar la feature.
>
> El hook SessionStart carga TODOS los handoffs presentes al abrir sesión.
> Directorio vacío (solo este archivo) = no hay trabajo a medias.
>
> ¿Por qué un archivo por feature y no uno global? Dos devs con trabajo a
> medias en ramas distintas mergean sin pisarse.
