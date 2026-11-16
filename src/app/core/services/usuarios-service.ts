import { Service, inject, Injector, runInInjectionContext } from '@angular/core';
import { getApp, getApps, initializeApp } from '@angular/fire/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from '@angular/fire/auth';
import {
    Firestore,
    collection,
    collectionData,
    doc,
    orderBy,
    query,
    setDoc,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Rol } from '../constants/roles';
import { Usuario } from '../interfaces/usuario';

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
}