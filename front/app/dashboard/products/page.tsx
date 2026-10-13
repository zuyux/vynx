"use client";
import { useCopy } from "@/i18n/copy";

import Link from '@/i18n/link';
import { Sidebar } from "@/components/Sidebar";
import { StudioMemberships } from "@/components/StudioMemberships";
import styles from "@/app/dashboard/studio/studio.module.css";
export default function CreatorProductsPage() {
  const t = useCopy();
  return <div className={styles.shell}><Sidebar/><main id="main-content" tabIndex={-1} className={styles.main}>
    <header className={styles.top}><span>{t("VYNX / CREATOR PRODUCTS")}</span><Link href="/dashboard/card" className={styles.demo}>{t("Back to My Card ↗")}</Link></header>
    <div className={styles.heading}><div><p className={styles.eyebrow}>{t("YOUR PROFILE OFFERS")}</p><h1>{t("My products")}</h1><p>{t("Prepare memberships for your community.")}</p></div></div>

    <p className={styles.integrationNote}>{t("Preview with example data. Changes last for this session. Memberships are not published and no charges are made.")}</p>
    <div className={styles.content}><StudioMemberships/></div>
  </main></div>;
}
