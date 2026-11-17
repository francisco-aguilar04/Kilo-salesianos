import { Component, computed, HostListener, input, OnInit, output, signal } from '@angular/core';
import { Asociacion } from '../../../core/interfaces/asociacion';

export interface DatosEntidad {
    nombre: string;
    contacto: string;
}

function normalizar(texto: string): string {
    return texto.trim().replace(/\s+/g, ' ').toLowerCase();
}

@Component({
    selector: 'app-modal-entidad',
    standalone: true,
    templateUrl: './modal-entidad.html',
    styleUrl: './modal-entidad.scss',
})
export class ModalEntidad implements OnInit {
    readonly titulo = input('Registrar entidad');
    readonly textoBoton = input('Registrar entidad');
    readonly textoGuardando = input('Registrando…');
    readonly nombreInicial = input('');
    readonly contactoInicial = input('');
    readonly idActual = input<string | null>(null); // al editar: la propia entidad no cuenta como repetida
    readonly asociaciones = input.required<Asociacion[]>();
    readonly guardando = input(false);
    readonly errorExterno = input<string | null>(null); // error que devuelve el servicio

    readonly guardar = output<DatosEntidad>();
    readonly cancelar = output<void>();

    protected readonly nombre = signal('');
    protected readonly contacto = signal('');
    private readonly intentado = signal(false);
    private readonly ultimoEnviado = signal<string | null>(null);

    // El modal se crea cada vez que se abre, así que basta con leer los valores iniciales una vez
    ngOnInit(): void {
        this.nombre.set(this.nombreInicial());
        this.contacto.set(this.contactoInicial());
    }

    // RN-05: obligatorio y sin repetir (sin mayúsculas ni espacios de más)
    private readonly errorNombre = computed<string | null>(() => {
        const normalizado = normalizar(this.nombre());
        if (!normalizado) return this.intentado() ? 'El nombre es obligatorio' : null;
        const repetido = this.asociaciones().some(
            (a) => a.id !== this.idActual() && normalizar(a.nombre) === normalizado,
        );
        return repetido ? 'Ya existe una asociación con ese nombre' : null;
    });

    // El error del servicio solo se muestra mientras el nombre siga siendo el que se envió
    protected readonly mensajeError = computed<string | null>(() => {
        const propio = this.errorNombre();
        if (propio) return propio;
        const externo = this.errorExterno();
        return externo && normalizar(this.nombre()) === this.ultimoEnviado() ? externo : null;
    });

    protected escribirNombre(valor: string): void {
        this.nombre.set(valor);
    }

    protected escribirContacto(valor: string): void {
        this.contacto.set(valor);
    }

    protected enviar(): void {
        if (this.guardando()) return;

        this.intentado.set(true);
        const normalizado = normalizar(this.nombre());
        if (!normalizado || this.errorNombre()) return;

        this.ultimoEnviado.set(normalizado);
        this.guardar.emit({
            nombre: this.nombre().trim().replace(/\s+/g, ' '),
            contacto: this.contacto().trim().replace(/\s+/g, ' '),
        });
    }

    @HostListener('document:keydown.escape')
    protected cerrar(): void {
        if (!this.guardando()) this.cancelar.emit();
    }
}