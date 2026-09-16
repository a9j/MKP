/**
 * Generates src/lib/database.types.ts from a live database.
 *
 * The Supabase CLI's "gen types" needs Docker, which is not available in every
 * environment, so this reads the Postgres catalog through psql and emits the
 * same shape the CLI does. Run it after changing a migration:
 *
 *   bash scripts/local-supabase.sh && node scripts/gen-types.mjs
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PGBIN = process.env.PGBIN ?? "/usr/lib/postgresql/16/bin";
const PORT = process.env.PGPORT ?? "55432";
const DB = process.env.DB ?? "mkp_dev";

// Unlikely to appear in a catalog value, so it is safe as a field separator.
const SEP = "<|>";

const q = (sql) =>
  execFileSync(
    join(PGBIN, "psql"),
    ["-h", "/tmp", "-p", PORT, "-U", "postgres", "-d", DB, "-tAF", SEP, "-c", sql],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split(SEP));

const enums = {};
for (const [name, label] of q(`
  select t.typname, e.enumlabel
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  order by t.typname, e.enumsortorder`)) {
  (enums[name] ??= []).push(label);
}

const relKind = {};
for (const [name, kind] of q(`
  select c.relname, c.relkind
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','v')`)) {
  relKind[name] = kind;
}

const cols = {};
for (const [table, column, nullable, hasDefault, udt, isIdentity] of q(`
  select c.table_name, c.column_name, c.is_nullable,
         case when c.column_default is null then 'f' else 't' end,
         c.udt_name, c.is_identity
  from information_schema.columns c
  where c.table_schema = 'public'
  order by c.table_name, c.ordinal_position`)) {
  (cols[table] ??= []).push({
    column,
    nullable: nullable === "YES",
    hasDefault: hasDefault === "t" || isIdentity === "YES",
    udt,
  });
}

// Foreign keys, so postgrest-js can type an embedded select such as
// .from("records_requests").select("*, agencies(name)")
const rels = {};
for (const [table, fkName, column, refTable, refColumn, isUnique] of q(`
  select
    src.relname, con.conname, srcatt.attname,
    tgt.relname, tgtatt.attname,
    case when exists (
      select 1 from pg_index i
      where i.indrelid = con.conrelid and i.indisunique
        and i.indnatts = array_length(con.conkey, 1)
        and (select array_agg(k order by k) from unnest(i.indkey::int[]) k)
            = (select array_agg(k order by k) from unnest(con.conkey::int[]) k)
    ) then 't' else 'f' end
  from pg_constraint con
  join pg_class src on src.oid = con.conrelid
  join pg_class tgt on tgt.oid = con.confrelid
  join pg_namespace n on n.oid = src.relnamespace
  join unnest(con.conkey) with ordinality as sk(attnum, ord) on true
  join unnest(con.confkey) with ordinality as tk(attnum, ord) on tk.ord = sk.ord
  join pg_attribute srcatt on srcatt.attrelid = con.conrelid and srcatt.attnum = sk.attnum
  join pg_attribute tgtatt on tgtatt.attrelid = con.confrelid and tgtatt.attnum = tk.attnum
  where con.contype = 'f' and n.nspname = 'public'
  order by src.relname, con.conname, sk.ord`)) {
  const list = (rels[table] ??= []);
  const existing = list.find((r) => r.foreignKeyName === fkName);
  if (existing) {
    existing.columns.push(column);
    existing.referencedColumns.push(refColumn);
  } else {
    list.push({
      foreignKeyName: fkName,
      columns: [column],
      isOneToOne: isUnique === "t",
      referencedRelation: refTable,
      referencedColumns: [refColumn],
    });
  }
}

function relationshipLines(name, indent) {
  const list = rels[name] ?? [];
  if (list.length === 0) return [`${indent}Relationships: [];`];
  const out = [`${indent}Relationships: [`];
  for (const r of list) {
    out.push(`${indent}  {`);
    out.push(`${indent}    foreignKeyName: "${r.foreignKeyName}";`);
    out.push(`${indent}    columns: [${r.columns.map((c) => `"${c}"`).join(", ")}];`);
    out.push(`${indent}    isOneToOne: ${r.isOneToOne};`);
    out.push(`${indent}    referencedRelation: "${r.referencedRelation}";`);
    out.push(`${indent}    referencedColumns: [${r.referencedColumns.map((c) => `"${c}"`).join(", ")}];`);
    out.push(`${indent}  },`);
  }
  out.push(`${indent}];`);
  return out;
}

const NUMERIC = new Set(["int2", "int4", "int8", "numeric", "float4", "float8"]);
const STRING = new Set([
  "text", "varchar", "bpchar", "uuid", "date", "timestamp", "timestamptz", "time", "name",
]);

function tsType(udt) {
  if (enums[udt]) return `Database["public"]["Enums"]["${udt}"]`;
  if (NUMERIC.has(udt)) return "number";
  if (STRING.has(udt)) return "string";
  if (udt === "bool") return "boolean";
  if (udt === "json" || udt === "jsonb") return "Json";
  if (udt.startsWith("_")) return `${tsType(udt.slice(1))}[]`;
  return "string";
}

const lines = [];
lines.push("// Generated by scripts/gen-types.mjs from the live schema. Do not edit by hand.");
lines.push("// Regenerate after any migration change:");
lines.push("//   bash scripts/local-supabase.sh && node scripts/gen-types.mjs");
lines.push("");
lines.push(
  "export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];",
);
lines.push("");
lines.push("export type Database = {");
lines.push("  public: {");

const tables = Object.keys(cols).filter((t) => relKind[t] === "r").sort();
const views = Object.keys(cols).filter((t) => relKind[t] === "v").sort();

lines.push("    Tables: {");
for (const t of tables) {
  lines.push(`      ${t}: {`);
  lines.push("        Row: {");
  for (const c of cols[t]) {
    lines.push(`          ${c.column}: ${tsType(c.udt)}${c.nullable ? " | null" : ""};`);
  }
  lines.push("        };");
  lines.push("        Insert: {");
  for (const c of cols[t]) {
    const optional = c.nullable || c.hasDefault;
    lines.push(
      `          ${c.column}${optional ? "?" : ""}: ${tsType(c.udt)}${c.nullable ? " | null" : ""};`,
    );
  }
  lines.push("        };");
  lines.push("        Update: {");
  for (const c of cols[t]) {
    lines.push(`          ${c.column}?: ${tsType(c.udt)}${c.nullable ? " | null" : ""};`);
  }
  lines.push("        };");
  lines.push(...relationshipLines(t, "        "));
  lines.push("      };");
}
lines.push("    };");

lines.push("    Views: {");
for (const v of views) {
  lines.push(`      ${v}: {`);
  lines.push("        Row: {");
  for (const c of cols[v]) {
    lines.push(`          ${c.column}: ${tsType(c.udt)}${c.nullable ? " | null" : ""};`);
  }
  lines.push("        };");
  lines.push(...relationshipLines(v, "        "));
  lines.push("      };");
}
lines.push("    };");

lines.push("    Functions: {");
lines.push("      business_days_between: {");
lines.push("        Args: { start_date: string; end_date: string };");
lines.push("        Returns: number;");
lines.push("      };");
lines.push("      is_admin: { Args: Record<string, never>; Returns: boolean };");
lines.push("    };");

lines.push("    Enums: {");
for (const [name, labels] of Object.entries(enums).sort()) {
  lines.push(`      ${name}: ${labels.map((l) => `"${l}"`).join(" | ")};`);
}
lines.push("    };");

lines.push("  };");
lines.push("};");
lines.push("");

const out = join(ROOT, "src/lib/database.types.ts");
writeFileSync(out, lines.join("\n"));
console.log(
  `Wrote ${out}: ${tables.length} tables, ${views.length} views, ${Object.keys(enums).length} enums.`,
);
