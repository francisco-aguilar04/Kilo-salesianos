import { Service, inject, Injector, runInInjectionContext } from '@angular/core';
import {
    Firestore,
    Timestamp,
    collection,
    collectionData,
    query,
    where,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResumenDia {
    cajasCerradas: number;
    kgRecogidos: number;
}

interface CajaResumen {
    fechaCierre?: Timestamp | null;
    pesoKg?: number | null;
}

@Service()
export class ResumenDiaService {
    private readonly injector: Injector = inject(Injector);
    private readonly firestore: Firestore = inject(Firestore);

    // Cajas del voluntario cerradas hoy, en tiempo real.
    // Se filtra por fecha en local para no necesitar un índice compuesto en Firestore.
    resumenDelDia(uid: string): Observable<ResumenDia> {
        const cajas$ = runInInjectionContext(this.injector, () =>
            collectionData(query(collection(this.firestore, 'cajas'), where('creadaPor', '==', uid))),
        ) as Observable<CajaResumen[]>;

        return cajas$.pipe(
            map((cajas) => {
                const inicioDia: Date = new Date();
                inicioDia.setHours(0, 0, 0, 0);

                let cajasCerradas: number = 0;
                let kgRecogidos: number = 0;

                for (const caja of cajas) {
                    if (caja.fechaCierre && caja.fechaCierre.toDate() >= inicioDia) {
                        cajasCerradas++;
                        kgRecogidos += caja.pesoKg ?? 0;
                    }
                }

                return { cajasCerradas, kgRecogidos };
            }),
        );
    }
}