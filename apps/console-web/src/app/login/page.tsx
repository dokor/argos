"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import s from "./page.module.scss";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push(from);
    } else {
      try {
        const data = await res.json();
        setError(data.error || "Erreur");
      } catch {
        setError(`Erreur ${res.status}`);
      }
      setLoading(false);
    }
  }

  return (
    <main className={s.root}>
      <form onSubmit={handleSubmit} className={s.form}>
        <h1 className={s.title}>🔐 Accès restreint</h1>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          autoFocus
          required
          className={s.input}
        />

        {error && <p className={s.error}>{error}</p>}

        <button type="submit" disabled={loading} className={s.btn}>
          {loading ? "..." : "Connexion"}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
