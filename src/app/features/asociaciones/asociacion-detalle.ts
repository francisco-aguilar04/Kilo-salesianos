import { Component, computed, inject, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Auth } from '../../core/services/auth';
import { AsociacionesService } from '../../core/services/asociaciones-service';
import { AsociacionDuplicadaError, CajasService } from '../../core/services/caja-service';
import { CategoriasService } from '../../core/services/categorias-service';
import { Asociacion } from '../../core/interfaces/asociacion';
import { Caja } from '../../core/interfaces/caja';
import { Categoria } from '../../core/interfaces/categoria';
import { DatosEntidad, ModalEntidad } from '../../shared/components/modal-entidad/modal-entidad';

@Component({
    selector: 'app-asociacion-detalle',
    standalone: true,
    imports: [RouterLink, TitleCasePipe, ModalEntidad],
    templateUrl: './asociacion-detalle.html',
    styleUrl: './asociacion-detalle.scss',
})
export class AsociacionDetalleComponent {
    protected readonly auth = inject(Auth);
    private readonly route = inject(ActivatedRoute);
    private readonly asociacionesService = inject(AsociacionesService);
    private readonly cajasService = inject(CajasService);
    private readonly categoriasService = inject(CategoriasService);

    // undefined = cargando, null = no existe
    protected readonly asociacion = toSignal<Asociacion | null | undefined>(
        this.route.paramMap.pipe(
            map((params) => params.get('id')),
            switchMap((id) => (id ? this.asociacionesService.obtenerPorId(id) : of(null))),
        ),
        { initialValue: undefined },
    );

    // Todas las entidades, para comprobar nombres repetidos al editar
    protected readonly todas = toSignal(this.asociacionesService.obtenerTodas(), {
        initialValue: [] as Asociacion[],
    });

    // null = todavía cargando
    private readonly cajasAsignadas = toSignal<Caja[] | null>(
        this.cajasService.obtenerCajasAsignadas(),
        { initialValue: null },
    );

    private readonly categorias = toSignal(this.categoriasService.obtenerTodas(), {
        initialValue: [] as Categoria[],
    });

    private readonly categoriaPorId = computed(
        () => new Map(this.categorias().map((categoria) => [categoria.id, categoria])),
    );

    // Cajas de esta entidad, ordenadas por código. null = cargando
    protected readonly cajas = computed<Caja[] | null>(() => {
        const todas = this.cajasAsignadas();
        const id = this.asociacion()?.id;
        if (!todas || !id) return null;
        return todas
            .filter((c) => c.asociacionId === id)
            .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'));
    });

    // Totales desde las cajas reales, igual que en la lista
    protected readonly totalCajas = computed(() => this.cajas()?.length ?? 0);
    protected readonly totalKg = computed(() =>
        (this.cajas() ?? []).reduce((suma, c) => suma + (c.pesoKg ?? 0), 0),
    );

    protected categoriaDe(caja: Caja): Categoria | undefined {
        return this.categoriaPorId().get(caja.categoriaId);
    }

    // ---- B4: editar entidad en el modal compartido (solo admin) ----
    protected readonly modalAbierto = signal(false);
    protected readonly guardando = signal(false);
    protected readonly errorModal = signal<string | null>(null);

    protected abrirModal(): void {
        if (!this.auth.isAdmin()) return;
        this.errorModal.set(null);
        this.modalAbierto.set(true);
    }

    protected cerrarModal(): void {
        if (this.guardando()) return;
        this.modalAbierto.set(false);
    }

    protected async guardar(datos: DatosEntidad): Promise<void> {
        const actual = this.asociacion();
        if (!actual || !this.auth.isAdmin() || this.guardando()) return;

        this.errorModal.set(null);
        this.guardando.set(true);
        try {
            await this.asociacionesService.actualizarAsociacion(actual.id, datos.nombre, datos.contacto);
            this.modalAbierto.set(false); // la ficha se actualiza sola (tiempo real)
        } catch (e) {
            if (e instanceof AsociacionDuplicadaError) {
                this.errorModal.set('Ya existe una asociación con ese nombre');
            } else {
                console.error(e);
                this.errorModal.set('No se han podido guardar los cambios. Inténtalo de nuevo');
            }
        } finally {
            this.guardando.set(false);
        }
    }
}