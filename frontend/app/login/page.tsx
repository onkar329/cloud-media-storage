 "use client";
import { FormEvent, useState } from "react";
import { api } from "../../lib/api";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    try { await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); router.push("/drive"); }
    catch (e) { setError(e instanceof Error ? e.message : "Login failed"); }
  }

  return <main className="min-h-screen grid place-items-center p-6">
    <form onSubmit={submit} className="w-full max-w-md bg-white p-8 rounded-2xl shadow space-y-4">
      <h1 className="text-2xl font-bold">Login</h1>
      <input className="w-full border rounded-lg p-3" placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
      <input className="w-full border rounded-lg p-3" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
      {error && <p className="text-red-600">{error}</p>}
      <button className="w-full bg-blue-600 text-white rounded-lg p-3">Login</button>
    </form>
  </main>;
}
