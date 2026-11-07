import { Component } from '@angular/core';

@Component({
    selector: 'app-mis-cajas',
    standalone: true,
    template: `<main class="pantalla"><h1>Mis cajas</h1></main>`,
    styles: `
    .pantalla {
      max-width: 24rem;
      margin: 0 auto;
      padding: 2rem 1rem calc(var(--navbar-alto) + env(safe-area-inset-bottom, 0px) + 1rem);
    }
  `,
})
export class MisCajasComponent { }