# Landing Page Spec — gruai.com

Build a single-page landing page for gruai (an AI agent company framework).

## Visual Aesthetic
- **Pixel art / retro game style** — 8-bit inspired design throughout
- CSS pixel art techniques: `box-shadow` pixel art, bitmap-style fonts, 8-bit color palette
- Scanline effects, CRT glow, pixel borders
- Animated pixel art characters representing AI agents at work
- Dark background with vibrant neon accent colors (think retro arcade)

## Technical Requirements
- **Single self-contained HTML file** (index.html)
- All CSS inline or in a `<style>` tag — no external stylesheets
- All JavaScript inline in a `<script>` tag — no external scripts
- No external dependencies (no CDNs, no npm packages, no Google Fonts links)
- Responsive design: must look good on mobile (320px), tablet (768px), and desktop (1200px+)
- Semantic HTML5 elements

## Required Sections (in order)

### 1. Hero
- Large pixel art logo/title "gruai"
- Animated pixel art scene (agents working at desks, typing, collaborating)
- Tagline: "Your AI Company, Running Autonomously"
- Primary CTA button: "Get Started" (pixel art button style)

### 2. Features Grid
- 2x3 or 3x2 grid of feature cards
- Each card has a pixel art icon, title, and 1-2 sentence description
- Features to highlight:
  - Autonomous Agent Teams
  - Context Tree Architecture
  - Pipeline Orchestration
  - Multi-Platform Support
  - Role-Based Agents (CEO, CTO, COO, Engineers)
  - Built-in Quality Gates

### 3. How It Works
- 3-step visual flow with pixel art illustrations
- Step 1: "Initialize" — `npx gru-ai init` command in a pixel terminal
- Step 2: "Create Directive" — show directive structure
- Step 3: "Agents Execute" — show agents building autonomously

### 4. Agent Showcase
- Visual display of agent roles as pixel art characters
- CEO, CTO, COO, Frontend Dev, Backend Dev, QA Engineer
- Each with name, role title, and 1-line description
- Arranged in an org chart or team grid layout

### 5. Pricing / Plans
- 3-tier pricing cards (pixel art card style)
- Starter (4 agents), Standard (7 agents), Full (11 agents)
- Feature comparison list per tier
- "Choose Plan" pixel art buttons

### 6. Call to Action (Footer)
- Final CTA: "Build Your AI Company Today"
- Links: GitHub, Docs, Discord (use # as href placeholders)
- Copyright line

## Color Palette (8-bit inspired)
- Background: #0a0a1a (deep navy/black)
- Primary: #00ff88 (neon green)
- Secondary: #ff6b9d (hot pink)
- Accent: #00d4ff (cyan)
- Warning: #ffaa00 (amber)
- Text: #e0e0e0 (light gray)
- Muted: #4a4a6a (dim purple-gray)

## Typography
- Use CSS `font-family` with monospace/pixel-style fallbacks
- Consider using `image-rendering: pixelated` for any pixel art assets
- Headings should feel chunky/blocky (large letter-spacing, uppercase)

## Animations
- Hero scene: subtle idle animations (characters typing, blinking cursors)
- Feature cards: hover glow effect
- How It Works: step-by-step reveal on scroll (CSS-only preferred)
- CTA buttons: pixel-art hover state (color shift, slight scale)
