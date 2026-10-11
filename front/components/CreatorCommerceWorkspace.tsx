import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { StudioMemberships, StudioTickets } from "@/components/StudioMemberships";
import styles from "@/app/dashboard/studio/studio.module.css";

export default function CreatorCommerceWorkspace({ kind }: { kind: "tickets" | "subscriptions" }) {
  const tickets = kind === "tickets";
  return <div className={styles.shell}>
    <Sidebar />
    <main id="main-content" tabIndex={-1} className={styles.main}>
      <header className={styles.top}><span>VYNX / PANEL DEL CREADOR</span><Link href="/dashboard/card" className={styles.demo}>Editar mi perfil ↗</Link></header>
      <div className={styles.heading}><div>
        <p className={styles.eyebrow}>{tickets ? "EXPERIENCIAS Y BENEFICIOS" : "TU COMUNIDAD, MÁS CERCA"}</p>
        <h1>{tickets ? "Tickets NFT" : "Suscripciones"}</h1>
        <p>{tickets ? "Prepara entradas para tus shows y pases con beneficios especiales." : "Define niveles de membresía y contenido para tu comunidad."}</p>
      </div></div>
      <div className={styles.integrationNote} role="note"><strong>Vista previa de la nueva función</strong><p>Las ofertas, imágenes y operaciones son ejemplos. Todavía no se publican eventos ni niveles, se emiten NFTs o se realizan cobros. Los cambios duran esta sesión.</p></div>
      <div className={styles.content}>{tickets ? <StudioTickets /> : <StudioMemberships />}</div>
      <footer className={styles.footer}><Link href="/dashboard">Volver al resumen</Link><Link href="/dashboard/studio">Revisar catálogo de mockups ↗</Link></footer>
    </main>
  </div>;
}
