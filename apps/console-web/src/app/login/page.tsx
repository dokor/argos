"use client";

import { useRef, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createLogger, safeError } from "@/lib/logger";
import s from "./page.module.scss";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";
  const loggerRef = useRef(createLogger("login", { route: "/login" }));

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    loggerRef.current.info("admin_login_submit", {
      action: "authenticate_admin",
      details: {
        redirectTo: from,
      },
    });

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        loggerRef.current.info("admin_login_succeeded", {
          action: "redirect_dashboard",
          details: {
            redirectTo: from,
          },
        });
        router.push(from);
      } else {
        const data = await res.json();
        loggerRef.current.warn("admin_login_rejected", {
          action: "authenticate_admin",
          details: {
            reason: data.error || "Erreur",
            statusCode: res.status,
          },
        });
        setError(data.error || "Erreur");
        setLoading(false);
      }
    } catch (fetchError) {
      loggerRef.current.error("admin_login_request_failed", {
        action: "authenticate_admin",
        details: {
          error: safeError(fetchError),
        },
      });
      setError("Erreur");
      setLoading(false);
    }
  }

  return (
    <main className={s.root}>
      <form onSubmit={handleSubmit} className={s.form}>
        <h1 className={s.title}>Acces restreint</h1>

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
