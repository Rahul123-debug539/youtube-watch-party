import { useState, useEffect, useRef, useCallback } from 'react';

export function useWebSocket(url, options = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const isMountedRef = useRef(true);

  const sendMessage = useCallback((type, payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
      console.log('📤 Sent:', type, payload);
      return true;
    }
    console.warn('❌ Not connected');
    return false;
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) {}
      wsRef.current = null;
    }

    if (!isMountedRef.current) return;

    try {
      console.log('🔌 Connecting to:', url);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        console.log('✅ WebSocket OPEN');
        setIsConnected(true);
        if (options.onOpen) options.onOpen();
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          console.log('📨 Received:', data);
          if (options.onMessage) options.onMessage(data);
        } catch (error) {
          console.error('Parse error:', error);
        }
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        console.log('❌ WebSocket CLOSED');
        setIsConnected(false);
        if (options.onClose) options.onClose();
      };

      ws.onerror = (error) => {
        if (!isMountedRef.current) return;
        console.error('⚠️ WebSocket ERROR:', error);
        if (options.onError) options.onError(error);
      };
    } catch (error) {
      console.error('Connection error:', error);
    }
  }, [url, options]);

  const disconnect = useCallback(() => {
    isMountedRef.current = false;
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) {}
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (e) {}
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { isConnected, sendMessage, disconnect };
}