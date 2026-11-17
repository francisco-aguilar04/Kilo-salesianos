import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth } from '../../core/services/auth';
import { Categoria } from '../../core/interfaces/categoria';
import {
  CategoriaDuplicadaError,
  CategoriasService,
  NuevaCategoria,
} from '../../core/services/categorias-service';
import { ModalCategoria } from '../../shared/components/modal-categoria/modal-categoria';
import { ModalConfirmar } from '../../shared/components/modal-confirmar/modal-confirmar';

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [ModalCategoria, ModalConfirmar],
  templateUrl: './categorias.html',
  styleUrl: './categorias.scss',
})
export class CategoriasComponent {
  protected readonly auth = inject(Auth);
  private readonly categoriasService = inject(CategoriasService);

  // null = todavía cargando
  protected readonly categorias = toSignal<Categoria[] | null>(
    this.categoriasService.obtenerTodas(),
    { initialValue: null },
  );

  // ---- A6 nueva / A7 editar (solo admin): el mismo modal para las dos cosas ----
  protected readonly modalAbierto = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorModal = signal<string | null>(null);
  // A7: null = crear una nueva; una categoría = editar esa
  protected readonly categoriaEditando = signal<Categoria | null>(null);

  protected abrirModal(): void {
    if (!this.auth.isAdmin()) return;
    this.categoriaEditando.set(null);
    this.errorModal.set(null);
    this.modalAbierto.set(true);
  }

  // A7
  protected abrirEdicion(categoria: Categoria): void {
    if (!this.auth.isAdmin()) return;
    this.categoriaEditando.set(categoria);
    this.errorModal.set(null);
    this.modalAbierto.set(true);
  }

  protected cerrarModal(): void {
    if (this.guardando()) return;
    this.modalAbierto.set(false);
  }

  // A7: el modal emite lo mismo en los dos modos; aquí decidimos si creamos o editamos
  protected async guardar(datos: NuevaCategoria): Promise<void> {
    if (!this.auth.isAdmin() || this.guardando()) return;

    const editando = this.categoriaEditando();
    // Si no ha cambiado el nombre, no hace falta escribir en Firestore
    if (editando && editando.nombre === datos.nombre) {
      this.modalAbierto.set(false);
      return;
    }

    this.errorModal.set(null);
    this.guardando.set(true);
    try {
      if (editando) {
        await this.categoriasService.editarNombre(editando.id, datos.nombre);
      } else {
        await this.categoriasService.crearCategoria(datos);
      }
      this.modalAbierto.set(false); // la lista se actualiza sola (tiempo real)
    } catch (e) {
      if (e instanceof CategoriaDuplicadaError) {
        this.errorModal.set(e.message);
      } else {
        console.error(e);
        this.errorModal.set(
          editando
            ? 'No se ha podido guardar el cambio. Inténtalo de nuevo'
            : 'No se ha podido crear la categoría. Inténtalo de nuevo',
        );
      }
    } finally {
      this.guardando.set(false);
    }
  }

  // ---- A8: borrar categoría con confirmación (solo admin) ----
  // null = no hay confirmación abierta; una categoría = la que se va a borrar
  protected readonly categoriaBorrando = signal<Categoria | null>(null);
  protected readonly borrando = signal(false);
  protected readonly errorBorrado = signal<string | null>(null);

  protected mensajeBorrado(c: Categoria): string {
    return `Vas a borrar «${c.nombre}». Las bolsas que la usaban no se borran: se quedarán sin categoría. Esta acción no se puede deshacer.`;
  }

  protected abrirBorrado(categoria: Categoria): void {
    if (!this.auth.isAdmin()) return;
    this.errorBorrado.set(null);
    this.categoriaBorrando.set(categoria);
  }

  protected cancelarBorrado(): void {
    if (this.borrando()) return;
    this.categoriaBorrando.set(null);
  }

  protected async borrar(): Promise<void> {
    const categoria = this.categoriaBorrando();
    if (!categoria || !this.auth.isAdmin() || this.borrando()) return;

    this.errorBorrado.set(null);
    this.borrando.set(true);
    try {
      await this.categoriasService.borrarCategoria(categoria.id);
      this.categoriaBorrando.set(null); // la lista se actualiza sola (tiempo real)
    } catch (e) {
      console.error(e);
      this.errorBorrado.set('No se ha podido borrar la categoría. Inténtalo de nuevo');
    } finally {
      this.borrando.set(false);
    }
  }
}
