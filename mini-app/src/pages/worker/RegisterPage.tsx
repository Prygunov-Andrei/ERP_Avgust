import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Placeholder, Spinner } from '@telegram-apps/telegram-ui';
import { getGeolocation, hapticNotification, scanQrCode } from '@/lib/telegram';
import { registerForShift } from '@/api/client';

type RegistrationState = 'idle' | 'locating' | 'registering' | 'success' | 'success_geo_warning' | 'error';

interface RegisterPageProps {
  workerName: string;
}

/**
 * Принудительное восстановление webview после закрытия нативного popup.
 * На iOS Telegram может "заморозить" webview после QR-сканера.
 */
const forceWebviewRecovery = () => {
  window.scrollTo(0, 0);
  document.body.style.opacity = '0.99';
  requestAnimationFrame(() => {
    document.body.style.opacity = '1';
  });
};

export const RegisterPage = ({ workerName }: RegisterPageProps) => {
  const { t } = useTranslation();
  const [state, setState] = useState<RegistrationState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const scanningRef = useRef(false);

  const processQrData = useCallback(async (qrData: string) => {
    try {
      let parsed: { shift_id: string; token: string };
      try {
        parsed = JSON.parse(qrData);
      } catch {
        throw new Error('Неверный QR-код. Попробуйте ещё раз.');
      }

      setState('locating');
      const geo = await getGeolocation();

      setState('registering');
      const result = await registerForShift(parsed.shift_id, {
        qr_token: parsed.token,
        latitude: geo.latitude,
        longitude: geo.longitude,
      });

      if (result.warning || result.geo_valid === false) {
        setState('success_geo_warning');
        hapticNotification('warning');
      } else {
        setState('success');
        hapticNotification('success');
      }
    } catch (error) {
      setState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Ошибка регистрации');
      hapticNotification('error');
    }
  }, []);

  const handleRegister = async () => {
    if (scanningRef.current) return;
    scanningRef.current = true;

    try {
      const qrData = await scanQrCode();
      scanningRef.current = false;
      forceWebviewRecovery();
      await processQrData(qrData);
    } catch (error) {
      scanningRef.current = false;
      forceWebviewRecovery();
      setState('error');
      setErrorMessage(error instanceof Error ? error.message : 'QR-сканер недоступен');
      hapticNotification('error');
    }
  };

  if (state === 'success') {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Placeholder
          header={t('worker.registered')}
          description={t('worker.shiftInfo')}
        >
          <div style={{ fontSize: '64px' }}>✅</div>
        </Placeholder>
      </div>
    );
  }

  if (state === 'success_geo_warning') {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Placeholder
          header={t('worker.registered')}
          description="Вы зарегистрированы, но находитесь вне геозоны объекта"
        >
          <div style={{ fontSize: '64px' }}>⚠️</div>
        </Placeholder>
      </div>
    );
  }

  if (['locating', 'registering'].includes(state)) {
    const statusText = state === 'locating'
      ? 'Определение местоположения...'
      : 'Регистрация на смену...';

    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spinner size="l" />
        <p style={{ marginTop: '16px', color: 'var(--tg-theme-hint-color)' }}>{statusText}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
      <Placeholder
        header={`${t('worker.title')}`}
        description={`${workerName}`}
      >
        <div style={{ fontSize: '64px' }}>👷</div>
      </Placeholder>

      {state === 'error' && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'var(--tg-theme-destructive-text-color, #ff3b30)',
          color: '#fff',
          borderRadius: '12px',
          width: '100%',
          textAlign: 'center',
        }}>
          {errorMessage}
        </div>
      )}

      <Button
        size="l"
        stretched
        onClick={handleRegister}
      >
        {t('worker.registerButton')}
      </Button>
    </div>
  );
};
