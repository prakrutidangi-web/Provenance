/** Responsive photo: two widths via srcset, explicit dimensions (no layout shift), lazy unless above the fold. */
export interface PhotoSpec {
  name: string; // file stem in /public/images, e.g. "hero-engineers"
  widths: [number, number]; // [small, large]
  ratio: number; // width / height of the source
  alt: string;
}

export const PHOTOS = {
  hero: { name: "hero-engineers", widths: [1200, 2400], ratio: 1.5, alt: "Two engineers working at their desks in a bright office" },
  team: { name: "team-table", widths: [800, 1600], ratio: 1.5, alt: "A team working together on laptops around a wooden table" },
  code: { name: "code-screens", widths: [600, 1200], ratio: 2 / 3, alt: "Source code open on a monitor and a laptop" },
  desk: { name: "quiet-desk", widths: [1200, 2400], ratio: 1.5, alt: "A laptop on a dark wooden desk next to a white chair" },
} satisfies Record<string, PhotoSpec>;

export default function Photo({
  photo,
  sizes,
  priority = false,
  className,
}: {
  photo: PhotoSpec;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const [small, large] = photo.widths;
  return (
    <img
      className={className}
      src={`/images/${photo.name}-${small}.jpg`}
      srcSet={`/images/${photo.name}-${small}.jpg ${small}w, /images/${photo.name}-${large}.jpg ${large}w`}
      sizes={sizes}
      width={large}
      height={Math.round(large / photo.ratio)}
      alt={photo.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
    />
  );
}
