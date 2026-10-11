import { SITE_MOTTO } from '@/lib/brand';
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { StudioMemberships, StudioTickets } from "@/components/StudioMemberships";
import styles from "@/app/dashboard/studio/studio.module.css";

export default function CreatorCommerceWorkspace({ kind }: { kind: "tickets" | "subscriptions" }) {
  const tickets = kind === "tickets";
  return <div className={styles.shell}>
    <Sidebar />
    <main id="main-content" tabIndex={-1} className={styles.main}>
      <header className={styles.top}><span>VYNX / CREATOR DASHBOARD</span><Link href="/dashboard/card" className={styles.demo}>Edit my profile ↗</Link></header>
      <div className={styles.heading}><div>
        <p className={styles.eyebrow}>{tickets ? "EXPERIENCES AND BENEFITS" : "YOUR COMMUNITY, CLOSER"}</p>
        <h1>{tickets ? "NFT Tickets" : "Subscriptions"}</h1>
        <p>{tickets ? "Prepare admission to your shows and passes with special benefits." : "Define membership tiers and content for your community."}</p>
      </div></div>
      <div className={styles.integrationNote} role="note"><strong>New feature preview</strong><p>Offers, images, and actions are examples. Events and tiers are not published, NFTs are not minted, and no charges are made yet. Changes last for this session.</p></div>
      <div className={styles.content}>{tickets ? <StudioTickets /> : <StudioMemberships />}</div>
      <footer className={styles.footer}><span>{SITE_MOTTO}</span><Link href="/dashboard">Back to overview</Link><Link href="/dashboard/studio">Explore the mockup catalog ↗</Link></footer>
    </main>
  </div>;
}
