import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AsociacionesService } from '../../core/services/asociaciones-service';
import { Asociacion } from '../../core/interfaces/asociacion';

@Component({
  selector: 'app-asociaciones',
  standalone: true,
  templateUrl: './asociaciones.html',
  styleUrl: './asociaciones.scss',
})
export class AsociacionesComponent {
  private readonly asociacionesService = inject(AsociacionesService);

  // null = todavía cargando
  protected readonly asociaciones = toSignal<Asociacion[] | null>(
    this.asociacionesService.obtenerTodas(),
    { initialValue: null },
  );
}