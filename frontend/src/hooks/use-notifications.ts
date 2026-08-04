import { useState, useEffect, useRef, useCallback } from 'react';
import { getToken, getUser } from '@/src/api';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const WS_URL = BASE.replace(/^http/, 'ws') + '/ws';

export interface AppNotification {
  id: string;
  type: 'chat' | 'media';
  title: string;
  body: string;
  data?: any;
  timestamp: number;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const user = await getUser();
    if (!user?.space_id) return;

    try {
      const ws = new WebSocket(`${WS_URL}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        if (reconnectRef.current) {
          clearTimeout(reconnectRef.current);
          reconnectRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          // Ignore server pings (keepalive)
          if (msg.type === 'ping') return;

          if (msg.type === 'chat') {
            // Defense-in-depth: skip own messages (backend already excludes sender)
            if (msg.data.sender_id === user?.id) return;
            const n: AppNotification = {
              id: msg.data.id,
              type: 'chat',
              title: 'New message',
              body: `${msg.data.sender_username}: ${msg.data.text}`,
              data: msg.data,
              timestamp: Date.now(),
            };
            setNotifications(prev => [...prev, n]);
          } else if (msg.type === 'media') {
            // Defense-in-depth: skip own uploads (backend already excludes sender)
            if (msg.data.uploader_id === user?.id) return;
            const n: AppNotification = {
              id: `media-${Date.now()}`,
              type: 'media',
              title: 'New upload',
              body: `${msg.data.uploader_username} uploaded ${msg.data.count} ${msg.data.resource_types[0] || 'item'}${msg.data.count > 1 ? 's' : ''}`,
              data: msg.data,
              timestamp: Date.now(),
            };
            setNotifications(prev => [...prev, n]);
          }
        } catch (e) {
          console.warn('Notification parse error:', e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectRef.current = setTimeout(() => connect(), 3000);
      };

      ws.onerror = () => {
        setConnected(false);
      };
    } catch (e) {
      console.warn('WebSocket connection error:', e);
      reconnectRef.current = setTimeout(() => connect(), 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
      }
    };
  }, [connect]);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clear = useCallback(() => {
    setNotifications([]);
  }, []);

  return { notifications, connected, dismiss, clear };
}