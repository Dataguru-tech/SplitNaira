import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
      {/* Large decorative 404 */}
      <p className="font-display text-[clamp(6rem,20vw,12rem)] leading-none font-bold tracking-tighter text-transparent"
         style={{ WebkitTextStroke: "2px var(--brand-accent)" }}>
        404
      </p>

      {/* Heading */}
      <h1 className="mt-4 font-display text-3xl font-bold text-[var(--brand-text)]">
        Page not found
      </h1>

      {/* Description */}
      <p className="mt-3 max-w-sm text-[var(--brand-muted)] leading-relaxed">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
        Check the URL or head back to the homepage.
      </p>

      {/* CTA */}
      <Link
        href="/"
        className="premium-button mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-6 py-3 font-semibold text-white"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        Back to home
      </Link>

      {/* Subtle bottom-accent line */}
      <div className="mt-16 h-px w-24 bg-[var(--brand-accent)] opacity-40" />
    </main>
  );
}
