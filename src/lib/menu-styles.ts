import { cn } from "@/lib/utils"

export type MenuKind = "dropdown-menu" | "context-menu" | "menubar"

const ORIGIN: Record<MenuKind, string> = {
  "dropdown-menu": "origin-(--radix-dropdown-menu-content-transform-origin)",
  "context-menu": "origin-(--radix-context-menu-content-transform-origin)",
  menubar: "origin-(--radix-menubar-content-transform-origin)",
}

const AVAILABLE: Record<MenuKind, string> = {
  "dropdown-menu": "max-h-(--radix-dropdown-menu-content-available-height)",
  "context-menu": "max-h-(--radix-context-menu-content-available-height)",
  menubar: "max-h-(--radix-menubar-content-available-height)",
}

const SLIP =
  "z-(--ll-z-popover) min-w-32 max-w-[calc(100vw-1rem)] p-0 text-popover-foreground outline-hidden " +
  "data-[side]:[--ll-sheet-shadow:var(--ll-shadow-lift)] data-[side]:calm:[--ll-sheet-shadow:var(--ll-shadow-hair)] " +
  "duration-(--ll-dur-pop) data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 " +
  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"

export function menuContentClass(kind: MenuKind): string {
  return `${SLIP} ${ORIGIN[kind]}`
}

export function menuViewportClass(kind: MenuKind, extra?: string): string {
  return cn(`${AVAILABLE[kind]} overflow-x-hidden overflow-y-auto p-1 compact:p-0.5 calm:p-0.5`, extra)
}

const SCROLL = /^(?:max-h|overflow|overscroll)(?:-|$)/

function utilityOf(token: string): string {
  let depth = 0
  let cut = 0
  for (let i = 0; i < token.length; i++) {
    const ch = token[i]
    if (ch === "[" || ch === "(") depth++
    else if (ch === "]" || ch === ")") depth--
    else if (ch === ":" && depth === 0) cut = i + 1
  }
  return token.slice(cut).replace(/^[-!]+/, "").replace(/!$/, "")
}

export function splitMenuClass(className?: string): { content: string; viewport: string } {
  const content: string[] = []
  const viewport: string[] = []
  for (const token of (className ?? "").split(/\s+/).filter(Boolean)) (SCROLL.test(utilityOf(token)) ? viewport : content).push(token)
  return { content: content.join(" "), viewport: viewport.join(" ") }
}

const ROW =
  "relative flex min-h-8 w-full cursor-default items-center gap-2.5 py-1 ps-2.5 pe-2.5 font-hand text-base leading-6 outline-hidden select-none compact:min-h-7 compact:py-0.5 calm:min-h-7 calm:py-0.5 calm:text-[15px] " +
  "data-[highlighted]:ll-swipe data-[disabled]:pointer-events-none data-[disabled]:text-pencil-text " +
  "focus-visible:[box-shadow:inset_3px_0_0_0_var(--ll-ink-you)] rtl:focus-visible:[box-shadow:inset_-3px_0_0_0_var(--ll-ink-you)] " +
  "forced-colors:data-[highlighted]:bg-[color:Highlight]! forced-colors:data-[highlighted]:text-[color:HighlightText]! forced-colors:data-[highlighted]:[&_svg]:text-[color:HighlightText]! " +
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-ink-soft"

export const MENU_ITEM =
  `${ROW} data-[inset]:ps-9 ` +
  "data-[variant=destructive]:text-red data-[variant=destructive]:*:[svg]:text-red! " +
  "data-[variant=destructive]:data-[highlighted]:text-ink data-[variant=destructive]:data-[highlighted]:bg-[color-mix(in_srgb,var(--ll-red)_12%,transparent)] " +
  "data-[variant=destructive]:data-[highlighted]:[background-image:repeating-linear-gradient(118deg,color-mix(in_srgb,var(--ll-red)_55%,transparent)_0_1px,transparent_1px_5px)]"

export const MENU_CHOICE_ITEM = `${ROW} ps-9`

export const MENU_SUB_TRIGGER = `${ROW} data-[inset]:ps-9 data-[state=open]:ll-swipe forced-colors:data-[state=open]:bg-[color:Highlight]! forced-colors:data-[state=open]:text-[color:HighlightText]!`

export const MENU_LABEL = "px-2.5 py-1.5 font-type text-sm tracking-wide text-ink-muted data-[inset]:ps-9 calm:py-1"

export const MENU_SEPARATOR = "pointer-events-none my-1.5 w-auto calm:my-1"

export const MENU_INDICATOR = "pointer-events-none absolute start-2.5 top-1/2 grid size-4 -translate-y-1/2 place-items-center"

export const MENU_MARK = "absolute grid animate-[ll-wipe_var(--ll-dur-sheet)_var(--ll-ease-out)_both] text-ink-you forced-colors:text-[CanvasText]"

export const MENU_SHORTCUT = "ms-auto flex items-center gap-1 ps-4"

export const MENU_KEYCAP = "h-5 min-w-5 text-sm"

export type ShortcutKey = { icon: string; label: string } | { text: string }

const SYMBOL: Record<string, ShortcutKey> = {
  "⌘": { icon: "command", label: "Command" },
  "⇧": { text: "Shift" },
  "⌥": { text: "Alt" },
  "⌃": { text: "Ctrl" },
  "↵": { text: "Enter" },
  "⏎": { text: "Enter" },
  "⌫": { text: "Del" },
  "⎋": { text: "Esc" },
  "⇥": { text: "Tab" },
  "␣": { text: "Space" },
}

export function parseShortcut(input: string): ShortcutKey[] {
  const s = input.trim()
  if (!s) return []
  let parts: string[]
  if (s.includes("+") && s.length > 1) parts = s.split("+").filter(Boolean)
  else if (/\s/.test(s)) parts = s.split(/\s+/)
  else if (Array.from(s).some((c) => c in SYMBOL)) parts = Array.from(s)
  else parts = [s]
  return parts.map((p) => SYMBOL[p] ?? { text: p })
}
