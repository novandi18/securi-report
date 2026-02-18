import {
  boolean,
  char,
  customType,
  date,
  datetime,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { sql, relations } from "drizzle-orm";

// MySQL LONGTEXT column type (4GB max)
const longtext = customType<{ data: string }>({
  dataType() {
    return "longtext";
  },
});

export const users = mysqlTable("users", {
  id: char("id", { length: 36 })
    .primaryKey()
    .default(sql`(UUID())`),
  username: varchar("username", { length: 50 }).unique().notNull(),
  fullName: varchar("full_name", { length: 100 }),
  email: varchar("email", { length: 100 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["administrator", "editor", "viewer"]).default("viewer"),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: varchar("two_factor_secret", { length: 255 }),
  backupCodes: text("backup_codes"),
  preferredLanguage: mysqlEnum("preferred_language", ["en", "id"]).default("en"),
  mustChangePassword: boolean("must_change_password").default(false),
  resetRequestPending: boolean("reset_request_pending").default(false),
  lastLogin: datetime("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const customers = mysqlTable("customers", {
  id: char("id", { length: 36 })
    .primaryKey()
    .default(sql`(UUID())`),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 100 }),
  description: text("description"),
  logoUrl: varchar("logo_url", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Relations ────────────────────────────────────────────
export const customersRelations = relations(customers, ({ many }) => ({
  reports: many(reports),
}));

export const reports = mysqlTable("reports", {
  id: char("id", { length: 36 })
    .primaryKey()
    .default(sql`(UUID())`),
  customerId: char("customer_id", { length: 36 })
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  reportIdCustom: varchar("report_id_custom", { length: 100 }).unique(),
  title: varchar("title", { length: 255 }).notNull(),
  executiveSummary: longtext("executive_summary"),
  scope: longtext("scope"),
  methodology: text("methodology"),
  referencesFramework: text("references_framework"),
  cvssVector: varchar("cvss_vector", { length: 150 }).default(
    "CVSS:4.0/AV:A/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",
  ),
  impact: longtext("impact"),
  recommendationSummary: longtext("recommendation_summary"),
  auditDate: date("audit_date", { mode: "string" }),
  status: mysqlEnum("status", ["Open", "Closed", "Draft"]).default("Draft"),
  isMaster: boolean("is_master").default(false),
  parentReportId: char("parent_report_id", { length: 36 }),
  createdBy: char("created_by", { length: 36 }).references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Report Attachments ───────────────────────────────────
export const reportAttachments = mysqlTable("report_attachments", {
  id: char("id", { length: 36 })
    .primaryKey()
    .default(sql`(UUID())`),
  reportId: char("report_id", { length: 36 })
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  fileUrl: varchar("file_url", { length: 500 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSize: int("file_size").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reportAttachmentsRelations = relations(reportAttachments, ({ one }) => ({
  report: one(reports, {
    fields: [reportAttachments.reportId],
    references: [reports.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one, many }) => ({
  customer: one(customers, {
    fields: [reports.customerId],
    references: [customers.id],
  }),
  creator: one(users, {
    fields: [reports.createdBy],
    references: [users.id],
  }),
  deliverables: many(deliverables),
  attachments: many(reportAttachments),
  contributions: many(reports, { relationName: "contributions" }),
  parentReport: one(reports, {
    fields: [reports.parentReportId],
    references: [reports.id],
    relationName: "contributions",
  }),
}));

// ─── Deliverables ─────────────────────────────────────────
export const deliverables = mysqlTable("deliverables", {
  id: char("id", { length: 36 })
    .primaryKey()
    .default(sql`(UUID())`),
  reportId: char("report_id", { length: 36 })
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  format: mysqlEnum("format", ["PDF", "HTML"]).notNull(),
  fileUrl: varchar("file_url", { length: 500 }).notNull(),
  sha256Hash: varchar("sha256_hash", { length: 64 }),
  generatedBy: char("generated_by", { length: 36 }).references(
    () => users.id,
    { onDelete: "set null" },
  ),
  generatedAt: timestamp("generated_at").defaultNow(),
});

export const deliverablesRelations = relations(deliverables, ({ one }) => ({
  report: one(reports, {
    fields: [deliverables.reportId],
    references: [reports.id],
  }),
  generator: one(users, {
    fields: [deliverables.generatedBy],
    references: [users.id],
  }),
}));

// ─── Knowledge Base: CWE Entries ──────────────────────────
export const cweEntries = mysqlTable("cwe_entries", {
  id: int("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
});

// ─── Knowledge Base: OWASP Entries ────────────────────────
export const owaspEntries = mysqlTable("owasp_entries", {
  id: int("id").primaryKey().autoincrement(),
  code: varchar("code", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  version: varchar("version", { length: 10 }).notNull(),
});

// ─── Knowledge Base: Finding Templates ────────────────────
export const findingTemplates = mysqlTable("finding_templates", {
  id: char("id", { length: 36 })
    .primaryKey()
    .default(sql`(UUID())`),
  title: varchar("title", { length: 255 }).notNull(),
  severity: mysqlEnum("severity", [
    "Critical",
    "High",
    "Medium",
    "Low",
    "Info",
    "None",
  ]).default("Info"),
  cvssScore: decimal("cvss_score", { precision: 3, scale: 1 }).default("0.0"),
  cvssVector: varchar("cvss_vector", { length: 100 }).default(
    "CVSS:4.0/AV:A/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",
  ),
  description: longtext("description"),
  impact: text("impact"),
  recommendation: longtext("recommendation"),
  referencesLink: text("references_link"),
  cweId: int("cwe_id").references(() => cweEntries.id, {
    onDelete: "set null",
  }),
  owaspId: int("owasp_id").references(() => owaspEntries.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const findingTemplatesRelations = relations(
  findingTemplates,
  ({ one }) => ({
    cwe: one(cweEntries, {
      fields: [findingTemplates.cweId],
      references: [cweEntries.id],
    }),
    owasp: one(owaspEntries, {
      fields: [findingTemplates.owaspId],
      references: [owaspEntries.id],
    }),
  }),
);

export const cweEntriesRelations = relations(cweEntries, ({ many }) => ({
  templates: many(findingTemplates),
}));

export const owaspEntriesRelations = relations(owaspEntries, ({ many }) => ({
  templates: many(findingTemplates),
}));

// ─── Global Application Settings (single-row table) ──────
export const appSettings = mysqlTable("app_settings", {
  id: int("id").primaryKey().default(1),
  companyName: varchar("company_name", { length: 255 }).default("Securi Report"),
  companyLogo: varchar("company_logo", { length: 512 }),
  reportIdPrefix: varchar("report_id_prefix", { length: 50 }).default("PEN-DOC-"),
  latexEngine: mysqlEnum("latex_engine", ["pdflatex", "xelatex"]).default("pdflatex"),
  titlePageColor: varchar("title_page_color", { length: 7 }).default("#1E3A5F"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Audit Logs ───────────────────────────────────────────
export const auditLogs = mysqlTable("audit_logs", {
  id: char("id", { length: 36 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: char("user_id", { length: 36 }).references(() => users.id, {
    onDelete: "cascade",
  }),
  action: varchar("action", { length: 255 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// ─── Notifications ────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: char("id", { length: 36 })
    .primaryKey()
    .default(sql`(UUID())`),
  /** The user who receives this notification */
  recipientId: char("recipient_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** The user who triggered the event (nullable for system events) */
  actorId: char("actor_id", { length: 36 }).references(() => users.id, {
    onDelete: "set null",
  }),
  category: mysqlEnum("category", [
    "collaboration",
    "security",
    "engagement",
    "system",
  ])
    .notNull()
    .default("system"),
  type: mysqlEnum("type", [
    // Collaboration & Workflow
    "contribution_submitted",
    "report_merged",
    "report_released",
    // Security & Audit
    "brute_force_detected",
    "2fa_state_change",
    "unauthorized_access",
    // Engagement & Deadline
    "sla_alert",
    "customer_assigned",
    // System & Data
    "pdf_generated",
    "pdf_failed",
    "backup_reminder",
    // Legacy (backward compat)
    "password_reset_request",
    "general",
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  /** URL to navigate when notification is clicked */
  actionUrl: varchar("action_url", { length: 500 }),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(users, {
    fields: [notifications.recipientId],
    references: [users.id],
    relationName: "recipient",
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
    relationName: "actor",
  }),
}));

// ── Keep old export alias for backward compatibility during migration ──
export const adminNotifications = notifications;

// ─── Custom Report Template (single-row, stores PDF-extracted text) ───
export const customReportTemplates = mysqlTable("custom_report_templates", {
  id: int("id").primaryKey().default(1),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  extractedText: longtext("extracted_text").notNull(),
  markdownContent: longtext("markdown_content"),
  fileSizeKb: int("file_size_kb"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// ─── Type Exports ─────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type Deliverable = typeof deliverables.$inferSelect;
export type NewDeliverable = typeof deliverables.$inferInsert;
export type CweEntry = typeof cweEntries.$inferSelect;
export type NewCweEntry = typeof cweEntries.$inferInsert;
export type OwaspEntry = typeof owaspEntries.$inferSelect;
export type NewOwaspEntry = typeof owaspEntries.$inferInsert;
export type FindingTemplate = typeof findingTemplates.$inferSelect;
export type NewFindingTemplate = typeof findingTemplates.$inferInsert;
export type AppSettings = typeof appSettings.$inferSelect;
export type NewAppSettings = typeof appSettings.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type AdminNotification = typeof notifications.$inferSelect;
export type NewAdminNotification = typeof notifications.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type ReportAttachment = typeof reportAttachments.$inferSelect;
export type NewReportAttachment = typeof reportAttachments.$inferInsert;
export type CustomReportTemplate = typeof customReportTemplates.$inferSelect;
export type NewCustomReportTemplate = typeof customReportTemplates.$inferInsert;
