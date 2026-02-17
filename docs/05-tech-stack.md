# FairDraft – Tech Stack

This document lists the technologies used (and planned), why they were chosen, and key tradeoffs.

---

## Core App

### React
**Why**
- Component-based UI fits a “tabs + cards + forms” app perfectly.
- Huge ecosystem and community support.

**Advantages**
- Fast iteration, easy to structure UI into reusable components.
- Works great with Tailwind and PWA workflows.

**Drawbacks**
- Requires discipline to avoid state spaghetti as app grows (mitigated by simple state patterns early).

---

### TypeScript
**Why**
- Data model heavy app (players/presets/results) benefits massively from types.

**Advantages**
- Prevents many bugs early (especially around optional criteria).
- Makes refactors safe.

**Drawbacks**
- Slight extra friction when moving fast (worth it).

---

### Vite
**Why**
- Fast dev server + simple build toolchain.
- Minimal config.

**Advantages**
- Quick startup, fast HMR.
- Easy deploy to static hosting (Vercel/Netlify).

**Drawbacks**
- Some plugins occasionally lag behind major Vite versions (rare issue).

---

## Styling / UI

### TailwindCSS
**Why**
- Mobile-first responsive UI is easier with utility-first CSS.
- Reduces “CSS drift” in solo projects.

**Advantages**
- Rapid UI building.
- Easy to enforce consistent spacing and sizing.
- Responsive rules are simple (breakpoints are built-in).

**Drawbacks**
- Class-heavy markup (mitigated by extracting components).
- Requires a bit of taste/discipline to keep UI consistent.

---

### shadcn/ui (planned)
**Why**
- Provides high-quality, modern components built on Radix.
- Not a locked-in dependency: components are copied into the project.

**Advantages**
- Fast to ship polished UI (dialogs, drawers, tabs, buttons).
- Accessible components by default (Radix).

**Drawbacks**
- You still own the components (updates are manual).
- Needs light styling decisions to keep a cohesive theme.

---

### Radix UI (indirect via shadcn)
**Why**
- Accessibility and consistent component behavior (dialog, dropdown, etc.)

**Advantages**
- “Just works” behavior across devices.
- A11y patterns handled for you.

**Drawbacks**
- Some primitives require styling + composition.

---

### Lucide Icons
**Why**
- Clean icon set, common in modern apps.

**Advantages**
- Lightweight, consistent style.

**Drawbacks**
- None significant.

---

## Offline / PWA

### vite-plugin-pwa
**Why**
- Easiest path to installable PWA with service worker and manifest.
- Offline-first app shell caching.

**Advantages**
- Installable app icon + standalone mode.
- App can work in airplane mode after first install.
- Auto-update support.

**Drawbacks**
- Service worker caching can be confusing during development (requires occasional “unregister SW” / hard refresh).
- Offline doesn’t apply to external services (payments require internet).

---

## Storage (No WiFi / No Backend)

### IndexedDB (browser storage)
**Why**
- Proper offline persistence on device.
- Suitable for structured data (players/presets/results).

**Advantages**
- Large storage capacity vs localStorage.
- Transactional storage (safer than writing one big JSON blob).

**Drawbacks**
- Native IndexedDB API is awkward (reason we use Dexie).

---

### Dexie (IndexedDB wrapper) — planned and recommended
**Why**
- Makes IndexedDB ergonomic and reliable for app development.

**Advantages**
- Simple schema definitions, versioning, migrations.
- Fast queries and updates (add/edit one player without rewriting everything).
- Well-known, stable library.

**Drawbacks**
- Another dependency (small).
- Requires light up-front schema planning (we keep schema minimal at first).

---

### Export/Import JSON (planned feature)
**Why**
- No accounts/no backend means users need portability and backup.

**Advantages**
- Easy device migration.
- User control over their data.

**Drawbacks**
- Manual step for the user (acceptable given no-accounts design).

---

## Deployment

### Vercel
**Why**
- Excellent static hosting for Vite builds.
- Simple GitHub integration, HTTPS, custom domains.

**Advantages**
- Set-and-forget deploys on push to main.
- Good caching/CDN defaults.
- Easy to roll back.

**Drawbacks**
- Platform dependence (low risk because app is static; easy to move later).

---

## Monetization (Optional / Later)

### Stripe Checkout (planned)
**Why**
- Easiest way to take one-time payments outside app stores.

**Advantages**
- Handles taxes/receipts/payment UI well.
- Lower fees than app store cuts.
- No account system required (can unlock on device after purchase).

**Drawbacks**
- Payment requires internet.
- “License/unlock” design must be careful (no backend makes it device-based unless you add a license server).

---

## Summary of Design Philosophy
- Offline-first, no backend
- Simple mobile-first UI (3 tabs + library)
- Local persistence via IndexedDB (Dexie)
- Deploy as static PWA on Vercel
- Keep complexity low until personal use-case is complete
