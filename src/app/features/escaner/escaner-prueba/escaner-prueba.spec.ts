import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EscanerPrueba } from './escaner-prueba';

describe('EscanerPrueba', () => {
  let component: EscanerPrueba;
  let fixture: ComponentFixture<EscanerPrueba>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EscanerPrueba],
    }).compileComponents();

    fixture = TestBed.createComponent(EscanerPrueba);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
