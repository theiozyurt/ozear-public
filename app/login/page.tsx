import { redirect } from "next/navigation";
import { getChatGPTUser } from "../chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getChatGPTUser()) redirect("/");
  const { error } = await searchParams;
  return (
    <main style={{ maxWidth: 420, margin: "12vh auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>Ozear</h1>
      <form action="/api/login" method="post">
        <label>
          Giriş anahtarı
          <input
            name="token"
            type="password"
            required
            autoComplete="current-password"
            maxLength={256}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            Giriş başarısız. Anahtarı kontrol et veya daha sonra yeniden dene.
          </p>
        )}
        <button className="primary" style={{ marginTop: 20 }} type="submit">
          Giriş yap
        </button>
      </form>
    </main>
  );
}
