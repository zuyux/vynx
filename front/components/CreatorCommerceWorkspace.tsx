import { SITE_MOTTO } from '@/lib/brand';
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { StudioMemberships } from "@/components/StudioMemberships";
import styles from "@/app/dashboard/studio/studio.module.css";

export default function CreatorCommerceWorkspace() {
  return <div className={styles.shell}>
    <Sidebar />
    <main id="main-content" tabIndex={-1} className={styles.main}>
      <header className={styles.top}><span>VYNX / CREATOR DASHBOARD</span><Link href="/dashboard/card" className={styles.demo}>Edit my profile ↗</Link></header>
      <div className={styles.heading}><div>
        <p className={styles.eyebrow}>YOUR COMMUNITY, CLOSER</p>
        <h1>Subscriptions</h1>
        <p>Define membership tiers and content for your community.</p>
      </div></div>
      <div className={styles.integrationNote} role="note"><strong>New feature preview</strong><p>Offers, images, and actions are examples. Tiers are not published and no charges are made yet. Changes last for this session.</p></div>
      <div className={styles.content}><StudioMemberships /></div>
      <footer className={styles.footer}><span>{SITE_MOTTO}</span><Link href="/dashboard">Back to overview</Link><Link href="/dashboard/studio">Explore the mockup catalog ↗</Link></footer>
    </main>
  </div>;
}
