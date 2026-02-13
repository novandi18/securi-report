"use client";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-stroke bg-white px-4 py-4 dark:border-stroke-dark dark:bg-gray-dark md:px-6 2xl:px-10">
      <div className="mx-auto flex max-w-screen-2xl flex-col items-center justify-between gap-2 text-xs text-dark-5 dark:text-dark-6 sm:flex-row">
        <p>
          &copy; {currentYear}{" "}
          <span className="font-semibold text-dark dark:text-white">
            DEIT REPORTING
          </span>
          . All rights reserved.
        </p>
        <div className="flex items-center gap-4">
          <span>v1.0.0</span>
          <span className="hidden h-3 w-px bg-stroke dark:bg-stroke-dark sm:block" />
          <span className="hidden sm:inline">
            Penetration Testing Report Management
          </span>
        </div>
      </div>
    </footer>
  );
}
