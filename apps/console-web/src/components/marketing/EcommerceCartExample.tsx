"use client";

import { useState } from "react";
import type { Lang } from "@/lib/i18n/routes";
import s from "./EcommerceCartExample.module.scss";

// An isolated teaching simulation: no store, network call, order or payment.
export default function EcommerceCartExample({ lang }: { lang: Lang }) {
  const fr = lang === "fr";
  const [fixed, setFixed] = useState(false);
  const [size, setSize] = useState("M");
  const [cart, setCart] = useState<string | null>(null);
  return <div className={s.demo}>
    <p>{fr ? "Simulation interactive · Tee-shirt Démo · aucune boutique réelle" : "Interactive simulation · Demo T-shirt · no live store"}</p>
    <fieldset>
      <legend>{fr ? "Version à essayer" : "Version to try"}</legend>
      {[false, true].map(value => <label key={String(value)}>
        <input type="radio" name="cart-demo-version" checked={fixed === value} onChange={() => { setFixed(value); setCart(null); }} />
        {value ? (fr ? "Après correction" : "After the fix") : (fr ? "Avant correction" : "Before the fix")}
      </label>)}
    </fieldset>
    <div className={s.controls}>
      <label htmlFor="cart-demo-size">{fr ? "Taille du tee-shirt" : "T-shirt size"}
        <select id="cart-demo-size" value={size} onChange={event => { setSize(event.target.value); setCart(null); }}>
          {["S", "M", "L"].map(value => <option key={value}>{value}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => setCart(fixed ? size : "S")}>{fr ? "Simuler l’ajout au panier" : "Simulate adding to cart"}</button>
    </div>
    <div className={s.result} role="status" aria-live="polite" aria-atomic="true">
      {cart === null ? <p>{fr ? "Choisissez une taille, puis simulez l’ajout. Aucun achat n’est possible." : "Choose a size, then simulate adding it. No purchase is possible."}</p> : <>
        <p>{fr ? "Choix sur la fiche" : "Product selection"} : {size} · <code>TS-{size}</code></p>
        <p>{fr ? "Ligne du panier" : "Cart line"} : {cart} · <code>TS-{cart}</code> · {fr ? "quantité 1" : "quantity 1"}</p>
        <p><strong>{cart === size ? (fr ? "Variante conforme au choix." : "Variant matches the selection.") : (fr ? "Échec : la variante ajoutée diffère du choix." : "Failure: the added variant differs from the selection.")}</strong></p>
      </>}
    </div>
    <p>{fr ? "Avant correction, le bouton transmet toujours TS-S. Après correction, il transmet l’identifiant sélectionné. Essayez aussi S : un seul essai peut masquer le défaut." : "Before the fix, the button always passes TS-S. After the fix, it passes the selected identifier. Also try S: a single test can hide the defect."}</p>
  </div>;
}
