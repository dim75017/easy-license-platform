import { pageMetadata } from "../_lib/seo";
import Link from "next/link";
import { EditorialInfoPage } from "../components/EditorialInfoPage";
import { LofiGirlWordmark } from "../components/LofiGirlWordmark";

export const metadata = pageMetadata("Privacy", "How the live Symbiome beta handles account, request and browser-stored information.", "/privacy");

export default function PrivacyPage() {
  return (
    <EditorialInfoPage
      eyebrow="Privacy"
      title={<>What Symbiome collects,<br />and why.</>}
      lead="Symbiome is a live public beta. Account profiles and submitted business requests are processed by the hosted service; personal playlists and unfinished drafts can also be stored locally on your device."
      actions={[
        { label: "Read about browser storage", href: "/cookies" },
        { label: <><LofiGirlWordmark className="lofi-girl-wordmark-inline" /> privacy policy</>, ariaLabel: "Lofi Girl privacy policy", href: "https://www.lofigirl.com/privacy", external: true, secondary: true },
      ]}
      sections={[
        {
          id: "information-collected",
          eyebrow: "Information collected",
          title: "Accounts and requests use only the details needed for the feature.",
          content: (
            <>
              <p>When you create a live Symbiome account, the secure identity service provides an account identifier, email address and display name. Symbiome stores those details with your optional company, plan preference, primary publishing platform, marketing choice and setup timestamps.</p>
              <p>When you send a licensing, custom-music or retail request, the live service stores the details you submit, such as your name, work email, company, project, intended use, rights scope, timing, budget and notes. Please do not include passwords, payment-card details or other sensitive information in a brief.</p>
            </>
          ),
        },
        {
          id: "why-and-how",
          eyebrow: "Purpose and legal basis",
          title: "Each use has a defined purpose and legal basis.",
          content: (
            <>
              <ul className="support-list">
                <li><strong>Account access</strong><span>Authenticate you, create or update your profile and return you to the correct workspace as part of the service you request.</span></li>
                <li><strong>Business requests</strong><span>Take pre-contractual steps at your request, clarify the scope, prepare a response and maintain the related conversation.</span></li>
                <li><strong>Product updates</strong><span>Send occasional catalogue or product news only with your consent, which you may withdraw at any time.</span></li>
                <li><strong>Service protection</strong><span>Rely on legitimate interests to operate and secure the hosted service and investigate misuse or technical faults.</span></li>
              </ul>
              <p>Plan selection during account setup records a preference only. It does not take payment, activate a subscription or issue a licence.</p>
            </>
          ),
        },
        {
          id: "device-storage",
          eyebrow: "Your device",
          title: "Some library activity stays in this browser.",
          content: (
            <>
              <p>Liked-track IDs, personal playlists, listening-copy download history and personal playlist artwork are stored locally in your browser. Unfinished business-request drafts are stored for the browser session. They are not part of your online Symbiome profile and do not follow you to another device.</p>
              <p>You can remove individual playlists and tracks in the workspace or clear the site data in your browser. The <Link href="/cookies">Cookies and browser storage page</Link> lists the exact storage used.</p>
            </>
          ),
        },
        {
          id: "hosting-retention",
          eyebrow: "Hosting and retention",
          title: "The live service uses a defined retention period and named technical providers.",
          content: (
            <>
              <p>OpenAI provides the Codex Sites hosting and secure identity layer. Cloudflare provides the connected D1 database and R2 storage used by the service. These providers process data only to deliver and secure the relevant infrastructure; transfers outside the European Economic Area must use the safeguards applicable to the provider, such as standard contractual clauses.</p>
              <p>Account and request records are retained for up to three years after your last interaction or the end of the related relationship, then deleted or anonymised unless a longer legal retention duty applies. Marketing consent is kept only while it remains valid. Authorised operating-team members may access submitted information only to answer a request, support an account or operate the service.</p>
              <p>Please do not submit sensitive personal data. The separate static GitHub mirror does not submit account or request data when its demo mode is active.</p>
            </>
          ),
        },
        {
          id: "rights-contact",
          eyebrow: "Your rights",
          title: "You can ask about, correct or delete your information.",
          content: (
            <>
              <p>Depending on applicable law, you may have rights to access, correct, delete, restrict, object to or receive a copy of your personal information, and to withdraw a marketing consent.</p>
              <p>Until the current Symbiome operator details are formally confirmed on the <Link href="/legal">Legal information page</Link>, send privacy requests to <a href="mailto:contact@lofigirl.com">contact@lofigirl.com</a> or use the <a href="https://www.lofigirl.com/contact" target="_blank" rel="noreferrer">official <LofiGirlWordmark className="lofi-girl-wordmark-inline" /> contact form</a>, and identify the request as concerning Symbiome. You may also lodge a complaint with the French CNIL.</p>
              <p className="support-notice">Last updated: 24 August 2026. This notice describes the current live public beta.</p>
            </>
          ),
        },
      ]}
    />
  );
}
