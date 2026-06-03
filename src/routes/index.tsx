import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight, Calendar, Car, CheckCircle2, ClipboardList,
  History, MapPin, Menu, Phone, ShieldCheck, Star, Users, Wrench, X,
} from "lucide-react";
import { CTechLogo } from "@/components/CTechLogo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "C-Tech Automotive — Service Portal" },
      {
        name: "description",
        content:
          "C-Tech Automotive — your trusted automotive partner in Bulacan. Track your vehicle's service history, know what's due next, and book appointments online.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* NAV */}
      <nav
        className="sticky top-0 z-50 border-b border-white/10 backdrop-blur"
        style={{ backgroundColor: "rgba(15,30,58,0.97)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <CTechLogo variant="light" size="sm" />
          <div className="hidden items-center gap-6 md:flex">
            <a href="#services" className="text-sm text-white/70 hover:text-white transition">Services</a>
            <a href="#why-us" className="text-sm text-white/70 hover:text-white transition">Why Us</a>
            <a href="#contact" className="text-sm text-white/70 hover:text-white transition">Contact</a>
            <Link
              to="/request-access"
              className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:border-white/40 hover:text-white transition"
            >
              Request Access
            </Link>
            <Link
              to="/login"
              className="rounded-lg px-4 py-2 text-sm font-bold text-[#0F1E3A] transition hover:opacity-90"
              style={{ backgroundColor: "#C9A227" }}
            >
              Sign In →
            </Link>
          </div>
          <button className="md:hidden text-white cursor-pointer" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-white/10 px-4 pb-4 md:hidden space-y-3">
            <a href="#services" className="block text-sm text-white/70 py-2" onClick={() => setMenuOpen(false)}>Services</a>
            <a href="#why-us" className="block text-sm text-white/70 py-2" onClick={() => setMenuOpen(false)}>Why Us</a>
            <a href="#contact" className="block text-sm text-white/70 py-2" onClick={() => setMenuOpen(false)}>Contact</a>
            <Link to="/request-access" className="block w-full rounded-lg border border-white/20 py-2 text-sm text-white text-center">Request Access</Link>
            <Link to="/login" className="block w-full rounded-lg py-2 text-sm font-bold text-[#0F1E3A] text-center" style={{ backgroundColor: "#C9A227" }}>Sign In →</Link>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section
        className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-4 py-24 text-center"
        style={{ backgroundImage: "linear-gradient(135deg, #0F1E3A 0%, #1E3464 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(201,162,39,0.25) 0%, rgba(201,162,39,0) 65%)" }}
        />
        <div className="relative z-10 max-w-3xl">
          <span
            className="mb-6 inline-block rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest"
            style={{ color: "#C9A227", backgroundColor: "rgba(201,162,39,0.12)", border: "1px solid rgba(201,162,39,0.25)" }}
          >
            Pulilan, Bulacan
          </span>
          <h1 className="text-5xl font-bold leading-tight text-white md:text-6xl lg:text-7xl">
            Your Car Deserves<br />
            <span style={{ color: "#C9A227" }}>Expert Care</span>
          </h1>
          <p className="mt-6 text-lg text-white/70 max-w-xl mx-auto leading-relaxed">
            C-Tech Automotive keeps your vehicle in peak condition — full service history,
            proactive reminders, and easy online booking all in one place.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              to="/login"
              className="flex items-center gap-2 rounded-xl px-8 py-4 text-base font-bold text-[#0F1E3A] shadow-lg hover:opacity-90 transition"
              style={{ backgroundColor: "#C9A227" }}
            >
              Sign In to Portal <ArrowRight size={18} />
            </Link>
            <Link
              to="/request-access"
              className="rounded-xl border border-white/25 px-8 py-4 text-base font-semibold text-white hover:border-white/50 transition"
            >
              Request Access
            </Link>
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-white/50">
            <div className="flex items-center gap-2"><ShieldCheck size={15} style={{ color: "#C9A227" }} /> Licensed & Insured</div>
            <div className="flex items-center gap-2"><Users size={15} style={{ color: "#C9A227" }} /> Locally trusted in Bulacan</div>
            <div className="flex items-center gap-2"><Star size={15} style={{ color: "#C9A227" }} /> Transparent, honest service</div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="bg-stone-50 px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#C9A227" }}>What We Do</span>
            <h2 className="mt-2 text-3xl font-bold" style={{ color: "#0F1E3A" }}>Complete Automotive Services</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {[
              { icon: <Wrench size={22} />, label: "Oil Change & PMS" },
              { icon: <Car size={22} />, label: "Full Inspection" },
              { icon: <ShieldCheck size={22} />, label: "Brake Service" },
              { icon: <ClipboardList size={22} />, label: "Engine Diagnostics" },
              { icon: <History size={22} />, label: "Tire & Balancing" },
              { icon: <CheckCircle2 size={22} />, label: "Battery Check" },
            ].map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center gap-3 rounded-xl border border-stone-200 bg-white p-6 text-center shadow-sm"
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(201,162,39,0.12)", color: "#C9A227" }}
                >
                  {s.icon}
                </div>
                <span className="text-xs font-semibold text-stone-700">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section id="why-us" className="bg-white px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#C9A227" }}>Why C-Tech</span>
            <h2 className="mt-2 text-3xl font-bold" style={{ color: "#0F1E3A" }}>We Tell You What's Due Before You Have to Ask</h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                icon: <History size={24} />,
                title: "Full Service History",
                desc: "Every oil change, brake job, and inspection logged and accessible anytime from your phone.",
              },
              {
                icon: <Calendar size={24} />,
                title: "Proactive Reminders",
                desc: "Know exactly what's due next based on your mileage and last service — no more guessing.",
              },
              {
                icon: <ClipboardList size={24} />,
                title: "Easy Online Booking",
                desc: "Book your next service in seconds. Pick your date and time — we confirm within 24 hours.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-stone-100 p-8 shadow-sm">
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "rgba(15,30,58,0.08)", color: "#0F1E3A" }}
                >
                  {item.icon}
                </div>
                <h3 className="mb-2 font-bold" style={{ color: "#0F1E3A" }}>{item.title}</h3>
                <p className="text-sm leading-relaxed text-stone-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section
        className="px-4 py-16 text-center"
        style={{ backgroundImage: "linear-gradient(135deg, #0F1E3A 0%, #1E3464 100%)" }}
      >
        <h2 className="text-2xl font-bold text-white md:text-3xl">Ready to simplify your car care?</h2>
        <p className="mt-3 text-white/60">Join our client portal and get full visibility into your vehicle's health.</p>
        <Link
          to="/request-access"
          className="mt-8 inline-block rounded-xl px-8 py-4 text-base font-bold text-[#0F1E3A] hover:opacity-90 transition"
          style={{ backgroundColor: "#C9A227" }}
        >
          Request Access →
        </Link>
      </section>

      {/* CONTACT */}
      <section id="contact" className="bg-stone-50 px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold" style={{ color: "#0F1E3A" }}>Find Us</h2>
          <div className="mt-6 flex flex-col items-center gap-3 text-stone-600">
            <div className="flex items-center gap-2"><MapPin size={16} style={{ color: "#C9A227" }} /> Sto. Cristo, Pulilan, Bulacan</div>
            <div className="flex items-center gap-2"><Phone size={16} style={{ color: "#C9A227" }} /> 0998-151-6245 / 0995-230-0296</div>
            <div className="text-sm text-stone-500">Mon – Sat · 8:00 AM – 5:00 PM</div>
          </div>
          <Link
            to="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white hover:opacity-90 transition"
            style={{ backgroundColor: "#0F1E3A" }}
          >
            Existing client? Sign In <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-stone-200 bg-white px-4 py-6 text-center text-xs text-stone-400">
        <div className="flex justify-center mb-2"><CTechLogo variant="dark" size="sm" /></div>
        © {new Date().getFullYear()} C-Tech Automotive · Pulilan, Bulacan · All rights reserved.
      </footer>
    </div>
  );
}
