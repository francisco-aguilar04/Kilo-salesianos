import { inject, Injector, runInInjectionContext, Service } from '@angular/core';
import { Categoria } from '../interfaces/categoria';
import { firstValueFrom, Observable } from 'rxjs';
import {
  addDoc,
  collection,
  collectionData,
  doc,
  DocumentReference,
  Firestore,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { QrInvalidoError } from '../errors/qr-invalid-error';

/** Datos que rellena el admin en el formulario (el id lo pone Firestore) */
export type NuevaCategoria = Omit<Categoria, 'id' | 'activa'>;

/** A6: ya hay otra categoría con ese nombre o con ese código QR */
export class CategoriaDuplicadaError extends Error {
  constructor(readonly campo: 'nombre' | 'codigoQr') {
    super(
      campo === 'nombre'
        ? 'Ya existe una categoría con ese nombre'
        : 'Ese código QR ya lo usa otra categoría',
    );
    this.name = 'CategoriaDuplicadaError';
  }
}

@Service()
export class CategoriasService {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(Injector);

  obtenerTodas(): Observable<Categoria[]> {
    const consulta = query(collection(this.firestore, 'categorias'), orderBy('nombre'));
    return collectionData(consulta, { idField: 'id' }) as Observable<Categoria[]>;
  }

  obtenerActivas(): Observable<Categoria[]> {
    const consulta = query(collection(this.firestore, 'categorias'), where('activa', '==', true));
    return collectionData(consulta, { idField: 'id' }) as Observable<Categoria[]>;
  }

  async validarCodigo(codigo: string): Promise<Categoria> {
    const consulta = query(
      collection(this.firestore, 'categorias'),
      where('codigoQr', '==', codigo),
    );
    const encontradas = await firstValueFrom(
      collectionData(consulta, { idField: 'id' }) as Observable<Categoria[]>,
    );
    const categoria = encontradas[0];

    if (!categoria) throw new QrInvalidoError(codigo, 'no-existe');
    if (!categoria.activa) throw new QrInvalidoError(codigo, 'inactiva');
    return categoria;
  }

  /** A6: crea una categoría nueva (solo admin; las rules lo vuelven a comprobar).
   *  Nombre en minúsculas, código QR en mayúsculas. Nace activa.
   *  Lanza CategoriaDuplicadaError si el nombre o el código ya existen. */
  async crearCategoria(datos: NuevaCategoria): Promise<void> {
    const nombre = datos.nombre.trim().replace(/\s+/g, ' ').toLowerCase();
    const codigoQr = datos.codigoQr.trim().toUpperCase();
    if (!nombre || !codigoQr) throw new Error('Nombre y código son obligatorios');

    return runInInjectionContext(this.injector, async () => {
      const categorias = collection(this.firestore, 'categorias');

      const mismoNombre = await getDocs(query(categorias, where('nombre', '==', nombre)));
      if (!mismoNombre.empty) throw new CategoriaDuplicadaError('nombre');

      const mismoCodigo = await getDocs(query(categorias, where('codigoQr', '==', codigoQr)));
      if (!mismoCodigo.empty) throw new CategoriaDuplicadaError('codigoQr');

      await addDoc(categorias, { nombre, codigoQr, color: datos.color, activa: true });
    });
  }

  /** A7: cambia el nombre y el color de una categoría (solo admin; las rules lo vuelven a comprobar).
   *  El código QR no se toca. Las bolsas guardan categoriaId, no el nombre ni el color,
   *  así que el cambio se ve solo en todas. Lanza CategoriaDuplicadaError si OTRA categoría
   *  ya tiene ese nombre. */
  async editarCategoria(id: string, nombreNuevo: string, color: string): Promise<void> {
    const nombre = nombreNuevo.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!nombre) throw new Error('El nombre es obligatorio');

    return runInInjectionContext(this.injector, async () => {
      const categorias = collection(this.firestore, 'categorias');

      const mismoNombre = await getDocs(query(categorias, where('nombre', '==', nombre)));
      // Si la única que coincide es ella misma, no es un duplicado
      if (mismoNombre.docs.some((d) => d.id !== id)) throw new CategoriaDuplicadaError('nombre');

      await updateDoc(doc(this.firestore, 'categorias', id), { nombre, color });
    });
  }

  /** A8: borra una categoría (solo admin; las rules lo vuelven a comprobar).
   *  Nada se borra en cascada: las bolsas que la usaban se quedan con categoriaId = null
   *  (la A11 las mostrará como "Eliminado"). Las bolsas y la categoría van en el mismo lote:
   *  o se hace todo o no se hace nada. Un lote admite 500 escrituras, así que si hubiera
   *  muchas bolsas se reparten en varios lotes y la categoría se borra en el último. */
  async borrarCategoria(id: string): Promise<void> {
    const TAMANO_LOTE = 450;

    return runInInjectionContext(this.injector, async () => {
      const consulta = query(collection(this.firestore, 'cajas'), where('categoriaId', '==', id));
      const snapBolsas = await getDocs(consulta);
      const refsBolsas = snapBolsas.docs.map((d) => d.ref);
      const refCategoria = doc(this.firestore, 'categorias', id);

      const lotes: DocumentReference[][] = [];
      for (let i = 0; i < refsBolsas.length; i += TAMANO_LOTE) {
        lotes.push(refsBolsas.slice(i, i + TAMANO_LOTE));
      }
      if (lotes.length === 0) lotes.push([]); // categoría sin bolsas: solo se borra ella

      for (let i = 0; i < lotes.length; i++) {
        const lote = writeBatch(this.firestore);
        lotes[i].forEach((ref) => lote.update(ref, { categoriaId: null }));
        if (i === lotes.length - 1) lote.delete(refCategoria);
        await lote.commit();
      }
    });
  }
}
