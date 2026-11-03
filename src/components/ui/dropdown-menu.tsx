import * as React from "react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"

import { Icon } from "@/components/ui/icon"
import { Kbd } from "@/components/ui/kbd"
import { Paper, type PaperProps } from "@/components/ui/paper"
import { Separator } from "@/components/ui/separator"
import { useInkScope } from "@/lib/ink/react"
import {
  MENU_CHOICE_ITEM,
  MENU_INDICATOR,
  MENU_ITEM,
  MENU_KEYCAP,
  MENU_LABEL,
  MENU_MARK,
  MENU_SEPARATOR,
  MENU_SHORTCUT,
  MENU_SUB_TRIGGER,
  menuContentClass,
  menuViewportClass,
  parseShortcut,
  splitMenuClass,
} from "@/lib/menu-styles"
import { cn } from "@/lib/utils"

type PaperLook = Pick<PaperProps, "stock" | "edge" | "tilt" | "tape" | "seed">

function DropdownMenu({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
}

function DropdownMenuTrigger({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({
  className,
  sideOffset = 6,
  stock = "slip",
  edge,
  tilt = true,
  tape,
  seed,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content> & PaperLook) {
  const scope = useInkScope()
  const split = splitMenuClass(className)
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content asChild sideOffset={sideOffset} {...props}>
        <Paper data-slot="dropdown-menu-content" stock={stock} edge={edge} tilt={tilt} tape={tape} rules="none" seed={seed} {...scope} className={cn(menuContentClass("dropdown-menu"), split.content)}>
          <div data-slot="dropdown-menu-viewport" className={menuViewportClass("dropdown-menu", split.viewport)}>
            {children}
          </div>
        </Paper>
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return <DropdownMenuPrimitive.Item data-slot="dropdown-menu-item" data-inset={inset} data-variant={variant} className={cn(MENU_ITEM, className)} {...props} />
}

function DropdownMenuCheckboxItem({ className, children, checked, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem data-slot="dropdown-menu-checkbox-item" className={cn(MENU_CHOICE_ITEM, className)} checked={checked} {...props}>
      <span data-slot="dropdown-menu-item-indicator" className={MENU_INDICATOR}>
        <Icon name="square" size={16} className="absolute text-pencil-mark forced-colors:text-[CanvasText]" />
        <DropdownMenuPrimitive.ItemIndicator className={MENU_MARK}>
          <Icon name="check" size={22} className="-translate-y-px" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />
}

function DropdownMenuRadioItem({ className, children, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem data-slot="dropdown-menu-radio-item" className={cn(MENU_CHOICE_ITEM, className)} {...props}>
      <span data-slot="dropdown-menu-item-indicator" className={MENU_INDICATOR}>
        <Icon name="circle" size={16} className="absolute text-pencil-mark forced-colors:text-[CanvasText]" />
        <DropdownMenuPrimitive.ItemIndicator className={MENU_MARK}>
          <Icon name="dot" size={26} />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuLabel({ className, inset, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }) {
  return <DropdownMenuPrimitive.Label data-slot="dropdown-menu-label" data-inset={inset} className={cn(MENU_LABEL, className)} {...props} />
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator asChild {...props}>
      <Separator data-slot="dropdown-menu-separator" className={cn(MENU_SEPARATOR, className)} />
    </DropdownMenuPrimitive.Separator>
  )
}

function DropdownMenuShortcut({ className, children, ...props }: React.ComponentProps<"span">) {
  const keys = typeof children === "string" ? parseShortcut(children) : null
  return (
    <span data-slot="dropdown-menu-shortcut" className={cn(MENU_SHORTCUT, className)} {...props}>
      {keys
        ? keys.map((k, i) => (
            <Kbd key={i} className={MENU_KEYCAP}>{"icon" in k ? <Icon name={k.icon} label={k.label} /> : k.text}</Kbd>
          ))
        : children}
    </span>
  )
}

function DropdownMenuSub({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({ className, inset, children, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & { inset?: boolean }) {
  return (
    <DropdownMenuPrimitive.SubTrigger data-slot="dropdown-menu-sub-trigger" data-inset={inset} className={cn(MENU_SUB_TRIGGER, className)} {...props}>
      {children}
      <Icon name="chevron-right" size={16} className="ms-auto" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  alignOffset = -4,
  stock = "slip",
  edge,
  tilt = true,
  tape,
  seed,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent> & PaperLook) {
  const scope = useInkScope()
  const split = splitMenuClass(className)
  return (
    <DropdownMenuPrimitive.SubContent asChild alignOffset={alignOffset} {...props}>
      <Paper data-slot="dropdown-menu-sub-content" stock={stock} edge={edge} tilt={tilt} tape={tape} rules="none" seed={seed} {...scope} className={cn(menuContentClass("dropdown-menu"), split.content)}>
        <div data-slot="dropdown-menu-viewport" className={menuViewportClass("dropdown-menu", split.viewport)}>
          {children}
        </div>
      </Paper>
    </DropdownMenuPrimitive.SubContent>
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
