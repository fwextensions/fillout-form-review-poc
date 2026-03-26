/**
 * Airtable Setup Script
 *
 * Run this inside an Airtable Scripting extension (or Airtable Automations
 * "Run a script" action) in a new base to create the Feedback table with
 * the correct columns and types.
 *
 * Steps:
 *   1. Create a new Airtable base
 *   2. Open Extensions → Scripting
 *   3. Paste this script and click Run
 */

// The table and fields we need
const TABLE_NAME = "Feedback";

const FIELDS = [
  { name: "Form URL", type: "url" },
  { name: "Form ID", type: "singleLineText" },
  { name: "Feedback Title", type: "singleLineText" },
  {
    name: "Severity",
    type: "singleSelect",
    options: {
      choices: [
        { name: "critical", color: "redBright" },
        { name: "warning", color: "yellowBright" },
        { name: "info", color: "blueBright" },
      ],
    },
  },
  { name: "Message", type: "multilineText" },
  { name: "Location", type: "singleLineText" },
  { name: "Category", type: "singleLineText" },
  {
    name: "Rating",
    type: "singleSelect",
    options: {
      choices: [
        { name: "Helpful", color: "greenBright" },
        { name: "Not Helpful", color: "redBright" },
        { name: "Skipped", color: "grayBright" },
      ],
    },
  },
  { name: "Submitted At", type: "singleLineText" },
];

// Check if table already exists
let table = base.getTable(TABLE_NAME);

if (!table) {
  // Create the table with a temporary primary field
  table = await base.createTableAsync(TABLE_NAME, [
    { name: "Form URL", type: "url" },
  ]);
  output.markdown(`✅ Created table **${TABLE_NAME}**`);
} else {
  output.markdown(`ℹ️ Table **${TABLE_NAME}** already exists — adding missing fields`);
}

// Add each field if it doesn't already exist
const existingFields = table.fields.map((f) => f.name);

for (const field of FIELDS) {
  if (existingFields.includes(field.name)) {
    output.markdown(`  ⏭️ Field "${field.name}" already exists`);
    continue;
  }

  const fieldConfig = { name: field.name, type: field.type };
  if (field.options) {
    fieldConfig.options = field.options;
  }

  await table.createFieldAsync(fieldConfig.name, fieldConfig.type, fieldConfig.options || null);
  output.markdown(`  ✅ Created field "${field.name}" (${field.type})`);
}

output.markdown(`\n🎉 Done! Your **${TABLE_NAME}** table is ready.`);
output.markdown(`\nNext steps:`);
output.markdown(`1. Copy the Base ID from the URL (starts with \`app\`)`);
output.markdown(`2. Create a Personal Access Token at https://airtable.com/create/tokens`);
output.markdown(`   - Scope: \`data.records:write\``);
output.markdown(`   - Access: this base`);
output.markdown(`3. Set these env vars in your Vercel project (or \`.env.local\`):`);
output.markdown("```");
output.markdown(`AIRTABLE_TOKEN=pat...`);
output.markdown(`AIRTABLE_BASE_ID=app...`);
output.markdown(`AIRTABLE_TABLE_NAME=${TABLE_NAME}`);
output.markdown("```");
