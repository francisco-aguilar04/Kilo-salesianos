import { Service, inject, Injector, runInInjectionContext } from '@angular/core';
import { getApp, getApps, initializeApp } from '@angular/fire/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from '@angular/fire/auth';
import {
    Firestore,
    collection,
    collectionData,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    setDoc,
    updateDoc,
    where,
    writeBatch,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Rol } from '../constants/roles';
import { Usuario } from '../interfaces/usuario';

// Este usuario no se puede editar, dar de baja ni eliminar.
export const EMAIL_PROTEGIDO = 'admin@admin.com';

export type MotivoCrearUsuario =
    | 'email-en-uso'
    | 'email-invalido'
    | 'password-debil'
    | 'sin-conexion'
    | 'error-guardado'
    | 'desconocido';

export class CrearUsuarioError extends Error {
    constructor(readonly motivo: MotivoCrearUsuario) {
        super(`No se ha podido crear el usuario: ${motivo}`);
        this.name = 'CrearUsuarioError';
    }
}

export type MotivoActualizarUsuario = 'protegido' | 'sin-conexion' | 'desconocido';

export class ActualizarUsuarioError extends Error {
    constructor(readonly motivo: MotivoActualizarUsuario) {
        super(`No se ha podido actualizar el usuario: ${motivo}`);
        this.name = 'ActualizarUsuarioError';
    }
}

export interface DatosNuevoUsuario {
    nombre: string;
    email: string;
    password: string;
    rol: Rol;
}

@Service()
export class UsuariosService {
    private readonly injector: Injector = inject(Injector);
    private readonly firestore: Firestore = inject(Firestore);

    // Lista en tiempo real, ordenada por nombre.
    readonly usuarios$: Observable<Usuario[]> = collectionData(
        query(collection(this.firestore, 'usuarios'), orderBy('nombre')),
        { idField: 'uid' },
    ) as Observable<Usuario[]>;

    /** Crea la cuenta en Auth con una 2ª instancia de Firebase (la sesión del admin
     *  no se toca) y guarda usuarios/{uid} con la sesión del admin. */
    async crearUsuario(datos: DatosNuevoUsuario): Promise<void> {
        const appSecundaria =
            getApps().find((a) => a.name === 'secundaria') ??
            initializeApp(environment.firebase, 'secundaria');
        const authSecundaria = getAuth(appSecundaria);

        let uid: string;
        try {
            const cred = await createUserWithEmailAndPassword(
                authSecundaria,
                datos.email,
                datos.password,
            );
            uid = cred.user.uid;
        } catch (e) {
            switch ((e as { code?: string })?.code) {
                case 'auth/email-already-in-use':
                    throw new CrearUsuarioError('email-en-uso');
                case 'auth/invalid-email':
                    throw new CrearUsuarioError('email-invalido');
                case 'auth/weak-password':
                    throw new CrearUsuarioError('password-debil');
                case 'auth/network-request-failed':
                    throw new CrearUsuarioError('sin-conexion');
                default:
                    console.error(e);
                    throw new CrearUsuarioError('desconocido');
            }
        }

        try {
            await runInInjectionContext(this.injector, () =>
                setDoc(doc(this.firestore, 'usuarios', uid), {
                    uid,
                    nombre: datos.nombre,
                    email: datos.email,
                    rol: datos.rol,
                    activo: true,
                }),
            );
        } catch (e) {
            console.error(e);
            throw new CrearUsuarioError('error-guardado');
        } finally {
            // La sesión de la instancia secundaria no se necesita más.
            await signOut(authSecundaria);
        }
    }

    /** Actualiza nombre y rol. No permite editarse a uno mismo ni al usuario protegido. */
    async actualizarUsuario(
        objetivo: Usuario,
        uidActual: string,
        cambios: { nombre: string; rol: Rol },
    ): Promise<void> {
        this.comprobarEditable(objetivo, uidActual);
        try {
            await runInInjectionContext(this.injector, () =>
                updateDoc(doc(this.firestore, 'usuarios', objetivo.uid), {
                    nombre: cambios.nombre.trim(),
                    rol: cambios.rol,
                }),
            );
        } catch (e) {
            throw this.errorActualizar(e);
        }
    }

    /** Da de baja (activo = false) o reactiva (activo = true) a un usuario. */
    async establecerActivo(objetivo: Usuario, uidActual: string, activo: boolean): Promise<void> {
        this.comprobarEditable(objetivo, uidActual);
        try {
            await runInInjectionContext(this.injector, () =>
                updateDoc(doc(this.firestore, 'usuarios', objetivo.uid), { activo }),
            );
        } catch (e) {
            throw this.errorActualizar(e);
        }
    }

    /** Quita al usuario de sus bolsas (creadaPor = null) y borra su documento.
     *  Si algo falla a medias, se puede reintentar: el documento se borra el último.
     *  La cuenta de Authentication no se puede borrar desde el cliente. */
    async eliminarUsuario(objetivo: Usuario, uidActual: string): Promise<void> {
        this.comprobarEditable(objetivo, uidActual);
        const ctx = <T>(fn: () => T): T => runInInjectionContext(this.injector, fn);

        try {
            const bolsas = await ctx(() =>
                getDocs(
                    query(collection(this.firestore, 'cajas'), where('creadaPor', '==', objetivo.uid)),
                ),
            );

            // Los lotes de Firestore admiten 500 operaciones como máximo.
            for (let i = 0; i < bolsas.docs.length; i += 400) {
                const lote = ctx(() => writeBatch(this.firestore));
                bolsas.docs.slice(i, i + 400).forEach((d) => lote.update(d.ref, { creadaPor: null }));
                await lote.commit();
            }

            await ctx(() => deleteDoc(doc(this.firestore, 'usuarios', objetivo.uid)));
        } catch (e) {
            throw this.errorActualizar(e);
        }
    }

    // No se puede gestionar a uno mismo ni al usuario protegido.
    private comprobarEditable(objetivo: Usuario, uidActual: string): void {
        if (objetivo.uid === uidActual || objetivo.email.toLowerCase() === EMAIL_PROTEGIDO) {
            throw new ActualizarUsuarioError('protegido');
        }
    }

    private errorActualizar(e: unknown): ActualizarUsuarioError {
        console.error(e);
        return new ActualizarUsuarioError(
            (e as { code?: string })?.code === 'unavailable' ? 'sin-conexion' : 'desconocido',
        );
    }
}