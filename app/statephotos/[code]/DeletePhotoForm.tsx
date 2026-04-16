"use client";

import { deleteStatePhoto } from "./actions";

export default function DeletePhotoForm({ photoId }: { photoId: number }) {
  return (
    <form
      action={deleteStatePhoto}
      className="inline-form"
      onSubmit={(e) => {
        if (!confirm("Delete this photo?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="photo_id" value={photoId} />
      <button type="submit" className="btn-danger">
        Delete
      </button>
    </form>
  );
}
