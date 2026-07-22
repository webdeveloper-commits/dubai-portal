import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Elysian Real Estate Dubai",
  description: "How Elysian Real Estate collects, uses, and protects your personal data in accordance with UAE law and international privacy standards.",
  alternates: { canonical: "https://elysian.ae/privacy-policy" },
};

const LAST_UPDATED = "22 July 2026";

export default function PrivacyPolicyPage() {
  return (
    <main style={{ background: "#f4f6f9" }}>

      {/* Hero */}
      <section style={{ background: "linear-gradient(145deg, #0d1e2e 0%, #192537 100%)", paddingTop: 120, paddingBottom: 60, paddingLeft: 24, paddingRight: 24, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(127,226,227,0.07) 1px, transparent 1px)", backgroundSize: "38px 38px", pointerEvents: "none" }} />
        <div style={{ maxWidth: 800, margin: "0 auto", position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 24 }}>
            <Link href="/" style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>Home</Link>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
            <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7fe2e3" }}>Privacy Policy</span>
          </div>
          <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "clamp(28px, 4vw, 42px)", color: "white", margin: "0 0 12px", letterSpacing: "-0.02em" }}>
            Privacy Policy
          </h1>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.7 }}>
            Last updated: {LAST_UPDATED} · Effective immediately
          </p>
        </div>
      </section>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "56px 24px 96px" }}>
        <div style={{ background: "white", borderRadius: 20, padding: "48px 52px", boxShadow: "0 2px 20px rgba(25,37,55,0.06)", border: "1px solid rgba(25,37,55,0.05)" }} className="legal-doc">

          <Intro />

          <Section title="1. Who We Are">
            <p>Elysian Real Estate LLC ("<strong>Elysian</strong>", "<strong>we</strong>", "<strong>us</strong>", or "<strong>our</strong>") is a licensed real estate agency registered and operating in Dubai, United Arab Emirates, under the Real Estate Regulatory Authority (RERA). Our registered office is located at Elysian Sales Center, Umm Al Sheif, Sheikh Zayed Road, Dubai, UAE.</p>
            <p>We operate the website at <strong>dubai-portal.elysian.ae</strong> (the "Portal") and the main company website at <strong>elysian.com</strong>. This Privacy Policy applies to all personal data we collect through these websites and through our property enquiry services.</p>
            <p>For any privacy-related questions, you may contact our Data Protection Officer at: <a href="mailto:info@elysian.com">info@elysian.com</a></p>
          </Section>

          <Section title="2. Information We Collect">
            <p>We collect personal data in the following ways:</p>
            <SubHeading>2.1 Information You Provide Directly</SubHeading>
            <ul>
              <li><strong>Enquiry forms:</strong> When you submit a property enquiry, we collect your full name, email address, phone number, and any message or requirements you provide.</li>
              <li><strong>Contact requests:</strong> When you request a callback or arrange a viewing, we collect your name, contact number, and preferred time.</li>
              <li><strong>Newsletter sign-ups:</strong> If you subscribe to our newsletter, we collect your email address.</li>
            </ul>
            <SubHeading>2.2 Information Collected Automatically</SubHeading>
            <ul>
              <li><strong>Usage data:</strong> Pages visited, time spent on pages, search queries entered, property listings viewed, and filter preferences applied.</li>
              <li><strong>Device and technical data:</strong> IP address, browser type, operating system, referring URL, and device identifiers.</li>
              <li><strong>Cookies and tracking:</strong> Session cookies, analytics cookies, and advertising tracking parameters (see Section 6 for full details).</li>
              <li><strong>UTM and advertising parameters:</strong> If you arrive via a Google Ads campaign, we collect UTM parameters (source, medium, campaign, content, term) and Google Click IDs (gclid) to measure the effectiveness of our advertising.</li>
            </ul>
            <SubHeading>2.3 Information from Third Parties</SubHeading>
            <ul>
              <li>Property market data and area information from publicly available sources.</li>
              <li>If you contact us via WhatsApp, Instagram, or other platforms, we may receive your profile name and message content.</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use your personal data for the following purposes:</p>
            <table>
              <thead>
                <tr><th>Purpose</th><th>Legal Basis</th></tr>
              </thead>
              <tbody>
                <tr><td>Responding to your property enquiries and connecting you with our advisors</td><td>Contract / Legitimate interests</td></tr>
                <tr><td>Sending property listings and market updates that match your preferences</td><td>Consent / Legitimate interests</td></tr>
                <tr><td>Improving our website content and user experience</td><td>Legitimate interests</td></tr>
                <tr><td>Measuring the performance of our advertising campaigns</td><td>Legitimate interests</td></tr>
                <tr><td>Complying with legal and regulatory obligations under UAE law</td><td>Legal obligation</td></tr>
                <tr><td>Fraud prevention and security</td><td>Legitimate interests / Legal obligation</td></tr>
              </tbody>
            </table>
          </Section>

          <Section title="4. Sharing Your Information">
            <p>We do not sell your personal data to third parties. We may share your data with:</p>
            <ul>
              <li><strong>Property developers:</strong> When you enquire about a specific off-plan project, we may share your contact details with the relevant developer to fulfil your enquiry. We only do so with your knowledge, as stated at the point of enquiry.</li>
              <li><strong>Service providers:</strong> Our CRM system, cloud hosting (Supabase/Vercel), email services, and analytics providers (Google Analytics) acting as data processors under our instructions.</li>
              <li><strong>Google Ads:</strong> Conversion data may be shared to measure campaign effectiveness, in accordance with Google's Privacy Policy.</li>
              <li><strong>Legal and regulatory authorities:</strong> Dubai Land Department (DLD), RERA, or other government bodies where required by UAE law.</li>
              <li><strong>Business transfers:</strong> In the event of a merger, acquisition, or sale of assets, your data may be transferred to the succeeding entity, with notice provided to you.</li>
            </ul>
          </Section>

          <Section title="5. Data Retention">
            <p>We retain your personal data for as long as necessary to fulfil the purposes described in this policy, or as required by UAE law. Our standard retention periods are:</p>
            <ul>
              <li><strong>Enquiry records:</strong> 5 years from the date of enquiry, in line with UAE commercial record-keeping requirements.</li>
              <li><strong>Marketing preferences:</strong> Until you withdraw consent or request deletion.</li>
              <li><strong>Website analytics:</strong> 26 months, after which data is anonymised or deleted.</li>
              <li><strong>Financial and transaction records:</strong> 10 years, as required by UAE Commercial Companies Law.</li>
            </ul>
          </Section>

          <Section title="6. Cookies & Tracking Technologies">
            <p>We use cookies and similar technologies on our Portal. Here is a summary of what we use:</p>
            <SubHeading>Essential Cookies</SubHeading>
            <p>Required for the website to function correctly. These cannot be disabled. They include session management and security cookies.</p>
            <SubHeading>Analytics Cookies</SubHeading>
            <p>We use Google Analytics to understand how visitors use our website — which pages are most popular, how long users stay, and where they come from. This data is aggregated and anonymised.</p>
            <SubHeading>Advertising Cookies / UTM Tracking</SubHeading>
            <p>When you arrive via a Google Ads link, we store your UTM parameters and any Google Click ID (gclid) in your browser's session storage. This data is tied to your enquiry if you submit a form, helping us understand which campaigns generate genuine property interest. This data is not shared externally beyond Google Ads conversion tracking.</p>
            <p>You can control cookies through your browser settings. Note that disabling certain cookies may affect site functionality.</p>
          </Section>

          <Section title="7. Your Rights">
            <p>Under the UAE Personal Data Protection Law (Federal Decree-Law No. 45 of 2021) and, where applicable, the EU General Data Protection Regulation (GDPR), you have the following rights:</p>
            <ul>
              <li><strong>Right of access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Right to rectification:</strong> Request correction of inaccurate or incomplete data.</li>
              <li><strong>Right to erasure:</strong> Request deletion of your data where there is no compelling reason for us to continue processing it.</li>
              <li><strong>Right to restrict processing:</strong> Request that we limit how we use your data in certain circumstances.</li>
              <li><strong>Right to data portability:</strong> Receive your data in a structured, machine-readable format.</li>
              <li><strong>Right to object:</strong> Object to processing based on our legitimate interests, including direct marketing.</li>
              <li><strong>Right to withdraw consent:</strong> Where processing is based on consent, withdraw it at any time without affecting lawfulness of prior processing.</li>
            </ul>
            <p>To exercise any of these rights, please contact us at <a href="mailto:info@elysian.com">info@elysian.com</a>. We will respond within 30 days. We may need to verify your identity before processing your request.</p>
          </Section>

          <Section title="8. Data Security">
            <p>We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, accidental loss, alteration, or disclosure. These include:</p>
            <ul>
              <li>Encrypted data transmission (HTTPS/TLS) across all our web properties.</li>
              <li>Access controls limiting data access to authorised personnel only.</li>
              <li>Regular security reviews of our third-party service providers.</li>
              <li>Row-level security on our database to prevent cross-account data access.</li>
            </ul>
            <p>No method of transmission over the internet is 100% secure. While we strive to use commercially acceptable means to protect your data, we cannot guarantee absolute security.</p>
          </Section>

          <Section title="9. International Data Transfers">
            <p>Our portal infrastructure may involve transfers of personal data to countries outside the UAE, including to the European Union (via cloud hosting providers). Where such transfers occur, we ensure adequate protections are in place through:</p>
            <ul>
              <li>Standard Contractual Clauses (SCCs) approved by the European Commission.</li>
              <li>Adequacy decisions where applicable.</li>
              <li>Our data processors' compliance with GDPR or equivalent standards.</li>
            </ul>
          </Section>

          <Section title="10. Third-Party Links">
            <p>Our website may contain links to third-party websites, including property developer sites, map services, and social media platforms. This Privacy Policy does not apply to those external sites. We encourage you to read the privacy policies of any third-party websites you visit.</p>
          </Section>

          <Section title="11. Children's Privacy">
            <p>Our services are not directed at children under the age of 18. We do not knowingly collect personal data from minors. If you believe we have inadvertently collected data from a child, please contact us immediately at <a href="mailto:info@elysian.com">info@elysian.com</a> and we will delete it promptly.</p>
          </Section>

          <Section title="12. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time to reflect changes in our practices or applicable law. We will notify you of material changes by posting the updated policy on this page with a revised "Last Updated" date. We encourage you to review this page periodically.</p>
            <p>Continued use of our website following the posting of changes constitutes acceptance of the revised policy.</p>
          </Section>

          <Section title="13. Contact Us">
            <p>If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact:</p>
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
        .legal-doc table { width: 100%; border-collapse: collapse; margin: 0 0 20px; font-family: Verdana, sans-serif; font-size: 12px; }
        .legal-doc th { background: #f4f6f9; padding: 11px 14px; text-align: left; font-family: Montserrat, sans-serif; font-weight: 700; font-size: 11px; color: #192537; border-bottom: 2px solid #e8ecf0; }
        .legal-doc td { padding: 11px 14px; color: #555; border-bottom: 1px solid #f0f2f5; vertical-align: top; }
        .legal-doc tr:last-child td { border-bottom: none; }
        @media (max-width: 640px) {
          .legal-doc { padding: 32px 24px !important; }
          .legal-doc table { display: block; overflow-x: auto; }
        }
      `}</style>
    </main>
  );
}

function Intro() {
  return (
    <div style={{ background: "rgba(127,226,227,0.06)", border: "1px solid rgba(127,226,227,0.2)", borderRadius: 14, padding: "20px 24px", marginBottom: 40 }}>
      <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#192537", lineHeight: 1.8, margin: 0 }}>
        At Elysian Real Estate, we take your privacy seriously. This policy explains what personal data we collect when you use our property portal, why we collect it, how we use it, and your rights regarding it. Please read this document carefully. By using our website, you agree to the practices described below.
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
