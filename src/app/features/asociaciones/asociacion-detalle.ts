import { Component, computed, inject } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AsociacionesService } from '../../core/services/asociaciones-service';
import { CajasService } from '../../core/services/caja-service';
import { CategoriasService } from '../../core/services/categorias-service';
import { Asociacion } from '../../core/interfaces/asociacion';
import { Caja } from '../../core/interfaces/caja';
import { Categoria } from '../../core/interfaces/categoria';

@Component({
    selector: 'app-asociacion-detalle',
    standalone: true,
    imports: [RouterLink, TitleCasePipe],
    templateUrl: './asociacion-detalle.html',
    styleUrl: './asociacion-detalle.scss',
})
export class AsociacionDetalleComponent {
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
}