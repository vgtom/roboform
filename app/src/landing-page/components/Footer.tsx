import { Link } from "react-router-dom";

interface NavigationItem {
  name: string;
  href: string;
}

function FooterLink({ item, className }: { item: NavigationItem; className: string }) {
  const isExternal =
    item.href.startsWith("http") ||
    item.href.startsWith("//") ||
    item.href === "#";

  if (isExternal) {
    return (
      <a href={item.href} className={className}>
        {item.name}
      </a>
    );
  }
  return (
    <Link to={item.href} className={className}>
      {item.name}
    </Link>
  );
}

export default function Footer({
  footerNavigation,
}: {
  footerNavigation: {
    app: NavigationItem[];
    company: NavigationItem[];
    legal: NavigationItem[];
  };
}) {
  const linkClass =
    "text-sm leading-6 text-gray-600 hover:text-gray-900 dark:text-white";

  return (
    <div className="dark:bg-boxdark-2 mx-auto mt-6 max-w-7xl px-6 lg:px-8">
      <footer
        aria-labelledby="footer-heading"
        className="relative border-t border-gray-900/10 py-24 sm:mt-32 dark:border-gray-200/10"
      >
        <h2 id="footer-heading" className="sr-only">
          Footer
        </h2>
        <div className="mt-10 flex flex-wrap items-start justify-end gap-x-20 gap-y-10">
          <div>
            <h3 className="text-sm font-semibold leading-6 text-gray-900 dark:text-white">
              App
            </h3>
            <ul role="list" className="mt-6 space-y-4">
              {footerNavigation.app.map((item) => (
                <li key={item.name}>
                  <FooterLink item={item} className={linkClass} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-6 text-gray-900 dark:text-white">
              Company
            </h3>
            <ul role="list" className="mt-6 space-y-4">
              {footerNavigation.company.map((item) => (
                <li key={item.name}>
                  <FooterLink item={item} className={linkClass} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-6 text-gray-900 dark:text-white">
              Legal
            </h3>
            <ul role="list" className="mt-6 space-y-4">
              {footerNavigation.legal.map((item) => (
                <li key={item.name}>
                  <FooterLink item={item} className={linkClass} />
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-16 border-t border-gray-900/10 pt-8 text-center text-sm leading-6 text-gray-500 dark:border-gray-200/10 dark:text-gray-400">
          © 2026 VinForms
        </p>
      </footer>
    </div>
  );
}
