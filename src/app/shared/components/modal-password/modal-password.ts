import { Component, computed, HostListener, input, output, signal } from '@angular/core';

export interface DatosPassword {
    actual: string;
    nueva: string;
}

const MINIMO_CARACTERES = 6; // mínimo de Firebase Auth

@Component({
    selector: 'app-modal-password',
    standalone: true,
    templateUrl: './modal-password.html',
    styleUrl: './modal-password.scss',
})
export class ModalPassword {
    readonly guardando = input(false);
    readonly errorActual = input<string | null>(null); // error que devuelve el servicio sobre la actual
    readonly errorGeneral = input<string | null>(null); // cualquier otro error del servicio

    readonly guardar = output<DatosPassword>();
    readonly cancelar = output<void>();

    protected readonly minimo = MINIMO_CARACTERES;

    protected readonly actual = signal('');
    protected readonly nueva = signal('');
    protected readonly repetir = signal('');
    private readonly intentado = signal(false);
    // true cuando el usuario ha tocado algo después del último envío: los errores del servicio se ocultan
    private readonly editado = signal(false);

    protected readonly errorCampoActual = computed<string | null>(() => {
        if (this.intentado() && !this.actual()) return 'Introduce tu contraseña actual';
        return null;
    });

    protected readonly errorCampoNueva = computed<string | null>(() => {
        if (!this.intentado()) return null;
        const nueva = this.nueva();
        if (!nueva) return 'Introduce la nueva contraseña';
        if (nueva.length < MINIMO_CARACTERES)
            return `La nueva contraseña debe tener al menos ${MINIMO_CARACTERES} caracteres`;
        if (nueva === this.actual()) return 'La nueva contraseña debe ser distinta de la actual';
        return null;
    });

    protected readonly errorCampoRepetir = computed<string | null>(() => {
        if (!this.intentado()) return null;
        if (!this.repetir()) return 'Repite la nueva contraseña';
        if (this.repetir() !== this.nueva()) return 'Las contraseñas no coinciden';
        return null;
    });

    // Error del servicio sobre la contraseña actual (solo mientras no se edite nada)
    protected readonly mensajeActual = computed<string | null>(
        () => this.errorCampoActual() ?? (this.editado() ? null : this.errorActual()),
    );

    protected readonly mensajeGeneral = computed<string | null>(() =>
        this.editado() ? null : this.errorGeneral(),
    );

    protected escribirActual(valor: string): void {
        this.actual.set(valor);
        this.editado.set(true);
    }

    protected escribirNueva(valor: string): void {
        this.nueva.set(valor);
        this.editado.set(true);
    }

    protected escribirRepetir(valor: string): void {
        this.repetir.set(valor);
        this.editado.set(true);
    }

    protected enviar(): void {
        if (this.guardando()) return;

        this.intentado.set(true);
        if (this.errorCampoActual() || this.errorCampoNueva() || this.errorCampoRepetir()) return;

        this.editado.set(false);
        // Las contraseñas no se recortan: los espacios cuentan
        this.guardar.emit({ actual: this.actual(), nueva: this.nueva() });
    }

    @HostListener('document:keydown.escape')
    protected cerrar(): void {
        if (!this.guardando()) this.cancelar.emit();
    }
}