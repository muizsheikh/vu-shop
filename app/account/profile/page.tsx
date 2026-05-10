"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [addressLine1, setAddressLine1] = useState("");

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        router.replace("/account/login?next=/account/profile");
        return;
      }

      setUserId(user.id);
      setEmail(user.email || "");

      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, city, address_line1")
        .eq("id", user.id)
        .single();

      setFullName(data?.full_name || "");
      setPhone(data?.phone || "");
      setCity(data?.city || "");
      setAddressLine1(data?.address_line1 || "");

      setLoading(false);
    }

    loadProfile();
  }, [router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!userId) return;

    if (!fullName.trim()) {
      toast.error("Full name required hai.");
      return;
    }

    if (!phone.trim()) {
      toast.error("Phone number required hai.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from("profiles").upsert(
  {
    id: userId,
    full_name: fullName.trim(),
    phone: phone.trim(),
    city: city.trim(),
    address_line1: addressLine1.trim(),
    updated_at: new Date().toISOString(),
  },
  { onConflict: "id" }
);

      if (error) throw error;

      toast.success("Profile updated successfully.");
      router.push("/account");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Profile update failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] border border-neutral-200 bg-white p-6 text-center shadow-sm">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
          Customer Profile
        </p>
        <h1 className="mt-3 text-3xl font-black text-neutral-950">
          Edit Profile
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Ye details checkout par auto-fill hongi.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-neutral-700">
            Email
          </label>
          <input
            value={email}
            disabled
            className="w-full cursor-not-allowed rounded-2xl border border-neutral-200 bg-neutral-100 px-4 py-3 text-sm text-neutral-500 outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-neutral-700">
            Full Name
          </label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none transition focus:border-[#a30105]"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-neutral-700">
            Phone
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="03XX1234567"
            inputMode="tel"
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none transition focus:border-[#a30105]"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-neutral-700">
            City
          </label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none transition focus:border-[#a30105]"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-neutral-700">
            Address
          </label>
          <input
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            placeholder="House no, street, area"
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none transition focus:border-[#a30105]"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            disabled={saving}
            className="rounded-2xl bg-[#a30105] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(163,1,5,0.18)] transition hover:bg-[#8f0104] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>

          <Link
            href="/account"
            className="rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-center text-sm font-bold text-neutral-900 transition hover:bg-neutral-50"
          >
            Back to Account
          </Link>
        </div>
      </form>
    </div>
  );
}