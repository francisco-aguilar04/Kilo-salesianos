import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { Aviso } from '../../shared/components/aviso/aviso';
import { CategoriasService } from '../../core/services/categorias-service';
import { CajasService } from '../../core/services/caja-service';
import { Auth } from '../../core/services/auth';
import { Categoria } from '../../core/interfaces/categoria';
import {
  AvisoPantalla,
  avisoRechazo,
  decidirEntrada,
  vibrarRechazo,
} from '../../core/utils/entrada-alimento';

@Component({
  selector: 'app-introducir-a-mano',
  imports: [Aviso, TitleCasePipe],
  templateUrl: './introducir-a-mano.html',
  styleUrl: './introducir-a-mano.scss',
})
export class IntroducirAMano {
  private readonly categorias = inject(CategoriasService);
  private readonly cajas = inject(CajasService);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // Mismos datos en tiempo real que la cámara
  protected readonly cajaAbierta = toSignal(
    this.auth.user$.pipe(switchMap((u) => (u ? this.cajas.obtenerCajaAbierta(u.uid) : of(null)))),
    { initialValue: null },
  );
  private readonly listaCategorias = toSignal(this.categorias.obtenerTodas(), { initialValue: [] });
  protected readonly activas = computed(() => this.listaCategorias().filter((c) => c.activa));
  protected readonly categoriaCaja = computed(() => {
    const caja = this.cajaAbierta();
    return caja ? (this.listaCategorias().find((c) => c.id === caja.categoriaId) ?? null) : null;
  });

  // Modal: si no es null, está abierto con esa categoría
  protected readonly seleccionada = signal<Categoria | null>(null);
  protected readonly guardando = signal(false);

  protected readonly aviso = signal<AvisoPantalla | null>(null);
  private temporizador?: ReturnType<typeof setTimeout>;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.temporizador));
  }

  protected volver(): void {
    this.router.navigate(['/']);
  }

  protected tocar(categoria: Categoria): void {
    if (this.guardando()) return;
    const decision = decidirEntrada(categoria, this.cajaAbierta());
    if (decision.accion === 'rechazar') {
      vibrarRechazo(); // EX-01: ni siquiera abrimos el modal
      this.mostrarAviso(avisoRechazo(categoria, decision.caja));
      return;
    }
    this.seleccionada.set(categoria);
  }

  protected cancelar(): void {
    if (!this.guardando()) this.seleccionada.set(null);
  }

  protected async confirmar(): Promise<void> {
    const categoria = this.seleccionada();
    const uid = this.auth.user()?.uid;
    if (!categoria || !uid) {
      this.seleccionada.set(null);
      this.mostrarAviso({
        tipo: 'error',
        titulo: 'Sesión caducada',
        mensaje: 'Vuelve a iniciar sesión',
      });
      return;
    }

    this.guardando.set(true);
    // Se decide otra vez: la caja pudo cambiar mientras el modal estaba abierto
    const decision = decidirEntrada(categoria, this.cajaAbierta());
    try {
      switch (decision.accion) {
        case 'abrir': {
          const codigo = await this.cajas.abrirCaja(categoria, uid); // ya cuenta 1 unidad
          this.mostrarAviso({
            tipo: 'exito',
            titulo: `Caja ${codigo} abierta`,
            mensaje: 'Escribe el código en la caja',
          });
          break;
        }
        case 'sumar':
          await this.cajas.sumarUnidad(decision.caja.id);
          this.mostrarAviso(
            { tipo: 'exito', titulo: 'Alimento sumado', mensaje: `Caja ${decision.caja.codigo}` },
            1500,
          );
          break;
        case 'rechazar':
          vibrarRechazo();
          this.mostrarAviso(avisoRechazo(categoria, decision.caja));
      }
    } catch (e) {
      console.error(e);
      this.mostrarAviso({
        tipo: 'error',
        titulo: 'No se ha podido guardar',
        mensaje: 'Inténtalo de nuevo',
      });
    } finally {
      this.guardando.set(false);
      this.seleccionada.set(null); // cierra el modal para que se vea el aviso
    }
  }

  private mostrarAviso(aviso: AvisoPantalla, ms = 3000): void {
    clearTimeout(this.temporizador);
    this.aviso.set(aviso);
    this.temporizador = setTimeout(() => this.aviso.set(null), ms);
  }
}
