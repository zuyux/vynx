"use client";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { StudioMemberships } from "@/components/StudioMemberships";
import styles from "@/app/dashboard/studio/studio.module.css";
export default function CreatorProductsPage() {
  return <div className={styles.shell}><Sidebar/><main id="main-content" tabIndex={-1} className={styles.main}>
    <header className={styles.top}><span>VYNX / CREATOR PRODUCTS</span><Link href="/dashboard/card" className={styles.demo}>Back to My Card ↗</Link></header>
    <div className={styles.heading}><div><p className={styles.eyebrow}>YOUR PROFILE OFFERS</p><h1>My products</h1><p>Prepare memberships for your community.</p></div></div>

    <p className={styles.integrationNote}>Preview with example data. Changes last for this session. Memberships are not published and no charges are made.</p>
    <div className={styles.content}><StudioMemberships/></div>
  </main></div>;
}
