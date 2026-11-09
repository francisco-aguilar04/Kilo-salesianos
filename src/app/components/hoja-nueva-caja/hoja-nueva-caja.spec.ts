import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HojaNuevaCaja } from './hoja-nueva-caja';

describe('HojaNuevaCaja', () => {
  let component: HojaNuevaCaja;
  let fixture: ComponentFixture<HojaNuevaCaja>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HojaNuevaCaja],
    }).compileComponents();

    fixture = TestBed.createComponent(HojaNuevaCaja);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
