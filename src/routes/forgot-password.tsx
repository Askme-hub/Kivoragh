import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendPhoneResetCode, resetPasswordWithPhone } from "@/lib/password-reset.functions";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPassword,
  head: () => ({
    meta: [
      { title: "Reset your password — Kivora Ghana" },
      { name: "description", content: "Get a reset code by SMS or email and choose a new Kivora password." },
      { property: "og:title", content: "Reset your Kivora password" },
      { property: "og:description", content: "Reset your password with a code sent to your phone or email." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const field = "w-full border-2 border-border bg-background text-foreground focus:border-primary rounded-md px-4 py-3.5 outline-none";

function ForgotPassword() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [step, setStep] = useState<"request" | "reset">("request");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEmail = id.includes("@");
  const clean = id.trim().replace(/\s/g, "");

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    try {
      if (isEmail) {
        const { error } = await supabase.auth.resetPasswordForEmail(id.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
      } else {
        await sendPhoneResetCode({ data: { phone: clean } });
      }
      toast.success(isEmail ? "If this email has an account, we sent a code." : "If this number has an account, we sent an SMS code.");
      setStep("reset");
    } catch (err: any) {
      toast.error(err.message ?? "Could not send code");
    } finally { setLoading(false); }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    setLoading(true);
    try {
      if (isEmail) {
        const { error } = await supabase.auth.verifyOtp({ email: id.trim(), token: code.trim(), type: "recovery" });
        if (error) throw new Error("Incorrect or expired code");
        const { error: e2 } = await supabase.auth.updateUser({ password });
        if (e2) throw e2;
        await supabase.auth.signOut();
      } else {
        await resetPasswordWithPhone({ data: { phone: clean, code: code.trim(), password } });
      }
      toast.success("Password changed. Please log in.");
      router.navigate({ to: "/login" });
    } catch (err: any) {
      toast.error(err.message ?? "Could not reset password");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen px-6 pt-4 pb-10 flex flex-col max-w-md mx-auto">
      <button onClick={() => router.history.back()} aria-label="Back" className="w-8 h-8 flex items-center text-foreground"><ArrowLeft size={22} /></button>
      <h1 className="mt-6 text-2xl font-bold text-foreground">Forgot password?</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {step === "request" ? "Enter your phone number or email. We'll send you a 6-digit code." : `Enter the code sent to ${id.trim()} and choose a new password.`}
      </p>

      {step === "request" ? (
        <form onSubmit={sendCode} className="mt-6 flex flex-col gap-3">
          <input required autoComplete="username" placeholder="Phone number or email" value={id} onChange={(e) => setId(e.target.value)} className={field} />
          <button type="submit" disabled={loading} className="bg-primary text-primary-foreground font-bold py-4 rounded-md tracking-widest disabled:opacity-60">{loading ? "..." : "SEND CODE"}</button>
        </form>
      ) : (
        <form onSubmit={reset} className="mt-6 flex flex-col gap-3">
          <input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={`${field} tracking-[0.4em] text-center text-lg`} />
          <div className="relative">
            <input type={show ? "text" : "password"} required minLength={8} autoComplete="new-password" placeholder="New password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} className={`${field} pr-12`} />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          <button type="submit" disabled={loading || code.length !== 6} className="bg-primary text-primary-foreground font-bold py-4 rounded-md tracking-widest disabled:opacity-60">{loading ? "..." : "RESET PASSWORD"}</button>
          <button type="button" disabled={loading} onClick={() => sendCode()} className="text-sm text-primary font-semibold">Resend code</button>
          <button type="button" onClick={() => { setStep("request"); setCode(""); }} className="text-sm text-muted-foreground">Use a different phone or email</button>
        </form>
      )}

      <Link to="/login" className="mt-8 text-center text-primary font-semibold">Back to log in</Link>
    </div>
  );
}
