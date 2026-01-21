import React from 'react';

export const GlassCard: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`glass-panel rounded-3xl p-6 ${className}`}>{children}</div>
);

