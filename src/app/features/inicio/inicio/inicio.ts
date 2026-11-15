import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { Escaner } from '../../../shared/components/escaner/escaner';
import { Aviso, TipoAviso } from '../../../shared/components/aviso/aviso';
import { CategoriasService } from '../../../core/services/categorias-service';
import { AsociacionDuplicadaError, CajasService } from '../../../core/services/caja-service';
import { AsociacionesService } from '../../../core/services/asociaciones-service';
import { Auth } from '../../../core/services/auth';
import { Asociacion } from '../../../core/interfaces/asociacion';
import { Caja } from '../../../core/interfaces/caja';
import { Categoria } from '../../../core/interfaces/categoria';
import { ESTADOS_CAJA } from '../../../core/constants/estados-caja';
import { HojaNuevaCaja } from '../../hoja-nueva-caja/hoja-nueva-caja';
import { HojaCerrarCaja } from '../../hoja-cerrar-caja/hoja-cerrar-caja';
import { HojaAsignarCaja } from '../../hoja-asignar-caja/hoja-asignar-caja';
import { BarraCaja } from '../../../shared/components/barra-caja/barra-caja';
import { Router } from '@angular/router';
import {
  AvisoPantalla,
  avisoRechazo,
  decidirEntrada,
  vibrarRechazo,
} from '../../../core/utils/entrada-alimento';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [Escaner, Aviso, HojaNuevaCaja, HojaCerrarCaja, HojaAsignarCaja, BarraCaja],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
})
export class InicioComponent {
  // ---- Servicios (van primero: las señales de abajo los usan al crearse) ----
  private readonly categorias = inject(CategoriasService);
  private readonly cajas = inject(CajasService);
  private readonly asociacionesService = inject(AsociacionesService);
  private readonly auth = inject(Auth);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  // ---- Datos de Firestore en tiempo real ----
  protected readonly cajaAbierta = toSignal(
    this.auth.user$.pipe(switchMap((u) => (u ? this.cajas.obtenerCajaAbierta(u.uid) : of(null)))),
    { initialValue: null },
  );
  private readonly listaCategorias = toSignal(this.categorias.obtenerTodas(), { initialValue: [] });
  // Categorías activas indexadas por su código QR: buscar es instantáneo y no gasta lecturas.
  private readonly categoriasPorCodigo = computed(
    () =>
      new Map(
        this.listaCategorias()
          .filter((c) => c.activa)
          .map((c) => [c.codigoQr, c]),
      ),
  );

  // Asociaciones de menos a más kg (HU-09), con kg y nº de cajas calculados desde las cajas reales
  protected readonly asociaciones = toSignal(this.asociacionesService.obtenerConTotales(), {
    initialValue: [],
  });

  protected readonly categoriaCaja = computed(() => {
    const caja = this.cajaAbierta();
    return caja ? (this.listaCategorias().find((c) => c.id === caja.categoriaId) ?? null) : null;
  });

  // ---- Avisos ----
  protected readonly aviso = signal<AvisoPantalla | null>(null);
  private temporizador?: ReturnType<typeof setTimeout>;

  // ---- Hoja "Nueva caja" (HU-03) ----
  protected readonly categoriaPendiente = signal<Categoria | null>(null);
  protected readonly creandoCaja = signal(false);

  // ---- Hoja "Cerrar caja" (HU-08) ----
  protected readonly hojaCerrarAbierta = signal(false);
  protected readonly cerrandoCaja = signal(false);

  // ---- Hoja "¿A qué asociación va?" (HU-09) ----
  // Caja recién cerrada pendiente de asignar. Si no es null, la hoja está abierta.
  protected readonly cajaCerrada = signal<Caja | null>(null);
  protected readonly asignandoCaja = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.temporizador));
  }

  protected atras(): void {
    this.router.navigate(['/a-mano']); // HU-07
  }

  protected async alLeerCodigo(codigo: string): Promise<void> {
    // Con cualquier hoja abierta, la cámara no hace nada
    if (this.categoriaPendiente() || this.hojaCerrarAbierta()) return;

    if (this.listaCategorias().length === 0) {
      this.mostrarAviso({
        tipo: 'aviso',
        titulo: 'Cargando categorías',
        mensaje: 'Vuelve a escanear en un segundo',
      });
      return;
    }

    // CP4: validación en local, sin consultar Firestore en cada lectura
    const categoria = this.categoriasPorCodigo().get(codigo.trim());
    if (!categoria) {
      this.mostrarAviso({ tipo: 'aviso', titulo: 'QR no válido', mensaje: 'Avisa al coordinador' });
      return;
    }

    const decision = decidirEntrada(categoria, this.cajaAbierta());
    switch (decision.accion) {
      case 'abrir':
        this.categoriaPendiente.set(categoria); // HU-03: hoja "Nueva caja"
        return;
      case 'rechazar':
        vibrarRechazo(); // HU-06
        this.mostrarAviso(avisoRechazo(categoria, decision.caja));
        return;
      case 'sumar':
        try {
          await this.cajas.sumarUnidad(decision.caja.id);
          this.mostrarAviso(
            { tipo: 'exito', titulo: 'Alimento sumado', mensaje: `Caja ${decision.caja.codigo}` },
            1500,
          );
        } catch (e) {
          console.error(e);
          this.mostrarAviso({
            tipo: 'error',
            titulo: 'No se ha podido sumar',
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
    this.categoriaPendiente.set(null);
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

    this.creandoCaja.set(true);
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
      this.categoriaPendiente.set(null);
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
      // Abre la hoja "¿A qué asociación va?" (HU-09)
      this.cajaCerrada.set({ ...caja, estado: ESTADOS_CAJA.CERRADA, pesoKg });
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

  // ---- HU-09: asignar caja ----
  protected cancelarAsignacion(): void {
    if (!this.asignandoCaja()) this.cajaCerrada.set(null);
  }

  protected async confirmarAsignacion(asociacion: Asociacion): Promise<void> {
    const caja = this.cajaCerrada();
    if (!caja) return;

    this.asignandoCaja.set(true);
    try {
      await this.cajas.asignarCaja(caja.id, asociacion.id);
      this.cajaCerrada.set(null); // vuelta a la cámara sin caja
      this.mostrarAviso({
        tipo: 'exito',
        titulo: 'Caja asignada',
        mensaje: `${caja.codigo} → ${asociacion.nombre}`,
      });
    } catch (e) {
      console.error(e);
      this.cajaCerrada.set(null);
      this.mostrarAviso({
        tipo: 'error',
        titulo: 'No se ha podido asignar la caja',
        mensaje: 'Inténtalo de nuevo',
      });
    } finally {
      this.asignandoCaja.set(false);
    }
  }

  // ---- HU-10: crear asociación nueva y asignarle la caja ----
  protected async confirmarNuevaAsociacion(nombre: string): Promise<void> {
    const caja = this.cajaCerrada();
    if (!caja) return;

    this.asignandoCaja.set(true);
    try {
      await this.cajas.asignarCajaANuevaAsociacion(caja.id, nombre);
      this.cajaCerrada.set(null);
      this.mostrarAviso({
        tipo: 'exito',
        titulo: 'Caja asignada',
        mensaje: `${caja.codigo} → ${nombre}`,
      });
    } catch (e) {
      this.cajaCerrada.set(null);
      if (e instanceof AsociacionDuplicadaError) {
        this.mostrarAviso({
          tipo: 'aviso',
          titulo: 'Ya existe esa asociación',
          mensaje: 'Asigna la caja desde Mis cajas',
        });
      } else {
        console.error(e);
        this.mostrarAviso({
          tipo: 'error',
          titulo: 'No se ha podido crear la asociación',
          mensaje: 'Inténtalo de nuevo',
        });
      }
    } finally {
      this.asignandoCaja.set(false);
    }
  }
}
