import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Auth } from './core/services/auth';
import { NavbarComponent } from './shared/components/navbar/navbar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly authService = inject(Auth);

  // La navbar solo se ve con sesión y rol cargado (no en el login)
  protected readonly mostrarNavbar = computed(() => this.authService.rol() !== null);
}