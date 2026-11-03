import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"
import { Paper, type PaperProps } from "@/components/ui/paper"
import { useInk, useInkScope } from "@/lib/ink/react"
import { closeMarkRecipe } from "@/lib/ink/recipes/overlay-ink"
import { cn } from "@/lib/utils"

const ModalContext = React.createContext(true)

function Dialog({ modal = true, ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return (
    <ModalContext.Provider value={modal}>
      <DialogPrimitive.Root data-slot="dialog" modal={modal} {...props} />
    </ModalContext.Provider>
  )
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  const scope = useInkScope()
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      {...scope}
      className={cn(
        "fixed inset-0 z-[10000] [background:var(--ll-overlay-dim)] backdrop-blur-[4px]",
        "duration-(--ll-dur-sheet) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DialogCloseMark({ className, seed }: { className?: string; seed?: string | number }) {
  const { hostRef, hostProps, node } = useInk({ recipe: closeMarkRecipe, params: {}, kind: "close", size: [32, 32], seed })
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      data-part="x"
      ref={hostRef}
      {...hostProps}
      className={cn("absolute end-4 top-4 z-(--ll-z-raised) grid size-8 place-items-center text-ink cursor-pointer hover:opacity-75 transition-opacity", className)}
    >
      {node}
      <span aria-hidden="true" className="font-hand text-xl leading-none">
        ×
      </span>
      <span className="sr-only">Close</span>
    </DialogPrimitive.Close>
  )
}

type DialogPaperProps = Pick<PaperProps, "stock" | "edge" | "tilt" | "tape" | "tapeKind" | "fastener" | "fastenerTone" | "rules" | "shadow" | "seed">

function DialogContent({
  className,
  children,
  showCloseButton = true,
  stock = "paper",
  edge,
  tilt,
  tape = false,
  tapeKind,
  fastener = false,
  fastenerTone,
  rules,
  shadow,
  seed,
  onInteractOutside,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> &
  DialogPaperProps & {
    showCloseButton?: boolean
  }) {
  const scope = useInkScope()
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 overflow-y-auto pointer-events-none">
        <DialogPrimitive.Content
          {...props}
          onInteractOutside={(e) => {
            onInteractOutside?.(e)
            if ((e.target as Element | null)?.closest?.("[data-sonner-toaster]")) e.preventDefault()
          }}
          className={cn(
            "pointer-events-auto relative w-full max-w-lg m-auto outline-none focus:outline-none",
            "data-[state=open]:animate-sheet-drop duration-(--ll-dur-fade) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            className
          )}
        >
          <Paper
            data-slot="dialog-content"
            stock={stock}
            edge={edge}
            tilt={tilt}
            tape={tape}
            tapeKind={tapeKind}
            fastener={fastener}
            fastenerTone={fastenerTone}
            rules={rules ?? "none"}
            shadow={shadow}
            seed={seed}
            {...scope}
            className="group/dialog relative grid w-full gap-4 p-6 text-foreground outline-hidden compact:p-5 calm:p-4"
          >
            {children}
            {showCloseButton && <DialogCloseMark seed={seed === undefined ? undefined : `${seed}|x`} />}
          </Paper>
        </DialogPrimitive.Content>
      </div>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center group-has-[[data-part=x]]/dialog:sm:pe-8 sm:text-start", className)}
      {...props}
    />
  )
}

function DialogBody({ className, tabIndex = 0, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      tabIndex={tabIndex}
      className={cn("-mx-2 max-h-[min(60dvh,32rem)] min-h-0 overflow-y-auto px-2 py-1 text-[15px] outline-hidden focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div data-slot="dialog-footer" className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props}>
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn("font-script text-[1.7rem] leading-none font-semibold", className)} {...props} />
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
