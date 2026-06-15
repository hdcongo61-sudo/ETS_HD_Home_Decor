import React from 'react';

/**
 * Top-level error boundary. Catches render/runtime errors anywhere in the tree
 * and shows a friendly recovery screen instead of a blank white page.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('UI error boundary caught:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center"
        style={{ background: 'var(--ms-bg, #faf9f8)' }}
      >
        <div className="w-full max-w-sm rounded-[var(--radiusLarge,12px)] border border-[var(--ms-border,#e1dfdd)] bg-white p-6 shadow-[var(--ms-shadow-lg,0_8px_24px_rgba(0,0,0,0.12))]">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: 'var(--colorStatusDangerBackground1, #fdf3f4)', color: 'var(--colorStatusDangerForeground1, #b10e1c)' }}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86l-8.48 14.7A1 1 0 002.7 20h18.6a1 1 0 00.87-1.5l-9.3-14.64a1 1 0 00-1.74.01z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--colorNeutralForeground1, #201f1e)' }}>
            Une erreur est survenue
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--colorNeutralForeground3, #616161)' }}>
            L'application a rencontré un problème inattendu. Vous pouvez recharger la page sans perdre vos données enregistrées.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={this.handleReload}
              className="min-h-[44px] rounded-[var(--ms-radius,6px)] px-4 py-2.5 text-sm font-semibold text-white"
              style={{ background: 'var(--ms-blue, #0f6cbd)' }}
            >
              Recharger la page
            </button>
            <button
              type="button"
              onClick={this.handleHome}
              className="min-h-[44px] rounded-[var(--ms-radius,6px)] border px-4 py-2.5 text-sm font-semibold"
              style={{ borderColor: 'var(--ms-border,#e1dfdd)', color: 'var(--colorNeutralForeground1,#201f1e)' }}
            >
              Accueil
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
