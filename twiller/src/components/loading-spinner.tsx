"use client";

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getSavedLanguage, Language, translate } from '@/lib/i18n';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const [lang, setLang] = useState<Language>("en");
  useEffect(() => {
    setLang(getSavedLanguage());
  }, []);
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return (
    <div className={cn("animate-spin rounded-full border-2 border-gray-300 border-t-blue-500", sizeClasses[size], className)}>
      <span className="sr-only">{translate(lang, "loading")}</span>
    </div>
  );
}