# Baseball Card Generator

An Astro + React project for creating custom baseball cards with team-themed borders and player stats.

## Features

- 📸 Upload player photos (JPG, PNG)
- 🎨 30 MLB teams with authentic color schemes
- 📊 Customizable player stats
- 🖼️ Live card preview
- ⚡ Built with Astro for fast performance

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
baseball-cards/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── BaseballCard.tsx    # Card display component
│   │   └── CardBuilder.tsx     # Form controls + preview
│   ├── data/
│   │   └── teams.ts            # Team colors & config
│   ├── layouts/
│   │   └── Layout.astro        # Base HTML layout
│   └── pages/
│       ├── index.astro         # Card builder page
│       └── gallery.astro       # Saved cards gallery
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
└── package.json
```

## Roadmap

- [ ] AI image stylization (make photos look like painted cards)
- [ ] Export cards as PNG/PDF
- [ ] Save cards to gallery (localStorage or database)
- [ ] Multiple card templates (vintage, modern, chrome)
- [ ] Batch card generation

## Tech Stack

- [Astro](https://astro.build) - Static site framework
- [React](https://react.dev) - UI components
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [TypeScript](https://typescriptlang.org) - Type safety

## License

MIT
