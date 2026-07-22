import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms and Conditions | Elysian Real Estate Dubai",
  description: "Terms and conditions governing use of the Elysian Real Estate property portal, including listing accuracy, intellectual property, and UAE law compliance.",
  alternates: { canonical: "https://elysian.ae/terms-and-conditions" },
};

const LAST_UPDATED = "22 July 2026";

export default function TermsPage() {
  return (
    <main style={{ background: "#f4f6f9" }}>

      {/* Hero */}
      <section style={{ background: "linear-gradient(145deg, #0d1e2e 0%, #192537 100%)", paddingTop: 120, paddingBottom: 60, paddingLeft: 24, paddingRight: 24, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(127,226,227,0.07) 1px, transparent 1px)", backgroundSize: "38px 38px", pointerEvents: "none" }} />
        <div style={{ maxWidth: 800, margin: "0 auto", position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 24 }}>
            <Link href="/" style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>Home</Link>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
            <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7fe2e3" }}>Terms & Conditions</span>
          </div>
          <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "clamp(28px, 4vw, 42px)", color: "white", margin: "0 0 12px", letterSpacing: "-0.02em" }}>
            Terms & Conditions
          </h1>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.7 }}>
            Last updated: {LAST_UPDATED} · Please read carefully before using this website
          </p>
        </div>
      </section>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "56px 24px 96px" }}>
        <div style={{ background: "white", borderRadius: 20, padding: "48px 52px", boxShadow: "0 2px 20px rgba(25,37,55,0.06)", border: "1px solid rgba(25,37,55,0.05)" }} className="legal-doc">

          <Intro />

          <Section title="1. Acceptance of Terms">
            <p>By accessing or using the Elysian Real Estate property portal (the "<strong>Portal</strong>") at <strong>dubai-portal.elysian.ae</strong> or any associated Elysian website, you agree to be bound by these Terms and Conditions ("<strong>Terms</strong>"), our <Link href="/privacy-policy">Privacy Policy</Link>, and all applicable UAE laws and regulations.</p>
            <p>If you do not agree with any part of these Terms, you must immediately cease using the Portal. These Terms constitute a legally binding agreement between you ("<strong>User</strong>", "<strong>you</strong>") and Elysian Real Estate LLC ("<strong>Elysian</strong>", "<strong>we</strong>", "<strong>us</strong>").</p>
            <p>We reserve the right to modify these Terms at any time. Continued use of the Portal after changes are posted constitutes your acceptance of the revised Terms. The date of the most recent revision is shown at the top of this page.</p>
          </Section>

          <Section title="2. About Elysian Real Estate">
            <p>Elysian Real Estate LLC is a licensed real estate brokerage registered in the Emirate of Dubai, United Arab Emirates, and regulated by the Real Estate Regulatory Authority (RERA) under the Dubai Land Department (DLD). We hold all required licences to conduct real estate brokerage activities in Dubai and the wider UAE.</p>
            <p><strong>RERA ORN:</strong> [Registration Number]<br />
            <strong>DED Licence:</strong> [Licence Number]<br />
            <strong>Registered Address:</strong> Elysian Sales Center, Umm Al Sheif, Sheikh Zayed Road, Dubai, UAE</p>
            <p>Our agents are registered brokers certified by RERA. We adhere to the RERA Code of Ethics and all applicable real estate regulations in the UAE.</p>
          </Section>

          <Section title="3. Use of the Portal">
            <SubHeading>3.1 Permitted Use</SubHeading>
            <p>You may use the Portal for lawful personal and non-commercial purposes only — specifically to browse property listings, research Dubai communities, and submit genuine property enquiries. You must be at least 18 years of age to use this Portal.</p>
            <SubHeading>3.2 Prohibited Conduct</SubHeading>
            <p>You agree not to:</p>
            <ul>
              <li>Submit false, misleading, or fraudulent enquiries or personal information.</li>
              <li>Use automated tools, bots, scrapers, or crawlers to extract content or data from the Portal without our prior written consent.</li>
              <li>Attempt to gain unauthorised access to our systems, databases, or any other user's data.</li>
              <li>Use the Portal to transmit spam, unsolicited communications, or malicious code.</li>
              <li>Reproduce, republish, distribute, or commercially exploit any content from the Portal without express written permission from Elysian.</li>
              <li>Interfere with the proper functioning of the Portal or its underlying infrastructure.</li>
              <li>Use the Portal for any purpose that violates UAE law, including Federal Law No. 5 of 2012 on Combating Cybercrimes.</li>
            </ul>
            <p>We reserve the right to suspend or terminate your access without notice if we reasonably believe you have breached these Terms.</p>
          </Section>

          <Section title="4. Property Listings & Information Accuracy">
            <SubHeading>4.1 Nature of Listings</SubHeading>
            <p>Property listings, project details, floor plans, pricing, and specifications displayed on this Portal are provided for general information purposes only. They are sourced from developers, third-party data providers, and public records, and are subject to change without notice.</p>
            <SubHeading>4.2 No Guarantee of Accuracy</SubHeading>
            <p>While we take reasonable care to ensure information on the Portal is accurate and up to date, Elysian makes no representations or warranties of any kind — express or implied — regarding the completeness, accuracy, reliability, or availability of any listing, price, availability status, or project timeline.</p>
            <ul>
              <li>Prices displayed are indicative only and may not reflect current market pricing or developer-confirmed prices.</li>
              <li>Handover dates for off-plan projects are estimates provided by developers and are subject to construction progress and regulatory approvals.</li>
              <li>Floor plans, renders, and lifestyle images are artist impressions intended to be representative only. Actual finishes, layouts, and dimensions may vary.</li>
              <li>Project status (Off-Plan, Ready, New Launch) reflects our best understanding at the time of publication and may change.</li>
            </ul>
            <SubHeading>4.3 Verification Responsibility</SubHeading>
            <p>Before making any investment or purchase decision, you are solely responsible for independently verifying all information with the relevant developer, the Dubai Land Department (DLD), or a qualified legal and financial advisor. Nothing on this Portal constitutes an offer to sell, a solicitation to buy, or investment advice.</p>
          </Section>

          <Section title="5. Enquiries & Lead Submissions">
            <p>When you submit an enquiry form on the Portal, you:</p>
            <ul>
              <li>Confirm that the information you provide is accurate, complete, and genuinely relates to your property interest.</li>
              <li>Consent to being contacted by Elysian advisors via phone, email, or WhatsApp regarding your enquiry.</li>
              <li>Acknowledge that your enquiry data may be shared with the relevant property developer where necessary to fulfil your request.</li>
              <li>Understand that submitting an enquiry does not create any contractual obligation on either party to proceed with a property transaction.</li>
            </ul>
            <p>We aim to respond to all enquiries within one business day during UAE working hours (Sunday to Thursday, 9:00 AM – 6:00 PM GST).</p>
          </Section>

          <Section title="6. Intellectual Property">
            <p>All content on the Portal — including but not limited to text, area guides, project descriptions, photographs, graphics, videos, logos, and the Portal's design and layout — is the intellectual property of Elysian Real Estate LLC or our licensed content partners, and is protected under UAE Federal Law No. 7 of 2002 concerning Copyrights and Neighbouring Rights and applicable international copyright conventions.</p>
            <p>You may not copy, reproduce, republish, upload, post, transmit, or distribute any content from this Portal in any form without our express prior written consent, except for personal, non-commercial use (e.g. saving a page for your own reference).</p>
            <p>The Elysian name, logo, and related trademarks are the property of Elysian Real Estate LLC. Nothing on the Portal grants you any licence or right to use our trademarks.</p>
          </Section>

          <Section title="7. Third-Party Links & Content">
            <p>The Portal may contain links to third-party websites, including property developer sites, map providers (Google Maps), payment processors, and social media platforms. These links are provided for convenience only.</p>
            <p>Elysian has no control over and accepts no responsibility for the content, privacy practices, or reliability of any third-party websites. The inclusion of any link does not imply our endorsement of that website or its operator. We encourage you to read the terms and privacy policies of any external sites you visit.</p>
          </Section>

          <Section title="8. Developer & Project Information">
            <p>Developer profiles, company descriptions, project portfolios, and related content on the Portal are compiled from publicly available information and our own research. Elysian does not represent, act as agent for, or have any formal partnership with any developer unless explicitly stated.</p>
            <p>Any developer names, logos, or trademarks used on this Portal remain the property of their respective owners and are used for identification purposes only. Their appearance on the Portal does not imply affiliation, endorsement, or sponsorship.</p>
          </Section>

          <Section title="9. Disclaimer of Warranties">
            <p>The Portal and all content within it are provided on an "<strong>as is</strong>" and "<strong>as available</strong>" basis, without any warranties of any kind, either express or implied, including but not limited to:</p>
            <ul>
              <li>Warranties of merchantability, fitness for a particular purpose, or non-infringement.</li>
              <li>Warranties that the Portal will be uninterrupted, error-free, or free of viruses or other harmful components.</li>
              <li>Warranties as to the accuracy, completeness, or timeliness of any content, pricing, or availability data.</li>
            </ul>
            <p>To the maximum extent permitted by UAE law, Elysian expressly disclaims all such warranties.</p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>To the fullest extent permitted by applicable UAE law, Elysian Real Estate LLC, its directors, employees, agents, and affiliates shall not be liable for any:</p>
            <ul>
              <li>Direct, indirect, incidental, special, or consequential damages arising from your use of, or inability to use, the Portal or its content.</li>
              <li>Loss of profits, loss of data, loss of goodwill, or investment losses arising from reliance on information displayed on the Portal.</li>
              <li>Damages arising from any inaccuracy in property pricing, availability, handover dates, or project specifications.</li>
              <li>Unauthorised access to or alteration of your data due to circumstances beyond our reasonable control.</li>
            </ul>
            <p>This limitation applies regardless of whether we have been advised of the possibility of such damages, and regardless of the theory of liability (contract, tort, statute, or otherwise).</p>
            <p>Nothing in these Terms shall limit liability for death or personal injury caused by our negligence, or for fraud or fraudulent misrepresentation.</p>
          </Section>

          <Section title="11. RERA Compliance & Regulatory Notices">
            <p>All real estate transactions involving properties in Dubai must be conducted in accordance with the rules and regulations of the Real Estate Regulatory Authority (RERA) and the Dubai Land Department (DLD). This includes:</p>
            <ul>
              <li>Off-plan properties must be registered with RERA and held in an escrow account approved by the DLD before being offered for sale.</li>
              <li>Buyers are advised to verify the registration status of any off-plan project via the Dubai REST application or the DLD official portal (dubailand.gov.ae) before proceeding.</li>
              <li>Service charges, maintenance fees, and community charges are regulated by RERA and vary by development. Ask your Elysian advisor for current estimates.</li>
              <li>Foreign nationals may purchase freehold property in designated freehold zones in Dubai. Eligibility for UAE Golden Visa through property investment is subject to current DLD and ICP criteria.</li>
            </ul>
            <p>Elysian agents will provide RERA-compliant advice. However, you are strongly encouraged to engage an independent UAE-qualified legal advisor before signing any sale and purchase agreement (SPA).</p>
          </Section>

          <Section title="12. Area Guides & Investment Information">
            <p>The area guides, ROI estimates, rental yield data, market commentary, and investment analysis published on this Portal are intended for general informational purposes only. They do not constitute financial, investment, or legal advice.</p>
            <p>Past performance of property markets is not indicative of future results. Property investment in the UAE carries risk, including the risk of capital loss, rental vacancy, and changes in regulatory environment. You should consult a qualified financial advisor before making any investment decision.</p>
          </Section>

          <Section title="13. Governing Law & Dispute Resolution">
            <p>These Terms and any disputes arising out of or in connection with them shall be governed by and construed in accordance with the laws of the Emirate of Dubai and the federal laws of the United Arab Emirates.</p>
            <p>Any disputes shall first be referred to good-faith negotiation between the parties. If unresolved within 30 days, disputes shall be submitted to the exclusive jurisdiction of the courts of Dubai, UAE.</p>
            <p>Nothing in this clause prevents either party from seeking urgent injunctive or other equitable relief in any court of competent jurisdiction.</p>
          </Section>

          <Section title="14. Indemnification">
            <p>You agree to indemnify, defend, and hold harmless Elysian Real Estate LLC, its officers, directors, employees, and agents from and against any and all claims, damages, losses, costs, and expenses (including reasonable legal fees) arising from:</p>
            <ul>
              <li>Your use of the Portal in violation of these Terms.</li>
              <li>Your submission of false or misleading information.</li>
              <li>Your violation of any third-party rights, including intellectual property rights.</li>
              <li>Your violation of any applicable UAE law or regulation.</li>
            </ul>
          </Section>

          <Section title="15. Severability">
            <p>If any provision of these Terms is found to be unlawful, void, or unenforceable under applicable UAE law, that provision shall be deemed severed from these Terms and shall not affect the validity and enforceability of the remaining provisions.</p>
          </Section>

          <Section title="16. Entire Agreement">
            <p>These Terms, together with our <Link href="/privacy-policy">Privacy Policy</Link>, constitute the entire agreement between you and Elysian Real Estate LLC with respect to your use of the Portal and supersede all prior agreements, representations, and understandings.</p>
          </Section>

          <Section title="17. Contact Us">
            <p>If you have any questions about these Terms and Conditions, please contact us:</p>
            <ContactBlock />
          </Section>

        </div>
      </div>

      <style>{`
        .legal-doc p { font-family: Verdana, sans-serif; font-size: 13px; color: #555; line-height: 1.9; margin: 0 0 16px; }
        .legal-doc ul { font-family: Verdana, sans-serif; font-size: 13px; color: #555; line-height: 1.9; margin: 0 0 16px; padding-left: 22px; }
        .legal-doc ul li { margin-bottom: 6px; }
        .legal-doc strong { color: #192537; }
        .legal-doc a { color: #7fe2e3; text-decoration: none; }
        .legal-doc a:hover { text-decoration: underline; }
        @media (max-width: 640px) {
          .legal-doc { padding: 32px 24px !important; }
        }
      `}</style>
    </main>
  );
}

function Intro() {
  return (
    <div style={{ background: "rgba(127,226,227,0.06)", border: "1px solid rgba(127,226,227,0.2)", borderRadius: 14, padding: "20px 24px", marginBottom: 40 }}>
      <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#192537", lineHeight: 1.8, margin: 0 }}>
        These Terms and Conditions govern your access to and use of the Elysian Real Estate property portal. They contain important information about your rights and obligations, including limitations on our liability and how disputes are resolved. Please read them in full before proceeding.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 17, color: "#192537", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 4, height: 18, background: "#7fe2e3", borderRadius: 2, flexShrink: 0, display: "inline-block" }} />
        {title}
      </h2>
      {children}
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#192537", margin: "20px 0 8px" }}>
      {children}
    </p>
  );
}

function ContactBlock() {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 14, padding: "20px 24px", border: "1px solid #eef0f3", fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#555", lineHeight: 2 }}>
      <strong style={{ fontFamily: "Montserrat, sans-serif", color: "#192537", display: "block", marginBottom: 6 }}>Elysian Real Estate LLC</strong>
      Elysian Sales Center, Umm Al Sheif, Sheikh Zayed Road<br />
      Dubai, United Arab Emirates<br />
      📧 <a href="mailto:info@elysian.com" style={{ color: "#7fe2e3" }}>info@elysian.com</a><br />
      📞 <a href="tel:+971547786800" style={{ color: "#7fe2e3" }}>+971 54 778 6800</a><br />
      🌐 <a href="https://elysian.com" target="_blank" rel="noopener noreferrer" style={{ color: "#7fe2e3" }}>elysian.com</a>
    </div>
  );
}
