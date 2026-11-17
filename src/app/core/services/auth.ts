import { Service, inject, Injector, runInInjectionContext, computed } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
    Auth as FirebaseAuth,
    EmailAuthProvider,
    reauthenticateWithCredential,
    signInWithEmailAndPassword,
    signOut,
    updatePassword,
    user,
} from '@angular/fire/auth';
import { Firestore, doc, docData, getDoc } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { catchError, filter, map, shareReplay, switchMap } from 'rxjs/operators';
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

/** La cuenta existe en Authentication pero no puede usar la app:
 *  'baja' = dada de baja; 'sin-ficha' = no tiene documento en usuarios (p. ej. eliminado). */
export type MotivoCuentaBloqueada = 'baja' | 'sin-ficha';

export class CuentaBajaError extends Error {
    constructor(readonly motivo: MotivoCuentaBloqueada) {
        super(`Cuenta sin acceso: ${motivo}`);
        this.name = 'CuentaBajaError';
    }
}

@Service()
export class Auth {

    private readonly injector: Injector = inject(Injector); //se usa para las inyecciones en funciones asincronas
    private readonly firebaseAuth: FirebaseAuth = inject(FirebaseAuth);
    private readonly firestore: Firestore = inject(Firestore);
    private readonly router = inject(Router);

    // null = sin sesión (o aún cargando)
    readonly user$ = user(this.firebaseAuth); //guarda el estado user incluso al salir y entrar
    readonly user = toSignal(this.user$, { initialValue: null });

    // Datos del usuario en Firestore (usuarios/{uid}), en tiempo real.
    // null = sin sesión o sin documento en `usuarios`.
    readonly usuario$: Observable<Usuario | null> = this.user$.pipe(
        switchMap((u) => {
            if (!u) {
                return of(null); //si no esta autenticado
            }
            return runInInjectionContext(this.injector, () =>
                docData(doc(this.firestore, 'usuarios', u.uid), { idField: 'uid' }), //escucha el documento
            ).pipe(
                map((datos) => (datos ? (datos as Usuario) : null)),
                catchError(() => of(null)),
            );
        }),
        shareReplay({ bufferSize: 1, refCount: false }), // evita abrir un listener nuevo por cada suscriptor
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

    // true si hay sesión pero la cuenta está de baja o no tiene documento.
    // Si la lectura falla (p. ej. sin red) no se bloquea: ya lo frenan las reglas.
    private readonly accesoDenegado$: Observable<boolean> = this.user$.pipe(
        switchMap((u) => {
            if (!u) {
                return of(false);
            }
            return runInInjectionContext(this.injector, () =>
                docData(doc(this.firestore, 'usuarios', u.uid)),
            ).pipe(
                map((datos) => !datos || (datos as Usuario).activo === false),
                catchError(() => of(false)),
            );
        }),
    );

    constructor() {
        // Si le dan de baja con la sesión abierta, se le saca al login.
        this.accesoDenegado$
            .pipe(filter((denegado) => denegado), takeUntilDestroyed())
            .subscribe(async () => {
                await this.logout();
                await this.router.navigate(['/login'], { queryParams: { motivo: 'baja' } });
            });
    }

    //recibe un correo y contraseña y firebase usa su authenticador para ver que pueda inicar sesion
    async login(email: string, password: string): Promise<void> {
        await runInInjectionContext(this.injector, () =>
            signInWithEmailAndPassword(this.firebaseAuth, email, password),
        );

        // Comprobar la ficha: una cuenta de baja o sin documento no entra.
        const uid = this.firebaseAuth.currentUser?.uid;
        if (!uid) return;

        const snap = await runInInjectionContext(this.injector, () =>
            getDoc(doc(this.firestore, 'usuarios', uid)),
        );
        if (!snap.exists()) {
            await this.logout();
            throw new CuentaBajaError('sin-ficha');
        }
        if ((snap.data() as Usuario).activo === false) {
            await this.logout();
            throw new CuentaBajaError('baja');
        }
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