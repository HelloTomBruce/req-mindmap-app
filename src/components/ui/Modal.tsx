import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface ModalProps {
  isOpen?: boolean;
  onClose: () => void;
  title: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen = true,
  onClose,
  title,
  className = '',
  footer,
  children,
  closeOnOverlayClick = true,
  closeOnEsc = true
}) => {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={cn('sm:max-w-[620px]', className)}
        onPointerDownOutside={(e) => {
          if (!closeOnOverlayClick) {
            e.preventDefault();
          } else {
            onClose();
          }
        }}
        onInteractOutside={(e) => {
          if (!closeOnOverlayClick) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (!closeOnEsc) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="py-1 text-sm leading-relaxed max-h-[70vh] overflow-y-auto text-[var(--ll-ink)]">
          {children}
        </div>
        {footer && (
          <div className="mt-4 pt-4 border-t border-[var(--ll-line-soft,rgba(var(--ll-ink-rgb,42,36,32),0.15))] flex items-center justify-between gap-3 w-full">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
