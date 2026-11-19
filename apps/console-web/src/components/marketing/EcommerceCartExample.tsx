"use client";
import { localizeValue } from "@/lib/i18n/messages";

import { useState } from "react";
import type { Lang } from "@/lib/i18n/routes";
import s from "./EcommerceCartExample.module.scss";

// An isolated teaching simulation: no store, network call, order or payment.
export default function EcommerceCartExample({ lang }: { lang: Lang }) {
  const [fixed, setFixed] = useState(false);
  const [size, setSize] = useState("M");
  const [cart, setCart] = useState<string | null>(null);
  return <div className={s.demo}>
    <p>{(lang === "fr" ? "Simulation interactive · Tee-shirt Démo · aucune boutique réelle" : localizeValue("Interactive simulation · Demo T-shirt · no live store", lang))}</p>
    <fieldset>
      <legend>{(lang === "fr" ? "Version à essayer" : localizeValue("Version to try", lang))}</legend>
      {[false, true].map(value => <label key={String(value)}>
        <input type="radio" name="cart-demo-version" checked={fixed === value} onChange={() => { setFixed(value); setCart(null); }} />
        {value ? ((lang === "fr" ? "Après correction" : localizeValue("After the fix", lang))) : ((lang === "fr" ? "Avant correction" : localizeValue("Before the fix", lang)))}
      </label>)}
    </fieldset>
    <div className={s.controls}>
      <label htmlFor="cart-demo-size">{(lang === "fr" ? "Taille du tee-shirt" : localizeValue("T-shirt size", lang))}
        <select id="cart-demo-size" value={size} onChange={event => { setSize(event.target.value); setCart(null); }}>
          {["S", "M", "L"].map(value => <option key={value}>{value}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => setCart(fixed ? size : "S")}>{(lang === "fr" ? "Simuler l’ajout au panier" : localizeValue("Simulate adding to cart", lang))}</button>
    </div>
    <div className={s.result} role="status" aria-live="polite" aria-atomic="true">
      {cart === null ? <p>{(lang === "fr" ? "Choisissez une taille, puis simulez l’ajout. Aucun achat n’est possible." : localizeValue("Choose a size, then simulate adding it. No purchase is possible.", lang))}</p> : <>
        <p>{(lang === "fr" ? "Choix sur la fiche" : localizeValue("Product selection", lang))} : {size} · <code>TS-{size}</code></p>
        <p>{(lang === "fr" ? "Ligne du panier" : localizeValue("Cart line", lang))} : {cart} · <code>TS-{cart}</code> · {(lang === "fr" ? "quantité 1" : localizeValue("quantity 1", lang))}</p>
        <p><strong>{cart === size ? ((lang === "fr" ? "Variante conforme au choix." : localizeValue("Variant matches the selection.", lang))) : ((lang === "fr" ? "Échec : la variante ajoutée diffère du choix." : localizeValue("Failure: the added variant differs from the selection.", lang)))}</strong></p>
      </>}
    </div>
    <p>{(lang === "fr" ? "Avant correction, le bouton transmet toujours TS-S. Après correction, il transmet l’identifiant sélectionné. Essayez aussi S : un seul essai peut masquer le défaut." : localizeValue("Before the fix, the button always passes TS-S. After the fix, it passes the selected identifier. Also try S: a single test can hide the defect.", lang))}</p>
  </div>;
}
