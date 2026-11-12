import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AsociacionesService } from '../../core/services/asociaciones-service';
import { CajasService } from '../../core/services/caja-service';
import { Asociacion } from '../../core/interfaces/asociacion';
import { Caja } from '../../core/interfaces/caja';

@Component({
  selector: 'app-asociaciones',
  standalone: true,
  templateUrl: './asociaciones.html',
  styleUrl: './asociaciones.scss',
})
export class AsociacionesComponent {
  private readonly asociacionesService = inject(AsociacionesService);
  private readonly cajasService = inject(CajasService);

  // null = todavía cargando
  private readonly asociacionesBase = toSignal<Asociacion[] | null>(
    this.asociacionesService.obtenerTodas(),
    { initialValue: null },
  );

  private readonly cajasAsignadas = toSignal<Caja[] | null>(
    this.cajasService.obtenerCajasAsignadas(),
    { initialValue: null },
  );

  // Mismas asociaciones, pero con kg y nº de cajas calculados desde las cajas reales
  protected readonly asociaciones = computed<Asociacion[] | null>(() => {
    const lista = this.asociacionesBase();
    const cajas = this.cajasAsignadas();
    if (!lista || !cajas) return null;

    return lista
      .map((a) => {
        const suyas = cajas.filter((c) => c.asociacionId === a.id);
        return {
          ...a,
          numCajas: suyas.length,
          kgRecibidos: suyas.reduce((suma, c) => suma + (c.pesoKg ?? 0), 0),
        };
      })
      .sort((x, y) => x.kgRecibidos - y.kgRecibidos || x.nombre.localeCompare(y.nombre, 'es'));
  });
}