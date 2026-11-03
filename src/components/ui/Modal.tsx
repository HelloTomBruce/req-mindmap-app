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
        <div className="py-1 text-sm leading-relaxed text-[var(--text-primary)] max-h-[70vh] overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="mt-5 pt-3.5 border-t border-[var(--border-default)] flex items-center justify-between gap-3 w-full">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
