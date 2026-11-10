import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HojaCerrarCaja } from './hoja-cerrar-caja';

describe('HojaCerrarCaja', () => {
  let component: HojaCerrarCaja;
  let fixture: ComponentFixture<HojaCerrarCaja>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HojaCerrarCaja],
    }).compileComponents();

    fixture = TestBed.createComponent(HojaCerrarCaja);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
