import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { ProbabilityGauge } from "@/components/ProbabilityGauge";
import { Spinner } from "@/components/Feedback";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { authMessage, useAuth } from "@/context/AuthContext";
import type { User } from "@/lib/types";

const home = (u: User) => (u.role === "admin" ? "/admin" : "/dashboard");

function Shell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="hidden flex-col justify-between bg-navy p-12 text-white lg:flex">
        <Logo dark />
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-2xl bg-white p-6 text-ink">
            <p className="mb-2 text-center text-sm text-muted">Sample result for a personal loan</p>
            <ProbabilityGauge value={82} tone="approved" label="Likely approved" className="mx-auto" />
          </div>
          <h2 className="mt-10 text-4xl font-medium leading-tight">Know your odds before you apply.</h2>
          <p className="mt-3 max-w-sm text-white/70">See your approval chance, what drives it, and how much you can comfortably borrow, without a hard credit check.</p>
        </div>
        <p className="text-xs text-white/50">Estimates come from a demo model trained on synthetic data.</p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <Logo className="mb-8 lg:hidden" />
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-muted">{subtitle}</p>
          {children}
          <p className="mt-6 text-center text-sm text-muted">{footer}</p>
        </div>
      </section>
    </div>
  );
}

function useSubmit(run: () => Promise<User | null>) {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(""); setSuccess("");
    try {
      const user = await run();
      if (!user) { setSuccess("Account created. Check your inbox and spam folder for a confirmation email, then follow its link to finish signing in."); return; }
      navigate(location.state?.from && user.role === "applicant" ? location.state.from : home(user), { replace: true });
    } catch (err) {
      setError(authMessage(err));
    } finally { setBusy(false); }
  };
  return { busy, error, success, submit };
}

const FormError = ({ text }: { text: string }) => (text ? <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{text}</p> : null);

export function LoginPage() {
  const { user, signIn, authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, submit } = useSubmit(() => signIn(email, password));
  if (user) return <Navigate to={home(user)} replace />;
  return (
    <Shell title="Welcome back" subtitle="Sign in to see your applications and results."
      footer={<>New here? <Link to="/register" className="font-semibold text-primary hover:underline">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <FormError text={error || authError} />
        <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <Button type="submit" size="lg" className="w-full" disabled={busy || !email || !password}>{busy ? <Spinner className="text-white" /> : "Sign in"}</Button>
      </form>
    </Shell>
  );
}

export function RegisterPage() {
  const { user, signUp, authError } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const { busy, error, success, submit } = useSubmit(() => signUp(form.name, form.email, form.password));
  if (user) return <Navigate to={home(user)} replace />;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <Shell title="Create your account" subtitle="It takes a minute. No credit check."
      footer={<>Already registered? <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <FormError text={error || authError} />
        {success && <p role="status" className="rounded-lg bg-primary-soft px-3 py-2 text-sm text-primary">{success}</p>}
        <div><Label htmlFor="name">Full name</Label><Input id="name" autoComplete="name" required value={form.name} onChange={set("name")} /></div>
        <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required value={form.email} onChange={set("email")} /></div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" required minLength={8} pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,}" title="At least 8 characters, with a letter and a number" value={form.password} onChange={set("password")} />
          <p className="mt-1 text-xs text-muted">At least 8 characters, with a letter and a number.</p>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy || !!success || !form.name || !form.email || !form.password}>{busy ? <Spinner className="text-white" /> : "Create account"}</Button>
      </form>
    </Shell>
  );
}
