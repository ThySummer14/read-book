const createSVGElement = tag =>
    document.createElementNS('http://www.w3.org/2000/svg', tag)

let overlayerCounter = 0
const hitRectsKey = '__foliateHitRects'
const hoverHandlerKey = '__foliateSetHover'

const copyRect = ({ left, top, right, bottom, width, height }) => ({
    left,
    top,
    right,
    bottom,
    width: width ?? right - left,
    height: height ?? bottom - top,
})

const getElementHitRects = element =>
    Array.isArray(element?.[hitRectsKey])
        ? element[hitRectsKey].map(copyRect)
        : null

export class Overlayer {
    #svg = createSVGElement('svg')
    #map = new Map()
    #doc = null
    #clipPath = null
    #clipPathPath = null
    #clipPathId
    #hoveredKey = null

    constructor(doc) {
        this.#doc = doc
        this.#clipPathId = `foliate-loupe-clip-${overlayerCounter++}`
        Object.assign(this.#svg.style, {
            position: 'absolute', top: '0', left: '0',
            width: '100%', height: '100%',
            pointerEvents: 'none',
        })

        // Create a clipPath to cut a hole for the loupe.
        // We use clip-rule="evenodd" with a large outer rect and inner circle
        // to create the hole effect efficiently without mask compositing.
        const defs = createSVGElement('defs')
        this.#clipPath = createSVGElement('clipPath')
        this.#clipPath.setAttribute('id', this.#clipPathId)
        this.#clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse')

        this.#clipPathPath = createSVGElement('path')
        this.#clipPathPath.setAttribute('clip-rule', 'evenodd')
        this.#clipPathPath.setAttribute('fill-rule', 'evenodd') // for older renderers

        this.#clipPath.append(this.#clipPathPath)
        defs.append(this.#clipPath)
        this.#svg.append(defs)
    }

    setHole(cx, cy, w, h, r) {
        // Define a path with a large outer rect and a capsule-shaped hole.
        // The capsule is a rounded rectangle (stadium shape) centred at (cx, cy).
        const outer = 'M -2000000 -2000000 H 4000000 V 4000000 H -2000000 Z'
        const hw = w / 2, hh = h / 2
        const cr = Math.min(r, hw, hh) // clamp corner radius
        const inner = `M ${cx - hw + cr} ${cy - hh}`
            + ` H ${cx + hw - cr}`
            + ` A ${cr} ${cr} 0 0 1 ${cx + hw} ${cy - hh + cr}`
            + ` V ${cy + hh - cr}`
            + ` A ${cr} ${cr} 0 0 1 ${cx + hw - cr} ${cy + hh}`
            + ` H ${cx - hw + cr}`
            + ` A ${cr} ${cr} 0 0 1 ${cx - hw} ${cy + hh - cr}`
            + ` V ${cy - hh + cr}`
            + ` A ${cr} ${cr} 0 0 1 ${cx - hw + cr} ${cy - hh} Z`
        this.#clipPathPath.setAttribute('d', `${outer} ${inner}`)

        this.#svg.setAttribute('clip-path', `url(#${this.#clipPathId})`)
        this.#svg.style.webkitClipPath = `url(#${this.#clipPathId})`
    }

    clearHole() {
        this.#svg.removeAttribute('clip-path')
        this.#svg.style.webkitClipPath = ''
        this.#clipPathPath.removeAttribute('d')
    }

    get element() {
        return this.#svg
    }
    get #zoom() {
        // Safari does not zoom the client rects, while Chrome, Edge and Firefox does
        if (/^((?!chrome|android).)*AppleWebKit/i.test(navigator.userAgent) && !window.chrome) {
            return window.getComputedStyle(this.#doc.body).zoom || 1.0
        }
        return 1.0
    }
    #splitRangeByParagraph(range) {
        const ancestor = range.commonAncestorContainer
        const paragraphs = Array.from(ancestor.querySelectorAll?.('p, h1, h2, h3, h4') || [])

        const splitRanges = []
        paragraphs.forEach((p) => {
            const pRange = document.createRange()
            if (range.intersectsNode(p)) {
                pRange.selectNodeContents(p)
                if (pRange.compareBoundaryPoints(Range.START_TO_START, range) < 0) {
                    pRange.setStart(range.startContainer, range.startOffset)
                }
                if (pRange.compareBoundaryPoints(Range.END_TO_END, range) > 0) {
                    pRange.setEnd(range.endContainer, range.endOffset)
                }
                splitRanges.push(pRange)
            }
        })
        return splitRanges.length === 0 ? [range] : splitRanges
    }
    add(key, range, draw, options) {
        if (this.#map.has(key)) this.remove(key)
        if (typeof range === 'function') range = range(this.#svg.getRootNode())
        const zoom = this.#zoom
        let rects = []
        this.#splitRangeByParagraph(range).forEach((pRange) => {
            const pRects = Array.from(pRange.getClientRects()).map(rect => ({
                left: rect.left * zoom,
                top: rect.top * zoom,
                right: rect.right * zoom,
                bottom: rect.bottom * zoom,
                width: rect.width * zoom,
                height: rect.height * zoom,
            }))
            rects = rects.concat(pRects)
        })
        const element = draw(rects, options)
        this.#svg.append(element)
        const hitRects = getElementHitRects(element)
        this.#map.set(key, { range, draw, options, element, rects, hitRects })
    }
    remove(key) {
        if (!this.#map.has(key)) return
        if (this.#hoveredKey === key) this.#hoveredKey = null
        this.#svg.removeChild(this.#map.get(key).element)
        this.#map.delete(key)
    }
    redraw() {
        for (const [key, obj] of this.#map.entries()) {
            const { range, draw, options, element } = obj
            this.#svg.removeChild(element)
            const zoom = this.#zoom
            let rects = []
            this.#splitRangeByParagraph(range).forEach((pRange) => {
                const pRects = Array.from(pRange.getClientRects()).map(rect => ({
                    left: rect.left * zoom,
                    top: rect.top * zoom,
                    right: rect.right * zoom,
                    bottom: rect.bottom * zoom,
                    width: rect.width * zoom,
                    height: rect.height * zoom,
                }))
                rects = rects.concat(pRects)
            })
            const el = draw(rects, options)
            this.#svg.append(el)
            obj.element = el
            obj.rects = rects
            obj.hitRects = getElementHitRects(el)
            if (this.#hoveredKey === key) {
                el[hoverHandlerKey]?.(true)
            }
        }
    }
    setHover(key) {
        if (this.#hoveredKey === key) return
        if (this.#hoveredKey && this.#map.has(this.#hoveredKey)) {
            this.#map.get(this.#hoveredKey).element?.[hoverHandlerKey]?.(false)
        }
        this.#hoveredKey = key
        if (key && this.#map.has(key)) {
            this.#map.get(key).element?.[hoverHandlerKey]?.(true)
        }
    }
    hitTest({ x, y }) {
        const arr = Array.from(this.#map.entries())
        const hitRectMatches = []
        for (let i = arr.length - 1; i >= 0; i--) {
            const [key, obj] = arr[i]
            if (!obj.hitRects?.length) continue
            for (const rect of obj.hitRects) {
                const { left, top, right, bottom, width, height } = rect
                if (top <= y && left <= x && bottom > y && right > x) {
                    const cx = left + width / 2
                    const cy = top + height / 2
                    hitRectMatches.push({
                        key,
                        obj,
                        rect,
                        order: i,
                        distance: ((x - cx) ** 2) / (width ** 2 || 1)
                            + ((y - cy) ** 2) / (height ** 2 || 1),
                    })
                }
            }
        }
        if (hitRectMatches.length) {
            hitRectMatches.sort((a, b) => a.distance - b.distance || b.order - a.order)
            const { key, obj, rect } = hitRectMatches[0]
            return [key, obj.range, rect]
        }

        // loop in reverse to hit more recently added items first
        for (let i = arr.length - 1; i >= 0; i--) {
            const tolerance = 5
            const [key, obj] = arr[i]
            if (obj.hitRects?.length) continue
            for (const { left, top, right, bottom } of obj.rects) {
                if (
                    top <= y + tolerance &&
                    left <= x + tolerance &&
                    bottom > y - tolerance &&
                    right > x - tolerance
                ) {
                    return [key, obj.range, { left, top, right, bottom }]
                }
            }
        }
        return []
    }
    static underline(rects, options = {}) {
        const { color = 'red', width: strokeWidth = 2, padding = 0, writingMode } = options
        const g = createSVGElement('g')
        g.setAttribute('fill', color)
        if (writingMode === 'vertical-rl' || writingMode === 'vertical-lr')
            for (const { right, top, height } of rects) {
                const el = createSVGElement('rect')
                el.setAttribute('x', right - strokeWidth / 2 + padding)
                el.setAttribute('y', top)
                el.setAttribute('height', height)
                el.setAttribute('width', strokeWidth)
                g.append(el)
            }
        else for (const { left, bottom, width } of rects) {
            const el = createSVGElement('rect')
            el.setAttribute('x', left)
            el.setAttribute('y', bottom - strokeWidth / 2 + padding)
            el.setAttribute('height', strokeWidth)
            el.setAttribute('width', width)
            g.append(el)
        }
        return g
    }
    static strikethrough(rects, options = {}) {
        const { color = 'red', width: strokeWidth = 2, writingMode } = options
        const g = createSVGElement('g')
        g.setAttribute('fill', color)
        if (writingMode === 'vertical-rl' || writingMode === 'vertical-lr')
            for (const { right, left, top, height } of rects) {
                const el = createSVGElement('rect')
                el.setAttribute('x', (right + left) / 2)
                el.setAttribute('y', top)
                el.setAttribute('height', height)
                el.setAttribute('width', strokeWidth)
                g.append(el)
            }
        else for (const { left, top, bottom, width } of rects) {
            const el = createSVGElement('rect')
            el.setAttribute('x', left)
            el.setAttribute('y', (top + bottom) / 2)
            el.setAttribute('height', strokeWidth)
            el.setAttribute('width', width)
            g.append(el)
        }
        return g
    }
    static squiggly(rects, options = {}) {
        const { color = 'red', width: strokeWidth = 2, padding = 0, writingMode } = options
        const g = createSVGElement('g')
        g.setAttribute('fill', 'none')
        g.setAttribute('stroke', color)
        g.setAttribute('stroke-width', strokeWidth)
        const block = strokeWidth * 1.5
        if (writingMode === 'vertical-rl' || writingMode === 'vertical-lr')
            for (const { right, top, height } of rects) {
                const el = createSVGElement('path')
                const n = Math.round(height / block / 1.5)
                const inline = height / n
                const ls = Array.from({ length: n },
                    (_, i) => `l${i % 2 ? -block : block} ${inline}`).join('')
                el.setAttribute('d', `M${right - strokeWidth / 2 + padding} ${top}${ls}`)
                g.append(el)
            }
        else for (const { left, bottom, width } of rects) {
            const el = createSVGElement('path')
            const n = Math.round(width / block / 1.5)
            const inline = width / n
            const ls = Array.from({ length: n },
                (_, i) => `l${inline} ${i % 2 ? block : -block}`).join('')
            el.setAttribute('d', `M${left} ${bottom + strokeWidth / 2 + padding}${ls}`)
            g.append(el)
        }
        return g
    }
    static highlight(rects, options = {}) {
        const {
            color = 'red',
            padding = 0,
            radius = 4,
            radiusPadding = 2,
            vertical = false,
        } = options

        const g = createSVGElement('g')
        g.setAttribute('fill', color)
        g.style.opacity = 'var(--overlayer-highlight-opacity, .3)'
        g.style.mixBlendMode = 'var(--overlayer-highlight-blend-mode, normal)'

        for (const [index, { left, top, height, width }] of rects.entries()) {
            const isFirst = index === 0
            const isLast = index === rects.length - 1

            let x, y, w, h

            let radiusTopLeft, radiusTopRight, radiusBottomRight, radiusBottomLeft

            if (vertical) {
                x = left - padding
                y = top - padding - (isFirst ? radiusPadding : 0)
                w = width + padding * 2
                h = height + padding * 2 + (isFirst ? radiusPadding : 0) + (isLast ? radiusPadding : 0)
                radiusTopLeft = isFirst ? radius : 0
                radiusTopRight = isFirst ? radius : 0
                radiusBottomRight = isLast ? radius : 0
                radiusBottomLeft = isLast ? radius : 0
            } else {
                x = left - padding - (isFirst ? radiusPadding : 0)
                y = top - padding
                w = width + padding * 2 + (isFirst ? radiusPadding : 0) + (isLast ? radiusPadding : 0)
                h = height + padding * 2
                radiusTopLeft = isFirst ? radius : 0
                radiusTopRight = isLast ? radius : 0
                radiusBottomRight = isLast ? radius : 0
                radiusBottomLeft = isFirst ? radius : 0
            }

            const rtl = Math.min(radiusTopLeft, w / 2, h / 2)
            const rtr = Math.min(radiusTopRight, w / 2, h / 2)
            const rbr = Math.min(radiusBottomRight, w / 2, h / 2)
            const rbl = Math.min(radiusBottomLeft, w / 2, h / 2)

            if (rtl === 0 && rtr === 0 && rbr === 0 && rbl === 0) {
                const el = createSVGElement('rect')
                el.setAttribute('x', x)
                el.setAttribute('y', y)
                el.setAttribute('height', h)
                el.setAttribute('width', w)
                g.append(el)
            } else {
                const el = createSVGElement('path')
                const d = `
                M ${x + rtl} ${y}
                L ${x + w - rtr} ${y}
                ${rtr > 0 ? `Q ${x + w} ${y} ${x + w} ${y + rtr}` : `L ${x + w} ${y}`}
                L ${x + w} ${y + h - rbr}
                ${rbr > 0 ? `Q ${x + w} ${y + h} ${x + w - rbr} ${y + h}` : `L ${x + w} ${y + h}`}
                L ${x + rbl} ${y + h}
                ${rbl > 0 ? `Q ${x} ${y + h} ${x} ${y + h - rbl}` : `L ${x} ${y + h}`}
                L ${x} ${y + rtl}
                ${rtl > 0 ? `Q ${x} ${y} ${x + rtl} ${y}` : `L ${x} ${y}`}
                Z
            `.trim().replace(/\s+/g, ' ')
                el.setAttribute('d', d)
                g.append(el)
            }
        }
        return g
    }
    static outline(rects, options = {}) {
        const { color = 'red', width: strokeWidth = 3, padding = 0, radius = 3 } = options
        const g = createSVGElement('g')
        g.setAttribute('fill', 'none')
        g.setAttribute('stroke', color)
        g.setAttribute('stroke-width', strokeWidth)
        for (const { left, top, height, width } of rects) {
            const el = createSVGElement('rect')
            el.setAttribute('x', left - padding)
            el.setAttribute('y', top - padding)
            el.setAttribute('height', height + padding * 2)
            el.setAttribute('width', width + padding * 2)
            el.setAttribute('rx', radius)
            g.append(el)
        }
        return g
    }
    static bubble(rects, options = {}) {
        const {
            color = '#fbbf24',
            writingMode,
            opacity = 0.85,
            size = 20,
            padding = 10,
            hitSize,
            includeRangeHit = false,
            ariaLabel = 'View annotation',
        } = options
        const isVertical = writingMode === 'vertical-rl' || writingMode === 'vertical-lr'
        const g = createSVGElement('g')
        g.style.opacity = opacity
        g.style.cursor = 'pointer'
        g.setAttribute('class', 'foliate-note-bubble')
        g.setAttribute('role', 'button')
        g.setAttribute('tabindex', '0')
        g.setAttribute('aria-label', ariaLabel)
        if (rects.length === 0) return g
        const firstRect = rects[0]
        const x = isVertical ? firstRect.right - size + padding : firstRect.right - size + padding
        const y = isVertical ? firstRect.bottom - size + padding : firstRect.top - size + padding
        const minimumHitSize = Math.max(hitSize ?? size + padding * 2, size)
        const hitLeft = x + size / 2 - minimumHitSize / 2
        const hitTop = y + size / 2 - minimumHitSize / 2
        const hitRect = {
            left: hitLeft,
            top: hitTop,
            right: hitLeft + minimumHitSize,
            bottom: hitTop + minimumHitSize,
            width: minimumHitSize,
            height: minimumHitSize,
        }
        g[hitRectsKey] = includeRangeHit
            ? [hitRect, ...rects.map(copyRect)]
            : [hitRect]

        const title = createSVGElement('title')
        title.textContent = ariaLabel
        const hitArea = createSVGElement('rect')
        hitArea.setAttribute('class', 'foliate-note-bubble-hit-area')
        hitArea.setAttribute('x', hitRect.left)
        hitArea.setAttribute('y', hitRect.top)
        hitArea.setAttribute('width', hitRect.width)
        hitArea.setAttribute('height', hitRect.height)
        hitArea.setAttribute('rx', Math.min(10, minimumHitSize / 4))
        hitArea.setAttribute('fill', 'transparent')
        hitArea.setAttribute('pointer-events', 'all')

        const bubble = createSVGElement('path')
        bubble.setAttribute('class', 'foliate-note-bubble-shape')
        const s = size
        const r = s * 0.15
        // Speech bubble shape with a small tail
        // Main rounded rectangle body
        const d = `
            M ${x + r} ${y}
            h ${s - 2 * r}
            a ${r} ${r} 0 0 1 ${r} ${r}
            v ${s * 0.65 - 2 * r}
            a ${r} ${r} 0 0 1 ${-r} ${r}
            h ${-s * 0.3}
            l ${-s * 0.15} ${s * 0.2}
            l ${s * 0.05} ${-s * 0.2}
            h ${-s * 0.6 + 2 * r}
            a ${r} ${r} 0 0 1 ${-r} ${-r}
            v ${-s * 0.65 + 2 * r}
            a ${r} ${r} 0 0 1 ${r} ${-r}
            z
        `.replace(/\s+/g, ' ').trim()

        bubble.setAttribute('d', d)
        bubble.setAttribute('fill', color)
        bubble.setAttribute('stroke', 'rgba(0, 0, 0, 0.2)')
        bubble.setAttribute('stroke-width', '1')
        // Add horizontal lines inside to represent text
        const lineGroup = createSVGElement('g')
        lineGroup.setAttribute('stroke', 'rgba(0, 0, 0, 0.3)')
        lineGroup.setAttribute('stroke-width', '1.5')
        lineGroup.setAttribute('stroke-linecap', 'round')
        const lineY1 = y + s * 0.18
        const lineY2 = y + s * 0.33
        const lineY3 = y + s * 0.48
        const lineX1 = x + s * 0.2
        const lineX2 = x + s * 0.8
        const line1 = createSVGElement('line')
        line1.setAttribute('x1', lineX1)
        line1.setAttribute('y1', lineY1)
        line1.setAttribute('x2', lineX2)
        line1.setAttribute('y2', lineY1)
        const line2 = createSVGElement('line')
        line2.setAttribute('x1', lineX1)
        line2.setAttribute('y1', lineY2)
        line2.setAttribute('x2', lineX2)
        line2.setAttribute('y2', lineY2)
        const line3 = createSVGElement('line')
        line3.setAttribute('x1', lineX1)
        line3.setAttribute('y1', lineY3)
        line3.setAttribute('x2', x + s * 0.6)
        line3.setAttribute('y2', lineY3)
        lineGroup.append(line1, line2, line3)

        if (isVertical) {
            const centerX = x + s / 2
            const centerY = y + s / 2
            bubble.setAttribute('transform', `rotate(90 ${centerX} ${centerY})`)
            lineGroup.setAttribute('transform', `rotate(90 ${centerX} ${centerY})`)
        }

        g[hoverHandlerKey] = active => {
            g.style.filter = active ? 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.28))' : ''
            bubble.setAttribute('stroke', active ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.2)')
            bubble.setAttribute('stroke-width', active ? '1.5' : '1')
        }

        g.append(title)
        g.append(hitArea)
        g.append(bubble)
        g.append(lineGroup)
        return g
    }
    // make an exact copy of an image in the overlay
    // one can then apply filters to the entire element, without affecting them;
    // it's a bit silly and probably better to just invert images twice
    // (though the color will be off in that case if you do heu-rotate)
    static copyImage([rect], options = {}) {
        const { src } = options
        const image = createSVGElement('image')
        const { left, top, height, width } = rect
        image.setAttribute('href', src)
        image.setAttribute('x', left)
        image.setAttribute('y', top)
        image.setAttribute('height', height)
        image.setAttribute('width', width)
        return image
    }
}
