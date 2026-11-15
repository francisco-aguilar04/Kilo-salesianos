import { inject, Injector, runInInjectionContext, Service } from '@angular/core';
import {
    collection,
    collectionData,
    doc,
    Firestore,
    runTransaction,
} from '@angular/fire/firestore';
import { combineLatest, map, Observable } from 'rxjs';
import { Asociacion } from '../interfaces/asociacion';
import { AsociacionDuplicadaError, CajasService } from './caja-service';

@Service()
export class AsociacionesService {
    private readonly firestore = inject(Firestore);
    private readonly injector = inject(Injector);
    private readonly cajasService = inject(CajasService);

    /** Asociaciones en tiempo real, de menos a más kg recibidos (empate: por nombre).
     *  Usa los contadores guardados, que pueden quedar desfasados. */
    obtenerTodas(): Observable<Asociacion[]> {
        return (
            collectionData(collection(this.firestore, 'asociaciones'), {
                idField: 'id',
            }) as Observable<Asociacion[]>
        ).pipe(
            map((lista) =>
                [...lista].sort(
                    (a, b) => a.kgRecibidos - b.kgRecibidos || a.nombre.localeCompare(b.nombre, 'es'),
                ),
            ),
        );
    }

    /** Igual que obtenerTodas, pero kg y nº de cajas se calculan desde las cajas asignadas reales. */
    obtenerConTotales(): Observable<Asociacion[]> {
        return combineLatest([
            this.obtenerTodas(),
            this.cajasService.obtenerCajasAsignadas(),
        ]).pipe(
            map(([asociaciones, cajas]) =>
                asociaciones
                    .map((a) => {
                        const suyas = cajas.filter((c) => c.asociacionId === a.id);
                        return {
                            ...a,
                            numCajas: suyas.length,
                            kgRecibidos: suyas.reduce((suma, c) => suma + (c.pesoKg ?? 0), 0),
                        };
                    })
                    .sort(
                        (x, y) =>
                            x.kgRecibidos - y.kgRecibidos || x.nombre.localeCompare(y.nombre, 'es'),
                    ),
            ),
        );
    }

    /** B2: registra una entidad nueva sin asignarle ninguna caja (solo admin).
     *  Mismas reglas que al crearla desde la asignación (RN-05): nombre obligatorio y sin repetir
     *  (sin mayúsculas ni espacios de más). El id es el nombre normalizado, así dos altas
     *  simultáneas con el mismo nombre no se duplican. El contacto es opcional. */
    async crearAsociacion(nombre: string, contacto = ''): Promise<void> {
        const limpio = nombre.trim().replace(/\s+/g, ' ');
        if (!limpio) throw new Error('El nombre es obligatorio');
        const idAsociacion = limpio.toLowerCase().replace(/\//g, '-');
        const contactoLimpio = contacto.trim().replace(/\s+/g, ' ');

        return runInInjectionContext(this.injector, () =>
            runTransaction(this.firestore, async (tx) => {
                const refAsociacion = doc(this.firestore, 'asociaciones', idAsociacion);
                const snapAsociacion = await tx.get(refAsociacion);

                if (snapAsociacion.exists()) throw new AsociacionDuplicadaError(limpio);

                tx.set(refAsociacion, {
                    nombre: limpio,
                    contacto: contactoLimpio,
                    kgRecibidos: 0,
                    numCajas: 0,
                });
            }),
        );
    }
}