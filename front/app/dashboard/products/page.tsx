"use client";
import Link from "next/link";
import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { StudioMemberships, StudioTickets } from "@/components/StudioMemberships";
import styles from "@/app/dashboard/studio/studio.module.css";
export default function CreatorProductsPage() {
  const [type,setType]=useState("tickets");
  return <div className={styles.shell}><Sidebar/><main id="main-content" tabIndex={-1} className={styles.main}>
    <header className={styles.top}><span>VYNX / PRODUCTOS DEL CREADOR</span><Link href="/dashboard/card" className={styles.demo}>Volver a Mi página ↗</Link></header>
    <div className={styles.heading}><div><p className={styles.eyebrow}>LAS OFERTAS DE TU PERFIL</p><h1>Mis productos</h1><p>Prepara experiencias y membresías para tu comunidad.</p></div></div>
    <nav className={styles.tabs} aria-label="Tipos de producto"><button aria-pressed={type==="tickets"} onClick={()=>setType("tickets")}>Tickets NFT</button><button aria-pressed={type==="subscriptions"} onClick={()=>setType("subscriptions")}>Suscripciones</button></nav>
    <p className={styles.integrationNote}>Vista previa con datos de ejemplo. Los cambios duran esta sesión. No se publican productos, se emiten NFTs ni se realizan cobros.</p>
    <div className={styles.content}><div hidden={type!=="tickets"}><StudioTickets/></div><div hidden={type!=="subscriptions"}><StudioMemberships/></div></div>
  </main></div>;
}
