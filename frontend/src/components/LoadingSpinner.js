import AppLoader from './AppLoader';

/** @deprecated Use AppLoader directly for consistency. This now renders the same app logo loader. */
export default function LoadingSpinner({ text = 'Chargement...' }) {
  return <AppLoader fullScreen text={text} />;
}
