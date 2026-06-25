import { connexion } from "@/app/actions-auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;

  const field = { width: "100%", fontSize: 14, padding: "10px 12px", border: "1px solid rgba(0,0,0,.2)", borderRadius: 8, background: "#fff", color: "#595959", boxSizing: "border-box" as const };
  const label = { fontSize: 12, color: "#7F7F7F", display: "block", marginBottom: 4 } as const;

  return (
    <div style={{ maxWidth: 380, margin: "60px auto", padding: "0 16px" }}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Ethik & Co" style={{ height: 56 }} />
      </div>
      <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, padding: "26px 24px" }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: "#595959", margin: "0 0 16px" }}>Connexion</h1>

        {sp.error && (
          <div style={{ background: "#fdeaea", border: "1px solid #f3c2c2", color: "#b03a3a", borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 14 }}>
            Identifiant ou mot de passe incorrect.
          </div>
        )}

        <form action={connexion}>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>Email</label>
            <input name="email" type="email" autoComplete="username" required style={field} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={label}>Mot de passe</label>
            <input name="password" type="password" autoComplete="current-password" required style={field} />
          </div>
          <button type="submit" style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: "#00B0F0", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            Se connecter
          </button>
        </form>
      </div>
      <p style={{ textAlign: "center", fontSize: 12, color: "#a5a5a5", marginTop: 16 }}>Ethik &amp; Co — espace consultant</p>
    </div>
  );
}
