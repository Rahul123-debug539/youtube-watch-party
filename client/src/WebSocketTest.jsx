import { useState, useEffect, useRef, useCallback } from 'react';

export function useWebSocket(url, options = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const isMountedRef = useRef(true);

  const sendMessage = useCallback((type, payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type, payload });
      wsRef.current.send(message);
      console.log('📤 Sent:', type, payload);
      return true;
    }
    console.warn('❌ WebSocket not connected');
    return false;
  }, []);

  const connect = useCallback(() => {
    // Clean up existing connection
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
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
        reconnectAttemptsRef.current = 0;
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

      ws.onclose = (event) => {
        if (!isMountedRef.current) return;
        console.log('❌ WebSocket CLOSED:', event.code);
        setIsConnected(false);
        if (options.onClose) options.onClose();
        
        // Auto reconnect
        if (event.code !== 1000 && isMountedRef.current) {
          handleReconnect();
        }
      };

      ws.onerror = (error) => {
        if (!isMountedRef.current) return;
        console.error('⚠️ WebSocket ERROR:', error);
        if (options.onError) options.onError(error);
      };
    } catch (error) {
      console.error('Connection error:', error);
      if (isMountedRef.current) {
        handleReconnect();
      }
    }
  }, [url, options]);

  const handleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (!isMountedRef.current) return;

    if (reconnectAttemptsRef.current < maxReconnectAttempts) {
      reconnectAttemptsRef.current++;
      const delay = Math.min(1000 * reconnectAttemptsRef.current, 5000);
      
      console.log(`🔄 Reconnecting in ${delay}ms (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
      
      reconnectTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          connect();
        }
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  }, [connect]);

  const disconnect = useCallback(() => {
    isMountedRef.current = false;
    
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'Intentional disconnect');
      } catch (e) {}
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        try {
          wsRef.current.close(1000, 'Unmount');
        } catch (e) {}
        wsRef.current = null;
      }
    };
  }, [connect]);

  return {
    isConnected,
    sendMessage,
    disconnect
  };
}