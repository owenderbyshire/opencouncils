import { Icon, type IconName } from "./icons";

/** The top of a page: its title, an optional lede and anything that qualifies the title (term, filters). */
export function PageHeader({
  title,
  lede,
  children,
  kicker,
}: {
  title: React.ReactNode;
  lede?: React.ReactNode;
  children?: React.ReactNode;
  /** A short line above the title that places the page (e.g. "Plenary"). Use only when it adds information. */
  kicker?: React.ReactNode;
}) {
  return (
    <header className="pt-8 pb-6 sm:pt-12 sm:pb-8">
      {kicker ? (
        <div className="mb-2 text-small text-ink-2">{kicker}</div>
      ) : null}
      <h1 className="text-h1 sm:text-display max-w-[22ch]">{title}</h1>
      {lede ? (
        <div className="mt-4 max-w-[62ch] text-body text-ink-2 sm:text-read">
          {lede}
        </div>
      ) : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </header>
  );
}

/** A titled block within a page, optionally marked with one of the family's line icons. */
export function Section({
  title,
  id,
  aside,
  icon,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  id?: string;
  aside?: React.ReactNode;
  icon?: IconName;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={title && id ? `${id}-title` : undefined}
      className={`py-8 ${className}`}
    >
      {title ? (
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id={id ? `${id}-title` : undefined} className="flex items-center gap-2.5 text-h3">
            {icon ? <Icon name={icon} size={22} className="text-accent-strong" /> : null}
            {title}
          </h2>
          {aside ? <div className="text-small text-ink-2">{aside}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
