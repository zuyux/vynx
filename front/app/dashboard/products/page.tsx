"use client";
import Link from "next/link";
import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { StudioMemberships, StudioTickets } from "@/components/StudioMemberships";
import styles from "@/app/dashboard/studio/studio.module.css";
export default function CreatorProductsPage() {
  const [type,setType]=useState("tickets");
  return <div className={styles.shell}><Sidebar/><main id="main-content" tabIndex={-1} className={styles.main}>
    <header className={styles.top}><span>VYNX / CREATOR PRODUCTS</span><Link href="/dashboard/card" className={styles.demo}>Back to My page ↗</Link></header>
    <div className={styles.heading}><div><p className={styles.eyebrow}>YOUR PROFILE OFFERS</p><h1>My products</h1><p>Prepare experiences and memberships for your community.</p></div></div>
    <nav className={styles.tabs} aria-label="Product types"><button aria-pressed={type==="tickets"} onClick={()=>setType("tickets")}>NFT Tickets</button><button aria-pressed={type==="subscriptions"} onClick={()=>setType("subscriptions")}>Subscriptions</button></nav>
    <p className={styles.integrationNote}>Preview with example data. Changes last for this session. Products are not published, NFTs are not minted, and no charges are made.</p>
    <div className={styles.content}><div hidden={type!=="tickets"}><StudioTickets/></div><div hidden={type!=="subscriptions"}><StudioMemberships/></div></div>
  </main></div>;
}
