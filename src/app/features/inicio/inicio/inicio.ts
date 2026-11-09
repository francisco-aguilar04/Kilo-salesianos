import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Escaner } from '../../../shared/components/escaner/escaner';
import { Aviso, TipoAviso } from '../../../shared/components/aviso/aviso';
import { CategoriasService } from '../../../core/services/categorias-service';
import { QrInvalidoError } from '../../../core/errors/qr-invalid-error';
import { CajasService } from '../../../core/services/caja-service';
import { Caja } from '../../../core/interfaces/caja';
import { Categoria } from '../../../core/interfaces/categoria';
import { HojaNuevaCaja } from '../../hoja-nueva-caja/hoja-nueva-caja';
import { Auth } from '../../../core/services/auth';
import { toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';

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

  // Categoría leída que espera confirmación. Si no es null, la hoja está abierta.
  protected readonly categoriaPendiente = signal<Categoria | null>(null);
  protected readonly creandoCaja = signal(false);

  private readonly cajas = inject(CajasService);
  private readonly auth = inject(Auth);

  // Caja abierta del usuario en tiempo real. Cambia sola al crear, cerrar o recargar.
  protected readonly cajaAbierta = toSignal(
    this.auth.user$.pipe(switchMap((u) => (u ? this.cajas.obtenerCajaAbierta(u.uid) : of(null)))),
    { initialValue: null },
  );

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
      // Con caja abierta. TEMPORAL: en la HU-05 esto se sustituye por sumar el alimento.
      this.mostrarAviso({
        tipo: 'aviso',
        titulo: `Tienes abierta la caja ${this.cajaAbierta()?.codigo}`,
        mensaje: 'Sumar alimentos llega en la HU-05',
      });
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

  protected cancelarNuevaCaja(): void {
    this.categoriaPendiente.set(null); // cierra la hoja y la cámara vuelve a leer
  }

  protected async confirmarNuevaCaja(): Promise<void> {
    const categoria = this.categoriaPendiente();
    const uid = this.auth.user()?.uid;
    if (!categoria || !uid) {
      this.categoriaPendiente.set(null);
      this.mostrarAviso({
        tipo: 'error',
        titulo: 'Sesión caducada',
        mensaje: 'Vuelve a iniciar sesión',
      });
      return;
    }

    this.creandoCaja.set(true); // desactiva los botones de la hoja
    try {
      const codigo = await this.cajas.abrirCaja(categoria, uid);
      this.categoriaPendiente.set(null);
      this.mostrarAviso({
        tipo: 'exito',
        titulo: `Caja ${codigo} abierta`,
        mensaje: 'Escribe el código en la caja',
      });
    } catch (e) {
      console.error(e);
      this.categoriaPendiente.set(null); // cierra la hoja para que se vea el aviso
      this.mostrarAviso({
        tipo: 'error',
        titulo: 'No se ha podido crear la caja',
        mensaje: 'Inténtalo de nuevo',
      });
    } finally {
      this.creandoCaja.set(false);
    }
  }
}
