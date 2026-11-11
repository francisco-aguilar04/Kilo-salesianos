import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarraCaja } from './barra-caja';

describe('BarraCaja', () => {
  let component: BarraCaja;
  let fixture: ComponentFixture<BarraCaja>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BarraCaja],
    }).compileComponents();

    fixture = TestBed.createComponent(BarraCaja);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
