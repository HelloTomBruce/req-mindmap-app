"use client"

import * as React from "react"

import { IconSizeContext, useInk, useMergedRef } from "@/lib/ink/react"
import { kbdRecipe } from "@/lib/ink/recipes/kbd-ink"
import { cn } from "@/lib/utils"

function Kbd({
  className,
  seed,
  ref,
  ...props
}: React.ComponentProps<"kbd"> & {
  seed?: string | number
}) {
  const { hostRef, hostProps, node } = useInk({ recipe: kbdRecipe, params: {}, kind: "keycap", seed, still: true })
  const { children, ...rest } = props
  return (
    <IconSizeContext value={14}>
      <kbd
        data-slot="kbd"
        data-ink-sink="self"
        ref={useMergedRef<HTMLElement>(hostRef, ref)}
        {...hostProps}
        className={cn(
          "relative isolate inline-flex h-6 w-fit min-w-6 items-center justify-center gap-1 pr-[6.4px] pl-1 pb-[2.4px] font-hand text-sm leading-none font-normal whitespace-nowrap text-muted-foreground select-none",
          "transition-[translate] duration-(--ll-dur-press) ease-out active:translate-y-[1.6px] [&[data-pressed]:not([data-pressed=false])]:translate-y-[1.6px]",
          "[&_svg]:pointer-events-none [&_svg:not(.absolute):not([class*='size-'])]:size-3.5",
          "calm:h-5 calm:pr-1 calm:pb-0",
          "[[data-slot=tooltip-content]_&]:text-inherit",
          className
        )}
        {...rest}
      >
        {node}
        {children}
      </kbd>
    </IconSizeContext>
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<"kbd">) {
  return <kbd data-slot="kbd-group" className={cn("inline-flex items-center gap-1", className)} {...props} />
}

export { Kbd, KbdGroup }
