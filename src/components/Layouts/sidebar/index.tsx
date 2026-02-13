"use client";

import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_DATA } from "./data";
import { ArrowLeftIcon, ChevronUp, PanelLeftCloseIcon, PanelLeftOpenIcon } from "./icons";
import { MenuItem } from "./menu-item";
import { useSidebarContext } from "./sidebar-context";
import { useSession } from "next-auth/react";

export function Sidebar() {
  const pathname = usePathname();
  const { setIsOpen, isOpen, isMobile, isCollapsed, toggleSidebar, toggleCollapse } =
    useSidebarContext();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  const filteredNavData = NAV_DATA.map((section) => ({
    ...section,
    items: section.items
      .filter(
        (item) => !("adminOnly" in item && item.adminOnly) || userRole === "administrator",
      )
      .filter(
        (item) => !("viewerBlocked" in item && item.viewerBlocked) || userRole !== "viewer",
      )
      .map((item) => ({
        ...item,
        items: item.items.filter(
          (sub) => !("adminOnly" in sub && sub.adminOnly) || userRole === "administrator",
        ),
      })),
  }))
    .filter((section) => !("viewerBlocked" in section && section.viewerBlocked) || userRole !== "viewer")
    .filter((section) => section.items.length > 0);

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) => (prev.includes(title) ? [] : [title]));
  };

  useEffect(() => {
    filteredNavData.some((section) => {
      return section.items.some((item) => {
        return item.items.some((subItem) => {
          if (subItem.url === pathname) {
            if (!expandedItems.includes(item.title)) {
              toggleExpanded(item.title);
            }
            return true;
          }
        });
      });
    });
  }, [pathname]);

  // Collapsed tooltip & flyout state
  const [tooltip, setTooltip] = useState<{ title: string; top: number } | null>(null);
  const [flyout, setFlyout] = useState<{ title: string; items: { title: string; url: string }[]; top: number } | null>(null);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "overflow-hidden border-r border-gray-200 bg-white transition-[width] duration-200 ease-linear dark:border-gray-800 dark:bg-gray-dark",
          isMobile ? "fixed bottom-0 top-0 z-50" : "sticky top-0 z-40 h-screen",
          isMobile
            ? isOpen
              ? "w-[250px]"
              : "w-0"
            : isCollapsed
              ? "w-[64px]"
              : "w-[240px]",
        )}
        aria-label="Main navigation"
        aria-hidden={!isOpen && isMobile}
        inert={!isOpen && isMobile ? true : undefined}
      >
        <div
          className={cn(
            "flex h-full flex-col py-4",
            isCollapsed && !isMobile ? "items-center px-2" : "pl-4 pr-[7px]",
          )}
        >
          {/* Logo / Brand */}
          <div className={cn("relative shrink-0", isCollapsed && !isMobile ? "px-0" : "pr-4.5")}>
            <Link
              href={"/"}
              onClick={() => isMobile && toggleSidebar()}
              className={cn(
                "block py-1.5 min-[850px]:py-0",
                isCollapsed && !isMobile && "flex items-center justify-center",
              )}
            >
              {isCollapsed && !isMobile ? (
                <Image
                  src="/images/logo/logo-icon.svg"
                  width={28}
                  height={28}
                  alt=""
                  role="presentation"
                />
              ) : (
                <Logo />
              )}
            </Link>

            {isMobile && (
              <button
                onClick={toggleSidebar}
                className="absolute left-3/4 right-4.5 top-1/2 -translate-y-1/2 text-right"
              >
                <span className="sr-only">Close Menu</span>
                <ArrowLeftIcon className="ml-auto size-7" />
              </button>
            )}
          </div>

          {/* Navigation */}
          <div
            className={cn(
              "custom-scrollbar mt-3 min-w-0 flex-1 overflow-y-auto min-[850px]:mt-4",
              isCollapsed && !isMobile ? "pr-0" : "pr-3",
            )}
          >
            {filteredNavData.map((section) => (
              <div key={section.label} className="mb-3">
                {/* Section label — only show when expanded */}
                {!(isCollapsed && !isMobile) && (
                  <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-dark-4 dark:text-dark-6">
                    {section.label}
                  </h2>
                )}

                {/* Collapsed separator */}
                {isCollapsed && !isMobile && (
                  <div className="mx-auto mb-2 h-px w-8 bg-gray-200 dark:bg-gray-700" />
                )}

                <nav role="navigation" aria-label={section.label}>
                  <ul className={cn("space-y-0.5", isCollapsed && !isMobile && "space-y-1")}>
                    {section.items.map((item) => {
                      // ─── Collapsed mode: icon-only with tooltip / flyout ───
                      if (isCollapsed && !isMobile) {
                        const hasSubItems = item.items.length > 0;
                        const href = hasSubItems
                          ? item.items[0].url
                          : "url" in item
                            ? item.url + ""
                            : "/" + item.title.toLowerCase().split(" ").join("-");

                        const isActive = hasSubItems
                          ? item.items.some(({ url }) => url === pathname)
                          : pathname === href;

                        return (
                          <li
                            key={item.title}
                            className="relative"
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              if (hasSubItems) {
                                setFlyout({ title: item.title, items: item.items, top: rect.top });
                                setTooltip(null);
                              } else {
                                setTooltip({ title: item.title, top: rect.top + rect.height / 2 });
                                setFlyout(null);
                              }
                            }}
                            onMouseLeave={() => {
                              setFlyout(null);
                              setTooltip(null);
                            }}
                          >
                            {hasSubItems ? (
                              <div
                                className={cn(
                                  "flex cursor-pointer items-center justify-center rounded-lg p-2.5 transition-colors",
                                  isActive
                                    ? "bg-[rgba(87,80,241,0.07)] text-primary dark:bg-[#FFFFFF1A] dark:text-white"
                                    : "text-dark-4 hover:bg-gray-100 hover:text-dark dark:text-dark-6 hover:dark:bg-[#FFFFFF1A] hover:dark:text-white",
                                )}
                              >
                                <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
                                <span className="sr-only">{item.title}</span>
                              </div>
                            ) : (
                              <Link
                                href={href}
                                className={cn(
                                  "flex items-center justify-center rounded-lg p-2.5 transition-colors",
                                  isActive
                                    ? "bg-[rgba(87,80,241,0.07)] text-primary dark:bg-[#FFFFFF1A] dark:text-white"
                                    : "text-dark-4 hover:bg-gray-100 hover:text-dark dark:text-dark-6 hover:dark:bg-[#FFFFFF1A] hover:dark:text-white",
                                )}
                              >
                                <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
                                <span className="sr-only">{item.title}</span>
                              </Link>
                            )}
                          </li>
                        );
                      }

                      // ─── Expanded mode: normal menu items ───
                      return (
                        <li key={item.title}>
                          {item.items.length ? (
                            <div>
                              <MenuItem
                                isActive={item.items.some(
                                  ({ url }) => url === pathname,
                                )}
                                onClick={() => toggleExpanded(item.title)}
                              >
                                <item.icon
                                  className="size-5 shrink-0"
                                  aria-hidden="true"
                                />

                                <span className="min-w-0 truncate text-sm">{item.title}</span>

                                <ChevronUp
                                  className={cn(
                                    "ml-auto rotate-180 transition-transform duration-200",
                                    expandedItems.includes(item.title) &&
                                      "rotate-0",
                                  )}
                                  aria-hidden="true"
                                />
                              </MenuItem>

                              {expandedItems.includes(item.title) && (
                                <ul
                                  className="ml-8 mr-0 space-y-0.5 pb-2 pr-0 pt-1.5"
                                  role="menu"
                                >
                                  {item.items.map((subItem) => (
                                    <li key={subItem.title} role="none">
                                      <MenuItem
                                        as="link"
                                        href={subItem.url}
                                        isActive={pathname === subItem.url}
                                      >
                                        <span className="truncate">{subItem.title}</span>
                                      </MenuItem>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ) : (
                            (() => {
                              const href =
                                "url" in item
                                  ? item.url + ""
                                  : "/" +
                                    item.title.toLowerCase().split(" ").join("-");

                              return (
                                <MenuItem
                                  className="flex items-center gap-2.5 py-2"
                                  as="link"
                                  href={href}
                                  isActive={pathname === href}
                                >
                                  <item.icon
                                    className="size-5 shrink-0"
                                    aria-hidden="true"
                                  />

                                  <span className="min-w-0 truncate text-sm">{item.title}</span>
                                </MenuItem>
                              );
                            })()
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </div>
            ))}
          </div>

          {/* Collapse toggle button (desktop only) */}
          {!isMobile && (
            <div
              className={cn(
                "shrink-0 border-t border-gray-200 pt-2 dark:border-gray-700",
                isCollapsed ? "flex justify-center" : "pr-3",
              )}
            >
              <button
                onClick={toggleCollapse}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-dark-4 transition-colors hover:bg-gray-100 hover:text-dark dark:text-dark-6 hover:dark:bg-[#FFFFFF1A] hover:dark:text-white",
                  isCollapsed && "justify-center px-2",
                )}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? (
                  <PanelLeftOpenIcon className="size-4 shrink-0" />
                ) : (
                  <>
                    <PanelLeftCloseIcon className="size-4 shrink-0" />
                    <span>Collapse</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

      </aside>

      {/* Tooltip for collapsed mode — rendered outside aside to avoid overflow:hidden clipping */}
      {isCollapsed && !isMobile && tooltip && !flyout && (
        <div
          className="pointer-events-none fixed z-[9999] ml-1 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-gray-700"
          style={{
            left: 64,
            top: tooltip.top,
            transform: "translateY(-50%)",
          }}
        >
          {tooltip.title}
        </div>
      )}

      {/* Flyout submenu for collapsed mode — rendered outside aside to avoid overflow:hidden clipping */}
      {isCollapsed && !isMobile && flyout && (
        <div
          className="fixed z-[9999] ml-1 min-w-[180px] rounded-lg border border-gray-200 bg-white py-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-dark"
          style={{
            left: 64,
            top: flyout.top,
          }}
          onMouseEnter={() => setFlyout(flyout)}
          onMouseLeave={() => setFlyout(null)}
        >
          <div className="mb-1 border-b border-gray-100 px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-dark-4 dark:border-gray-700 dark:text-dark-6">
            {flyout.title}
          </div>
          {flyout.items.map((sub) => (
            <Link
              key={sub.url}
              href={sub.url}
              className={cn(
                "block px-3 py-1.5 text-sm transition-colors",
                pathname === sub.url
                  ? "bg-primary/10 font-medium text-primary dark:bg-[#FFFFFF1A] dark:text-white"
                  : "text-dark-4 hover:bg-gray-50 hover:text-dark dark:text-dark-6 dark:hover:bg-[#FFFFFF1A] dark:hover:text-white",
              )}
            >
              {sub.title}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
