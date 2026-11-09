import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Escaner } from '../../../shared/components/escaner/escaner';
import { Aviso, TipoAviso } from '../../../shared/components/aviso/aviso';
import { CategoriasService } from '../../../core/services/categorias-service';
import { QrInvalidoError } from '../../../core/errors/qr-invalid-error';
import { CajaService } from '../../../core/services/caja-service';
import { Caja } from '../../../core/interfaces/caja';
import { Categoria } from '../../../core/interfaces/categoria';
import { HojaNuevaCaja } from '../../hoja-nueva-caja/hoja-nueva-caja';

interface AvisoPantalla {
  tipo: TipoAviso;
  titulo: string;
  mensaje: string;
}

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [Escaner, Aviso, HojaNuevaCaja],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
})
export class InicioComponent {
  private readonly categorias = inject(CategoriasService);
  private readonly destroyRef = inject(DestroyRef);
  private temporizador?: ReturnType<typeof setTimeout>;

  protected readonly aviso = signal<AvisoPantalla | null>(null);

  // null = el voluntario no tiene caja abierta. Esto se hace debido a que las pantallas cambian según si hay o no caja abierta, de esta fornma el html oslo tiene que preguntar al signal

  protected readonly cajaAbierta = signal<Caja | null>(null);

  // Categoría leída que espera confirmación. Si no es null, la hoja está abierta.
  protected readonly categoriaPendiente = signal<Categoria | null>(null);
  protected readonly creandoCaja = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.temporizador));
  }

  protected atras(): void {
    // TODO: según el Figma (1.1), esta flecha lleva a "Introducir a mano".
    // Esa pantalla aún no existe; cuando esté, navegar a su ruta aquí.
  }

  protected async alLeerCodigo(codigo: string): Promise<void> {
    if (this.categoriaPendiente()) return; // con la hoja abierta, la cámara no hace nada
    try {
      const categoria = await this.categorias.validarCodigo(codigo);
      if (!this.cajaAbierta()) {
        this.categoriaPendiente.set(categoria); // abre la hoja
        return;
      }
    } catch (e) {
      if (e instanceof QrInvalidoError) {
        this.mostrarAviso({
          tipo: 'aviso',
          titulo: 'QR no válido',
          mensaje: 'Avisa al coordinador',
        });
      } else {
        console.error(e);
        this.mostrarAviso({
          tipo: 'error',
          titulo: 'Ha ocurrido un error',
          mensaje: 'Inténtalo de nuevo',
        });
      }
    }
  }

  private mostrarAviso(aviso: AvisoPantalla, ms = 3000): void {
    clearTimeout(this.temporizador);
    this.aviso.set(aviso);
    this.temporizador = setTimeout(() => this.aviso.set(null), ms);
  }
  protected confirmarNuevaCaja(): void {
    // Checkpoint 3: aquí llamaremos a CajasService.abrirCaja.
    console.log('Crear caja de', this.categoriaPendiente()?.nombre);
    this.categoriaPendiente.set(null);
  }

  protected cancelarNuevaCaja(): void {
    this.categoriaPendiente.set(null); // cierra la hoja y la cámara vuelve a leer
  }
}
