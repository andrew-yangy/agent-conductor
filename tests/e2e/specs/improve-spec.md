# Improve and Polish Spec — Landing Page Enhancement

Take the existing gruai landing page (index.html) and improve it without losing any content.

## Critical Constraint: Preserve Original Sections
All 6 original sections MUST remain present and functional after improvements:
1. Hero (with pixel art and CTA)
2. Features Grid (all 6 features)
3. How It Works (3 steps)
4. Agent Showcase (all agent roles)
5. Pricing / Plans (3 tiers)
6. Call to Action / Footer

**Regression check:** Any removed or broken section is a failure.

## Responsive Breakpoints
Add or refine responsive breakpoints:
- **Mobile** (max-width: 480px): Single column layout, stacked cards, touch-friendly tap targets (min 44px)
- **Tablet** (481px - 768px): 2-column grids, adjusted spacing
- **Small desktop** (769px - 1024px): Original layout with tighter margins
- **Large desktop** (1025px+): Full layout with max-width container

Verify each breakpoint produces a usable layout with no horizontal overflow.

## Accessibility (WCAG 2.1 AA)
- Add `aria-label` to all interactive elements (buttons, links)
- Add `role` attributes where semantic HTML is insufficient
- Ensure keyboard navigation works: all interactive elements focusable, visible focus indicators
- Color contrast: all text meets 4.5:1 ratio against its background (use WebAIM contrast checker)
- Add `alt` text to any images or decorative elements (use `alt=""` for purely decorative)
- Add skip-to-content link at the top of the page
- Ensure heading hierarchy is correct (h1 > h2 > h3, no skipped levels)

## Micro-Animations
- **Hover effects**: Subtle glow, scale, or color shift on interactive elements
- **Scroll reveals**: Sections fade in or slide up as they enter the viewport (CSS-only with `@keyframes` + intersection observer, or pure CSS `animation-timeline` if supported)
- **Button feedback**: Click/active state animation (press effect)
- **Loading transitions**: Smooth fade-in on page load
- **Reduced motion**: Respect `prefers-reduced-motion` media query — disable all animations

## Typography and Spacing Polish
- Consistent vertical rhythm: use a base spacing unit (e.g., 8px) and multiples
- Line height: body text 1.5-1.6, headings 1.1-1.3
- Paragraph max-width: 65-75 characters for readability
- Section padding: consistent top/bottom padding across all sections
- Card padding: consistent internal padding in all card components

## Performance
- Minimize CSS: remove unused rules, consolidate duplicates
- Ensure no layout shifts (CLS): set explicit dimensions on dynamic elements
- Keep the single-file constraint: everything stays in one HTML file
