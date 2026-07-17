import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, email, countryCode, phone, message,
      projectName, developerName, areaName, filterDetails, sourceUrl,
    } = body;

    if (!name?.trim())
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    if (!phone?.trim() || phone.replace(/\D/g, "").length < 6)
      return NextResponse.json({ error: "A valid phone number is required." }, { status: 400 });

    const cc = (countryCode || "+971").trim();
    const fullPhone = `${cc} ${phone.trim().replace(/^0+/, "")}`;

    // Build notes from filter details if present
    let notes: string | null = null;
    if (filterDetails && Object.keys(filterDetails).length > 0) {
      notes = "Filters: " + JSON.stringify(filterDetails);
    }

    // Parse price range from filter details into budget fields
    const budgetMin = filterDetails?.priceFrom > 0 ? filterDetails.priceFrom : null;
    const budgetMax = filterDetails?.priceTo < 100_000_000 ? filterDetails.priceTo : null;

    const { error } = await supabase.from("leads").insert({
      name:           name.trim(),
      email:          email.trim().toLowerCase(),
      phone:          fullPhone,
      project_name:   projectName   || null,
      developer_name: developerName || null,
      area_name:      areaName      || null,
      message:        message?.trim() || null,
      page_url:       sourceUrl     || null,
      enquiry_type:   "website_form",
      lead_status:    "new",
      lead_score:     "cold",
      notes:          notes,
      budget_min:     budgetMin,
      budget_max:     budgetMax,
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
