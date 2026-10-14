/**
 * Associate's `.page-head`: the title every dashboard page opens with, and an
 * optional line under it. `children` sit on the right (actions, filters).
 */
export default function PageHead({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-0">
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {title}
        </h1>
        {sub && <p className="mt-1.5 text-sm text-muted">{sub}</p>}
      </div>
      {children}
    </header>
  );
}

/** The padding a dashboard page sits in: Associate's 40px gutter, 16px on phones. */
export const PAGE = "px-4 pt-6 pb-20 sm:px-10 sm:pt-9";
