import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type TipoAviso = 'exito' | 'error' | 'aviso';

@Component({
  selector: 'app-aviso',
  templateUrl: './aviso.html',
  styleUrl: './aviso.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-tipo]': 'tipo()',
    '[attr.role]': "tipo() === 'exito' ? 'status' : 'alert'",
  },
})
export class Aviso {
  readonly tipo = input.required<TipoAviso>();
  readonly titulo = input.required<string>();
  readonly mensaje = input<string>('');
}
