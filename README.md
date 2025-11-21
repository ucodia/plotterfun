# Plotterfun

Plotterfun is a collection of algorithms for turning images into vector art. The interface has been rebuilt as a modern React + Vite app that uses Tailwind CSS and [shadcn/ui](https://ui.shadcn.com/) components for a neutral look and feel.

The original algorithms now live as classic web workers inside `public/workers/`, so you can experiment with them without blocking the UI. The app lets you load an image, capture one from the webcam, adjust algorithm parameters, and download the generated SVG.

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. Open the provided local URL in your browser.

## Project structure

- `src/` – React components and styling.
- `public/workers/` – Legacy plotting algorithms and their helper scripts, served as classic workers.
- `public/workers/external/` – Third-party libraries used by some algorithms.

## Usage tips

- Drag the preview image to position it and scroll to zoom before running an algorithm.
- Each algorithm exposes its own controls; changing a setting either re-runs the worker or updates it live when supported.
- Use the **Download SVG** button to save the result for plotting in tools like Inkscape.

Pull requests for new algorithms are welcome—drop a new worker script into `public/workers/` and it will be available in the UI.
