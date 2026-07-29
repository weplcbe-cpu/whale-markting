import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export const ToastContainer = () => {
  const { toasts } = useApp();

  if (!toasts || toasts.length === 0) return null;

  const visibleToasts = toasts.filter((toast, index, list) => (
    index === list.findIndex((candidate) => candidate.message === toast.message && candidate.type === toast.type)
  ));

  return (
    <div className="toast-container">
      {visibleToasts.map(toast => {
        let IconComponent = Info;
        if (toast.type === 'success') IconComponent = CheckCircle2;
        if (toast.type === 'error') IconComponent = AlertCircle;
        if (toast.type === 'warning') IconComponent = AlertTriangle;

        return (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <IconComponent size={20} />
            <span>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
};
