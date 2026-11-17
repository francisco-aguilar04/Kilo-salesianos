import { Pipe, PipeTransform } from '@angular/core';

/**
 * A11: texto común para lo que ya no existe.
 *  - null      → "Eliminado" (en Firestore se puso a null al borrar: categoría A8, usuario B9…)
 *  - undefined → '' (todavía no ha cargado: no se pinta nada para no parpadear)
 *  - texto     → el propio texto
 */
export function textoOEliminado(valor: string | null | undefined): string {
  if (valor === null) return 'Eliminado';
  return valor ?? '';
}

@Pipe({ name: 'eliminado' })
export class EliminadoPipe implements PipeTransform {
  transform(valor: string | null | undefined): string {
    return textoOEliminado(valor);
  }
}
