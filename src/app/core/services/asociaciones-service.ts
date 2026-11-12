import { inject, Service } from '@angular/core';
import { collection, collectionData, Firestore } from '@angular/fire/firestore';
import { combineLatest, map, Observable } from 'rxjs';
import { Asociacion } from '../interfaces/asociacion';
import { CajasService } from './caja-service';

@Service()
export class AsociacionesService {
    private readonly firestore = inject(Firestore);
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
}