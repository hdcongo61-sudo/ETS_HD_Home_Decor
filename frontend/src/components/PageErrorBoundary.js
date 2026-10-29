import React from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

class PageErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidUpdate(previousProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  retry = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="mx-auto flex min-h-[55vh] w-full max-w-xl items-center justify-center px-4 py-10">
        <section className="ms-surface w-full p-6 text-center sm:p-8" role="alert">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--colorStatusDangerBackground1)] text-[var(--colorStatusDangerForeground1)]">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="ms-eyebrow mt-4">Cette section a rencontré un problème</p>
          <h1 className="ms-page-title mt-2">Vos données ne sont pas perdues</h1>
          <p className="ms-page-description mx-auto mt-2 max-w-md">Réessayez la section ou revenez à l’accueil pour continuer votre travail.</p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <button type="button" onClick={this.retry} className="ms-button ms-button-primary ms-button-md">
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Réessayer
            </button>
            <Link to="/" className="ms-button ms-button-secondary ms-button-md">
              <Home className="h-4 w-4" aria-hidden="true" /> Accueil
            </Link>
          </div>
        </section>
      </div>
    );
  }
}

export default PageErrorBoundary;

