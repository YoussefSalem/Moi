# Required Public Images

Place the following image files in this `public/` directory:

| File | Description |
|------|-------------|
| `hero-image.jpeg` | Full-screen hero background image (min 2400×3200px, portrait orientation, model wearing the MOI WAVVY or VERSA TOP) |

## Tips

- Use a high-resolution JPG (quality 85–90) for best loading performance
- Compress with [Squoosh](https://squoosh.app/) or similar before publishing
- Aspect ratio: 3:4 portrait preferred; image is CSS object-fit: cover so any ratio works
- The hero fallback image is referenced in `app/components/HeroVideo.tsx` as `HERO_FALLBACK`
