import { useEffect } from 'react';

/**
 * Adds `data-title` attributes to table cells so CSS can render
 * a card-like layout on small screens.
 *
 * @param {React.RefObject<HTMLTableElement>} tableRef
 * @param {Array<unknown>} deps Dependencies when the table contents change
 */
const useResponsiveTable = (tableRef, deps = []) => {
  useEffect(() => {
    const tableElement = tableRef?.current;
    if (!tableElement) {
      return undefined;
    }

    const headerCells = Array.from(
      tableElement.querySelectorAll('thead th')
    );

    if (!headerCells.length) {
      return undefined;
    }

    const headers = headerCells.map((cell) => {
      const text = cell.textContent || cell.innerText || '';
      return text.trim();
    });

    const bodyRows = Array.from(
      tableElement.querySelectorAll('tbody tr')
    );

    bodyRows.forEach((row) => {
      Array.from(row.children).forEach((cell, index) => {
        if (!(cell instanceof HTMLElement)) {
          return;
        }

        const headerTitle = headers[index];
        if (headerTitle) {
          cell.dataset.title = headerTitle;
        }
      });
    });

    return () => {
      bodyRows.forEach((row) => {
        Array.from(row.children).forEach((cell) => {
          if (cell instanceof HTMLElement && cell.dataset.title) {
            delete cell.dataset.title;
          }
        });
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableRef, ...deps]);
};

export default useResponsiveTable;
