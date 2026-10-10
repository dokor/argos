import { localizedMetadata } from "@/lib/i18n/metadata";
import { editorialPages } from "@/lib/editorial";
import type { ReactNode } from "react";
export const metadata = { ...localizedMetadata("/methodologie-score", "fr", "Comment est calculé le score d'audit de site web ?", "Comprendre le score d'audit de site web Argos : contrôles, poids, quatre domaines, résultats partiels et différence avec Lighthouse. Exemple chiffré du barème v12."), openGraph: { ...localizedMetadata("/methodologie-score", "fr", "Comment est calculé le score d'audit de site web ?", "Comprendre le score d'audit de site web Argos : contrôles, poids, quatre domaines, résultats partiels et différence avec Lighthouse. Exemple chiffré du barème v12.").openGraph, type: "article" as const, publishedTime: editorialPages["/methodologie-score"].firstVersion, modifiedTime: editorialPages["/methodologie-score"].revised } };
export default function Layout({ children }: { children: ReactNode }) { return children; }
