import { useState } from 'react';
import toast from 'react-hot-toast';
import { Shield, Smartphone, Monitor, Trash2, LogOut, Key, QrCode, Check, X } from 'lucide-react';
import { PageHeader, Workspace, LoadingSkeleton } from '../components/business';
import { confirmDialog } from '../components/ConfirmProvider';
import { useSessions, useMfa } from '../features/auth/hooks';

const Security = () => {

  // Phase 7.1 : logique déplacée dans features/auth (hooks réutilisables).
  const {
    sessions, loading: loadingSessions, revoking: revokingSession, revokingAll,
    revoke: revokeSession, revokeAll: revokeAllSessions,
  } = useSessions();
  const {
    enabled: mfaEnabled, setupData: mfaSetupData, loading: mfaLoading,
    setup: setupMfa, verify: verifyMfa, disable: disableMfa,
  } = useMfa();

  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [showMfaSetup, setShowMfaSetup] = useState(false);

  const handleRevokeSession = async (sessionId) => {
    const confirmed = await confirmDialog({
      title: 'Révoquer cette session ?',
      message: 'Cette session sera immédiatement déconnectée.',
      confirmText: 'Révoquer',
      cancelText: 'Annuler',
    });
    if (!confirmed) return;
    try {
      await revokeSession(sessionId);
      toast.success('Session révoquée');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la révocation');
    }
  };

  const handleRevokeAll = async () => {
    const confirmed = await confirmDialog({
      title: 'Déconnecter tous les appareils ?',
      message: 'Toutes vos sessions actives seront révoquées, y compris celle-ci. Vous devrez vous reconnecter.',
      confirmText: 'Tout déconnecter',
      cancelText: 'Annuler',
    });
    if (!confirmed) return;
    try {
      toast.success('Toutes les sessions ont été révoquées');
      await revokeAllSessions(); // nettoie le stockage et redirige vers /login
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la déconnexion');
    }
  };

  const handleMfaSetup = async () => {
    try {
      const data = await setupMfa();
      if (data) setShowMfaSetup(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la configuration MFA');
    }
  };

  const handleMfaVerify = async (e) => {
    e.preventDefault();
    if (!mfaVerifyCode || mfaVerifyCode.length !== 6) {
      toast.error('Entrez un code à 6 chiffres');
      return;
    }

    try {
      await verifyMfa(mfaVerifyCode);
      toast.success('MFA activé avec succès');
      setShowMfaSetup(false);
      setMfaVerifyCode('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Code invalide');
    }
  };

  const handleMfaDisable = async () => {
    const confirmed = await confirmDialog({
      title: 'Désactiver l\'authentification à deux facteurs ?',
      message: 'Votre compte sera moins sécurisé sans MFA.',
      confirmText: 'Désactiver',
      cancelText: 'Annuler',
    });

    if (!confirmed) return;

    // Le backend exige le mot de passe pour désactiver MFA.
    const password = window.prompt('Confirmez votre mot de passe pour désactiver MFA :');
    if (!password) {
      toast.error('Mot de passe requis pour désactiver MFA.');
      return;
    }

    try {
      await disableMfa(password);
      toast.success('MFA désactivé');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la désactivation');
    }
  };

  const cancelMfaSetup = () => {
    setShowMfaSetup(false);
    setMfaVerifyCode('');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDeviceIcon = (device) => {
    const d = String(device || '').toLowerCase();
    if (d.includes('mobile') || d.includes('android') || d.includes('iphone')) {
      return Smartphone;
    }
    return Monitor;
  };

  return (
    <Workspace className="space-y-5">
      <PageHeader
        eyebrow="Sécurité"
        title="Sessions et MFA"
        description="Gérez vos appareils connectés et l'authentification à deux facteurs."
      />

      {/* MFA Section */}
      <section className="fluent-card-filled p-4 sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
            <Shield className="h-5 w-5" />
          </span>
          <div>
            <h2 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Authentification à deux facteurs</h2>
            <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
              Ajoutez une couche de sécurité supplémentaire à votre compte avec un code temporaire.
            </p>
          </div>
        </div>

        {!showMfaSetup && (
          <div className="rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke2)' }}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>
                  Statut MFA
                </p>
                <div className="mt-1 flex items-center gap-2">
                  {mfaEnabled ? (
                    <>
                      <Check className="h-4 w-4" style={{ color: 'var(--colorPaletteGreenForeground1)' }} />
                      <span className="fui-caption1" style={{ color: 'var(--colorPaletteGreenForeground1)' }}>
                        Activé
                      </span>
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4" style={{ color: 'var(--colorNeutralForeground3)' }} />
                      <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                        Désactivé
                      </span>
                    </>
                  )}
                </div>
              </div>
              {mfaEnabled ? (
                <button
                  type="button"
                  onClick={handleMfaDisable}
                  disabled={mfaLoading}
                  className="btn-ghost-danger"
                >
                  <X className="h-4 w-4" />
                  Désactiver
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleMfaSetup}
                  disabled={mfaLoading}
                  className="btn-primary"
                >
                  <Key className="h-4 w-4" />
                  Activer MFA
                </button>
              )}
            </div>
          </div>
        )}

        {/* MFA Setup Flow */}
        {showMfaSetup && mfaSetupData && (
          <div className="space-y-4">
            <div className="rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke2)' }}>
              <div className="mb-3 flex items-center gap-2">
                <QrCode className="h-5 w-5" style={{ color: 'var(--colorBrandForeground1)' }} />
                <h3 className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>
                  Scanner ce code QR
                </h3>
              </div>
              <p className="fui-caption1 mb-4" style={{ color: 'var(--colorNeutralForeground3)' }}>
                Utilisez une application d'authentification (Google Authenticator, Authy, Microsoft Authenticator) pour scanner ce code.
              </p>

              {/* QR Code display - using a placeholder, would need qrcode.react library */}
              <div className="flex justify-center rounded-lg p-4" style={{ background: 'var(--colorNeutralBackground1)' }}>
                <div className="rounded-lg p-4" style={{ background: '#ffffff' }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mfaSetupData.otpauthUrl)}`}
                    alt="QR Code MFA"
                    className="h-[200px] w-[200px]"
                  />
                </div>
              </div>

              <div className="mt-4 rounded-lg p-3" style={{ background: 'var(--colorNeutralBackground1)', border: '1px solid var(--colorNeutralStroke1)' }}>
                <p className="fui-caption1 mb-1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  Code secret (saisie manuelle)
                </p>
                <code className="fui-body2" style={{ color: 'var(--colorNeutralForeground1)', fontFamily: 'var(--fontFamilyMonospace)' }}>
                  {mfaSetupData.secret}
                </code>
              </div>
            </div>

            <form onSubmit={handleMfaVerify} className="rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke2)' }}>
              <label className="fui-body1-strong mb-2 block" style={{ color: 'var(--colorNeutralForeground1)' }}>
                Code de vérification
              </label>
              <p className="fui-caption1 mb-3" style={{ color: 'var(--colorNeutralForeground3)' }}>
                Entrez le code à 6 chiffres affiché dans votre application.
              </p>
              <input
                type="text"
                value={mfaVerifyCode}
                onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="form-control mb-3"
                style={{ fontFamily: 'var(--fontFamilyMonospace)', fontSize: '1.25rem', letterSpacing: '0.5em', textAlign: 'center' }}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={mfaLoading || mfaVerifyCode.length !== 6}
                  className="btn-primary flex-1"
                >
                  <Check className="h-4 w-4" />
                  Vérifier et activer
                </button>
                <button
                  type="button"
                  onClick={cancelMfaSetup}
                  disabled={mfaLoading}
                  className="btn-ghost"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      {/* Sessions Section */}
      <section className="fluent-card-filled p-4 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
              <Monitor className="h-5 w-5" />
            </span>
            <div>
              <h2 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Sessions actives</h2>
              <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
                Les appareils où vous êtes actuellement connecté(e).
              </p>
            </div>
          </div>
          {sessions.length > 0 && (
            <button
              type="button"
              onClick={handleRevokeAll}
              disabled={revokingAll}
              className="btn-ghost-danger shrink-0"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Tout déconnecter</span>
            </button>
          )}
        </div>

        {loadingSessions && <LoadingSkeleton />}

        {!loadingSessions && sessions.length === 0 && (
          <div className="rounded-[var(--radiusLarge)] p-8 text-center" style={{ background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke2)' }}>
            <Monitor className="mx-auto h-12 w-12 mb-3" style={{ color: 'var(--colorNeutralForeground3)' }} />
            <p className="fui-body1" style={{ color: 'var(--colorNeutralForeground3)' }}>
              Aucune session active
            </p>
          </div>
        )}

        {!loadingSessions && sessions.length > 0 && (
          <div className="space-y-3">
            {sessions.map((session) => {
              const DeviceIcon = getDeviceIcon(session.device);
              // L'identifiant de session courante n'est pas exposé par /me :
              // on ne surligne pas de session « courante ».
              const isCurrent = false;

              return (
                <div
                  key={session._id}
                  className="rounded-[var(--radiusLarge)] p-4"
                  style={{ background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke2)' }}
                >
                  <div className="flex items-start gap-3">
                    <DeviceIcon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--colorNeutralForeground2)' }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>
                          {session.device || 'Appareil inconnu'}
                        </p>
                        {isCurrent && (
                          <span className="ms-status-badge ms-status-success text-xs">Session actuelle</span>
                        )}
                      </div>
                      <p className="fui-caption1 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                        {session.ip || 'IP inconnue'}
                      </p>
                      <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                        Dernière activité : {formatDate(session.lastSeenAt)}
                      </p>
                      {session.userAgent && (
                        <p className="fui-caption1 mt-1 truncate" style={{ color: 'var(--colorNeutralForeground4)' }}>
                          {session.userAgent}
                        </p>
                      )}
                    </div>
                    {!isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleRevokeSession(session._id)}
                        disabled={revokingSession === session._id}
                        className="btn-ghost-danger shrink-0"
                        title="Révoquer cette session"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </Workspace>
  );
};

export default Security;
