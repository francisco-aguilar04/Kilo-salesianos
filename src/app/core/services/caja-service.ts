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
  where,
} from '@angular/fire/firestore';
import { firstValueFrom, map, Observable } from 'rxjs';
import { Caja } from '../interfaces/caja';
import { ESTADOS_CAJA } from '../constants/estados-caja';
import { Categoria } from '../interfaces/categoria';
import { PESO_MAXIMO_KG } from '../constants/peso-cajas';

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
}