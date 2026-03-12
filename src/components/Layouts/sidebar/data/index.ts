import * as Icons from "../icons";

type NavSubItem = {
  title: string;
  url: string;
  adminOnly?: boolean;
};

type NavItem = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  url?: string;
  items: NavSubItem[];
  adminOnly?: boolean;
  /** Hide this item from viewers */
  viewerBlocked?: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
  /** Hide entire section from viewers */
  viewerBlocked?: boolean;
};

export const NAV_DATA: NavSection[] = [
  {
    label: "MAIN MENU",
    items: [
      {
        title: "Dashboard",
        icon: Icons.HomeIcon,
        url: "/",
        items: [],
      },
      {
        title: "Notifications",
        icon: Icons.BellIcon,
        url: "/notifications",
        items: [],
      },
      {
        title: "Customers",
        icon: Icons.Table,
        url: "/customers",
        items: [],
      },
      {
        title: "Findings",
        icon: Icons.FindingsIcon,
        items: [
          { title: "All Findings", url: "/findings" },
          { title: "New Finding", url: "/findings/new" },
          { title: "New Finding with AI", url: "/findings/new-with-ai" },
        ],
      },
      {
        title: "Reports",
        icon: Icons.PieChart,
        items: [
          { title: "All Reports", url: "/reports" },
          { title: "All Deliverables", url: "/reports/deliverables" },
        ],
      },
    ],
  },
  {
    label: "KNOWLEDGE BASE",
    viewerBlocked: true,
    items: [
      {
        title: "CWE/OWASP",
        icon: Icons.KnowledgeBase,
        url: "/kb/frameworks",
        items: [],
      },
      {
        title: "Finding Templates",
        icon: Icons.KnowledgeBase,
        url: "/kb/templates",
        items: [],
      },
    ],
  },
  {
    label: "TOOLS",
    viewerBlocked: true,
    items: [
      {
        title: "JSON Formatter",
        icon: Icons.Wrench,
        url: "/tools/json",
        items: [],
      },
      {
        title: "Hashing & Encryption",
        icon: Icons.Wrench,
        url: "/tools/crypto",
        items: [],
      },
      {
        title: "Encoder & Decoder",
        icon: Icons.Wrench,
        url: "/tools/encoding",
        items: [],
      },
    ],
  },
  {
    label: "ADMIN",
    items: [
      {
        title: "Users",
        url: "/users",
        icon: Icons.User,
        items: [],
        adminOnly: true,
      },
    ],
  },
  {
    label: "SETTINGS",
    items: [
      {
        title: "Settings",
        icon: Icons.SettingsGear,
        items: [
          { title: "Account", url: "/settings/account" },
          { title: "Application", url: "/settings/app", adminOnly: true },
          {
            title: "Custom Template",
            url: "/settings/custom-template",
            adminOnly: true,
          },
        ],
      },
    ],
  },
];
