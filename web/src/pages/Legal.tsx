import { useEffect } from "react";
import { Link } from "react-router-dom";

/**
 * Terms of Service and Privacy Policy for the demo.
 * They describe what this project really does. Anything that needs a decision
 * by the operator is marked as a draft, not filled in with invented commitments.
 */

const Draft = () => <span className="draft-tag">Draft</span>;

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Kernelcraft`;
    return () => {
      document.title = "Kernelcraft";
    };
  }, [title]);
  return (
    <article className="prose">
      <h1>{title}</h1>
      <p className="muted">Last updated October 1, 2026</p>
      <p className="draft-note">
        This page is a draft for review. It describes how the demo works today. Items marked <Draft /> are missing
        details that the operator needs to supply and that a lawyer should review before any real use.
      </p>
      {children}
    </article>
  );
}

export function Terms() {
  return (
    <Page title="Terms of Service">
      <h2>What Kernelcraft is</h2>
      <p>
        Kernelcraft is a practice store for video courses. The courses,
        instructors, prices and reviews are made up. It is not affiliated with or endorsed by Koah Labs or any
        advertising platform named on the site.
      </p>

      <h2>No real purchases</h2>
      <p>
        Placing an order saves a practice order record. No payment is taken, no card details are
        collected, no course is delivered and no refund is owed.
      </p>

      <h2>Using the store</h2>
      <ul>
        <li>You may browse, add courses to your cart and place practice orders.</li>
        <li>Please do not send personal data, credentials or real payment details through any field.</li>
        <li>The practice data can be reset at any time, so nothing you create is kept for you.</li>
      </ul>

      <h2>Content and credits</h2>
      <p>
        Course posters are generated for this project. Photographs come from Unsplash and are used under the Unsplash
        license, with the photographers credited in the page footer. The names Koah, Google, Facebook and Penrose
        appear only to describe the demo scenario.
      </p>

      <h2>No warranty</h2>
      <p>
        The demo is provided as is, without promises about availability or accuracy. Figures on the dashboard come from
        simulated traffic plus any clicks you make yourself. <Draft /> Warranty and liability wording to be reviewed.
      </p>

      <h2>Governing law and contact</h2>
      <p>
        <Draft /> Operator name, governing law and a contact address have not been supplied yet.
      </p>

      <h2>Changes</h2>
      <p>These terms may change as the project changes. The date at the top shows the latest revision.</p>
      <p>See also the <Link to="/privacy">Privacy Policy</Link>.</p>
    </Page>
  );
}

export function Privacy() {
  return (
    <Page title="Privacy Policy">
      <h2>What the tracking does</h2>
      <p>
        This site includes a small tracking script (a pixel) that works the way an advertiser's conversion pixel does.
        It exists to show how a visit from an ad is tied to a later purchase.
      </p>

      <h2>What is collected</h2>
      <ul>
        <li>
          <strong>A visitor ID.</strong> A random ID kept in a first-party cookie named koah_uid. It is set by the server,
          is not readable by page scripts, and lasts up to 365 days.
        </li>
        <li>
          <strong>A Koah click ID.</strong> If the address contains a kad_cid value, it is kept in a first-party cookie
          named koah_kad_cid for up to 30 days.
        </li>
        <li>
          <strong>The ad visit for each tab.</strong> The ad parameters in the landing address (utm_source, utm_medium,
          utm_campaign, utm_content), the click ID and the landing address are kept in the tab's session storage and
          cleared when the tab closes.
        </li>
        <li>
          <strong>Events.</strong> For each page view and shopping step: the event name, time, page address, referrer,
          browser user agent, a per-tab ID, and product, price and order details where relevant.
        </li>
        <li>
          <strong>Orders.</strong> An order ID, the items and the total. The optional email field at checkout stays in
          your browser and is not sent to the server or the tracker.
        </li>
      </ul>
      <p>
        The server uses your network address only to limit request rates and does not store it with events. Pages under
        /admin and /chat are not tracked as store traffic.
      </p>

      <h2>How it is used</h2>
      <p>
        Events are stored in the demo's own PostgreSQL database and shown on the attribution dashboard. Crawler traffic
        is stored, flagged and left out of the numbers. Nothing is sold, shared with advertising networks or sent to any
        third party by this project.
      </p>

      <h2>Keeping and deleting data</h2>
      <p>
        Data stays until the dashboard's Reset data button is used or the database is wiped. You can remove the
        cookies at any time in your browser settings. <Draft /> A fixed retention period and a way to request deletion
        have not been decided.
      </p>

      <h2>Your rights and contact</h2>
      <p>
        <Draft /> Region-specific rights (for example under GDPR or CCPA), the data controller's name and a contact
        address have not been supplied yet.
      </p>

      <p>See also the <Link to="/terms">Terms of Service</Link>.</p>
    </Page>
  );
}
