import { useState, useEffect, useRef, useCallback } from "react";

export function useWebSocket(url, options = {}) {
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef(null);
  const optionsRef = useRef(options);

  // Hamesha latest callbacks store karo
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const connect = useCallback(() => {
    if (!url) return;

    // Agar already connected hai to dobara mat banao
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    console.log("🔌 Connecting to:", url);

    const ws = new WebSocket(url);

    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ WebSocket Connected");
      setIsConnected(true);

      optionsRef.current?.onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        console.log("📨", data);

        optionsRef.current?.onMessage?.(data);
      } catch (err) {
        console.error("Message Parse Error:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket Error:", err);

      optionsRef.current?.onError?.(err);
    };

    ws.onclose = (event) => {
      console.log("❌ WebSocket Closed:", event.code);

      setIsConnected(false);

      wsRef.current = null;

      optionsRef.current?.onClose?.(event);
    };
  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, "Component Unmount");
      }
    };
  }, [connect]);

  const sendMessage = useCallback((type, payload) => {
    if (!wsRef.current) return false;

    if (wsRef.current.readyState !== WebSocket.OPEN) return false;

    wsRef.current.send(
      JSON.stringify({
        type,
        payload,
      })
    );

    return true;
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, "Manual Disconnect");
      wsRef.current = null;
    }
  }, []);

  return {
    isConnected,
    sendMessage,
    disconnect,
  };
}