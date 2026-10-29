import { useCallback, useEffect, useRef, useState } from 'react';

// A failed first load is unavailable, never an empty successful result.
export default function useInventorySection(fetchValue, initialValue) {
  const [state, setState] = useState({ data: initialValue, loaded: false, pending: false, error: null });
  const sequence = useRef(0);
  useEffect(() => () => { sequence.current += 1; }, []);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    setState(previous => ({ ...previous, pending: true, error: null }));
    try {
      const data = await fetchValue();
      if (request === sequence.current) setState({ data, loaded: true, pending: false, error: null });
    } catch (error) {
      if (request === sequence.current) setState(previous => ({ ...previous, pending: false, error }));
    }
  }, [fetchValue]);
  return { ...state, reload };
}
