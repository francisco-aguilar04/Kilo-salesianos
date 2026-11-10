import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { Escaner } from '../../../shared/components/escaner/escaner';
import { Aviso, TipoAviso } from '../../../shared/components/aviso/aviso';
import { CategoriasService } from '../../../core/services/categorias-service';
import { CajasService } from '../../../core/services/caja-service';
import { Auth } from '../../../core/services/auth';
import { QrInvalidoError } from '../../../core/errors/qr-invalid-error';
import { Caja } from '../../../core/interfaces/caja';
import { Categoria } from '../../../core/interfaces/categoria';
import { ESTADOS_CAJA } from '../../../core/constants/estados-caja';
import { HojaNuevaCaja } from '../../hoja-nueva-caja/hoja-nueva-caja';
import { HojaCerrarCaja } from '../../hoja-cerrar-caja/hoja-cerrar-caja';

interface AvisoPantalla {
  tipo: TipoAviso;
  titulo: string;
  mensaje: string;
}

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [Escaner, Aviso, HojaNuevaCaja, HojaCerrarCaja],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
})
export class InicioComponent {
  // ---- Servicios (van primero: las señales de abajo los usan al crearse) ----
  private readonly categorias = inject(CategoriasService);
  private readonly cajas = inject(CajasService);
  private readonly auth = inject(Auth);
  private readonly destroyRef = inject(DestroyRef);

  // ---- Datos de Firestore en tiempo real ----
  // Caja abierta del usuario. Cambia sola al crear, cerrar o recargar.
  protected readonly cajaAbierta = toSignal(
    this.auth.user$.pipe(switchMap((u) => (u ? this.cajas.obtenerCajaAbierta(u.uid) : of(null)))),
    { initialValue: null },
  );
  // Si en la HU-05 ya cargaste las categorías en local, usa esa señal y no añadas esta.
  private readonly listaCategorias = toSignal(this.categorias.obtenerTodas(), { initialValue: [] });

  // Categoría de la caja abierta (nombre y color para la hoja de cierre).
  protected readonly categoriaCaja = computed(() => {
    const caja = this.cajaAbierta();
    return caja ? (this.listaCategorias().find((c) => c.id === caja.categoriaId) ?? null) : null;
  });

  // ---- Avisos ----
  protected readonly aviso = signal<AvisoPantalla | null>(null);
  private temporizador?: ReturnType<typeof setTimeout>;

  // ---- Hoja "Nueva caja" (HU-03) ----
  // Categoría leída que espera confirmación. Si no es null, la hoja está abierta.
  protected readonly categoriaPendiente = signal<Categoria | null>(null);
  protected readonly creandoCaja = signal(false);

  // ---- Hoja "Cerrar caja" (HU-08) ----
  protected readonly hojaCerrarAbierta = signal(false);
  protected readonly cerrandoCaja = signal(false);
  // Última caja cerrada. HU-09 (compañero) abre la asignación a partir de esta señal.
  protected readonly cajaCerrada = signal<Caja | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.temporizador));
  }

  protected atras(): void {
    // TODO: según el Figma (1.1), esta flecha lleva a "Introducir a mano".
    // Esa pantalla aún no existe; cuando esté, navegar a su ruta aquí.
  }

  protected async alLeerCodigo(codigo: string): Promise<void> {
    // Con cualquier hoja abierta, la cámara no hace nada
    if (this.categoriaPendiente() || this.hojaCerrarAbierta()) return;
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

  // ---- HU-03: abrir caja ----
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

  // ---- HU-08: cerrar caja ----
  protected abrirCierre(): void {
    const caja = this.cajaAbierta();
    if (!caja) return;
    if (caja.unidades === 0) {
      // EX-04
      this.mostrarAviso({
        tipo: 'aviso',
        titulo: 'La caja está vacía',
        mensaje: 'Escanea al menos un alimento antes de cerrarla.',
      });
      return;
    }
    this.hojaCerrarAbierta.set(true);
  }

  protected cancelarCierre(): void {
    if (!this.cerrandoCaja()) this.hojaCerrarAbierta.set(false);
  }

  protected async confirmarCierre(pesoKg: number): Promise<void> {
    const caja = this.cajaAbierta();
    if (!caja) {
      this.hojaCerrarAbierta.set(false);
      return;
    }

    this.cerrandoCaja.set(true);
    try {
      await this.cajas.cerrarCaja(caja.id, pesoKg);
      this.hojaCerrarAbierta.set(false);
      this.cajaCerrada.set({ ...caja, estado: ESTADOS_CAJA.CERRADA, pesoKg });
      // TODO HU-09: aquí se abre la hoja "¿A qué asociación va?". Mientras tanto, aviso verde:
      this.mostrarAviso({
        tipo: 'exito',
        titulo: `Caja ${caja.codigo} cerrada`,
        mensaje: `${pesoKg.toLocaleString('es-ES')} kg`,
      });
    } catch (e) {
      console.error(e);
      this.hojaCerrarAbierta.set(false);
      this.mostrarAviso({
        tipo: 'error',
        titulo: 'No se ha podido cerrar la caja',
        mensaje: 'Inténtalo de nuevo',
      });
    } finally {
      this.cerrandoCaja.set(false);
    }
  }
}
