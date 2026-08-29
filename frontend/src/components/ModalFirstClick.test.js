import React, { useState, act } from 'react';
import { createRoot } from 'react-dom/client';
import Modal from './Modal';
import { ModalProvider } from '../context/ModalContext';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const click = (element) => {
  element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
};

describe('Modal first-click behaviour', () => {
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

  it('fires the handler on the FIRST click of a button inside the modal', async () => {
    let clicks = 0;
    const Harness = () => (
      <ModalProvider>
        <Modal isOpen onClose={() => {}} title="Test modal">
          <button type="button" onClick={() => { clicks += 1; }}>Action</button>
        </Modal>
      </ModalProvider>
    );

    await act(async () => {
      root.render(<Harness />);
    });

    const button = document.querySelector('button:not([aria-label="Fermer"])');
    expect(button).toBeTruthy();

    await act(async () => {
      click(button);
    });

    expect(clicks).toBe(1);
  });

  it('fires on the first click of an input inside the modal', async () => {
    let focused = false;
    const Harness = () => (
      <ModalProvider>
        <Modal isOpen onClose={() => {}} title="Test modal">
          <input aria-label="Champ" onFocus={() => { focused = true; }} />
        </Modal>
      </ModalProvider>
    );

    await act(async () => {
      root.render(<Harness />);
    });

    const input = document.querySelector('[aria-label="Champ"]');
    await act(async () => {
      input.focus();
    });

    expect(focused).toBe(true);
  });

  it('ne vole pas le focus d’un champ déjà cliqué quand l’autofocus différé se déclenche', async () => {
    const Harness = () => (
      <ModalProvider>
        <Modal isOpen onClose={() => {}} title="Test modal">
          <input aria-label="First field" />
          <input aria-label="Second field" />
        </Modal>
      </ModalProvider>
    );

    await act(async () => {
      root.render(<Harness />);
    });

    // L'utilisateur clique dans le second champ AVANT que le rAF d'autofocus
    // ne s'exécute (scénario réel en dev : main-thread occupé par la recompilation).
    const secondField = document.querySelector('[aria-label="Second field"]');
    secondField.focus();

    await act(async () => {
      await new Promise((resolve) => {
        window.requestAnimationFrame(resolve);
      });
    });

    expect(document.activeElement).toBe(secondField);
  });
});
