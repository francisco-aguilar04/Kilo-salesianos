import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CategoriasService } from '../../../core/services/categorias-service';

@Component({
  selector: 'app-categorias-prueba',
  templateUrl: './categorias-prueba.html',
})
export class CategoriasPrueba {
  protected readonly categorias = toSignal(inject(CategoriasService).obtenerActivas(), {
    initialValue: [],
  });
}
