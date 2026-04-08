import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "A valid URL is required." },
        { status: 400 }
      );
    }

    // Basic URL validation
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format." },
        { status: 400 }
      );
    }

    const res = await fetch(parsed.toString(), {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Fetch failed: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }

    const html = await res.text();

    const match = html.match(
      /<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
    );
    if (!match) {
      return NextResponse.json(
        { error: "No __NEXT_DATA__ found in page. Is this a Fillout form URL?" },
        { status: 422 }
      );
    }

    const nextData = JSON.parse(match[1]);
    const pageProps = nextData?.props?.pageProps ?? {};

    // The template lives directly at pageProps.flowSnapshot.template
    const template = pageProps.flowSnapshot?.template ?? null;
    const formName = pageProps.flow?.name || pageProps.flowSnapshot?.name || "Untitled Form";
    // Merge flow-level settings into template settings so the reviewer can access them
    const flowSettings = pageProps.flow?.settings ?? {};

    if (!template) {
      return NextResponse.json(
        {
          error:
            "Could not find form template in page data. The URL may not point to a Fillout form.",
        },
        { status: 422 }
      );
    }

    // Inject flow-level settings into the template so the reviewer picks them up
    if (flowSettings && Object.keys(flowSettings).length > 0) {
      template.settings = { ...flowSettings, ...template.settings };
    }

    return NextResponse.json({ template, formName });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
