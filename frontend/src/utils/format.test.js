import { formatCfa, formatMoney, setActiveCurrency, DEFAULT_CURRENCY } from './format';

// `toLocaleString` uses non-breaking spaces depending on the runtime; normalize
// so assertions are stable across Node/jsdom versions.
const normalizeSpaces = (value) => value.replace(/[\u202F\u00A0]/g, ' ');

describe('formatMoney / formatCfa (tenant currency)', () => {
  afterEach(() => setActiveCurrency(DEFAULT_CURRENCY));

  it('keeps the legacy CFA behaviour by default (XOF, 0 decimals, rounds)', () => {
    setActiveCurrency(DEFAULT_CURRENCY);
    expect(normalizeSpaces(formatCfa(1234567))).toBe('1 234 567 CFA');
    expect(normalizeSpaces(formatCfa(1234.7))).toBe('1 235 CFA');
  });

  it('formats a 2-decimal currency with its symbol', () => {
    setActiveCurrency({ code: 'EUR', symbol: '€', decimals: 2, locale: 'fr-FR' });
    expect(normalizeSpaces(formatMoney(1234.5))).toBe('1 234,50 €');
    expect(normalizeSpaces(formatCfa(10))).toBe('10,00 €');
  });

  it('falls back to CFA when the active currency is empty', () => {
    setActiveCurrency(null);
    expect(normalizeSpaces(formatCfa(1000))).toBe('1 000 CFA');
  });
});
