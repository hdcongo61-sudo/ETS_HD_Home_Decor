import React, { useContext } from 'react';
import { ArrowLeft, Home, SearchX } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

const NotFound = () => {
  const { auth } = useContext(AuthContext);
  const location = useLocation();
  const destination = auth.isAuthenticated ? '/' : '/login';
  const destinationLabel = auth.isAuthenticated ? "Retour à l’accueil" : 'Retour à la connexion';

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-4 py-12">
      <section className="ms-surface w-full max-w-xl p-6 text-center sm:p-10" aria-labelledby="not-found-title">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg"
          style={{ background: 'var(--colorStatusInfoBackground1)', color: 'var(--colorStatusInfoForeground1)' }}
        >
          <SearchX className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="ms-eyebrow mt-5">Erreur 404</p>
        <h1 id="not-found-title" className="ms-page-title mt-2">Cette page est introuvable</h1>
        <p className="ms-page-description mx-auto mt-3 max-w-md">
          L’adresse est peut-être incorrecte ou la page a été déplacée.
        </p>
        <p className="mt-2 break-all text-xs text-[var(--ms-text-muted)]">{location.pathname}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button type="button" className="ms-button ms-button-secondary ms-button-md" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Page précédente
          </button>
          <Link to={destination} className="ms-button ms-button-primary ms-button-md">
            <Home className="h-4 w-4" aria-hidden="true" />
            {destinationLabel}
          </Link>
        </div>
      </section>
    </div>
  );
};

export default NotFound;
