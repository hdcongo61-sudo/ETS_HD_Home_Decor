import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Modal from './Modal';
import { ModalProvider } from '../context/ModalContext';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const flushAnimationFrame = () => act(() => new Promise((resolve) => {
  window.requestAnimationFrame(resolve);
}));

describe('Modal interactions', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('keeps focus on the control being edited when its parent re-renders', async () => {
    const Harness = () => {
      const [value, setValue] = useState('');

      return (
        <ModalProvider>
          <Modal isOpen onClose={() => {}} title="Test modal">
            <input aria-label="First field" />
            <input
              aria-label="Second field"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </Modal>
        </ModalProvider>
      );
    };

    await act(async () => {
      root.render(<Harness />);
    });
    await flushAnimationFrame();

    const secondField = document.querySelector('[aria-label="Second field"]');
    secondField.focus();

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      ).set;
      valueSetter.call(secondField, 'updated');
      secondField.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await flushAnimationFrame();

    expect(document.activeElement).toBe(secondField);
  });
});
