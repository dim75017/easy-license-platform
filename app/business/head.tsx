const retailImagePreloads = [
  "/images/unsplash/retail/store.webp",
  "/images/unsplash/retail/office.webp",
  "/images/unsplash/retail/restaurant.webp",
  "/images/unsplash/retail/hotel.webp",
  "/images/unsplash/retail/gym.webp",
  "/images/unsplash/retail/spa.webp",
];

export default function Head() {
  return retailImagePreloads.map((href) => (
    <link key={href} rel="preload" as="image" type="image/webp" href={href} />
  ));
}
