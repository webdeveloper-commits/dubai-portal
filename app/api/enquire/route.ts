import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, email, phone, message,
      projectName, developerName, areaName, sourceUrl,
      // UTM / ad tracking (from lib/tracking.ts → getLeadTrackingData)
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      gclid, landing_page, custom_params,
      // What the user was searching for before they hit the form
      search_context,
    } = body;

    // ── Validation ───────────────────────────────────────────────────────────
    if (!name?.trim())
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    if (!phone?.trim() || phone.replace(/\D/g, "").length < 7)
      return NextResponse.json({ error: "A valid phone number is required." }, { status: 400 });

    // ── Build notes (human-readable audit trail) ─────────────────────────────
    const noteParts: string[] = [];

    if (utm_medium || utm_campaign || utm_content || utm_term || gclid) {
      const adParts = [
        utm_medium   ? `medium=${utm_medium}`     : null,
        utm_campaign ? `campaign=${utm_campaign}` : null,
        utm_term     ? `term=${utm_term}`         : null,
        utm_content  ? `content=${utm_content}`   : null,
        gclid        ? `gclid=${gclid}`           : null,
      ].filter(Boolean).join(" | ");
      noteParts.push(`Ad: ${adParts}`);
    }
    if (custom_params && Object.keys(custom_params).length > 0) {
      const customStr = Object.entries(custom_params).map(([k, v]) => `${k}=${v}`).join(" | ");
      noteParts.push(`Ad custom params: ${customStr}`);
    }
    if (landing_page) noteParts.push(`Landing: ${landing_page}`);

    if (search_context && Object.keys(search_context).length > 0) {
      const sc = search_context;
      const searchParts = [
        sc.areas?.length          ? `areas=${sc.areas.join(",")}` : null,
        sc.developers?.length     ? `devs=${sc.developers.join(",")}`  : null,
        sc.property_types?.length ? `types=${sc.property_types.join(",")}` : null,
        sc.lifestyle?.length      ? `lifestyle=${sc.lifestyle.join(",")}` : null,
        sc.price_from             ? `from=AED ${sc.price_from.toLocaleString()}` : null,
        sc.price_to < 100_000_000 ? `to=AED ${sc.price_to?.toLocaleString()}` : null,
        sc.query                  ? `q="${sc.query}"` : null,
      ].filter(Boolean).join(" | ");
      if (searchParts) noteParts.push(`Search: ${searchParts}`);
      if (sc.source_page) noteParts.push(`From: ${sc.source_page}`);
    }

    const notes = noteParts.length ? noteParts.join("\n") : null;

    // ── Insert lead ──────────────────────────────────────────────────────────
    const { error } = await supabase.from("leads").insert({
      name:           name.trim(),
      email:          email.trim().toLowerCase(),
      phone:          phone.trim(),
      project_name:   projectName   || null,
      developer_name: developerName || null,
      area_name:      areaName      || null,
      message:        message?.trim() || null,
      page_url:       sourceUrl     || null,
      utm_source:     utm_source    || null,   // saved to dedicated column
      enquiry_type:   "website_form",
      lead_status:    "new",
      lead_score:     "cold",
      notes,
    });

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: "Failed to save enquiry." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Enquiry route error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
