import { inject, Service } from '@angular/core';
import { collection, collectionData, Firestore } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Asociacion } from '../interfaces/asociacion';
import { Caja } from '../interfaces/caja';

@Service()
export class ResumenService {
    private readonly firestore = inject(Firestore);

    /** Todas las cajas de la campaña, en tiempo real. */
    obtenerCajas(): Observable<Caja[]> {
        return collectionData(collection(this.firestore, 'cajas'), {
            idField: 'id',
        }) as Observable<Caja[]>;
    }

    /** Todas las asociaciones, en tiempo real. */
    obtenerAsociaciones(): Observable<Asociacion[]> {
        return collectionData(collection(this.firestore, 'asociaciones'), {
            idField: 'id',
        }) as Observable<Asociacion[]>;
    }
}