"use client";

import { useEffect, useState } from "react";
import Link from "@/components/PageLink";
import s from "./ClsDemo.module.scss";

export default function ClsDemo({ reserved }: { reserved: boolean }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setLoaded(true), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className={s.page} lang="fr">
      <p className={s.eyebrow}>Démonstration pédagogique · {reserved ? "Après" : "Avant"}</p>
      <h1>{reserved ? "La place est réservée" : "Le contenu repousse le texte"}</h1>
      <p>Un encart arrive après un délai artificiel de 1,2 seconde. Observez le paragraphe ci-dessous.</p>
      <div className={reserved ? s.reserved : s.unreserved} data-demo-slot="true">
        {loaded && <div className={s.banner}>Un encart chargé tardivement</div>}
      </div>
      <article className={s.content} data-demo-content="true">
        <h2>Le texte à observer</h2>
        <p>La position de ce bloc permet de comparer les deux variantes. Le contenu et le délai sont identiques ; seule la réservation d’espace change.</p>
        <p>Relevez les décalages dans une trace Performance. Ce scénario artificiel ne représente aucun résultat client.</p>
      </article>
      <nav aria-label="Comparer les démonstrations">
        <Link href={`/demonstrations/cls/${reserved ? "avant" : "apres"}`}>Voir la variante {reserved ? "avant" : "après"}</Link>
        <Link href="/guides/cls-eleve#demonstration">Revenir au guide CLS</Link>
      </nav>
      <noscript>JavaScript est désactivé : l’insertion différée ne sera pas exécutée.</noscript>
    </main>
  );
}
