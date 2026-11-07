## Componente `Escaner` (`app-escaner`)

Abre la cámara trasera, lee códigos QR y avisa del texto leído. No contiene lógica
de cajas ni de categorías: quien lo use decide qué hacer con el código.

Ruta: `src/app/shared/components/escaner/`

### Uso

```html
<app-escaner (codigoLeido)="alLeerCodigo($event)" />
```

```ts
imports: [Escaner]

alLeerCodigo(codigo: string) { /* tu lógica */ }
```

### Entradas y salidas

| | Nombre | Tipo | Descripción |
|---|---|---|---|
| Entradas | ninguna | | |
| Salida | `codigoLeido` | `string` | Texto del QR leído (sin espacios sobrantes) |

### Comportamiento
- Arranca la cámara al aparecer y la apaga al destruirse el componente.
- Si el mismo QR se mantiene delante de la cámara, solo se emite **una vez cada 3 segundos**.
- Muestra un mensaje con botón "Reintentar" si no hay permiso, no hay cámara o falla.
- Solo lee QR. Para añadir códigos de barras, cambiar `symbolType` en la configuración.

### Requisitos
- El contenedor tiene que darle **altura**, porque el componente ocupa el 100 %.
- En `angular.json` debe estar el bloque `assets` que copia `ngx-scanner-qrcode/wasm/`
  a `assets/wasm/`.
- En el móvil la cámara solo funciona con **HTTPS** (`ng serve --host 0.0.0.0 --ssl`
  o la app desplegada).