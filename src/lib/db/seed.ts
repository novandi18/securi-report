/**
 * Database seed script.
 * Creates an initial administrator account if none exists.
 * Seeds CWE and OWASP standard data.
 *
 * Usage: npx tsx src/lib/db/seed.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { users, cweEntries, owaspEntries } from "./schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

// ─── Standard CWE Entries ──────────────────────────────────
const CWE_SEED_DATA = [
  { id: 20, title: "Improper Input Validation", description: "The product receives input or data, but it does not validate or incorrectly validates that the input has the properties that are required to process the data safely and correctly." },
  { id: 22, title: "Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')", description: "The product uses external input to construct a pathname that is intended to identify a file or directory that is located underneath a restricted parent directory, but the product does not properly neutralize special elements within the pathname." },
  { id: 77, title: "Improper Neutralization of Special Elements used in a Command ('Command Injection')", description: "The product constructs all or part of a command using externally-influenced input from an upstream component, but it does not neutralize or incorrectly neutralizes special elements that could modify the intended command." },
  { id: 78, title: "Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection')", description: "The product constructs all or part of an OS command using externally-influenced input, but it does not neutralize or incorrectly neutralizes special elements that could modify the intended OS command." },
  { id: 79, title: "Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting')", description: "The product does not neutralize or incorrectly neutralizes user-controllable input before it is placed in output that is used as a web page that is served to other users." },
  { id: 89, title: "Improper Neutralization of Special Elements used in an SQL Command ('SQL Injection')", description: "The product constructs all or part of an SQL command using externally-influenced input, but it does not neutralize or incorrectly neutralizes special elements that could modify the intended SQL command." },
  { id: 94, title: "Improper Control of Generation of Code ('Code Injection')", description: "The product constructs all or part of a code segment using externally-influenced input, but it does not neutralize or incorrectly neutralizes special elements that could modify the syntax or behavior of the intended code segment." },
  { id: 119, title: "Improper Restriction of Operations within the Bounds of a Memory Buffer", description: "The product performs operations on a memory buffer, but it can read from or write to a memory location that is outside of the intended boundary of the buffer." },
  { id: 200, title: "Exposure of Sensitive Information to an Unauthorized Actor", description: "The product exposes sensitive information to an actor that is not explicitly authorized to have access to that information." },
  { id: 250, title: "Execution with Unnecessary Privileges", description: "The product performs an operation at a privilege level that is higher than the minimum level required, which creates new weaknesses or amplifies the consequences of other weaknesses." },
  { id: 269, title: "Improper Privilege Management", description: "The product does not properly assign, modify, track, or check privileges for an actor, creating an unintended sphere of control for that actor." },
  { id: 276, title: "Incorrect Default Permissions", description: "During installation, installed file permissions are set to allow anyone to modify those files." },
  { id: 287, title: "Improper Authentication", description: "When an actor claims to have a given identity, the product does not prove or insufficiently proves that the claim is correct." },
  { id: 306, title: "Missing Authentication for Critical Function", description: "The product does not perform any authentication for functionality that requires a provable user identity or consumes a significant amount of resources." },
  { id: 311, title: "Missing Encryption of Sensitive Data", description: "The product does not encrypt sensitive or critical information before storage or transmission." },
  { id: 312, title: "Cleartext Storage of Sensitive Information", description: "The product stores sensitive information in cleartext within a resource that might be accessible to another control sphere." },
  { id: 327, title: "Use of a Broken or Risky Cryptographic Algorithm", description: "The product uses a broken or risky cryptographic algorithm or protocol." },
  { id: 352, title: "Cross-Site Request Forgery (CSRF)", description: "The web application does not, or can not, sufficiently verify whether a well-formed, valid, consistent request was intentionally provided by the user who submitted the request." },
  { id: 362, title: "Concurrent Execution using Shared Resource with Improper Synchronization ('Race Condition')", description: "The product contains a code sequence that can run concurrently with other code, and the code sequence requires temporary, exclusive access to a shared resource, but a timing window exists in which the shared resource can be modified by another code sequence." },
  { id: 434, title: "Unrestricted Upload of File with Dangerous Type", description: "The product allows the attacker to upload or transfer files of dangerous types that can be automatically processed within the product's environment." },
  { id: 502, title: "Deserialization of Untrusted Data", description: "The product deserializes untrusted data without sufficiently verifying that the resulting data will be valid." },
  { id: 521, title: "Weak Password Requirements", description: "The product does not require that users should have strong passwords, which makes it easier for attackers to compromise user accounts." },
  { id: 522, title: "Insufficiently Protected Credentials", description: "The product transmits or stores authentication credentials, but it uses an insecure method that is susceptible to unauthorized interception and/or retrieval." },
  { id: 601, title: "URL Redirection to Untrusted Site ('Open Redirect')", description: "A web application accepts a user-controlled input that specifies a link to an external site, and uses that link in a Redirect." },
  { id: 611, title: "Improper Restriction of XML External Entity Reference", description: "The product processes an XML document that can contain XML entities with URIs that resolve to documents outside of the intended sphere of control." },
  { id: 613, title: "Insufficient Session Expiration", description: "According to WASC, Insufficient Session Expiration is when a web site permits an attacker to reuse old session credentials or session IDs for authorization." },
  { id: 639, title: "Authorization Bypass Through User-Controlled Key (IDOR)", description: "The system's authorization functionality does not prevent one user from gaining access to another user's data or record by modifying the key value identifying the data." },
  { id: 732, title: "Incorrect Permission Assignment for Critical Resource", description: "The product specifies permissions for a security-critical resource in a way that allows that resource to be read or modified by unintended actors." },
  { id: 798, title: "Use of Hard-coded Credentials", description: "The product contains hard-coded credentials, such as a password or cryptographic key, which it uses for its own inbound authentication, outbound communication to external components, or encryption of internal data." },
  { id: 862, title: "Missing Authorization", description: "The product does not perform an authorization check when an actor attempts to access a resource or perform an action." },
  { id: 863, title: "Incorrect Authorization", description: "The product performs an authorization check when an actor attempts to access a resource or perform an action, but it does not correctly perform the check." },
  { id: 918, title: "Server-Side Request Forgery (SSRF)", description: "The web server receives a URL or similar request from an upstream component and retrieves the contents of this URL, but it does not sufficiently ensure that the request is being sent to the expected destination." },
  { id: 1021, title: "Improper Restriction of Rendered UI Layers or Frames", description: "The web application does not restrict or incorrectly restricts frame objects or UI layers that belong to another application or domain." },
  { id: 1275, title: "Sensitive Cookie with Improper SameSite Attribute", description: "The SameSite attribute for sensitive cookies is not set, or an insecure value is used." },
];

// ─── Standard OWASP Top 10 Entries ─────────────────────────
const OWASP_SEED_DATA = [
  { code: "A01:2021", title: "Broken Access Control", version: "2021" },
  { code: "A02:2021", title: "Cryptographic Failures", version: "2021" },
  { code: "A03:2021", title: "Injection", version: "2021" },
  { code: "A04:2021", title: "Insecure Design", version: "2021" },
  { code: "A05:2021", title: "Security Misconfiguration", version: "2021" },
  { code: "A06:2021", title: "Vulnerable and Outdated Components", version: "2021" },
  { code: "A07:2021", title: "Identification and Authentication Failures", version: "2021" },
  { code: "A08:2021", title: "Software and Data Integrity Failures", version: "2021" },
  { code: "A09:2021", title: "Security Logging and Monitoring Failures", version: "2021" },
  { code: "A10:2021", title: "Server-Side Request Forgery (SSRF)", version: "2021" },
  { code: "A01:2025", title: "Broken Access Control", version: "2025" },
  { code: "A02:2025", title: "Cryptographic Failures", version: "2025" },
  { code: "A03:2025", title: "Injection", version: "2025" },
  { code: "A04:2025", title: "Insecure Design", version: "2025" },
  { code: "A05:2025", title: "Security Misconfiguration", version: "2025" },
  { code: "A06:2025", title: "Vulnerable and Outdated Components", version: "2025" },
  { code: "A07:2025", title: "Identification and Authentication Failures", version: "2025" },
  { code: "A08:2025", title: "Software and Data Integrity Failures", version: "2025" },
  { code: "A09:2025", title: "Security Logging and Monitoring Failures", version: "2025" },
  { code: "A10:2025", title: "Server-Side Request Forgery (SSRF)", version: "2025" },
];

async function seed() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set. Please check your .env.local");
    process.exit(1);
  }

  const connection = await mysql.createConnection(connectionString);
  const db = drizzle(connection);

  console.log("🌱 Seeding database...");

  // Check if admin user exists
  const [existingAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.username, "admin"))
    .limit(1);

  if (existingAdmin) {
    console.log("ℹ️  Admin user already exists. Skipping seed.");
  } else {
    const passwordHash = await bcrypt.hash("Admin@1234", 12);

    await db.insert(users).values({
      username: "admin",
      email: "admin@deitreporting.local",
      passwordHash,
      role: "administrator",
    });

    console.log("✅ Admin user created:");
    console.log("   Username: admin");
    console.log("   Email:    admin@deitreporting.local");
    console.log("   Password: Admin@1234");
    console.log("   Role:     administrator");
    console.log("");
    console.log("⚠️  IMPORTANT: Change this password immediately after first login!");
  }

  // ─── Seed CWE Entries ──────────────────────────────────
  console.log("\n🔐 Seeding CWE entries...");
  let cweCount = 0;
  for (const entry of CWE_SEED_DATA) {
    const [existing] = await db
      .select()
      .from(cweEntries)
      .where(eq(cweEntries.id, entry.id))
      .limit(1);

    if (!existing) {
      await db.insert(cweEntries).values(entry);
      cweCount++;
    }
  }
  console.log(`✅ ${cweCount} CWE entries seeded (${CWE_SEED_DATA.length - cweCount} already existed).`);

  // ─── Seed OWASP Entries ────────────────────────────────
  console.log("\n🛡️  Seeding OWASP entries...");
  let owaspCount = 0;
  for (const entry of OWASP_SEED_DATA) {
    const existing = await db
      .select()
      .from(owaspEntries)
      .where(eq(owaspEntries.code, entry.code))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(owaspEntries).values(entry);
      owaspCount++;
    }
  }
  console.log(`✅ ${owaspCount} OWASP entries seeded (${OWASP_SEED_DATA.length - owaspCount} already existed).`);

  await connection.end();
  console.log("\n🌱 Seed complete.");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
