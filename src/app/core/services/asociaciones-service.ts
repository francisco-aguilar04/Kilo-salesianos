import { inject, Injector, runInInjectionContext, Service } from '@angular/core';
import {
    collection,
    collectionData,
    doc,
    docData,
    DocumentReference,
    Firestore,
    getDocs,
    query,
    runTransaction,
    where,
    writeBatch,
} from '@angular/fire/firestore';
import { combineLatest, map, Observable } from 'rxjs';
import { Asociacion } from '../interfaces/asociacion';
import { ESTADOS_CAJA } from '../constants/estados-caja';
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

    /** B3: una asociación en tiempo real por su id, o null si no existe.
     *  Se envuelve en el contexto de inyección porque se llama desde un switchMap. */
    obtenerPorId(id: string): Observable<Asociacion | null> {
        return runInInjectionContext(this.injector, () =>
            (
                docData(doc(this.firestore, 'asociaciones', id), {
                    idField: 'id',
                }) as Observable<Asociacion | undefined>
            ).pipe(map((a) => a ?? null)),
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

    /** B4: edita nombre y contacto de una entidad (solo admin).
     *  El id del documento NO cambia (las cajas apuntan a él); los kg y las cajas no se tocan.
     *  RN-05: si el nombre nuevo, normalizado, coincide con el id de otra entidad, es un duplicado. */
    async actualizarAsociacion(id: string, nombre: string, contacto = ''): Promise<void> {
        const limpio = nombre.trim().replace(/\s+/g, ' ');
        if (!limpio) throw new Error('El nombre es obligatorio');
        const idNombre = limpio.toLowerCase().replace(/\//g, '-');
        const contactoLimpio = contacto.trim().replace(/\s+/g, ' ');

        return runInInjectionContext(this.injector, () =>
            runTransaction(this.firestore, async (tx) => {
                const refAsociacion = doc(this.firestore, 'asociaciones', id);
                const snapAsociacion = await tx.get(refAsociacion);
                if (!snapAsociacion.exists()) throw new Error('La asociación no existe');

                if (idNombre !== id) {
                    const snapOtra = await tx.get(doc(this.firestore, 'asociaciones', idNombre));
                    if (snapOtra.exists()) throw new AsociacionDuplicadaError(limpio);
                }

                tx.update(refAsociacion, { nombre: limpio, contacto: contactoLimpio });
            }),
        );
    }

    /** B5: borra una entidad (solo admin). Nada se borra en cascada: las cajas que apuntaban a ella
     *  vuelven a estado Cerrada con asociacionId = null, así quedan pendientes de asignar otra vez.
     *  Las cajas y la entidad se cambian en el mismo lote, así que se hace todo o nada. Un lote admite
     *  500 operaciones: si hubiera más cajas, se reparten en varios lotes y la entidad se borra en el último. */
    async eliminarAsociacion(id: string): Promise<void> {
        const TAMANO_LOTE = 450;

        const consulta = runInInjectionContext(this.injector, () =>
            query(collection(this.firestore, 'cajas'), where('asociacionId', '==', id)),
        );
        const snapCajas = await runInInjectionContext(this.injector, () => getDocs(consulta));
        const refsCajas = snapCajas.docs.map((d) => d.ref);
        const refAsociacion = runInInjectionContext(this.injector, () =>
            doc(this.firestore, 'asociaciones', id),
        );

        const lotes: DocumentReference[][] = [];
        for (let i = 0; i < refsCajas.length; i += TAMANO_LOTE) {
            lotes.push(refsCajas.slice(i, i + TAMANO_LOTE));
        }
        if (lotes.length === 0) lotes.push([]); // entidad sin cajas: solo se borra la entidad

        for (let i = 0; i < lotes.length; i++) {
            const esUltimo = i === lotes.length - 1;
            await runInInjectionContext(this.injector, () => {
                const lote = writeBatch(this.firestore);
                lotes[i].forEach((ref) =>
                    lote.update(ref, { estado: ESTADOS_CAJA.CERRADA, asociacionId: null }),
                );
                if (esUltimo) lote.delete(refAsociacion);
                return lote.commit();
            });
        }
    }
}