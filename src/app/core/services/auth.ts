import { Service, inject, Injector, runInInjectionContext, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
    Auth as FirebaseAuth,
    EmailAuthProvider,
    reauthenticateWithCredential,
    signInWithEmailAndPassword,
    signOut,
    updatePassword,
    user,
} from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { Usuario } from '../interfaces/usuario';
import { ROLES, Rol } from '../constants/roles';

/** B6: motivo por el que no se ha podido cambiar la contraseña. */
export type MotivoCambioPassword =
    | 'sin-sesion'
    | 'actual-incorrecta'
    | 'password-debil'
    | 'demasiados-intentos'
    | 'sin-conexion'
    | 'desconocido';

export class CambioPasswordError extends Error {
    constructor(readonly motivo: MotivoCambioPassword) {
        super(`No se ha podido cambiar la contraseña: ${motivo}`);
        this.name = 'CambioPasswordError';
    }
}

@Service()
export class Auth {

    private readonly injector: Injector = inject(Injector); //se usa para las inyecciones en funciones asincronas
    private readonly firebaseAuth: FirebaseAuth = inject(FirebaseAuth);
    private readonly firestore: Firestore = inject(Firestore);

    // null = sin sesión (o aún cargando)
    readonly user$ = user(this.firebaseAuth); //guarda el estado user incluso al salir y entrar
    readonly user = toSignal(this.user$, { initialValue: null });

    // Datos del usuario en Firestore (usuarios/{uid}).
    // null = sin sesión o sin documento en `usuarios`.
    readonly usuario$: Observable<Usuario | null> = this.user$.pipe(
        switchMap((u) => {
            if (!u) {
                return of(null); //si no esta autenticado
            }
            return from(
                runInInjectionContext(this.injector, () =>
                    getDoc(doc(this.firestore, 'usuarios', u.uid)), //busca en firestore el usuario
                ),
            ).pipe(
                map((snap) => (snap.exists() ? (snap.data() as Usuario) : null)), //extrae los datos y los tipa como usuario
            );
        }),
        shareReplay({ bufferSize: 1, refCount: false }), // shareReplay evita volver a leer Firestore cada vez que alguien se suscribe.
    );

    readonly rol$: Observable<Rol | null> = this.usuario$.pipe(
        map((usuario) => usuario?.rol ?? null), //extrae el rol del usuario autenticado
    );

    // Admin = coordinador (mismo rol, sin renombrar)
    readonly isAdmin$: Observable<boolean> = this.rol$.pipe(
        map((rol) => rol === ROLES.COORDINADOR),
    );

    readonly usuario = toSignal(this.usuario$, { initialValue: null });
    readonly rol = toSignal(this.rol$, { initialValue: null });

    // true solo si el rol cargado es coordinador; mientras carga o sin sesión es false
    readonly isAdmin = computed(() => this.rol() === ROLES.COORDINADOR);

    //recibe un correo y contraseña y firebase usa su authenticador para ver que pueda inicar sesion
    async login(email: string, password: string): Promise<void> {
        await runInInjectionContext(this.injector, () =>
            signInWithEmailAndPassword(this.firebaseAuth, email, password),
        );
    }

    async logout(): Promise<void> {
        await runInInjectionContext(this.injector, () => signOut(this.firebaseAuth));
    }

    /** B6: cambia la contraseña del usuario con sesión.
     *  Firebase exige una sesión reciente para cambiarla, así que primero se reautentica
     *  con la contraseña actual y después se actualiza. La sesión sigue abierta al terminar.
     *  Si algo falla, lanza CambioPasswordError con el motivo. */
    async cambiarPassword(actual: string, nueva: string): Promise<void> {
        const usuarioFirebase = this.firebaseAuth.currentUser;
        if (!usuarioFirebase || !usuarioFirebase.email) throw new CambioPasswordError('sin-sesion');

        try {
            const credencial = EmailAuthProvider.credential(usuarioFirebase.email, actual);
            await runInInjectionContext(this.injector, () =>
                reauthenticateWithCredential(usuarioFirebase, credencial),
            );
            await runInInjectionContext(this.injector, () =>
                updatePassword(usuarioFirebase, nueva),
            );
        } catch (e) {
            const codigo = (e as { code?: string })?.code;
            switch (codigo) {
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                case 'auth/invalid-login-credentials':
                    throw new CambioPasswordError('actual-incorrecta');
                case 'auth/weak-password':
                    throw new CambioPasswordError('password-debil');
                case 'auth/too-many-requests':
                    throw new CambioPasswordError('demasiados-intentos');
                case 'auth/network-request-failed':
                    throw new CambioPasswordError('sin-conexion');
                default:
                    console.error(e);
                    throw new CambioPasswordError('desconocido');
            }
        }
    }

}