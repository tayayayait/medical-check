import React, { useEffect, useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X, Loader2 } from 'lucide-react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}
export const Button: React.FC<ButtonProps> = ({ className, variant = 'primary', size = 'md', isLoading, children, ...props }) => {
  const baseStyles = "rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-primary text-surface hover:bg-primary-dark focus:ring-primary",
    secondary: "bg-surface text-text-primary border border-border hover:bg-gray-50 focus:ring-gray-200",
    danger: "bg-risk-high text-surface hover:bg-red-700 focus:ring-red-500",
    ghost: "bg-transparent text-text-secondary hover:bg-gray-100"
  };
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-5 text-base"
  };

  return (
    <button className={cn(baseStyles, sizes[size], variants[variant], className)} disabled={isLoading || props.disabled} {...props}>
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};

// --- Input ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}
export const Input: React.FC<InputProps> = ({ className, label, error, ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-text-secondary mb-1">{label}</label>}
      <input 
        className={cn(
          "h-9 w-full rounded-md border border-border px-3 bg-white text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:bg-gray-100",
          error && "border-risk-high focus:ring-risk-high focus:border-risk-high",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-risk-high mt-1">{error}</p>}
    </div>
  );
};

// --- Textarea ---
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}
export const Textarea: React.FC<TextareaProps> = ({ className, label, error, ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-text-secondary mb-1">{label}</label>}
      <textarea
        className={cn(
          "min-h-24 w-full rounded-md border border-border px-3 py-2 bg-white text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:bg-gray-100",
          error && "border-risk-high focus:ring-risk-high focus:border-risk-high",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-risk-high mt-1">{error}</p>}
    </div>
  );
};

// --- Select ---
type SelectOption = { value: string; label: string; disabled?: boolean };
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: SelectOption[];
}
export const Select: React.FC<SelectProps> = ({ className, label, error, options, children, ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-text-secondary mb-1">{label}</label>}
      <select
        className={cn(
          "h-9 w-full rounded-md border border-border px-3 bg-white text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:bg-gray-100",
          error && "border-risk-high focus:ring-risk-high focus:border-risk-high",
          className
        )}
        {...props}
      >
        {options
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
      {error && <p className="text-xs text-risk-high mt-1">{error}</p>}
    </div>
  );
};

// --- Badge ---
interface BadgeProps {
  variant?: 'high' | 'medium' | 'low' | 'info' | 'default';
  label: string;
  className?: string;
}
export const Badge: React.FC<BadgeProps> = ({ variant = 'default', label, className }) => {
  const styles = {
    high: "bg-risk-high text-white",
    medium: "bg-risk-medium text-white",
    low: "bg-risk-low text-white",
    info: "bg-risk-info text-white",
    default: "bg-gray-200 text-text-primary"
  };
  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium inline-block", styles[variant], className)}>
      {label}
    </span>
  );
};

// --- Card ---
export const Card: React.FC<{ children: React.ReactNode; title?: React.ReactNode; className?: string; action?: React.ReactNode }> = ({ children, title, className, action }) => (
  <div className={cn("bg-surface rounded-lg border border-border shadow-sm overflow-hidden", className)}>
    {(title || action) && (
      <div className="px-4 py-3 border-b border-border flex justify-between items-center bg-gray-50/50">
        {title && <h3 className="text-base font-bold text-text-primary">{title}</h3>}
        {action && <div>{action}</div>}
      </div>
    )}
    <div className="p-4">{children}</div>
  </div>
);

// --- Alert ---
type AlertTone = 'info' | 'success' | 'warning' | 'error';
interface AlertProps {
  tone?: AlertTone;
  title?: string;
  message?: string;
  children?: React.ReactNode;
  className?: string;
}
export const Alert: React.FC<AlertProps> = ({ tone = 'info', title, message, children, className }) => {
  const styles: Record<AlertTone, string> = {
    info: "bg-blue-50 text-risk-info border-blue-100",
    success: "bg-green-50 text-risk-low border-green-100",
    warning: "bg-orange-50 text-risk-medium border-orange-100",
    error: "bg-red-50 text-risk-high border-red-100"
  };

  return (
    <div className={cn("border rounded-md p-3 text-sm", styles[tone], className)}>
      {title && <div className="font-semibold mb-1">{title}</div>}
      {message && <div>{message}</div>}
      {children}
    </div>
  );
};

// --- Modal ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative bg-surface rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface z-10">
          <h3 className="text-lg font-bold text-text-primary">{title}</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Tabs ---
type TabItem = { id: string; label: string; disabled?: boolean };
interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}
export const Tabs: React.FC<TabsProps> = ({ items, value, onChange, className }) => {
  return (
    <div className={cn("flex border-b border-border", className)}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={item.disabled}
          onClick={() => onChange(item.id)}
          className={cn(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors -mb-px",
            value === item.id
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary",
            item.disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

interface TabPanelProps {
  value: string;
  when: string;
  children: React.ReactNode;
  className?: string;
}
export const TabPanel: React.FC<TabPanelProps> = ({ value, when, children, className }) => {
  if (value !== when) return null;
  return <div className={className}>{children}</div>;
};

// --- Toggle ---
interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}
export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, disabled, className }) => {
  return (
    <label className={cn("inline-flex items-center gap-2 cursor-pointer", disabled && "opacity-60 cursor-not-allowed", className)}>
      <span className="relative inline-flex items-center">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className={cn(
          "w-10 h-5 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-border"
        )} />
        <span className={cn(
          "absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )} />
      </span>
      {label && <span className="text-sm text-text-primary">{label}</span>}
    </label>
  );
};

// --- Toast ---
type ToastVariant = 'success' | 'warning' | 'error' | 'info';
interface ToastProps {
  isOpen: boolean;
  variant?: ToastVariant;
  message: string;
  autoCloseMs?: number;
  onClose?: () => void;
  className?: string;
}
export const Toast: React.FC<ToastProps> = ({ isOpen, variant = 'info', message, autoCloseMs = 2500, onClose, className }) => {
  useEffect(() => {
    if (!isOpen || !onClose) return;
    const id = window.setTimeout(onClose, autoCloseMs);
    return () => window.clearTimeout(id);
  }, [isOpen, autoCloseMs, onClose]);

  if (!isOpen) return null;

  const styles: Record<ToastVariant, string> = {
    success: "bg-risk-low text-white",
    warning: "bg-risk-medium text-white",
    error: "bg-risk-high text-white",
    info: "bg-risk-info text-white"
  };

  return (
    <div className={cn("fixed bottom-6 right-6 z-50 rounded-md px-4 py-3 text-sm shadow-lg", styles[variant], className)}>
      {message}
    </div>
  );
};

// --- Table ---
interface TableProps {
  children: React.ReactNode;
  className?: string;
}
export const Table: React.FC<TableProps> = ({ children, className }) => (
  <div className="overflow-x-auto">
    <table className={cn("w-full text-sm text-left border border-border", className)}>
      {children}
    </table>
  </div>
);

// --- Progress ---
interface ProgressProps {
  value?: number;
  max?: number;
  label?: string;
  indeterminate?: boolean;
  className?: string;
}
export const Progress: React.FC<ProgressProps> = ({ value = 0, max = 100, label, indeterminate, className }) => {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cn("w-full", className)}>
      {label && <div className="text-xs text-text-secondary mb-1">{label}</div>}
      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn("h-2 bg-primary rounded-full transition-all", indeterminate && "animate-pulse w-1/3")}
          style={!indeterminate ? { width: `${percent}%` } : undefined}
        />
      </div>
    </div>
  );
};

// --- Uploader ---
interface UploaderProps {
  accept?: string;
  maxFiles?: number;
  mode?: 'dragDrop' | 'click';
  helperText?: string;
  onFiles?: (files: FileList) => void;
  className?: string;
}
export const Uploader: React.FC<UploaderProps> = ({ accept, maxFiles = 1, mode = 'dragDrop', helperText, onFiles, className }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (files.length > maxFiles) return;
    onFiles?.(files);
  };

  return (
    <label
      className={cn(
        "flex flex-col items-center justify-center w-full border-2 border-dashed rounded-lg cursor-pointer transition-colors p-6",
        isDragging ? "border-primary bg-primary/5" : "border-border bg-gray-50 hover:bg-gray-100",
        className
      )}
      onDragOver={(e) => {
        if (mode !== 'dragDrop') return;
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        if (mode !== 'dragDrop') return;
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <div className="text-sm text-text-secondary">
        {mode === 'dragDrop' ? "Drag & drop files here" : "Click to select a file"}
      </div>
      {helperText && <div className="text-xs text-text-secondary mt-2">{helperText}</div>}
      <input
        type="file"
        className="hidden"
        accept={accept}
        multiple={maxFiles > 1}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </label>
  );
};

// --- Pagination ---
interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}
export const Pagination: React.FC<PaginationProps> = ({ page, totalPages, onChange, className }) => {
  if (totalPages <= 1) return null;
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className={cn("flex items-center justify-end gap-2", className)}>
      <button
        type="button"
        className="h-8 px-3 rounded-md border border-border text-sm disabled:opacity-50"
        disabled={!canPrev}
        onClick={() => onChange(page - 1)}
      >
        Prev
      </button>
      <span className="text-sm text-text-secondary">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        className="h-8 px-3 rounded-md border border-border text-sm disabled:opacity-50"
        disabled={!canNext}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
};

// --- RadioGroup ---
type RadioOption = { value: string; label: string; disabled?: boolean };
interface RadioGroupProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  label?: string;
  required?: boolean;
  className?: string;
}
export const RadioGroup: React.FC<RadioGroupProps> = ({ name, value, onChange, options, label, required, className }) => {
  return (
    <fieldset className={cn("w-full", className)}>
      {label && <legend className="block text-sm font-medium text-text-secondary mb-2">{label}{required ? " *" : ""}</legend>}
      <div className="flex flex-col gap-2">
        {options.map((opt) => (
          <label key={opt.value} className={cn("flex items-center gap-2 text-sm text-text-primary", opt.disabled && "opacity-60")}>
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              disabled={opt.disabled}
              onChange={() => onChange(opt.value)}
              className="h-4 w-4 text-primary focus:ring-primary"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
};
