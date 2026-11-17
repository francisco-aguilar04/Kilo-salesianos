import { inject, Injector, runInInjectionContext, Service } from '@angular/core';
import {
  collection,
  collectionData,
  doc,
  Firestore,
  increment,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { firstValueFrom, map, Observable } from 'rxjs';
import { Caja } from '../interfaces/caja';
import { ESTADOS_CAJA } from '../constants/estados-caja';
import { Categoria } from '../interfaces/categoria';
import { PESO_MAXIMO_KG } from '../constants/peso-cajas';

/** RN-05: ya existe una asociación con ese nombre. */
export class AsociacionDuplicadaError extends Error {
  constructor(nombre: string) {
    super(`Ya existe la asociación "${nombre}"`);
    this.name = 'AsociacionDuplicadaError';
  }
}

@Service()
export class CajasService {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(Injector);

  /** Crea la caja en estado Abierta con el primer alimento ya contado. Devuelve su código (p. ej. "AC-015"). Tambien hace la transaccion*/
  async abrirCaja(categoria: Categoria, uid: string): Promise<string> {
    const abierta = await firstValueFrom(this.obtenerCajaAbierta(uid));
    if (abierta) throw new Error(`Ya tienes abierta la caja ${abierta.codigo}`);

    return runInInjectionContext(this.injector, () =>
      // ... igual que antes
      //Hace la transaccion como una unica operacion a la firestore:
      runTransaction(this.firestore, async (tx) => {
        const refContador = doc(this.firestore, 'contadores', categoria.id);
        const contador = await tx.get(refContador); //En una transaccion los tx.get se hacen siempre anrtes que lo set, por normal general de firebase
        const numero = (contador.exists() ? (contador.data()['ultimo'] as number) : 0) + 1;
        const codigo = `${categoria.codigoQr}-${String(numero).padStart(3, '0')}`;

        const refCaja = doc(collection(this.firestore, 'cajas')); // id automático
        tx.set(refContador, { ultimo: numero });
        tx.set(refCaja, {
          codigo,
          categoriaId: categoria.id,
          unidades: 1, // el alimento que abrió la caja ya cuenta
          pesoKg: null,
          estado: ESTADOS_CAJA.ABIERTA,
          creadaPor: uid,
          asociacionId: null,
          fechaApertura: serverTimestamp(),
          fechaCierre: null,
        });
        return codigo;
      }),
    );
  }

  /** Caja abierta del voluntario en tiempo real, o null si no tiene. */
  obtenerCajaAbierta(uid: string): Observable<Caja | null> {
    const consulta = query(
      collection(this.firestore, 'cajas'),
      where('creadaPor', '==', uid),
      where('estado', '==', ESTADOS_CAJA.ABIERTA),
      limit(1),
    );
    return (collectionData(consulta, { idField: 'id' }) as Observable<Caja[]>).pipe(
      map((cajas) => cajas[0] ?? null),
    );
  }

  /** Todas las cajas del voluntario en tiempo real, las más recientes primero.
   *  Se ordena en local para no necesitar un índice compuesto en Firestore. */
  obtenerCajasDe(uid: string): Observable<Caja[]> {
    const consulta = query(collection(this.firestore, 'cajas'), where('creadaPor', '==', uid));
    return (collectionData(consulta, { idField: 'id' }) as Observable<Caja[]>).pipe(
      map((cajas) =>
        [...cajas].sort(
          (a, b) => (b.fechaApertura?.toMillis() ?? 0) - (a.fechaApertura?.toMillis() ?? 0),
        ),
      ),
    );
  }

  /** Todas las cajas asignadas (de cualquier voluntario) en tiempo real. */
  obtenerCajasAsignadas(): Observable<Caja[]> {
    const consulta = query(
      collection(this.firestore, 'cajas'),
      where('estado', '==', ESTADOS_CAJA.ASIGNADA),
    );
    return collectionData(consulta, { idField: 'id' }) as Observable<Caja[]>;
  }

  /** Cierra la caja: estado Cerrada, peso y fecha de cierre. Falla si está vacía o ya no está abierta. */
  async cerrarCaja(cajaId: string, pesoKg: number): Promise<void> {
    //Comprobacion
    if (!(pesoKg > 0 && pesoKg <= PESO_MAXIMO_KG)) throw new Error('Peso no válido');

    //Realiza la transaccion a la bdd para guardar la caja
    return runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async (tx) => {
        const refCaja = doc(this.firestore, 'cajas', cajaId);
        const snap = await tx.get(refCaja);
        if (!snap.exists()) throw new Error('La caja no existe');

        const caja = snap.data() as Caja;
        if (caja.estado !== ESTADOS_CAJA.ABIERTA)
          throw new Error(`La caja ${caja.codigo} ya no está abierta`);
        if (caja.unidades === 0) throw new Error('La caja está vacía'); // EX-04

        tx.update(refCaja, {
          estado: ESTADOS_CAJA.CERRADA,
          pesoKg,
          fechaCierre: serverTimestamp(),
        });
      }),
    );
  }

  /** Asigna una caja cerrada a una asociación: la caja pasa a Asignada y la asociación suma
   *  los kg de la caja y una caja más. Todo en una transacción: se hace entero o no se hace nada.
   *  Falla si la caja ya no está cerrada (RN-04: una sola asignación por caja). */
  async asignarCaja(cajaId: string, asociacionId: string): Promise<void> {
    return runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async (tx) => {
        const refCaja = doc(this.firestore, 'cajas', cajaId);
        const refAsociacion = doc(this.firestore, 'asociaciones', asociacionId);
        const snapCaja = await tx.get(refCaja);
        const snapAsociacion = await tx.get(refAsociacion);

        if (!snapCaja.exists()) throw new Error('La caja no existe');
        if (!snapAsociacion.exists()) throw new Error('La asociación no existe');

        const caja = snapCaja.data() as Caja;
        if (caja.estado !== ESTADOS_CAJA.CERRADA)
          throw new Error(`La caja ${caja.codigo} no está pendiente de asignar`);
        if (caja.pesoKg === null) throw new Error(`La caja ${caja.codigo} no tiene peso`);

        tx.update(refCaja, { estado: ESTADOS_CAJA.ASIGNADA, asociacionId });
        // increment suma en el servidor, así dos asignaciones a la vez a la misma asociación no se pisan
        tx.update(refAsociacion, { kgRecibidos: increment(caja.pesoKg), numCajas: increment(1) });
      }),
    );
  }

  /** HU-10: crea una asociación nueva y le asigna la caja cerrada, todo en una transacción.
   *  RN-05: el nombre es obligatorio y no se puede repetir (sin mayúsculas ni espacios de más).
   *  El id de la asociación es su nombre normalizado, así dos altas simultáneas no se duplican. */
  async asignarCajaANuevaAsociacion(cajaId: string, nombre: string): Promise<void> {
    const limpio = nombre.trim().replace(/\s+/g, ' ');
    if (!limpio) throw new Error('El nombre es obligatorio');
    const idAsociacion = limpio.toLowerCase().replace(/\//g, '-');

    return runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async (tx) => {
        const refCaja = doc(this.firestore, 'cajas', cajaId);
        const refAsociacion = doc(this.firestore, 'asociaciones', idAsociacion);
        const snapCaja = await tx.get(refCaja);
        const snapAsociacion = await tx.get(refAsociacion);

        if (!snapCaja.exists()) throw new Error('La caja no existe');
        if (snapAsociacion.exists()) throw new AsociacionDuplicadaError(limpio);

        const caja = snapCaja.data() as Caja;
        if (caja.estado !== ESTADOS_CAJA.CERRADA)
          throw new Error(`La caja ${caja.codigo} no está pendiente de asignar`);
        if (caja.pesoKg === null) throw new Error(`La caja ${caja.codigo} no tiene peso`);

        tx.set(refAsociacion, {
          nombre: limpio,
          contacto: '',
          kgRecibidos: caja.pesoKg,
          numCajas: 1,
        });
        tx.update(refCaja, { estado: ESTADOS_CAJA.ASIGNADA, asociacionId: idAsociacion });
      }),
    );
  }
  /** HU-05: suma un alimento. increment lo resuelve el servidor, no hace falta leer antes. */
  sumarUnidad(cajaId: string): Promise<void> {
    return updateDoc(doc(this.firestore, 'cajas', cajaId), { unidades: increment(1) });
  }
  async quitarUnidad(cajaId: string): Promise<void> {
    const ref = doc(this.firestore, 'cajas', cajaId);
    await runTransaction(this.firestore, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('La bolsa no existe');
      const caja = snap.data() as Caja;
      if (caja.estado !== 'abierta') throw new Error('La bolsa no está abierta');
      if ((caja.unidades ?? 0) > 0) {
        tx.update(ref, { unidades: increment(-1) });
      } else {
        tx.delete(ref);
      }
    });
  }

  /** A3: reabre una bolsa cerrada para seguir añadiendo. Borra peso y fecha de cierre. */
  async reabrirCaja(caja: Caja): Promise<void> {
    const abierta = await firstValueFrom(this.obtenerCajaAbierta(caja.creadaPor));
    if (abierta) throw new Error(`Ya tienes abierta la bolsa ${abierta.codigo}`);

    return runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async (tx) => {
        const ref = doc(this.firestore, 'cajas', caja.id);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('La bolsa no existe');
        if ((snap.data() as Caja).estado !== ESTADOS_CAJA.CERRADA)
          throw new Error(`La bolsa ${caja.codigo} ya no está cerrada`);

        tx.update(ref, { estado: ESTADOS_CAJA.ABIERTA, pesoKg: null, fechaCierre: null });
      }),
    );
  }
  /** A4: quita la entidad de una bolsa asignada. La bolsa NO se borra: vuelve a Cerrada
   *  sin asociación, y la entidad resta sus kg y una bolsa. Todo en una transacción. */
  async quitarAsociacion(cajaId: string): Promise<void> {
    return runInInjectionContext(this.injector, () =>
      runTransaction(this.firestore, async (tx) => {
        const refCaja = doc(this.firestore, 'cajas', cajaId);
        const snapCaja = await tx.get(refCaja);
        if (!snapCaja.exists()) throw new Error('La bolsa no existe');

        const caja = snapCaja.data() as Caja;
        if (caja.estado !== ESTADOS_CAJA.ASIGNADA || !caja.asociacionId)
          throw new Error(`La bolsa ${caja.codigo} no está asignada`);

        const refAsociacion = doc(this.firestore, 'asociaciones', caja.asociacionId);
        const snapAsociacion = await tx.get(refAsociacion);

        tx.update(refCaja, { estado: ESTADOS_CAJA.CERRADA, asociacionId: null });
        // Si la entidad ya no existe (la borró el admin), no hay nada que restar
        if (snapAsociacion.exists()) {
          tx.update(refAsociacion, {
            kgRecibidos: increment(-(caja.pesoKg ?? 0)),
            numCajas: increment(-1),
          });
        }
      }),
    );
  }
}
