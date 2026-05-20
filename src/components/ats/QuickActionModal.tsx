import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type QuickActionModalProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onCancel: () => void;
  onSave?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  maxWidthClass?: string;
};

export function QuickActionModal({
  title,
  subtitle,
  children,
  onCancel,
  onSave,
  saveLabel = 'Save / Update',
  cancelLabel = 'Cancel',
  maxWidthClass = 'max-w-2xl',
}: QuickActionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={cn('w-full overflow-hidden rounded-2xl border border-white/10 bg-[#08111f] shadow-2xl', maxWidthClass)}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            aria-label="Close quick action"
            onClick={onCancel}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        <div className="flex flex-col-reverse gap-2 border-t border-white/10 px-5 py-4 sm:flex-row sm:justify-end">
          <button onClick={onCancel} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10">
            {cancelLabel}
          </button>
          {onSave && (
            <button onClick={onSave} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
              {saveLabel}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export function QuickIconButton({
  title,
  children,
  onClick,
  tone = 'hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-200',
}: {
  title: string;
  children: React.ReactNode;
  onClick: () => void;
  tone?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={event => {
        event.stopPropagation();
        onClick();
      }}
      className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-colors', tone)}
    >
      {children}
    </button>
  );
}
