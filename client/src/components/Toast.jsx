import React, { useEffect } from 'react';

function Toast({ toasts, onRemove }) {
  useEffect(() => {
    // Auto-remove toasts after 4 seconds
    if (toasts.length > 0 && onRemove) {
      const timers = toasts.map(toast => {
        return setTimeout(() => {
          onRemove(toast.id);
        }, 4000);
      });
      
      return () => {
        timers.forEach(timer => clearTimeout(timer));
      };
    }
  }, [toasts, onRemove]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

export default Toast;