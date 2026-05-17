# TODO List

## Bug fixes and small improvements ( do these first)

- [x] the images on the featured page are being zoomed in and cropped weird, it should try to preserve the aspect ratio and fit the image within the container instead of cropping it.the car details page images are also being cropped. make sure to preserve the aspect ratio of all the images. the images source is 1920x1080px
  - Changed all car listing images from `object-fit: cover` to `object-fit: contain` with `aspect-ratio: 16/9` across featured cards, detail page gallery, related listings, search thumbnails, and PopularMakes carousel.

- [x] I want a way to refetch the car listings on the main website from the dashboard without refreshing the page. maybe a button that says "Refresh Listings" that triggers a refetch of the car listings data and updates the UI with the new data.
  - Converted listing pages to SSR (`prerender = false`): `index.astro`, `search/index.astro`, `sold/index.astro`, and `listing/[slug].astro`. Pages now fetch live data from WordPress on every request — no rebuild needed when listings change. `listing/[slug].astro` replaced `getStaticPaths()` with `Astro.params` + `getCarBySlug`.

- [x] the sold tag is not very prominent, we should make it more prominent it should cover around 60% of the image.
  - Replaced the small corner badge with a large diagonal "SOLD" ribbon (160% wide, rotated −30°) centered across the image, styled consistently across all listing card locations.
