import React from 'react';
import { ArrowLeft, LockKeyhole, MessageSquareText } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Workspace } from '../components/business';

const PermissionDenied = ({ reason = 'Cette page nécessite une autorisation supplémentaire.' }) => {
  const location = useLocation();

  return (
    <Workspace className="flex min-h-[70vh] items-center justify-center">
      <section className="ms-surface w-full max-w-lg p-6 text-center sm:p-8" role="status">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--colorStatusWarningBackground1)] text-[var(--colorStatusWarningForeground1)]">
          <LockKeyhole className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="ms-eyebrow mt-5">Accès contrôlé</p>
        <h1 className="ms-page-title mt-2">Vous ne pouvez pas ouvrir cette page</h1>
        <p className="ms-page-description mx-auto mt-3 max-w-md">{reason}</p>
        <p className="mt-2 break-all text-xs text-[var(--colorNeutralForeground3)]">{location.pathname}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link to="/" className="ms-button ms-button-primary ms-button-md">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Retour à l’accueil
          </Link>
          <Link to="/support" className="ms-button ms-button-secondary ms-button-md">
            <MessageSquareText className="h-4 w-4" aria-hidden="true" /> Contacter le support
          </Link>
        </div>
      </section>
    </Workspace>
  );
};

export default PermissionDenied;

