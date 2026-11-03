import { wash } from '@/lib/ink/fills'
import { roundRectPoly } from '@/lib/ink/geom'
import { clamp } from '@/lib/ink/rng'
import { box } from '@/lib/ink/shapes'
import { defineRecipe } from '@/lib/ink/recipes'

export const KEY_DEPTH = 2.4

export const kbdRecipe = defineRecipe<Record<string, never>>({
  id: 'kbd',
  kind: 'keycap',
  layers: ['rest'],
  pad: 12,
  draw(ink, { w, h }, _p, ctx) {
    const calm = ctx.calm
    const d = calm ? 0 : KEY_DEPTH
    const fw = w - d
    const fh = h - d
    const r = clamp(Math.min(fw, fh) * 0.16, 2, 3.4)
    ink.layer('rest', () => {
      if (!calm) ink.group({ part: 'depth', hideOn: 'pressed' }, () => ink.poly('wash', roundRectPoly(d, d, fw, fh, r), 'current', 0.3), 'under')
      ink.poly('under', roundRectPoly(0.5, 0.5, fw - 1, fh - 1, r), 'slip', 1)
      wash(ink, roundRectPoly(1.4, 1.4, fw - 2.8, fh - 2.8, r), 'current', { alpha: 0.09, material: 'wash' })
      box(ink, 0, 0, fw, fh, { pen: 'pencil', corner: r, loose: 0.6, opts: { color: 'current', width: 1, alpha: 0.85, simple: true } })
    })
  },
})
