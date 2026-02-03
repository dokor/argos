import AuditForm from "@/components/AuditForm";

export default function Page() {
  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
      <h1 style={{ marginBottom: 12 }}>Argos</h1>
      <p style={{ marginBottom: 24, color: "#555" }}>
        Lance un audit en fournissant une URL. Le backend prendra le job en charge automatiquement.
      </p>
      <AuditForm />
    </main>
  );
}
