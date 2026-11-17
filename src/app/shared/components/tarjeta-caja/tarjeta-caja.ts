import { Component, computed, input, output } from '@angular/core';
import { ESTADOS_CAJA } from '../../../core/constants/estados-caja';
import { Caja } from '../../../core/interfaces/caja';
import { Categoria } from '../../../core/interfaces/categoria';

@Component({
  selector: 'app-tarjeta-caja',
  standalone: true,
  templateUrl: './tarjeta-caja.html',
  styleUrl: './tarjeta-caja.scss',
})
export class TarjetaCaja {
  readonly caja = input.required<Caja>();
  readonly categoria = input<Categoria | undefined>();
  readonly asociacion = input<string | null>(null);
  // A9: quién creó la bolsa. undefined = no se muestra (voluntario); null = desconocido
  readonly creador = input<string | null | undefined>(undefined);
  readonly interactiva = input(false); // solo las cajas cerradas sin asignar se pueden tocar
  readonly seleccionada = output<Caja>();

  // "LG" de "LG-014"
  protected readonly prefijo = computed(() => this.caja().codigo.split('-')[0]);

  protected readonly color = computed(() => this.categoria()?.color ?? '#666666');

  protected readonly detalle = computed(() => {
    const caja: Caja = this.caja();
    const nombre: string = this.categoria()?.nombre ?? '';
    const partes: string[] = [];

    if (nombre) {
      partes.push(nombre.charAt(0).toUpperCase() + nombre.slice(1));
    }
    partes.push(caja.unidades === 1 ? '1 ud' : caja.unidades + ' uds');
    if (caja.pesoKg !== null) {
      partes.push(
        caja.pesoKg.toLocaleString('es-ES', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }) + ' kg',
      );
    }
    return partes.join(' · ');
  });

  protected readonly estadoTexto = computed(() => {
    switch (this.caja().estado) {
      case ESTADOS_CAJA.ABIERTA:
        return 'Abierta';
      case ESTADOS_CAJA.CERRADA:
        return 'Sin asignar';
      default:
        return 'Asignada';
    }
  });
}
