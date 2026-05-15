import { resume } from "@/lib/resume";
import ResumeCollapse from "@/components/ResumeCollapse";
import HeroWithHeadshot from "@/components/HeroWithHeadshot";

export default async function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-20">
      <HeroWithHeadshot
        name={resume.name}
        tagline={resume.tagline}
        website={resume.website}
      />

      {/* Collapsible resume at the bottom */}
      <section className="mt-10 sm:mt-16">
        <ResumeCollapse resume={resume} />
      </section>
    </main>
  );
}
