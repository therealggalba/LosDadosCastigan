import { describe, it, expect } from 'vitest';
import {
  calculatePoints,
  hexToRgb,
  calculateContrastRatio,
  calculateColorDistance
} from '../components/DiceGame';

describe('Cálculo de puntos de dados (Los Dados Castigan)', () => {
  it('debe anular la ronda si salen 4 o más unos en la primera tirada', () => {
    const result4 = calculatePoints([1, 1, 1, 1, 5], true);
    expect(result4.cancelRound).toBe(true);
    expect(result4.points).toBe(0);

    const result5 = calculatePoints([1, 1, 1, 1, 1], true);
    expect(result5.cancelRound).toBe(true);
    expect(result5.points).toBe(0);
  });

  it('no debe anular la ronda si salen 4 unos pero NO es la primera tirada', () => {
    const result = calculatePoints([1, 1, 1, 1, 5], false);
    expect(result.cancelRound).toBe(false);
    expect(result.points).toBe(50); // El único puntuable es el 5
    expect(result.scoringDice).toEqual([5]);
  });

  it('debe otorgar 1000 puntos por tres seises en la primera tirada más adicionales', () => {
    const result = calculatePoints([6, 6, 6, 5, 2], true);
    expect(result.points).toBe(1050);
    expect(result.scoringDice.sort()).toEqual([5, 6, 6, 6]);
  });

  it('debe otorgar 500 puntos por tres cincos en la primera tirada más adicionales', () => {
    const result = calculatePoints([5, 5, 5, 6, 3], true);
    expect(result.points).toBe(600);
    expect(result.scoringDice.sort()).toEqual([5, 5, 5, 6]);
  });

  it('debe calcular puntuaciones individuales si no es la primera tirada', () => {
    const result = calculatePoints([6, 5, 2, 3, 4], false);
    expect(result.points).toBe(150);
    expect(result.scoringDice.sort()).toEqual([5, 6]);
  });

  it('debe devolver 0 puntos si no hay ningún cinco o seis', () => {
    const result = calculatePoints([2, 3, 4, 2, 1], false);
    expect(result.points).toBe(0);
    expect(result.scoringDice).toEqual([]);
  });
});

describe('Utilidades de color para contraste y similitud', () => {
  it('debe convertir correctamente HEX a RGB', () => {
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('debe calcular el ratio de contraste correctamente', () => {
    // Blanco y negro tienen el contraste máximo (~21:1)
    const ratioMax = calculateContrastRatio('#FFFFFF', '#000000');
    expect(ratioMax).toBeCloseTo(21, 0);

    // Blanco sobre blanco tiene contraste mínimo (1:1)
    const ratioMin = calculateContrastRatio('#FFFFFF', '#FFFFFF');
    expect(ratioMin).toBeCloseTo(1, 0);

    // Rojo (#FF3B30) y blanco (#FFFFFF)
    const ratioMedium = calculateContrastRatio('#FF3B30', '#FFFFFF');
    expect(ratioMedium).toBeLessThan(4.5); // Debería dar un aviso por contraste bajo
  });

  it('debe calcular la distancia euclidiana entre colores', () => {
    // Colores idénticos
    expect(calculateColorDistance('#FF0000', '#FF0000')).toBe(0);

    // Colores muy similares
    const distSimilar = calculateColorDistance('#FF0000', '#FF0505');
    expect(distSimilar).toBeLessThan(10);

    // Colores completamente diferentes (Rojo y Azul)
    const distDifferent = calculateColorDistance('#FF0000', '#0000FF');
    expect(distDifferent).toBeGreaterThan(300);
  });
});
