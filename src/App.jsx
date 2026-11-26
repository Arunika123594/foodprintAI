import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarClock,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  HandHeart,
  Leaf,
  MapPin,
  Menu,
  PackageCheck,
  Plus,
  Search,
  Sparkles,
  Utensils,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "surplus", label: "Surplus listings", icon: "surplus" },
  { id: "partners", label: "Community partners", icon: "partners" },
  { id: "impact", label: "Your impact", icon: "impact" },
];

const CATEGORY_COLORS = {
  "Prepared meals": "sage",
  Bakery: "peach",
  Produce: "yellow",
  Dairy: "blue",
};

function formatTimeLeft(value) {
  const minutes = Math.max(0, Math.round((new Date(value).getTime() - Date.now()) / 60000));
  if (minutes < 60) return `${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m left` : `${hours}h left`;
}

function formatPickup(value) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function toLocalDateTimeInput(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

async function request(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function App() {
  const [activeNav, setActiveNav] = useState("overview");
  const [dashboard, setDashboard] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All food");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [toast, setToast] = useState("");
  const [actionError, setActionError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const data = await request("/api/dashboard");
      setDashboard(data);
      setLoadError("");
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const listings = dashboard?.listings ?? [];
  const partners = dashboard?.partners ?? [];
  const stats = dashboard?.stats ?? {};
  const visibleListings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return listings.filter((listing) => {
      const matchesSearch =
        !query ||
        [listing.name, listing.category, listing.donor_name, listing.donor_address]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));
      const matchesCategory =
        categoryFilter === "All food" || listing.category === categoryFilter;
      const matchesAvailable =
        activeNav !== "surplus" || listing.status === "available";
      return matchesSearch && matchesCategory && matchesAvailable;
    });
  }, [activeNav, categoryFilter, listings, search]);

  async function claimListing(listing, charityId) {
    setActionError("");
    try {
      await request(`/api/listings/${listing.id}/claim`, {
        method: "POST",
        body: JSON.stringify({ charityId }),
      });
      setSelectedListing(null);
      setToast("Pickup confirmed — the community partner has been notified.");
      await loadDashboard();
    } catch (error) {
      setActionError(error.message);
    }
  }

  async function completeListing(listing) {
    setActionError("");
    try {
      await request(`/api/listings/${listing.id}/complete`, { method: "POST" });
      setSelectedListing(null);
      setToast("Pickup confirmed — thanks for sharing good food.");
      await loadDashboard();
    } catch (error) {
      setActionError(error.message);
    }
  }

  async function createListing(formData) {
    const created = await request("/api/listings", {
      method: "POST",
      body: JSON.stringify(formData),
    });
    setShowAddModal(false);
    setToast(`${created.predicted_servings} servings added to your listings.`);
    await loadDashboard();
  }

  const isImpact = activeNav === "impact";
  const pageTitle =
    activeNav === "overview"
      ? "Good morning, Greenhouse"
      : activeNav === "surplus"
        ? "Surplus listings"
        : activeNav === "partners"
          ? "Community partners"
          : "Your impact";

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <a className="brand" href="#" onClick={() => setActiveNav("overview")}>
          <span className="brand-mark"><Leaf size={19} strokeWidth={2.2} /></span>
          <span>goodtable<span className="brand-dot">.</span></span>
        </a>
        <div className="workspace-switcher">
          <span className="workspace-avatar">G</span>
          <span className="workspace-copy"><strong>Greenhouse Kitchen</strong><small>Food partner</small></span>
          <ChevronDown size={15} />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button
              className={`nav-item ${activeNav === item.id ? "nav-item-active" : ""}`}
              key={item.id}
              onClick={() => {
                setActiveNav(item.id);
                setMobileMenuOpen(false);
              }}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
              {item.id === "surplus" && <span className="nav-count">{stats.active_listings ?? 0}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon"><Sparkles size={16} /></span>
            <p><strong>A little goes a long way.</strong><br />Every shared meal brings us closer to zero waste.</p>
            <span className="tip-leaf">✳</span>
          </div>
          <button className="nav-item support-button" onClick={() => setToast("We’re here to help — hello@goodtable.org")}>
            <CircleHelp size={18} /><span>Help & support</span>
          </button>
          <div className="profile-row">
            <span className="profile-avatar">AM</span>
            <span className="workspace-copy"><strong>Arun Mehta</strong><small>Kitchen manager</small></span>
            <ChevronDown size={15} />
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" aria-label="Open menu" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}><Menu size={19} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="breadcrumb-divider">/</span><strong>{NAV_ITEMS.find((item) => item.id === activeNav)?.label}</strong></div>
          <div className="topbar-actions">
            <span className="today-label"><span className="status-dot" /> Bengaluru, India</span>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setToast("You’re all caught up.")}><Bell size={18} /><i /></button>
            <span className="topbar-avatar">AM</span>
          </div>
        </header>

        <div className="page-content">
          {loadError && (
            <div className="error-banner" role="alert">
              <span><strong>Couldn’t load your workspace.</strong> {loadError}</span>
              <button onClick={loadDashboard}>Try again</button>
            </div>
          )}
          {actionError && !selectedListing && !showAddModal && (
            <div className="error-banner" role="alert">
              <span>{actionError}</span>
              <button aria-label="Dismiss error" onClick={() => setActionError("")}><X size={15} /></button>
            </div>
          )}

          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" />{new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date()).toUpperCase()}</div>
              <h1>{pageTitle}<span className="heading-period">.</span></h1>
              <p className="page-subtitle">
                {activeNav === "overview" && "Here’s what’s happening with your food sharing today."}
                {activeNav === "surplus" && "Keep good food moving. Your latest surplus, all in one place."}
                {activeNav === "partners" && "Meet the local organizations turning extra into enough."}
                {activeNav === "impact" && "A little extra on your end makes a big difference nearby."}
              </p>
            </div>
            <button className="primary-button add-button" onClick={() => { setShowAddModal(true); setActionError(""); }}>
              <Plus size={17} /> Add surplus
            </button>
          </section>

          {isImpact ? (
            <ImpactView stats={stats} />
          ) : activeNav === "partners" ? (
            <PartnersView partners={partners} />
          ) : (
            <>
              {activeNav === "overview" && <StatsSection stats={stats} />}
              {activeNav === "overview" && <ForecastBanner stats={stats} />}
              <section className="listings-section">
                <div className="section-heading-row">
                  <div>
                    <div className="section-kicker">{activeNav === "overview" ? "FRESH OPPORTUNITIES" : "YOUR FOOD, FINDING A HOME"}</div>
                    <h2>{activeNav === "overview" ? "Ready to be shared" : "Available surplus"} <span className="count-pill">{visibleListings.filter((item) => item.status === "available").length}</span></h2>
                  </div>
                  {activeNav === "overview" && (
                    <button className="text-button" onClick={() => setActiveNav("surplus")}>View all listings <ArrowRight size={15} /></button>
                  )}
                </div>
                <div className="listings-toolbar">
                  <label className="search-field">
                    <Search size={16} />
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search food or location..." aria-label="Search listings" />
                    {search && <button aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}
                  </label>
                  <div className="filter-wrap">
                    <Utensils size={15} />
                    <select aria-label="Filter by food category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                      <option>All food</option>
                      <option>Prepared meals</option>
                      <option>Bakery</option>
                      <option>Produce</option>
                      <option>Dairy</option>
                    </select>
                    <ChevronDown size={14} />
                  </div>
                  <span className="updated-label"><span className="status-dot" /> Live updates</span>
                </div>
                {loading ? (
                  <div className="loading-state"><span className="spinner" /> Finding nearby food...</div>
                ) : visibleListings.length ? (
                  <div className="listing-grid">
                    {(activeNav === "overview" ? visibleListings.slice(0, 3) : visibleListings).map((listing) => (
                      <ListingCard key={listing.id} listing={listing} onMatch={() => { setSelectedListing(listing); setActionError(""); }} />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state"><span className="empty-icon"><PackageCheck size={23} /></span><strong>No listings found</strong><span>Try changing your search or add surplus food to get started.</span></div>
                )}
              </section>
              {activeNav === "overview" && <BottomSection partners={partners} listings={listings} onNavigate={setActiveNav} />}
            </>
          )}
          <footer className="page-footer"><span>Made with care for a world with less waste <span className="footer-heart">♥</span></span><span>GoodTable <span className="footer-version">v1.0</span></span></footer>
        </div>
      </main>

      {showAddModal && <AddListingModal onClose={() => setShowAddModal(false)} onSubmit={createListing} />}
      {selectedListing && <MatchModal listing={selectedListing} onClose={() => setSelectedListing(null)} onClaim={claimListing} onComplete={completeListing} />}
      {toast && <div className="toast" role="status"><span className="toast-check"><Check size={15} /></span>{toast}<button aria-label="Dismiss" onClick={() => setToast("")}><X size={14} /></button></div>}
    </div>
  );
}

function NavIcon({ name }) {
  const icons = {
    overview: <span className="overview-icon"><i /><i /><i /><i /></span>,
    surplus: <PackageCheck size={18} />,
    partners: <HandHeart size={18} />,
    impact: <Sparkles size={18} />,
  };
  return icons[name];
}

function StatsSection({ stats }) {
  return (
    <section className="stats-grid" aria-label="Food sharing summary">
      <StatCard label="Servings rescued" value={Number(stats.shared_servings ?? 0).toLocaleString()} change="Confirmed pickups" icon={<HandHeart size={18} />} tone="green" />
      <StatCard label="At risk right now" value={Number(stats.at_risk_servings ?? 0).toLocaleString()} change="Servings ready to share" icon={<Utensils size={18} />} tone="cream" />
      <StatCard label="Active listings" value={String(stats.active_listings ?? 0).padStart(2, "0")} change="Waiting for a good home" icon={<PackageCheck size={18} />} tone="lavender" />
      <StatCard label="Community partners" value={String(stats.partner_count ?? 0).padStart(2, "0")} change="Within your neighbourhood" icon={<MapPin size={18} />} tone="blue" />
    </section>
  );
}

function StatCard({ label, value, change, icon, tone }) {
  return (
    <article className="stat-card">
      <div className="stat-card-top"><span>{label}</span><span className={`stat-icon ${tone}`}>{icon}</span></div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot"><span className="stat-foot-dot" />{change}</div>
    </article>
  );
}

function ForecastBanner({ stats }) {
  return (
    <section className="forecast-banner">
      <div className="forecast-icon"><Sparkles size={19} /></div>
      <div className="forecast-copy"><div><strong>Surplus outlook</strong><span className="forecast-tag">LIVE LISTINGS</span></div><p>You have <strong>{Number(stats.at_risk_servings ?? 0)} predicted surplus servings</strong> ready to match across {stats.active_listings ?? 0} active listings.</p></div>
      <div className="forecast-side"><span className="forecast-trend"><Sparkles size={13} /> Nearby matches</span><span>Ranked by <strong>pickup distance</strong></span></div>
      <span className="forecast-decoration" aria-hidden="true">✳</span>
    </section>
  );
}

function ListingCard({ listing, onMatch }) {
  const categoryTone = CATEGORY_COLORS[listing.category] || "sage";
  const isAvailable = listing.status === "available";
  return (
    <article className="listing-card">
      <div className={`food-art food-art-${categoryTone}`}>
        <span className="food-art-shape food-shape-one" />
        <span className="food-art-shape food-shape-two" />
        <span className="food-art-shape food-shape-three" />
        <span className="food-art-label">{listing.category}</span>
        {isAvailable ? <span className="availability-pill"><span /> Available</span> : <span className="claimed-pill"><Check size={11} /> {listing.status === "completed" ? "Rescued" : "Matched"}</span>}
        <span className="food-art-symbol">{categoryTone === "peach" ? "〰" : categoryTone === "yellow" ? "✳" : categoryTone === "blue" ? "◌" : "✿"}</span>
      </div>
      <div className="listing-card-body">
        <div className="listing-title-row">
          <h3>{listing.name}</h3>
          <button className="more-button" aria-label={`More details for ${listing.name}`} onClick={onMatch}>···</button>
        </div>
        <div className="listing-location"><MapPin size={13} /><span>{listing.donor_address}</span></div>
        <div className="listing-divider" />
        <div className="listing-meta">
          <div className="servings-block"><span className="meta-label">EST. SURPLUS</span><strong>{listing.predicted_servings}<small> servings</small></strong></div>
          <div className="pickup-block"><span className="meta-label">{isAvailable ? "PICKUP BY" : "PICKUP STATUS"}</span><strong className={isAvailable ? "pickup-time" : "matched-text"}>{isAvailable ? formatPickup(listing.available_until) : listing.claimed_by_name || "Matched"}</strong></div>
        </div>
        <div className="card-bottom">
          <span className={`time-left ${isAvailable ? "" : "time-matched"}`}><Clock3 size={13} />{isAvailable ? formatTimeLeft(listing.available_until) : listing.status === "completed" ? "Pickup complete" : "Partner confirmed"}</span>
          <button className={`match-button ${!isAvailable ? "match-button-claimed" : ""}`} onClick={onMatch}>{isAvailable ? "Find a match" : "View details"} <ArrowRight size={14} /></button>
        </div>
      </div>
    </article>
  );
}

function BottomSection({ partners, listings, onNavigate }) {
  const firstListing = listings.find((listing) => listing.status === "available");
  const nearest = firstListing?.matches?.[0];
  return (
    <section className="bottom-grid">
      <article className="community-card">
        <div className="bottom-card-heading"><div><div className="section-kicker">CLOSE TO HOME</div><h2>Nearby community</h2></div><button className="round-arrow" aria-label="View all partners" onClick={() => onNavigate("partners")}><ArrowRight size={16} /></button></div>
        <div className="map-preview">
          <div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" /><div className="map-park"><span>Indiranagar Park</span></div>
          <div className="map-pin map-pin-kitchen"><span>G</span></div><div className="map-pin map-pin-charity"><HandHeart size={13} /></div><div className="map-pin map-pin-charity map-pin-two"><HandHeart size={13} /></div>
          <span className="map-distance">{nearest ? `${nearest.distanceKm} km` : "Nearby"}</span>
          <div className="map-label map-label-kitchen">Your kitchen</div><div className="map-label map-label-charity">Community</div>
          <span className="map-north">N <ArrowUpRight size={13} /></span>
        </div>
        <div className="nearby-footer"><span className="nearby-count"><span className="status-dot" />{partners.length} partners in your area</span><button className="text-button" onClick={() => onNavigate("partners")}>Explore <ArrowRight size={14} /></button></div>
      </article>
      <article className="impact-card">
        <div className="impact-card-top"><div><div className="section-kicker">YOUR GOOD IN NUMBERS</div><h2>Small extras.<br />Big ripples.</h2></div><span className="impact-art"><Leaf size={27} /></span></div>
        <p>You’ve helped keep good food on tables and out of landfills.</p>
        <div className="impact-stat-row"><span><HandHeart size={15} /> Servings rescued</span><strong>{listings.filter((item) => item.status === "completed").reduce((sum, item) => sum + item.predicted_servings, 0)}</strong></div>
        <button className="impact-link" onClick={() => onNavigate("impact")}>See your impact <ArrowRight size={14} /></button>
      </article>
    </section>
  );
}

function PartnersView({ partners }) {
  return (
    <section className="partners-view">
      <div className="section-heading-row"><div><div className="section-kicker">LOCAL GOOD PEOPLE</div><h2>In your community <span className="count-pill">{partners.length}</span></h2></div><span className="partners-radius"><MapPin size={14} /> Within 25 km</span></div>
      <div className="partner-grid">
        {partners.map((partner, index) => (
          <article className="partner-card" key={partner.id}>
            <div className={`partner-avatar partner-avatar-${index % 3}`}>{partner.name.split(" ").map((word) => word[0]).slice(0, 2).join("")}</div>
            <div className="partner-card-main"><span className="partner-active"><i /> VERIFIED PARTNER</span><h3>{partner.name}</h3><p><MapPin size={13} />{partner.address}</p></div>
            <span className="partner-card-arrow"><ArrowUpRight size={16} /></span>
          </article>
        ))}
        {!partners.length && <div className="empty-state"><strong>No community partners yet</strong><span>Partners will appear here when they join your area.</span></div>}
      </div>
      <div className="partner-note"><Sparkles size={17} /><span>Matches are ranked by distance and food pickup window so each donation reaches someone nearby in time.</span></div>
    </section>
  );
}

function ImpactView({ stats }) {
  const shared = Number(stats.shared_servings ?? 0);
  const meals = Number(stats.completed_pickups ?? 0);
  return (
    <section className="impact-view">
      <div className="impact-hero"><div><span className="impact-hero-kicker"><Sparkles size={14} /> YOUR COMMUNITY IMPACT</span><h2>Every serving<br />makes a difference.</h2><p>Good food deserves a good home. Here’s the good you’ve put into the world.</p></div><div className="impact-hero-art"><div className="impact-sun" /><Leaf className="impact-leaf-one" size={56} /><Leaf className="impact-leaf-two" size={42} /><span>good<br />things<br />grow</span></div></div>
      <div className="impact-metrics"><article><span className="impact-metric-icon"><HandHeart size={19} /></span><strong>{shared.toLocaleString()}</strong><span>servings rescued</span><small>Confirmed community pickups</small></article><article><span className="impact-metric-icon peach"><PackageCheck size={19} /></span><strong>{meals}</strong><span>completed pickups</span><small>Connections made nearby</small></article><article><span className="impact-metric-icon yellow"><Leaf size={19} /></span><strong>{(shared * 0.5).toFixed(1)} kg</strong><span>estimated food saved</span><small>Approx. 0.5 kg per serving</small></article></div>
      <div className="impact-note"><Sparkles size={17} /><span>Impact estimates are based on shared servings. Every donation is different, and every one matters.</span></div>
    </section>
  );
}

function AddListingModal({ onClose, onSubmit }) {
  const defaultAvailability = toLocalDateTimeInput(new Date(Date.now() + 2 * 60 * 60 * 1000));
  const [form, setForm] = useState({ name: "", category: "Prepared meals", preparedServings: "", expectedDemand: "", availableUntil: defaultAvailability, notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        ...form,
        preparedServings: Number(form.preparedServings),
        expectedDemand: Number(form.expectedDemand),
        availableUntil: new Date(form.availableUntil).toISOString(),
      });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="add-modal-title">
        <div className="modal-top"><span className="modal-icon"><Plus size={18} /></span><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-heading"><div className="section-kicker">GIVE GOOD FOOD A SECOND HOME</div><h2 id="add-modal-title">Add a surplus listing</h2><p>Tell us what’s coming up. We’ll estimate the extra and find nearby partners.</p></div>
        <form className="listing-form" onSubmit={handleSubmit}>
          <label>What food do you have?<input required maxLength={100} placeholder="e.g. Seasonal vegetable bowls" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Food category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Prepared meals</option><option>Bakery</option><option>Produce</option><option>Dairy</option></select></label>
          <div className="form-columns"><label>Prepared servings<input required type="number" min="1" max="10000" placeholder="e.g. 50" value={form.preparedServings} onChange={(event) => setForm({ ...form, preparedServings: event.target.value })} /></label><label>Expected demand<input required type="number" min="0" max="10000" placeholder="e.g. 35" value={form.expectedDemand} onChange={(event) => setForm({ ...form, expectedDemand: event.target.value })} /></label></div>
          <label>Available for pickup until<input required type="datetime-local" min={toLocalDateTimeInput(new Date())} value={form.availableUntil} onChange={(event) => setForm({ ...form, availableUntil: event.target.value })} /></label>
          <label>Pickup notes <span className="optional-label">OPTIONAL</span><textarea rows="2" maxLength={300} placeholder="Allergens, packaging, collection instructions..." value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
          <div className="forecast-preview"><Sparkles size={16} /><span>Our forecast estimates your surplus, recommends a pickup time and suggests nearby community matches.</span></div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button submit-button" type="submit" disabled={submitting}>{submitting ? "Finding a good home..." : "Get surplus forecast"}<ArrowRight size={16} /></button>
        </form>
      </section>
    </div>
  );
}

function MatchModal({ listing, error, onClose, onClaim, onComplete }) {
  const [claimingId, setClaimingId] = useState(null);
  const matches = listing.matches ?? [];
  async function handleClaim(partnerId) {
    setClaimingId(partnerId);
    await onClaim(listing, partnerId);
    setClaimingId(null);
  }
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-card match-modal" role="dialog" aria-modal="true" aria-labelledby="match-modal-title">
        <div className="modal-top"><span className="modal-icon match-modal-icon"><HandHeart size={18} /></span><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-heading"><div className="section-kicker">NEARBY COMMUNITY MATCHES</div><h2 id="match-modal-title">{listing.name}</h2><p>{listing.predicted_servings} estimated servings · {listing.donor_address}</p></div>
        <div className="match-pickup-summary"><span><CalendarClock size={15} /> Pickup by <strong>{formatPickup(listing.available_until)}</strong></span><span><Clock3 size={14} /> Recommended within <strong>{listing.recommended_pickup_minutes} min</strong></span><span><Sparkles size={14} /> {Math.round(Number(listing.confidence) * 100)}% forecast confidence</span></div>
        {listing.notes && <p className="match-notes">{listing.notes}</p>}
        {error && <div className="form-error match-error" role="alert">{error}</div>}
        {listing.status === "claimed" ? (
          <div className="completion-panel">
            <div className="completion-copy"><span className="completion-check"><Check size={15} /></span><span><strong>Pickup matched</strong><small>{listing.claimed_by_name} is collecting this food.</small></span></div>
            <button className="primary-button complete-button" onClick={() => onComplete(listing)}>Mark as picked up <Check size={15} /></button>
          </div>
        ) : listing.status === "completed" ? (
          <div className="completed-panel"><span className="completion-check"><Check size={15} /></span><span><strong>Pickup complete</strong><small>Thank you for keeping good food in the community.</small></span></div>
        ) : (
          <div className="match-list">
          {matches.map((partner, index) => (
            <article className="match-partner" key={partner.id}>
              <span className={`partner-avatar partner-avatar-${index % 3}`}><HandHeart size={17} /></span>
              <span className="match-partner-copy"><strong>{partner.name}</strong><small><MapPin size={12} />{partner.distanceKm} km away · {partner.address}</small></span>
              <button className="claim-button" disabled={claimingId !== null || listing.status !== "available"} onClick={() => handleClaim(partner.id)}>{claimingId === partner.id ? "Saving..." : listing.status === "available" ? "Select" : "Matched"}</button>
            </article>
          ))}
          {!matches.length && <div className="empty-state compact-empty"><strong>No nearby matches yet</strong><span>There are no registered partners within 25 km.</span></div>}
          </div>
        )}
        <p className="match-footnote"><MapPin size={13} /> Matches are ranked by distance from your kitchen.</p>
      </section>
    </div>
  );
}

export default App;
