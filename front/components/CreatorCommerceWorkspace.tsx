
import { useCopy } from "@/i18n/copy";
import { SITE_MOTTO } from '@/lib/brand';
import Link from '@/i18n/link';
import { Sidebar } from "@/components/Sidebar";
import { StudioMemberships } from "@/components/StudioMemberships";
import styles from "@/app/dashboard/studio/studio.module.css";

export default function CreatorCommerceWorkspace() {
  const t = useCopy();
  return <div className={styles.shell}>
    <Sidebar />
    <main id="main-content" tabIndex={-1} className={styles.main}>
      <header className={styles.top}><span>{t("VYNX / CREATOR DASHBOARD")}</span><Link href="/dashboard/card" className={styles.demo}>{t("Edit my profile ↗")}</Link></header>
      <div className={styles.heading}><div>
        <p className={styles.eyebrow}>{t("YOUR COMMUNITY, CLOSER")}</p>
        <h1>{t("Subscriptions")}</h1>
        <p>{t("Define membership tiers and content for your community.")}</p>
      </div></div>
      <div className={styles.integrationNote} role="note"><strong>{t("New feature preview")}</strong><p>{t("Offers, images, and actions are examples. Tiers are not published and no charges are made yet. Changes last for this session.")}</p></div>
      <div className={styles.content}><StudioMemberships /></div>
      <footer className={styles.footer}><span>{t(SITE_MOTTO)}</span><Link href="/dashboard">{t("Back to overview")}</Link><Link href="/dashboard/studio">{t("Explore the mockup catalog ↗")}</Link></footer>
    </main>
  </div>;
}
