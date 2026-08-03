import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const leadTypes = ["sync", "retail_waitlist"] as const;
export type LeadType = (typeof leadTypes)[number];

export const leadStatuses = [
  "new",
  "contacted",
  "qualified",
  "closed",
  "archived",
] as const;
export type LeadStatus = (typeof leadStatuses)[number];

export const leads = sqliteTable(
  "leads",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type", { enum: leadTypes }).notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    company: text("company").notNull(),
    project: text("project"),
    useCase: text("use_case"),
    budget: text("budget"),
    timeline: text("timeline"),
    status: text("status", { enum: leadStatuses }).notNull().default("new"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check(
      "leads_type_check",
      sql`${table.type} IN ('sync', 'retail_waitlist')`,
    ),
    check(
      "leads_status_check",
      sql`${table.status} IN ('new', 'contacted', 'qualified', 'closed', 'archived')`,
    ),
    check(
      "leads_email_length_check",
      sql`length(${table.email}) BETWEEN 3 AND 254`,
    ),
    check(
      "leads_name_length_check",
      sql`length(${table.name}) BETWEEN 1 AND 120`,
    ),
    check(
      "leads_company_length_check",
      sql`length(${table.company}) BETWEEN 1 AND 160`,
    ),
    check(
      "leads_project_length_check",
      sql`${table.project} IS NULL OR length(${table.project}) BETWEEN 1 AND 4000`,
    ),
    check(
      "leads_use_case_length_check",
      sql`${table.useCase} IS NULL OR length(${table.useCase}) BETWEEN 1 AND 4000`,
    ),
    check(
      "leads_budget_length_check",
      sql`${table.budget} IS NULL OR length(${table.budget}) BETWEEN 1 AND 120`,
    ),
    check(
      "leads_timeline_length_check",
      sql`${table.timeline} IS NULL OR length(${table.timeline}) BETWEEN 1 AND 120`,
    ),
    check(
      "leads_request_shape_check",
      sql`(
        (${table.type} = 'sync' AND ${table.project} IS NOT NULL AND ${table.useCase} IS NULL)
        OR
        (${table.type} = 'retail_waitlist' AND ${table.useCase} IS NOT NULL AND ${table.project} IS NULL)
      )`,
    ),
    index("idx_leads_created_at_id").on(table.createdAt, table.id),
  ],
);
