import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, Text, View } from 'react-native';
import type { AlertButton, AlertOptions } from 'react-native';

import { useGigStore } from '@/lib/gig-store';

type AlertFunction = (title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => void;

type ActiveAlert = {
  buttons: AlertButton[];
  message?: string;
  options?: AlertOptions;
  title: string;
};

type AppAlertProviderProps = {
  children: React.ReactNode;
};

export function AppAlertProvider({ children }: AppAlertProviderProps) {
  const { isDark } = useGigStore();
  const [activeAlert, setActiveAlert] = useState<ActiveAlert | null>(null);
  const originalAlertRef = useRef<AlertFunction | null>(null);
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const messageClass = isDark ? 'text-zinc-300' : 'text-zinc-600';
  const panelClass = isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white';

  const showAlert = useCallback<AlertFunction>((title, message, buttons, options) => {
    setActiveAlert({
      buttons: buttons?.length ? buttons : [{ text: 'OK' }],
      message,
      options,
      title,
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    const alertApi = Alert as unknown as { alert: AlertFunction };
    originalAlertRef.current = alertApi.alert;
    alertApi.alert = showAlert;

    return () => {
      if (originalAlertRef.current) {
        alertApi.alert = originalAlertRef.current;
      }
    };
  }, [showAlert]);

  function closeWith(button?: AlertButton) {
    setActiveAlert(null);
    button?.onPress?.();
  }

  function closeFromBackdrop() {
    if (!activeAlert || activeAlert.options?.cancelable === false) {
      return;
    }

    closeWith(activeAlert.buttons.find((button) => button.style === 'cancel'));
  }

  return (
    <>
      {children}
      {Platform.OS === 'web' ? (
        <Modal transparent animationType="fade" visible={Boolean(activeAlert)} onRequestClose={closeFromBackdrop}>
          <View className="flex-1 items-center justify-center bg-black/70 px-5">
            <Pressable accessibilityRole="button" className="absolute inset-0" onPress={closeFromBackdrop} />
            <View className={`w-full max-w-md rounded-[28px] border p-5 ${panelClass}`}>
              <Text className={`text-2xl font-black ${titleClass}`}>{activeAlert?.title}</Text>
              {activeAlert?.message ? (
                <Text className={`mt-3 text-base leading-6 ${messageClass}`}>{activeAlert.message}</Text>
              ) : null}

              <View className="mt-5 gap-3">
                {activeAlert?.buttons.map((button, index) => (
                  <AlertActionButton
                    key={`${button.text ?? button.style ?? 'action'}-${index}`}
                    button={button}
                    onPress={() => closeWith(button)}
                  />
                ))}
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

function AlertActionButton({ button, onPress }: { button: AlertButton; onPress: () => void }) {
  const { isDark } = useGigStore();
  const destructive = button.style === 'destructive';
  const cancel = button.style === 'cancel';
  const buttonClass = destructive
    ? 'bg-rose-500'
    : cancel
      ? isDark
        ? 'border border-white/20 bg-white/10'
        : 'border border-zinc-200 bg-zinc-100'
      : 'bg-violet';
  const textClass = cancel && !isDark ? 'text-zinc-950' : 'text-white';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`min-h-12 items-center justify-center rounded-3xl px-5 ${buttonClass}`}>
      <Text className={`text-sm font-black ${textClass}`}>{button.text ?? 'OK'}</Text>
    </Pressable>
  );
}
