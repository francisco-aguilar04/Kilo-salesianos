// core/services/asociaciones-service.ts
import { inject, Service } from '@angular/core';
import { collection, collectionData, Firestore } from '@angular/fire/firestore';
import { map, Observable } from 'rxjs';
import { Asociacion } from '../interfaces/asociacion';

@Service()
export class AsociacionesService {
    private readonly firestore = inject(Firestore);

    /** Asociaciones en tiempo real, de menos a más kg recibidos (empate: por nombre). */
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
}