import { createContext, useContext, ReactNode } from 'react';
import { useNotifications, AppNotification } from '@/src/hooks/use-notifications';

interface NotificationContextValue {
  notifications: AppNotification[];
  connected: boolean;
  dismiss: (id: string) => void;
  clear: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  connected: false,
  dismiss: () => {},
  clear: () => {},
});

export function useNotificationContext() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { notifications, connected, dismiss, clear } = useNotifications();
  return (
    <NotificationContext.Provider value={{ notifications, connected, dismiss, clear }}>
      {children}
    </NotificationContext.Provider>
  );
}