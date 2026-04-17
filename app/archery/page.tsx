/**
 * Hidden practice page — not linked from the main site.
 * Direct URL: /archery
 */

export default function ArcheryPage() {
  return (
    <div className="space-y-10">
      <section>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#c8e6c9] sm:text-4xl">
          Moving targets
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-white/75">
          This page is a home for a game you are building: a <strong className="text-white/90">projector</strong>{" "}
          shows targets on a wall, a <strong className="text-white/90">camera</strong> watches the impact area, and
          when an <strong className="text-white/90">arrow</strong> hits, the projection can stop and the software
          can report whether you hit the target and how close you were.
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-[#a5d6a7]">Planned loop</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-white/80">
          <li>Calibrate projector image and camera view to the same wall region.</li>
          <li>Run a sequence of projected targets (position, size, motion).</li>
          <li>Detect impact (motion / sound / depth — you will choose the sensors).</li>
          <li>Freeze or clear the projection and show hit / miss plus offset from aim point.</li>
        </ol>
      </section>

      <section className="rounded-2xl border border-dashed border-white/20 bg-black/20 p-8 text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-white/45">Session</p>
        <p className="mt-2 text-lg text-white/70">Hardware not connected</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/50">
          When you wire up the projector and camera, this area can host live preview, calibration, and round
          controls. For now it is a placeholder so the route exists and you can iterate.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[#a5d6a7]">Next build steps (ideas)</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/65">
          <li>WebRTC or a small local bridge for the camera feed (browser security usually blocks raw USB).</li>
          <li>Canvas or WebGL layer aligned to projector keystone (or send frames to a native helper).</li>
          <li>Impact timing: peak motion in ROI after release, or microphone spike near wall.</li>
          <li>Scoring UI: bullseye overlay, distance in cm or “ring” score, save history to your DB if you want.</li>
        </ul>
      </section>
    </div>
  );
}
