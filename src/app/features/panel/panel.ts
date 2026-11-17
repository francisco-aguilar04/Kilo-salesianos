import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ESTADOS_CAJA, EstadoCaja } from '../../core/constants/estados-caja';
import { Asociacion } from '../../core/interfaces/asociacion';
import { ResumenService } from '../../core/services/resumen-service';
import { RouterLink } from '@angular/router';

function formatearKg(valor: number, decimalesMinimos: number): string {
  return valor.toLocaleString('es-ES', {
    useGrouping: true,
    minimumFractionDigits: decimalesMinimos,
    maximumFractionDigits: 1,
  });
}

@Component({
  selector: 'app-panel',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
})
export class PanelComponent {
  private readonly resumenService = inject(ResumenService);

  protected readonly anio: number = new Date().getFullYear();

  // undefined = todavía cargando
  private readonly cajas = toSignal(this.resumenService.obtenerCajas());
  private readonly asociaciones = toSignal(this.resumenService.obtenerAsociaciones(), {
    initialValue: [] as Asociacion[],
  });

  protected readonly cargando = computed(() => this.cajas() === undefined);

  protected readonly totalCajas = computed(() => (this.cajas() ?? []).length);

  protected readonly abiertas = computed(() => this.contar(ESTADOS_CAJA.ABIERTA));

  protected readonly kgTotalesTexto = computed(() => {
    let kg: number = 0;
    for (const caja of this.cajas() ?? []) {
      kg += caja.pesoKg ?? 0;
    }
    return formatearKg(kg, 0);
  });

  // Barra apilada y leyenda de "Cajas por estado"
  protected readonly tramos = computed(() => {
    const total: number = this.totalCajas();
    const definicion = [
      { etiqueta: 'Asignadas', clase: 'asignada', cantidad: this.contar(ESTADOS_CAJA.ASIGNADA) },
      {
        etiqueta: 'Cerradas sin asignar',
        clase: 'cerrada',
        cantidad: this.contar(ESTADOS_CAJA.CERRADA),
      },
      { etiqueta: 'Abiertas', clase: 'abierta', cantidad: this.contar(ESTADOS_CAJA.ABIERTA) },
    ];
    return definicion.map((tramo) => ({
      ...tramo,
      porcentaje: total > 0 ? (tramo.cantidad / total) * 100 : 0,
    }));
  });

  // Kg por asociación calculados con las cajas asignadas (misma fuente que "Cajas por estado");
  // la barra es proporcional a la que más tiene
  protected readonly filasAsociaciones = computed(() => {
    const kgPorAsociacion = new Map<string, number>();
    for (const caja of this.cajas() ?? []) {
      if (caja.estado === ESTADOS_CAJA.ASIGNADA && caja.asociacionId) {
        const acumulado: number = kgPorAsociacion.get(caja.asociacionId) ?? 0;
        kgPorAsociacion.set(caja.asociacionId, acumulado + (caja.pesoKg ?? 0));
      }
    }

    const filas = this.asociaciones().map((asociacion) => ({
      id: asociacion.id,
      nombre: asociacion.nombre,
      kg: kgPorAsociacion.get(asociacion.id) ?? 0,
    }));
    filas.sort((a, b) => b.kg - a.kg);

    const maximo: number = filas.length > 0 ? filas[0].kg : 0;
    return filas.map((fila) => ({
      id: fila.id,
      nombre: fila.nombre,
      kgTexto: formatearKg(fila.kg, 1) + ' kg',
      porcentaje: maximo > 0 ? (fila.kg / maximo) * 100 : 0,
    }));
  });

  private contar(estado: EstadoCaja): number {
    return (this.cajas() ?? []).filter((caja) => caja.estado === estado).length;
  }
}
