import { formatProformaAmount } from './proformaPdf';
import { DEFAULT_CURRENCY, setActiveCurrency } from './format';

describe('formatProformaAmount', () => {
  afterEach(() => setActiveCurrency(DEFAULT_CURRENCY));

  it('uses periods as thousands separators in pro forma prices', () => {
    expect(formatProformaAmount(1234567)).toBe('1.234.567 CFA');
  });

  it('preserves decimal formatting for currencies that use decimals', () => {
    setActiveCurrency({ code: 'EUR', symbol: '€', decimals: 2, locale: 'fr-FR' });
    expect(formatProformaAmount(1234.5)).toBe('1.234,50 €');
  });
});
