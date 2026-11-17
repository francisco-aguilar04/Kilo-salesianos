import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EliminadoPipe } from './eliminado-pipe';

describe('EliminadoPipe', () => {
  let component: EliminadoPipe;
  let fixture: ComponentFixture<EliminadoPipe>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EliminadoPipe]
    })
      .compileComponents();

    fixture = TestBed.createComponent(EliminadoPipe);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
