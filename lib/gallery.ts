// Add your photos and files here. Put images in public/gallery/ and reference by path.
export type GalleryItem = {
  id: string;
  title: string;
  description?: string;
  src: string; // e.g. "/gallery/photo.jpg"
  type: "image" | "file";
};

export const galleryItems: GalleryItem[] = [
  // Example – add real items once you have files in public/gallery/
  // { id: "1", title: "Sunset", description: "A nice evening.", src: "/gallery/sunset.jpg", type: "image" },
];
