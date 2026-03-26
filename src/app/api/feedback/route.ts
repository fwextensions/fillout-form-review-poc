import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || "Feedback";

interface FeedbackPayload {
  formUrl: string;
  formId: string;
  items: {
    title: string;
    severity: string;
    message: string;
    location: string | null;
    category: string;
    helpful: boolean | null;
  }[];
}

export async function POST(req: NextRequest) {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    return NextResponse.json(
      { error: "Airtable is not configured." },
      { status: 500 }
    );
  }

  try {
    const body: FeedbackPayload = await req.json();

    if (!body.formUrl || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "formUrl and items are required." },
        { status: 400 }
      );
    }

    const submittedAt = new Date().toISOString();

    // Airtable accepts up to 10 records per request
    const records = body.items.map((item) => ({
      fields: {
        "Form URL": body.formUrl,
        "Form ID": body.formId || "",
        "Feedback Title": item.title,
        Severity: item.severity,
        Message: item.message,
        Location: item.location || "",
        Category: item.category || "",
        Rating:
          item.helpful === true
            ? "Helpful"
            : item.helpful === false
              ? "Not Helpful"
              : "Skipped",
        "Submitted At": submittedAt,
      },
    }));

    // Batch into chunks of 10 (Airtable limit)
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;
    const chunks: typeof records[] = [];
    for (let i = 0; i < records.length; i += 10) {
      chunks.push(records.slice(i, i + 10));
    }

    for (const chunk of chunks) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records: chunk }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Airtable error:", err);
        return NextResponse.json(
          { error: "Failed to write to Airtable." },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ ok: true, count: records.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
