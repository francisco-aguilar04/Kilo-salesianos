import { Service, inject, Injector, runInInjectionContext } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
    Auth as FirebaseAuth,
    signInWithEmailAndPassword,
    signOut,
    user,
} from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { Usuario } from '../interfaces/usuario';
import { Rol } from '../constants/roles';

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

    readonly usuario = toSignal(this.usuario$, { initialValue: null });
    readonly rol = toSignal(this.rol$, { initialValue: null });

    //recibe un correo y contraseña y firebase usa su authenticador para ver que pueda inicar sesion
    async login(email: string, password: string): Promise<void> {
        await runInInjectionContext(this.injector, () =>
            signInWithEmailAndPassword(this.firebaseAuth, email, password),
        );
    }

    async logout(): Promise<void> {
        await runInInjectionContext(this.injector, () => signOut(this.firebaseAuth));
    }

}