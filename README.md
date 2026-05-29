# ⚾ Sports Card Generator

An AI-powered kiosk that turns your real athletic movements into a personalized sports card.

## What It Does

Step up, strike a pose, and walk away with a custom card — your stats calculated from actual body movement, your photo transformed by AI.

## Requirements

- Node.js 18+
- Python 3.10+
- Webcam
- OpenRouter API key

## Setup

```bash
npm install
```

Create a `.env` file:

```env
OPENROUTER_API_KEY=your_key_here
```

Set up Python environment:

```bash
cd vision
pip install opencv-python numpy requests ai-edge-litert
```

## Running

```bash
npm run dev -- --host
```

Open `http://localhost:4321/kiosk` for the kiosk experience.
