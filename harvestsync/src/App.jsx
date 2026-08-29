import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Church,
  BookOpen,
  ShieldCheck,
  CalendarCheck,
  Plus,
  Search,
  Home,
  CalendarCheck2,
  Users,
  ListPlus,
  MessageCircle,
  Settings,
  Power,
  Book,
  HandHelping,
  Mic,
} from "lucide-react";
/* ---------- Supabase Configuration ---------- */
const SUPABASE_URL = "https://ncfhawuodkenzakiijql.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZMhM-LHhQuOc7-X9qq7JfA_Gvb-VCXE";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const DB_KEY = "directory_db";
const LOCAL_CACHE_KEY = "harvest-sync-directory-db";
const ADMIN_PASSWORD = "harvest-admin-2026";

/* ---------- helpers ---------- */
const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const initialSongs = [
  {
    id: "s1",
    title: "Amazing Grace (My Chains Are Gone)",
    key: "G",
    chordpro:
      "# Verse 1\n[G]Amazing grace how [C]sweet the [G]sound\nThat saved a [D]wretch like [G]me\nI [G]once was lost but [C]now am [G]found\nWas blind but [D]now I [G]see\n\n# Chorus\nMy [G]chains are gone I've [C]been set [G]free\nMy God my Savior has [D]ransomed me\nAnd [G]like a flood His [C]mercy [G]reigns\nUnending [D]love amazing [G]grace",
  },
  {
    id: "s2",
    title: "Way Maker",
    key: "E",
    chordpro:
      "# Verse 1\n[E]You are here moving in our [B]midst\nI worship [A]You I worship [E]You\n[E]You are here working in this [B]place\nI worship [A]You I worship [E]You\n\n# Chorus\n[E]Way Maker Miracle Worker [B]Promise Keeper\n[A]Light in the darkness my God [E]that is who You are",
  },
];

const defaultChurches = [
  {
    code: "SGHC",
    churchName: "Shekinah Global Harvest Church",
    people: [
      { id: "p1", name: "Pastor Juan", roles: ["preacher"], instrument: "" },
      { id: "p2", name: "Sis. Maria", roles: ["songleader"], instrument: "" },
      {
        id: "p3",
        name: "Bro. Mark",
        roles: ["musician"],
        instrument: "Acoustic Guitar",
      },
    ],
    songs: initialSongs,
    sermons: [],
    weeks: [],
    messages: [
      {
        id: "m1",
        sender: "System",
        text: "Welcome to SGHC secure server! Ready for Sunday service.",
        time: "Today",
      },
    ],
  },
];

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtLong = (iso) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};
const fmtShort = (iso) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

function parseChordLine(line) {
  const lyricChars = [];
  const marks = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === "[") {
      const end = line.indexOf("]", i);
      if (end !== -1) {
        marks.push({ pos: lyricChars.length, chord: line.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    lyricChars.push(line[i]);
    i++;
  }
  const lyric = lyricChars.join("");
  let chordLine = "";
  marks.forEach(({ pos, chord }) => {
    while (chordLine.length < pos) chordLine += " ";
    chordLine += chord + " ";
  });
  return {
    chordLine: chordLine.replace(/\s+$/, ""),
    lyric,
    hasChords: marks.length > 0,
  };
}

function ChordChart({ text }) {
  if (!text || !text.trim()) {
    return (
      <p className="wp-muted wp-mono-empty">
        No chords entered for this song yet.
      </p>
    );
  }
  const lines = text.split("\n");
  return (
    <div className="wp-chartblock">
      {lines.map((line, idx) => {
        if (line.trim() === "")
          return <div key={idx} className="wp-chart-gap" />;
        if (line.trim().startsWith("#")) {
          return (
            <div key={idx} className="wp-chart-section">
              {line.trim().replace(/^#\s*/, "")}
            </div>
          );
        }
        const { chordLine, lyric, hasChords } = parseChordLine(line);
        return (
          <div key={idx} className="wp-chart-line">
            {hasChords && (
              <div className="wp-chart-chords">{chordLine || "\u00A0"}</div>
            )}
            <div className="wp-chart-lyric">{lyric || "\u00A0"}</div>
          </div>
        );
      })}
    </div>
  );
}

const ROLE_LABEL = {
  preacher: "Preacher",
  songleader: "Song Leader",
  musician: "Musician",
};
const ROLE_LIST = ["preacher", "songleader", "musician"];

function RoleBadge({ role }) {
  return (
    <span className={`wp-badge wp-badge-${role}`}>{ROLE_LABEL[role]}</span>
  );
}

/* Shared header used by Home Base, Server Portal, and Dashboard so
   all three screens read as one continuous product. */
function BrandHeader({ kicker, title, right }) {
  return (
    <header className="wp-masthead">
      <div>
        <div className="wp-kicker">{kicker}</div>
        <h1 className="wp-title">{title}</h1>
      </div>
      {right ? <div className="wp-masthead-right">{right}</div> : null}
    </header>
  );
}

/* ---------- main app ---------- */
export default function App() {
  const [churches, setChurches] = useState(defaultChurches);
  const [activeCode, setActiveCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState("idle");
  const [appStage, setAppStage] = useState("dashboard");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminError, setAdminError] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [connectError, setConnectError] = useState("");
  const [newChurchName, setNewChurchName] = useState("");
  const [newChurchCode, setNewChurchCode] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [pendingChurchCode, setPendingChurchCode] = useState(null);
  const [modalCodeInput, setModalCodeInput] = useState("");
  const [modalError, setModalError] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const [loginInputName, setLoginInputName] = useState("");
  const [loginRoles, setLoginRoles] = useState(["musician"]);
  const [loginInstrument, setLoginInstrument] = useState("");
  const [tab, setTab] = useState("week");
  const [selectedWeekId, setSelectedWeekId] = useState(null);

  const churchesRef = useRef(churches);
  useEffect(() => {
    churchesRef.current = churches;
  }, [churches]);

  useEffect(() => {
    let cancelled = false;

    async function fetchCloudData() {
      try {
        const { data, error } = await supabase
          .from("app_data")
          .select("value")
          .eq("key", DB_KEY)
          .maybeSingle();

        if (error) throw error;

        if (data && Array.isArray(data.value) && data.value.length > 0) {
          if (!cancelled) setChurches(data.value);
          localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(data.value));
        } else {
          const { error: seedError } = await supabase
            .from("app_data")
            .upsert({ key: DB_KEY, value: defaultChurches });
          if (seedError) throw seedError;
        }
      } catch (err) {
        console.warn("Cloud fetch failed, using local storage fallback:", err);
        const saved = localStorage.getItem(LOCAL_CACHE_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0 && !cancelled) {
              setChurches(parsed);
            }
          } catch (e) {
            /* ignore corrupt cache */
          }
        }
      }
      if (!cancelled) setLoading(false);
    }

    fetchCloudData();

    const channel = supabase
      .channel("public:app_data")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_data",
          filter: `key=eq.${DB_KEY}`,
        },
        (payload) => {
          if (payload.new && Array.isArray(payload.new.value)) {
            setChurches(payload.new.value);
            localStorage.setItem(
              LOCAL_CACHE_KEY,
              JSON.stringify(payload.new.value)
            );
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const persistDirectory = useCallback(async (updatedList) => {
    setChurches(updatedList);
    setSaveState("saving");
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(updatedList));

    try {
      const { error } = await supabase
        .from("app_data")
        .upsert({ key: DB_KEY, value: updatedList });
      if (error) throw error;
      setSaveState("idle");
    } catch (err) {
      console.warn("Cloud sync blocked/failed, saved locally:", err);
      setSaveState("error");
      setTimeout(() => setSaveState((s) => (s === "error" ? "idle" : s)), 4000);
    }
  }, []);

  const currentChurch = churches.find((c) => c.code === activeCode) || null;

  const updateCurrentChurch = (patch) => {
    const latest = churchesRef.current;
    const updated = latest.map((c) =>
      c.code === activeCode ? { ...c, ...patch } : c
    );
    persistDirectory(updated);
  };

  useEffect(() => {
    if (!currentChurch || loading) return;
    if (
      selectedWeekId &&
      currentChurch.weeks.some((w) => w.id === selectedWeekId)
    )
      return;
    if (currentChurch.weeks.length === 0) {
      setSelectedWeekId(null);
      return;
    }
    const sorted = [...currentChurch.weeks].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const upcoming = sorted.find((w) => w.date >= todayISO());
    setSelectedWeekId((upcoming || sorted[sorted.length - 1]).id);
  }, [loading, currentChurch, selectedWeekId]);

  const peopleById = useMemo(
    () =>
      Object.fromEntries((currentChurch?.people || []).map((p) => [p.id, p])),
    [currentChurch]
  );
  const songsById = useMemo(
    () =>
      Object.fromEntries((currentChurch?.songs || []).map((s) => [s.id, s])),
    [currentChurch]
  );
  const selectedWeek =
    currentChurch?.weeks.find((w) => w.id === selectedWeekId) || null;

  const addPerson = (name, roles, instrument) => {
    if (!name.trim()) return;
    const newPeople = [
      ...currentChurch.people,
      { id: uid(), name: name.trim(), roles, instrument: instrument.trim() },
    ];
    updateCurrentChurch({ people: newPeople });
  };
  const updatePerson = (id, patch) => {
    const newPeople = currentChurch.people.map((p) =>
      p.id === id ? { ...p, ...patch } : p
    );
    updateCurrentChurch({ people: newPeople });
  };
  const deletePerson = (id) => {
    const newPeople = currentChurch.people.filter((p) => p.id !== id);
    const newWeeks = currentChurch.weeks.map((w) => ({
      ...w,
      preacherId: w.preacherId === id ? null : w.preacherId,
      songLeaderId: w.songLeaderId === id ? null : w.songLeaderId,
      musicianIds: w.musicianIds.filter((m) => m !== id),
    }));
    updateCurrentChurch({ people: newPeople, weeks: newWeeks });
  };
  const addSong = (title, key) => {
    if (!title.trim()) return;
    const s = { id: uid(), title: title.trim(), key: key.trim(), chordpro: "" };
    updateCurrentChurch({ songs: [...currentChurch.songs, s] });
    return s.id;
  };
  const updateSong = (id, patch) => {
    const newSongs = currentChurch.songs.map((s) =>
      s.id === id ? { ...s, ...patch } : s
    );
    updateCurrentChurch({ songs: newSongs });
  };
  const deleteSong = (id) => {
    const newSongs = currentChurch.songs.filter((s) => s.id !== id);
    const newWeeks = currentChurch.weeks.map((w) => ({
      ...w,
      lineup: w.lineup.filter((l) => l.songId !== id),
    }));
    updateCurrentChurch({ songs: newSongs, weeks: newWeeks });
  };
  const addSermon = (title, scripture, date) => {
    if (!title.trim()) return;
    const s = {
      id: uid(),
      title: title.trim(),
      scripture: scripture.trim(),
      date: date || todayISO(),
      notes: "",
    };
    updateCurrentChurch({ sermons: [...(currentChurch.sermons || []), s] });
    return s.id;
  };
  const updateSermon = (id, patch) => {
    const newSermons = (currentChurch.sermons || []).map((s) =>
      s.id === id ? { ...s, ...patch } : s
    );
    updateCurrentChurch({ sermons: newSermons });
  };
  const deleteSermon = (id) => {
    const newSermons = (currentChurch.sermons || []).filter((s) => s.id !== id);
    updateCurrentChurch({ sermons: newSermons });
  };
  const addWeek = (date) => {
    if (!date) return;
    const w = {
      id: uid(),
      date,
      preacherId: null,
      songLeaderId: null,
      musicianIds: [],
      notes: "",
      lineup: [],
    };
    updateCurrentChurch({ weeks: [...currentChurch.weeks, w] });
    setSelectedWeekId(w.id);
    setTab("week");
  };
  const updateWeek = (id, patch) => {
    const newWeeks = currentChurch.weeks.map((w) =>
      w.id === id ? { ...w, ...patch } : w
    );
    updateCurrentChurch({ weeks: newWeeks });
  };
  const deleteWeek = (id) => {
    const newWeeks = currentChurch.weeks.filter((w) => w.id !== id);
    updateCurrentChurch({ weeks: newWeeks });
    if (selectedWeekId === id) setSelectedWeekId(null);
  };
  const addToLineup = (weekId, songId) => {
    const w = currentChurch.weeks.find((x) => x.id === weekId);
    if (!w) return;
    const newWeeks = currentChurch.weeks.map((wk) =>
      wk.id === weekId
        ? { ...wk, lineup: [...wk.lineup, { id: uid(), songId, notes: "" }] }
        : wk
    );
    updateCurrentChurch({ weeks: newWeeks });
  };
  const updateLineupItem = (weekId, itemId, patch) => {
    const newWeeks = currentChurch.weeks.map((wk) =>
      wk.id === weekId
        ? {
            ...wk,
            lineup: wk.lineup.map((l) =>
              l.id === itemId ? { ...l, ...patch } : l
            ),
          }
        : wk
    );
    updateCurrentChurch({ weeks: newWeeks });
  };
  const removeLineupItem = (weekId, itemId) => {
    const newWeeks = currentChurch.weeks.map((wk) =>
      wk.id === weekId
        ? { ...wk, lineup: wk.lineup.filter((l) => l.id !== itemId) }
        : wk
    );
    updateCurrentChurch({ weeks: newWeeks });
  };
  const moveLineupItem = (weekId, index, dir) => {
    const w = currentChurch.weeks.find((x) => x.id === weekId);
    const arr = [...w.lineup];
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    const newWeeks = currentChurch.weeks.map((wk) =>
      wk.id === weekId ? { ...wk, lineup: arr } : wk
    );
    updateCurrentChurch({ weeks: newWeeks });
  };
  const addMessage = (text) => {
    const sender = currentUserName ? currentUserName : "Member";
    const newMessage = {
      id: uid(),
      sender,
      text,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    updateCurrentChurch({
      messages: [...(currentChurch.messages || []), newMessage],
    });
  };

  const handleConnect = (e) => {
    e.preventDefault();
    setConnectError("");
    if (!inputCode.trim()) return;
    const found = churches.find(
      (c) => c.code === inputCode.trim().toUpperCase()
    );
    if (found) {
      setActiveCode(found.code);
      setAppStage("platform");
      setInputCode("");
    } else {
      setConnectError(
        "That access code doesn't match any server yet. Double-check it with your church admin, or register a new one below."
      );
    }
  };

  const handleCreateChurch = (e) => {
    e.preventDefault();
    if (!newChurchName.trim() || !newChurchCode.trim()) return;
    const codeClean = newChurchCode.trim().toUpperCase();
    if (churches.some((c) => c.code === codeClean)) {
      alert("This access code is already taken. Please choose another one.");
      return;
    }
    const newChurch = {
      code: codeClean,
      churchName: newChurchName.trim(),
      people: [],
      songs: initialSongs,
      sermons: [],
      weeks: [],
      messages: [
        {
          id: "m1",
          sender: "System",
          text: `Welcome to ${newChurchName.trim()} server!`,
          time: "Today",
        },
      ],
    };
    persistDirectory([...churches, newChurch]);
    setActiveCode(codeClean);
    setAppStage("platform");
    setShowCreate(false);
    setNewChurchName("");
    setNewChurchCode("");
  };

  const openConnectModal = (code) => {
    setPendingChurchCode(code);
    setModalCodeInput("");
    setModalError("");
    setShowConnectModal(true);
  };

  const submitConnectModal = (e) => {
    e.preventDefault();
    const target = churches.find((c) => c.code === pendingChurchCode);
    if (target && modalCodeInput.trim().toUpperCase() === target.code) {
      setActiveCode(target.code);
      setAppStage("platform");
      setShowConnectModal(false);
    } else {
      setModalError(
        "That access code doesn't match this church. Ask your admin for the correct code."
      );
    }
  };

  const handleJoinServer = (e) => {
    if (e) e.preventDefault();
    const nameClean = loginInputName.trim();
    if (!nameClean || loginRoles.length === 0) return;

    const existing = currentChurch.people.find(
      (p) => p.name.toLowerCase() === nameClean.toLowerCase()
    );
    if (!existing) {
      const newPerson = {
        id: uid(),
        name: nameClean,
        roles: loginRoles,
        instrument: loginInstrument.trim(),
      };
      updateCurrentChurch({ people: [...currentChurch.people, newPerson] });
    }
    setCurrentUserName(nameClean.toUpperCase());
  };

  if (loading) {
    return (
      <div className="wp-app wp-loading">
        <Style />
        <div className="wp-loading-text">Loading Dashboard...</div>
      </div>
    );
  }

  /* ---------- CHURCHES DASHBOARD (unchanged Supabase-style admin views) ---------- */
  if (appStage === "dashboard") {
    const filteredChurches = churches
      .filter((c) =>
        c.churchName.toLowerCase().includes(ownerSearch.toLowerCase())
      )
      .sort((a, b) => a.churchName.localeCompare(b.churchName));

    const totalMembers = churches.reduce((n, c) => n + c.people.length, 0);
    const totalSongs = churches.reduce((n, c) => n + c.songs.length, 0);
    const totalWeeks = churches.reduce((n, c) => n + c.weeks.length, 0);
    const totalMessages = churches.reduce(
      (n, c) => n + (c.messages || []).length,
      0
    );

    return (
      <div className="wp-app wp-sb">
        <Style />

        <div className="wp-sb-topbar">
          <div className="wp-sb-topbar-left">
            <span className="wp-sb-logo">
              {" "}
              <CalendarCheck size={20} strokeWidth={1.5} />{" "}
            </span>
            <span className="wp-sb-slash">/</span>
            <span className="wp-sb-org">ShiftFlow Omega</span>
            <span className="wp-sb-chevron">⌄</span>
          </div>
          <div className="wp-sb-topbar-right">
            <span className="wp-sb-feedback">Feedback</span>
            <div className="wp-sb-search">
              <span className="wp-sb-search-ic">🔍</span>
              Search... <kbd>Ctrl K</kbd>
            </div>
            <span className="wp-sb-iconbtn" title="Help">
              ?
            </span>
            <div className="wp-sb-avatar">HS</div>
          </div>
        </div>

        <div className="wp-sb-body">
          <div className="wp-sb-rail">
            <div className="wp-sb-rail-logo">
              {" "}
              <CalendarCheck size={20} strokeWidth={1.5} />{" "}
            </div>
            <button className="wp-sb-railicon is-active" title="Churches">
              <Church size={16} strokeWidth={2} />
            </button>
            <button
              className="wp-sb-railicon"
              title="Bible & Daily Devotional"
              onClick={() => setAppStage("devotion")}
            >
              <BookOpen size={16} strokeWidth={2.5} />
            </button>

            <div className="wp-sb-rail-spacer" />
            <button
              className="wp-sb-railicon"
              title="Admin"
              onClick={() => setAppStage("admin")}
            >
              <ShieldUser size={16} strokeWidth={2} />
            </button>
          </div>

          <div className="wp-sb-main">
            <h1 className="wp-sb-title">Churches</h1>

            <div className="wp-sb-toolbar">
              <div className="wp-sb-searchbox">
                <span className="wp-sb-search-ic">
                  {" "}
                  <Search size={16} strokeWidth={1.5} />{" "}
                </span>
                <input
                  placeholder="Search for a church..."
                  value={ownerSearch}
                  onChange={(e) => setOwnerSearch(e.target.value)}
                />
              </div>
              <button className="wp-sb-pillbtn" type="button">
                Status <span className="wp-sb-caret">⌄</span>
              </button>
              <button className="wp-sb-pillbtn" type="button">
                <span className="wp-sb-sortic">↕</span> Sorted by name
              </button>
              <div className="wp-sb-spacergrow" />
              <div className="wp-sb-viewtoggle">
                <button
                  className={viewMode === "grid" ? "is-active" : ""}
                  onClick={() => setViewMode("grid")}
                  title="Grid view"
                >
                  ▦
                </button>
                <button
                  className={viewMode === "list" ? "is-active" : ""}
                  onClick={() => setViewMode("list")}
                  title="List view"
                >
                  ☰
                </button>
              </div>
              <button
                className="wp-btn wp-btn-ghost"
                onClick={() => setShowCreate(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Plus size={15} strokeWidth={3} /> Register a New Church Server
              </button>
            </div>
            <div className="wp-sb-content">
              <div className="wp-sb-content-main">
                {filteredChurches.length === 0 ? (
                  <div className="wp-empty">
                    <div className="wp-empty-mark">✦</div>
                    <h2>No churches found</h2>
                    <p className="wp-muted">
                      Try a different search, or register a new church server.
                    </p>
                  </div>
                ) : viewMode === "grid" ? (
                  <div className="wp-sb-grid">
                    {filteredChurches.map((c) => (
                      <button
                        key={c.code}
                        className="wp-sb-card"
                        onClick={() => openConnectModal(c.code)}
                      >
                        <div className="wp-sb-card-top">
                          <span className="wp-sb-card-dot" />
                          <span className="wp-sb-card-name">
                            {c.churchName}
                          </span>
                        </div>
                        <div className="wp-sb-card-meta">
                          {c.people.length} member
                          {c.people.length === 1 ? "" : "s"} · {c.weeks.length}{" "}
                          Sunday{c.weeks.length === 1 ? "" : "s"}
                        </div>
                        <span className="wp-sb-card-tag">{c.code}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="wp-sb-listview">
                    {filteredChurches.map((c) => (
                      <button
                        key={c.code}
                        className="wp-sb-listrow"
                        onClick={() => openConnectModal(c.code)}
                      >
                        <span className="wp-sb-card-dot" />
                        <span className="wp-sb-listrow-name">
                          {c.churchName}
                        </span>
                        <span className="wp-sb-listrow-meta">
                          {c.people.length} members · {c.weeks.length} Sundays
                        </span>
                        <span className="wp-sb-card-tag">{c.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="wp-sb-usage">
                <div className="wp-sb-usage-head">
                  <div className="wp-sb-usage-title">Platform usage</div>
                  <div className="wp-sb-usage-sub">All churches combined</div>
                </div>
                <div className="wp-sb-usage-row">
                  <span className="wp-sb-usage-bullet" />
                  <span className="wp-sb-usage-label">Churches</span>
                  <span className="wp-sb-usage-value">{churches.length}</span>
                </div>
                <div className="wp-sb-usage-row">
                  <span className="wp-sb-usage-bullet" />
                  <span className="wp-sb-usage-label">Team Members</span>
                  <span className="wp-sb-usage-value">{totalMembers}</span>
                </div>
                <div className="wp-sb-usage-row">
                  <span className="wp-sb-usage-bullet" />
                  <span className="wp-sb-usage-label">Songs in Library</span>
                  <span className="wp-sb-usage-value">{totalSongs}</span>
                </div>
                <div className="wp-sb-usage-row">
                  <span className="wp-sb-usage-bullet" />
                  <span className="wp-sb-usage-label">Sundays Scheduled</span>
                  <span className="wp-sb-usage-value">{totalWeeks}</span>
                </div>
                <div className="wp-sb-usage-row">
                  <span className="wp-sb-usage-bullet" />
                  <span className="wp-sb-usage-label">Chat Messages</span>
                  <span className="wp-sb-usage-value">{totalMessages}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showCreate && (
          <div
            className="wp-modal-overlay"
            onClick={() => setShowCreate(false)}
          >
            <div className="wp-modal-box" onClick={(e) => e.stopPropagation()}>
              <h2 className="wp-modal-title">Register a New Church Server</h2>
              <p className="wp-muted" style={{ marginBottom: "14px" }}>
                Give it a name and a unique access code — you'll use that code
                on every device to reach this church's server.
              </p>
              <form
                onSubmit={handleCreateChurch}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <input
                  className="wp-input"
                  placeholder="Church Name"
                  value={newChurchName}
                  onChange={(e) => setNewChurchName(e.target.value)}
                  autoFocus
                />
                <input
                  className="wp-input"
                  placeholder="Unique Access Code (e.g., SGHC2026)"
                  value={newChurchCode}
                  onChange={(e) => setNewChurchCode(e.target.value)}
                />
                <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                  <button
                    type="submit"
                    className="wp-sb-newbtn"
                    style={{ flex: 1 }}
                  >
                    Create Server
                  </button>
                  <button
                    type="button"
                    className="wp-btn wp-btn-ghost"
                    onClick={() => setShowCreate(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showConnectModal && (
          <div
            className="wp-modal-overlay"
            onClick={() => setShowConnectModal(false)}
          >
            <div className="wp-modal-box" onClick={(e) => e.stopPropagation()}>
              <h2 className="wp-modal-title">
                Connect to{" "}
                {churches.find((c) => c.code === pendingChurchCode)
                  ?.churchName || "this church"}
              </h2>
              <p className="wp-muted" style={{ marginBottom: "14px" }}>
                Enter this church's access code to enter its server.
              </p>
              <form
                onSubmit={submitConnectModal}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <input
                  className="wp-input"
                  placeholder="Access Code"
                  value={modalCodeInput}
                  onChange={(e) => {
                    setModalCodeInput(e.target.value);
                    setModalError("");
                  }}
                  autoFocus
                />
                {modalError && <p className="wp-error-text">{modalError}</p>}
                <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                  <button
                    type="submit"
                    className="wp-sb-newbtn"
                    style={{ flex: 1 }}
                    disabled={!modalCodeInput.trim()}
                  >
                    Connect
                  </button>
                  <button
                    type="button"
                    className="wp-btn wp-btn-ghost"
                    onClick={() => setShowConnectModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ---------- BIBLE & DAILY DEVOTIONAL (standalone, no church login needed) ---------- */
  if (appStage === "devotion") {
    return (
      <div className="wp-app wp-sb">
        <Style />
        <div className="wp-sb-topbar">
          <div className="wp-sb-topbar-left">
            <span className="wp-sb-logo">
              {" "}
              <CalendarCheck size={20} strokeWidth={1.5} />{" "}
            </span>
            <span className="wp-sb-slash">/</span>
            <span className="wp-sb-org">ShiftFlow Omega</span>
            <span className="wp-sb-plan">DEVOTION</span>
          </div>
          <div className="wp-sb-topbar-right">
            <div className="wp-sb-avatar">HS</div>
          </div>
        </div>
        <div className="wp-sb-body">
          <div className="wp-sb-rail">
            <div className="wp-sb-rail-logo">
              {" "}
              <CalendarCheck size={20} strokeWidth={1.5} />{" "}
            </div>
            <button
              className="wp-sb-railicon"
              title="Churches"
              onClick={() => setAppStage("dashboard")}
            >
              <Church size={16} strokeWidth={2} />
            </button>
            <button
              className="wp-sb-railicon is-active"
              title="Bible & Daily Devotional"
            >
              <BookOpen size={16} strokeWidth={2.5} />
            </button>
            <div className="wp-sb-rail-spacer" />
            <button
              className="wp-sb-railicon"
              title="Admin"
              onClick={() => setAppStage("admin")}
            >
              <ShieldUser size={16} strokeWidth={2} />
            </button>
          </div>
          <div className="wp-sb-main">
            <div className="wp-admin-headrow">
              <h1 className="wp-sb-title" style={{ marginBottom: "4px" }}>
                Bible &amp; Daily Devotional
              </h1>
              <button
                className="wp-btn wp-btn-ghost"
                onClick={() => setAppStage("dashboard")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <House size={16} strokeWidth={2.5} /> Back to Churches
              </button>
            </div>
            <p className="wp-muted" style={{ margin: "0 0 22px" }}>
              A quiet moment before the week's plans — today's devotion and a
              handful of Scripture passages your team turns to often.
            </p>
            <div className="wp-panel">
              <DevotionView />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- ADMIN AREA ---------- */
  if (appStage === "admin") {
    if (!adminUnlocked) {
      return (
        <div className="wp-app wp-loginscreen">
          <Style />
          <div className="wp-loginbox">
            <div className="wp-kicker">ShiftFlow Omega Platform</div>
            <h1 className="wp-title" style={{ fontSize: "30px" }}>
              🛡️ Admin Access
            </h1>
            <p className="wp-muted" style={{ margin: "14px 0 20px" }}>
              Enter your admin password to check the site's progress.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (adminPasswordInput === ADMIN_PASSWORD) {
                  setAdminUnlocked(true);
                  setAdminPasswordInput("");
                  setAdminError("");
                } else {
                  setAdminError("Wrong password. Try again.");
                }
              }}
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <input
                type="password"
                className="wp-input"
                placeholder="Admin password"
                value={adminPasswordInput}
                onChange={(e) => {
                  setAdminPasswordInput(e.target.value);
                  setAdminError("");
                }}
                autoFocus
              />
              {adminError && <p className="wp-error-text">{adminError}</p>}
              <button
                type="submit"
                className="wp-btn wp-btn-primary"
                disabled={!adminPasswordInput.trim()}
              >
                Unlock Admin Area
              </button>
              <button
                type="button"
                className="wp-btn wp-btn-ghost"
                onClick={() => setAppStage("dashboard")}
              >
                ← Back to Churches
              </button>
            </form>
          </div>
        </div>
      );
    }

    const totalMembers = churches.reduce((n, c) => n + c.people.length, 0);
    const totalSongs = churches.reduce((n, c) => n + c.songs.length, 0);
    const totalWeeks = churches.reduce((n, c) => n + c.weeks.length, 0);
    const totalMessages = churches.reduce(
      (n, c) => n + (c.messages || []).length,
      0
    );
    const today = todayISO();

    return (
      <div className="wp-app wp-sb">
        <Style />
        <div className="wp-sb-topbar">
          <div className="wp-sb-topbar-left">
            <span className="wp-sb-logo">⚡</span>
            <span className="wp-sb-slash">/</span>
            <span className="wp-sb-org">ShiftFlow Omega</span>
            <span className="wp-sb-plan">ADMIN</span>
          </div>
          <div className="wp-sb-topbar-right">
            <button
              className="wp-btn wp-btn-ghost"
              style={{ fontSize: "11.5px", padding: "6px 10px" }}
              onClick={() => setAdminUnlocked(false)}
            >
              🔒 Lock Admin
            </button>
            <div className="wp-sb-avatar">HS</div>
          </div>
        </div>

        <div className="wp-sb-body">
          <div className="wp-sb-rail">
            <div className="wp-sb-rail-logo">⚡</div>
            <button
              className="wp-sb-railicon"
              title="Churches"
              onClick={() => setAppStage("dashboard")}
            >
              ⛪
            </button>
          </div>

          <div className="wp-sb-main">
            <div className="wp-admin-headrow">
              <h1 className="wp-sb-title" style={{ marginBottom: "4px" }}>
                Admin Overview
              </h1>
              <button
                className="wp-btn wp-btn-ghost"
                onClick={() => setAppStage("dashboard")}
              >
                🏠 Back to Churches
              </button>
            </div>
            <p className="wp-muted" style={{ margin: "0 0 22px" }}>
              A quick check of how ShiftFlow Omega is being used across every church
              currently registered.
            </p>

            <div className="wp-admin-statgrid">
              <div className="wp-admin-statcard">
                <span className="wp-admin-statlabel">Churches</span>
                <span className="wp-admin-statvalue">{churches.length}</span>
              </div>
              <div className="wp-admin-statcard">
                <span className="wp-admin-statlabel">Team Members</span>
                <span className="wp-admin-statvalue">{totalMembers}</span>
              </div>
              <div className="wp-admin-statcard">
                <span className="wp-admin-statlabel">Songs In Library</span>
                <span className="wp-admin-statvalue">{totalSongs}</span>
              </div>
              <div className="wp-admin-statcard">
                <span className="wp-admin-statlabel">Sundays Scheduled</span>
                <span className="wp-admin-statvalue">{totalWeeks}</span>
              </div>
              <div className="wp-admin-statcard">
                <span className="wp-admin-statlabel">Chat Messages</span>
                <span className="wp-admin-statvalue">{totalMessages}</span>
              </div>
              <div className="wp-admin-statcard">
                <span className="wp-admin-statlabel">Sync Status</span>
                <span
                  className="wp-admin-statvalue"
                  style={
                    saveState === "error"
                      ? { color: "var(--remove)" }
                      : undefined
                  }
                >
                  {saveState === "error" ? "Local only" : "Cloud synced"}
                </span>
              </div>
            </div>

            <h2 className="wp-admin-tablehead">Churches</h2>
            {churches.length === 0 ? (
              <div className="wp-empty">
                <div className="wp-empty-mark">✦</div>
                <h2>No churches yet</h2>
                <p className="wp-muted">
                  Once churches register, their progress will show up here.
                </p>
              </div>
            ) : (
              <div className="wp-admin-tablewrap">
                <table className="wp-admin-table">
                  <thead>
                    <tr>
                      <th>Church</th>
                      <th>Code</th>
                      <th>Members</th>
                      <th>Songs</th>
                      <th>Sundays</th>
                      <th>Messages</th>
                      <th>Next Sunday</th>
                    </tr>
                  </thead>
                  <tbody>
                    {churches.map((c) => {
                      const upcoming = [...c.weeks]
                        .filter((w) => w.date >= today)
                        .sort((a, b) => a.date.localeCompare(b.date))[0];
                      return (
                        <tr
                          key={c.code}
                          onClick={() => {
                            setActiveCode(c.code);
                            setAppStage("platform");
                          }}
                        >
                          <td className="wp-admin-td-name">{c.churchName}</td>
                          <td>
                            <span className="wp-sb-card-tag">{c.code}</span>
                          </td>
                          <td>{c.people.length}</td>
                          <td>{c.songs.length}</td>
                          <td>{c.weeks.length}</td>
                          <td>{(c.messages || []).length}</td>
                          <td>{upcoming ? fmtShort(upcoming.date) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- HOME BASE PORTAL (Supabase-style, matches Dashboard) ---------- */
  if (!activeCode) {
    return (
      <div className="wp-app wp-sb">
        <Style />
        <div className="wp-sb-topbar">
          <div className="wp-sb-topbar-left">
            <span className="wp-sb-logo">⚡</span>
            <span className="wp-sb-slash">/</span>
            <span className="wp-sb-org">ShiftFlow Omega</span>
          </div>
        </div>

        <div className="wp-sb-authwrap">
          <div className="wp-sb-authbox">
            <div className="wp-kicker">ShiftFlow Omega Platform</div>
            <h1 className="wp-title">Home Base</h1>
            <p className="wp-muted" style={{ margin: "14px 0 20px" }}>
              Enter your church access code to connect to your server:
            </p>

            {!showCreate ? (
              <form
                onSubmit={handleConnect}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    className="wp-input"
                    placeholder="Access Code (e.g., SGHC2026)"
                    value={inputCode}
                    onChange={(e) => {
                      setInputCode(e.target.value);
                      setConnectError("");
                    }}
                  />
                  <button
                    type="submit"
                    className="wp-btn wp-btn-primary"
                    disabled={!inputCode.trim()}
                  >
                    Connect
                  </button>
                </div>
                {connectError && (
                  <p className="wp-error-text">{connectError}</p>
                )}
                <div
                  style={{
                    borderTop: "1px solid var(--rule)",
                    margin: "10px 0",
                  }}
                />
                <button
                  type="button"
                  className="wp-btn wp-btn-ghost"
                  onClick={() => setShowCreate(true)}
                >
                  ➕ Register a New Church Server
                </button>
              </form>
            ) : (
              <form
                onSubmit={handleCreateChurch}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <input
                  className="wp-input"
                  placeholder="Church Name"
                  value={newChurchName}
                  onChange={(e) => setNewChurchName(e.target.value)}
                />
                <input
                  className="wp-input"
                  placeholder="Unique Access Code (e.g., SGHC2026)"
                  value={newChurchCode}
                  onChange={(e) => setNewChurchCode(e.target.value)}
                />
                <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                  <button
                    type="submit"
                    className="wp-btn wp-btn-primary"
                    style={{ flex: 1 }}
                  >
                    Create Server
                  </button>
                  <button
                    type="button"
                    className="wp-btn wp-btn-ghost"
                    onClick={() => setShowCreate(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- SERVER PORTAL (Supabase-style, matches Dashboard) ---------- */
  if (!currentUserName) {
    return (
      <div className="wp-app wp-sb">
        <Style />
        <div className="wp-sb-topbar">
          <div className="wp-sb-topbar-left">
            <span className="wp-sb-logo">
              <CalendarCheck size={20} strokeWidth={1.5} />{" "}
            </span>
            <span className="wp-sb-slash">/</span>
            <span className="wp-sb-org">{currentChurch.churchName}</span>
            <span className="wp-sb-plan">{currentChurch.code}</span>
          </div>
          <div className="wp-sb-topbar-right">
            <button
              className="wp-btn wp-btn-ghost"
              style={{
                fontSize: "11.5px",
                padding: "6px 10px",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
              onClick={() => {
                setActiveCode(null);
                setLoginInputName("");
                setAppStage("dashboard");
              }}
            >
              <House size={16} strokeWidth={2.5} /> Home Base
            </button>
          </div>
        </div>

        <div className="wp-sb-authwrap">
          <div className="wp-sb-authbox">
            <div className="wp-kicker">
              {currentChurch.churchName} (Code: {currentChurch.code})
            </div>
            <h1 className="wp-title">Server Portal</h1>
            <p className="wp-muted" style={{ margin: "14px 0 18px" }}>
              Enter your details to join and register into the team:
            </p>

            <form
              onSubmit={handleJoinServer}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                textAlign: "left",
              }}
            >
              <input
                className="wp-input"
                placeholder="Your Name (e.g., Jeremiah)"
                value={loginInputName}
                onChange={(e) => setLoginInputName(e.target.value)}
                autoFocus
              />

              <label className="wp-fieldlabel" style={{ marginTop: "4px" }}>
                Select Your Role(s):
              </label>
              <div className="wp-rolepicker">
                {ROLE_LIST.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`wp-rolechip ${
                      loginRoles.includes(r) ? "is-on" : ""
                    }`}
                    onClick={() =>
                      setLoginRoles((cur) =>
                        cur.includes(r)
                          ? cur.filter((x) => x !== r)
                          : [...cur, r]
                      )
                    }
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>

              {loginRoles.includes("musician") && (
                <input
                  className="wp-input"
                  placeholder="Instrument (e.g. Acoustic Guitar, Piano)"
                  value={loginInstrument}
                  onChange={(e) => setLoginInstrument(e.target.value)}
                  style={{ marginTop: "4px" }}
                />
              )}

              <button
                type="submit"
                className="wp-btn wp-btn-primary"
                disabled={!loginInputName.trim() || loginRoles.length === 0}
                style={{ marginTop: "10px", width: "100%" }}
              >
                Join &amp; Enter Dashboard
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- FULL SHARED DASHBOARD (Supabase-style shell) ---------- */
  const NAV_TABS = [
    {
      id: "week",
      label: "This Sunday",
      icon: <CalendarCheck size={16} strokeWidth={2.5} />,
    },
    {
      id: "schedule",
      label: "Schedule",
      icon: <CalendarCheck2 size={16} strokeWidth={2.5} />,
    },
    { id: "team", label: "Team", icon: <Users size={16} strokeWidth={2.5} /> },
    {
      id: "library",
      label: "Song Library",
      icon: <ListPlus size={16} strokeWidth={2.5} />,
    },
    {
      id: "preaching",
      label: "Preaching Library",
      icon: <Mic size={16} strokeWidth={2.5} />,
    },
    {
      id: "chat",
      label: "Team Chat",
      icon: <MessageCircle size={16} strokeWidth={2.5} />,
    },
    {
      id: "settings",
      label: "Settings",
      icon: <Settings size={16} strokeWidth={2.5} />,
    },
    {
      id: "devotion",
      label: "Bible & Devotion",
      icon: <BookOpen size={16} strokeWidth={2.5} />,
    },
  ];
  const activeTabLabel =
    NAV_TABS.find((t) => t.id === tab)?.label || "Dashboard";
  const initials = currentUserName
    ? currentUserName.trim().slice(0, 2).toUpperCase()
    : "ME";

  return (
    <div className="wp-app wp-sb">
      <Style />

      <div className="wp-sb-topbar">
        <div className="wp-sb-topbar-left">
          <span className="wp-sb-logo">
            <CalendarCheck size={20} strokeWidth={1.5} />
          </span>
          <span className="wp-sb-slash">/</span>
          <span className="wp-sb-org">{currentChurch.churchName}</span>
          <span className="wp-sb-plan">{currentChurch.code}</span>
          <span className="wp-sb-chevron">⌄</span>
        </div>
        <div className="wp-sb-topbar-right">
          <div className="wp-savepill" data-state={saveState}>
            {saveState === "saving"
              ? "Saving…"
              : saveState === "error"
              ? "⚠ Saved locally only"
              : "Saved"}
          </div>
          <span className="wp-sb-feedback">👤 {currentUserName}</span>
          <button
            className="wp-sb-iconbtn"
            title="Home Base"
            onClick={() => {
              setCurrentUserName("");
              setActiveCode(null);
              setAppStage("dashboard");
            }}
          >
            <House size={16} strokeWidth={2.5} />
          </button>
          <button
            className="wp-sb-iconbtn"
            title="Exit"
            onClick={() => {
              setCurrentUserName("");
              setActiveCode(null);
            }}
          >
            <Power size={16} />
          </button>
          <div className="wp-sb-avatar">{initials}</div>
        </div>
      </div>

      <div className="wp-sb-body">
        <div className="wp-sb-rail">
          <div className="wp-sb-rail-logo">
            {" "}
            <CalendarCheck size={16} />{" "}
          </div>
          {NAV_TABS.map((t) => (
            <button
              key={t.id}
              className={`wp-sb-railicon ${tab === t.id ? "is-active" : ""}`}
              title={t.label}
              onClick={() => setTab(t.id)}
            >
              {t.icon}
            </button>
          ))}
          <div className="wp-sb-rail-spacer" />
          <button
            className="wp-sb-railicon"
            title="Home Base"
            onClick={() => {
              setCurrentUserName("");
              setActiveCode(null);
              setAppStage("dashboard");
            }}
          >
            <House size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="wp-sb-main">
          <h1 className="wp-sb-title">{activeTabLabel}</h1>

          <div className="wp-panel">
            {tab === "week" && (
              <WeekView
                data={currentChurch}
                week={selectedWeek}
                peopleById={peopleById}
                songsById={songsById}
                onSelectWeek={setSelectedWeekId}
                onUpdateWeek={updateWeek}
                onAddWeek={addWeek}
                onAddToLineup={addToLineup}
                onUpdateLineupItem={updateLineupItem}
                onRemoveLineupItem={removeLineupItem}
                onMoveLineupItem={moveLineupItem}
                goToLibrary={() => setTab("library")}
                goToTeam={() => setTab("team")}
              />
            )}
            {tab === "schedule" && (
              <ScheduleView
                weeks={currentChurch.weeks}
                peopleById={peopleById}
                onAddWeek={addWeek}
                onSelect={(id) => {
                  setSelectedWeekId(id);
                  setTab("week");
                }}
                onDelete={deleteWeek}
              />
            )}
            {tab === "team" && (
              <TeamView
                people={currentChurch.people}
                onAdd={addPerson}
                onUpdate={updatePerson}
                onDelete={deletePerson}
              />
            )}
            {tab === "library" && (
              <LibraryView
                songs={currentChurch.songs}
                onAdd={addSong}
                onUpdate={updateSong}
                onDelete={deleteSong}
              />
            )}
            {tab === "preaching" && (
              <PreachingLibraryView
                sermons={currentChurch.sermons || []}
                onAdd={addSermon}
                onUpdate={updateSermon}
                onDelete={deleteSermon}
              />
            )}
            {tab === "chat" && (
              <ChatView
                messages={currentChurch.messages || []}
                onSendMessage={addMessage}
                currentUserName={currentUserName}
              />
            )}
            {tab === "settings" && (
              <SettingsView
                church={currentChurch}
                onUpdate={updateCurrentChurch}
              />
            )}
            {tab === "devotion" && <DevotionView />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- This Sunday view ---------- */
function WeekView({
  data,
  week,
  peopleById,
  songsById,
  onSelectWeek,
  onUpdateWeek,
  onAddWeek,
  onAddToLineup,
  onUpdateLineupItem,
  onRemoveLineupItem,
  onMoveLineupItem,
  goToLibrary,
  goToTeam,
}) {
  const [newDate, setNewDate] = useState(todayISO());
  const [pickSong, setPickSong] = useState("");
  const [openChords, setOpenChords] = useState({});
  const upcoming = [...data.weeks].sort((a, b) => a.date.localeCompare(b.date));
  if (!week) {
    return (
      <div className="wp-empty">
        <div className="wp-empty-mark">✦</div>
        <h2>No Sundays on the books yet</h2>
        <p className="wp-muted">
          Add the next date and you can start assigning people and picking
          songs.
        </p>
        <div className="wp-inline-form">
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="wp-input"
          />
          <button
            className="wp-btn wp-btn-primary"
            onClick={() => onAddWeek(newDate)}
          >
            Add Sunday
          </button>
        </div>
      </div>
    );
  }
  const preachers = data.people.filter((p) => p.roles.includes("preacher"));
  const songLeaders = data.people.filter((p) => p.roles.includes("songleader"));
  const musicians = data.people.filter((p) => p.roles.includes("musician"));
  const availableSongs = data.songs.filter(
    (s) => !week.lineup.some((l) => l.songId === s.id)
  );
  return (
    <div>
      {upcoming.length > 1 && (
        <div className="wp-weekpicker">
          {upcoming.map((w) => (
            <button
              key={w.id}
              className={`wp-weekchip ${w.id === week.id ? "is-active" : ""}`}
              onClick={() => onSelectWeek(w.id)}
            >
              {fmtShort(w.date)}
            </button>
          ))}
        </div>
      )}

      <div className="wp-hero">
        <div className="wp-hero-date">{fmtLong(week.date)}</div>
        <div className="wp-hero-line">
          <div className="wp-hero-stat">
            <span className="wp-hero-label">Preacher</span>
            <select
              className="wp-select wp-hero-select"
              value={week.preacherId || ""}
              onChange={(e) =>
                onUpdateWeek(week.id, { preacherId: e.target.value || null })
              }
            >
              <option value="">— unassigned —</option>
              {preachers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="wp-hero-div" />
          <div className="wp-hero-stat">
            <span className="wp-hero-label">Song Leader</span>
            <select
              className="wp-select wp-hero-select"
              value={week.songLeaderId || ""}
              onChange={(e) =>
                onUpdateWeek(week.id, { songLeaderId: e.target.value || null })
              }
            >
              <option value="">— unassigned —</option>
              {songLeaders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="wp-hero-div" />
          <div className="wp-hero-stat wp-hero-stat-wide">
            <span className="wp-hero-label">Musicians</span>
            {musicians.length === 0 && (
              <span className="wp-muted">
                No musicians on the team yet — add some under Team.
              </span>
            )}
            <div className="wp-musiciangrid">
              {musicians.map((m) => {
                const on = week.musicianIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    className={`wp-muschip ${on ? "is-on" : ""}`}
                    onClick={() =>
                      onUpdateWeek(week.id, {
                        musicianIds: on
                          ? week.musicianIds.filter((id) => id !== m.id)
                          : [...week.musicianIds, m.id],
                      })
                    }
                  >
                    {m.name}
                    {m.instrument ? (
                      <span className="wp-muschip-inst"> · {m.instrument}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <textarea
          className="wp-textarea wp-notes"
          placeholder="Service notes — communion, baptism, guest speaker…"
          value={week.notes}
          onChange={(e) => onUpdateWeek(week.id, { notes: e.target.value })}
        />
      </div>

      <div className="wp-lineup">
        <div className="wp-lineup-head">
          <h2>Song Lineup</h2>
          {data.songs.length === 0 ? (
            <button className="wp-btn wp-btn-ghost" onClick={goToLibrary}>
              Add songs to the library first →
            </button>
          ) : (
            <div className="wp-addsong">
              <select
                className="wp-select"
                value={pickSong}
                onChange={(e) => setPickSong(e.target.value)}
              >
                <option value="">Add a song…</option>
                {availableSongs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                    {s.key ? ` — ${s.key}` : ""}
                  </option>
                ))}
              </select>
              <button
                className="wp-btn wp-btn-primary"
                disabled={!pickSong}
                onClick={() => {
                  onAddToLineup(week.id, pickSong);
                  setPickSong("");
                }}
              >
                Add
              </button>
            </div>
          )}
        </div>

        {week.lineup.length === 0 && (
          <p className="wp-muted wp-lineup-empty">
            No songs picked for this Sunday yet.
          </p>
        )}

        <ol className="wp-songlist">
          {week.lineup.map((item, idx) => {
            const song = songsById[item.songId];
            if (!song) return null;
            const chordsOpen = !!openChords[item.id];
            return (
              <li key={item.id} className="wp-songitem">
                <div className="wp-songitem-row">
                  <span className="wp-songnum">{idx + 1}</span>
                  <div className="wp-songitem-main">
                    <div className="wp-songitem-title">
                      {song.title}
                      {song.key && (
                        <span className="wp-songitem-key">{song.key}</span>
                      )}
                    </div>
                    <input
                      className="wp-input wp-songnote"
                      placeholder="Note — e.g. acoustic version, key change"
                      value={item.notes}
                      onChange={(e) =>
                        onUpdateLineupItem(week.id, item.id, {
                          notes: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="wp-songitem-actions">
                    <button
                      className="wp-iconbtn"
                      title="Move up"
                      disabled={idx === 0}
                      onClick={() => onMoveLineupItem(week.id, idx, -1)}
                    >
                      ↑
                    </button>
                    <button
                      className="wp-iconbtn"
                      title="Move down"
                      disabled={idx === week.lineup.length - 1}
                      onClick={() => onMoveLineupItem(week.id, idx, 1)}
                    >
                      ↓
                    </button>
                    <button
                      className="wp-iconbtn"
                      title="Show chords"
                      onClick={() =>
                        setOpenChords((s) => ({ ...s, [item.id]: !s[item.id] }))
                      }
                    >
                      {chordsOpen ? "♪ hide" : "♪ chords"}
                    </button>
                    <button
                      className="wp-iconbtn wp-iconbtn-remove"
                      title="Remove"
                      onClick={() => onRemoveLineupItem(week.id, item.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {chordsOpen && (
                  <div className="wp-songitem-chords">
                    <ChordChart text={song.chordpro} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/* ---------- Schedule view ---------- */
function ScheduleView({ weeks, peopleById, onAddWeek, onSelect, onDelete }) {
  const [newDate, setNewDate] = useState(todayISO());
  const sorted = [...weeks].sort((a, b) => a.date.localeCompare(b.date));
  const today = todayISO();
  return (
    <div>
      <div className="wp-section-head">
        <h2>Schedule (Unlimited)</h2>
        <div className="wp-addsong">
          <input
            type="date"
            className="wp-input"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
          <button
            className="wp-btn wp-btn-primary"
            onClick={() => onAddWeek(newDate)}
          >
            Add Sunday
          </button>
        </div>
      </div>

      {sorted.length === 0 && (
        <div className="wp-empty">
          <div className="wp-empty-mark">✦</div>
          <h2>Nothing scheduled</h2>
          <p className="wp-muted">Pick a date above to open the calendar.</p>
        </div>
      )}

      <ul className="wp-schedulelist">
        {sorted.map((w) => {
          const preacher = w.preacherId ? peopleById[w.preacherId] : null;
          const songLeader = w.songLeaderId ? peopleById[w.songLeaderId] : null;
          const isPast = w.date < today;
          return (
            <li
              key={w.id}
              className={`wp-schedulerow ${isPast ? "is-past" : ""}`}
            >
              <button
                className="wp-schedulerow-main"
                onClick={() => onSelect(w.id)}
              >
                <div className="wp-schedulerow-date">
                  <div className="wp-schedulerow-day">
                    {new Date(`${w.date}T00:00:00`).getDate()}
                  </div>
                  <div className="wp-schedulerow-mon">
                    {new Date(`${w.date}T00:00:00`).toLocaleDateString(
                      "en-US",
                      { month: "short" }
                    )}
                  </div>
                </div>
                <div className="wp-schedulerow-body">
                  <div className="wp-schedulerow-title">{fmtLong(w.date)}</div>
                  <div className="wp-schedulerow-meta">
                    <span>{preacher ? preacher.name : "No preacher set"}</span>
                    <span className="wp-dot">·</span>
                    <span>
                      {songLeader ? songLeader.name : "No song leader set"}
                    </span>
                    <span className="wp-dot">·</span>
                    <span>
                      {w.lineup.length} song{w.lineup.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </button>
              <button
                className="wp-iconbtn wp-iconbtn-remove"
                onClick={() => onDelete(w.id)}
                title="Delete"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- Team view ---------- */
function TeamView({ people, onAdd, onUpdate, onDelete }) {
  const [name, setName] = useState("");
  const [roles, setRoles] = useState([]);
  const [instrument, setInstrument] = useState("");
  const submit = () => {
    onAdd(name, roles, instrument);
    setName("");
    setRoles([]);
    setInstrument("");
  };
  return (
    <div>
      <div className="wp-section-head">
        <h2>Team</h2>
      </div>

      <div className="wp-card wp-addperson">
        <input
          className="wp-input"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="wp-rolepicker">
          {ROLE_LIST.map((r) => (
            <button
              key={r}
              className={`wp-rolechip ${roles.includes(r) ? "is-on" : ""}`}
              onClick={() =>
                setRoles((cur) =>
                  cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]
                )
              }
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
        {roles.includes("musician") && (
          <input
            className="wp-input"
            placeholder="Instrument (optional)"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
          />
        )}
        <button
          className="wp-btn wp-btn-primary"
          disabled={!name.trim() || roles.length === 0}
          onClick={submit}
        >
          Add to team
        </button>
      </div>

      <ul className="wp-personlist">
        {people.map((p) => (
          <PersonRow
            key={p.id}
            person={p}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </div>
  );
}

function PersonRow({ person, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(person.name);
  const [roles, setRoles] = useState(person.roles);
  const [instrument, setInstrument] = useState(person.instrument || "");
  const save = () => {
    onUpdate(person.id, {
      name: name.trim() || person.name,
      roles,
      instrument,
    });
    setEditing(false);
  };
  if (editing) {
    return (
      <li className="wp-card wp-personrow wp-personrow-editing">
        <input
          className="wp-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="wp-rolepicker">
          {ROLE_LIST.map((r) => (
            <button
              key={r}
              className={`wp-rolechip ${roles.includes(r) ? "is-on" : ""}`}
              onClick={() =>
                setRoles((cur) =>
                  cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]
                )
              }
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
        {roles.includes("musician") && (
          <input
            className="wp-input"
            placeholder="Instrument"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
          />
        )}
        <div className="wp-row-actions">
          <button
            className="wp-btn wp-btn-ghost"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
          <button className="wp-btn wp-btn-primary" onClick={save}>
            Save
          </button>
        </div>
      </li>
    );
  }
  return (
    <li className="wp-card wp-personrow">
      <div className="wp-personrow-info">
        <div className="wp-personrow-name">{person.name}</div>
        <div className="wp-personrow-badges">
          {person.roles.map((r) => (
            <RoleBadge key={r} role={r} />
          ))}
          {person.instrument && (
            <span className="wp-instrument">{person.instrument}</span>
          )}
        </div>
      </div>
      <div className="wp-row-actions">
        <button className="wp-iconbtn" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          className="wp-iconbtn wp-iconbtn-remove"
          onClick={() => onDelete(person.id)}
        >
          ✕
        </button>
      </div>
    </li>
  );
}

/* ---------- Library view ---------- */
function LibraryView({ songs, onAdd, onUpdate, onDelete }) {
  const [title, setTitle] = useState("");
  const [key, setKey] = useState("");
  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState("");
  const submit = () => {
    const id = onAdd(title, key);
    if (id) {
      setTitle("");
      setKey("");
      setOpenId(id);
    }
  };
  const filtered = songs.filter((s) =>
    s.title.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <div>
      <div className="wp-section-head">
        <h2>Chord Library (Unlimited)</h2>
        {songs.length > 0 && (
          <input
            className="wp-input wp-search"
            placeholder="Search songs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
      </div>

      <div className="wp-card wp-addperson">
        <input
          className="wp-input"
          placeholder="Song title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="wp-input"
          placeholder="Key (e.g. G, Capo 2)"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <button
          className="wp-btn wp-btn-primary"
          disabled={!title.trim()}
          onClick={submit}
        >
          Add song
        </button>
      </div>

      {filtered.length === 0 && songs.length > 0 && (
        <p className="wp-muted" style={{ marginTop: "6px" }}>
          No songs match "{query}".
        </p>
      )}

      <ul className="wp-songlibrary">
        {filtered.map((s) => (
          <SongEntry
            key={s.id}
            song={s}
            open={openId === s.id}
            onToggle={() => setOpenId(openId === s.id ? null : s.id)}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </div>
  );
}

function SongEntry({ song, open, onToggle, onUpdate, onDelete }) {
  const [title, setTitle] = useState(song.title);
  const [key, setKey] = useState(song.key);
  const [chordpro, setChordpro] = useState(song.chordpro);
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    setTitle(song.title);
    setKey(song.key);
    setChordpro(song.chordpro);
  }, [song.id]);
  const saveField = (patch) => onUpdate(song.id, patch);
  return (
    <li className="wp-card wp-libraryentry">
      <button className="wp-libraryentry-head" onClick={onToggle}>
        <div>
          <span className="wp-libraryentry-title">{song.title}</span>
          {song.key && <span className="wp-songitem-key">{song.key}</span>}
        </div>
        <span className="wp-caret">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="wp-libraryentry-body">
          <div className="wp-fieldrow">
            <label className="wp-fieldlabel">
              Title
              <input
                className="wp-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => saveField({ title })}
              />
            </label>
            <label className="wp-fieldlabel">
              Key
              <input
                className="wp-input"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onBlur={() => saveField({ key })}
              />
            </label>
          </div>
          <div className="wp-chordeditor-head">
            <label className="wp-fieldlabel wp-fieldlabel-grow">
              Chords & Lyrics
              <span className="wp-fieldhint">
                Wrap chords in brackets right before the syllable — [G]like
                this. Start a line with # for a section label.
              </span>
            </label>
            <button
              className="wp-btn wp-btn-ghost"
              onClick={() => setPreview((p) => !p)}
            >
              {preview ? "Edit" : "Preview"}
            </button>
          </div>
          {preview ? (
            <div className="wp-chordpreviewbox">
              <ChordChart text={chordpro} />
            </div>
          ) : (
            <textarea
              className="wp-textarea wp-chordinput"
              rows={8}
              value={chordpro}
              onChange={(e) => setChordpro(e.target.value)}
              onBlur={() => saveField({ chordpro })}
              placeholder={
                "# Verse 1\nAmazing [G]grace how [C]sweet the [G]sound"
              }
            />
          )}
          <div className="wp-row-actions">
            <button
              className="wp-iconbtn wp-iconbtn-remove"
              onClick={() => onDelete(song.id)}
            >
              Delete song
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/* ---------- Preaching Library view ---------- */
function PreachingLibraryView({ sermons, onAdd, onUpdate, onDelete }) {
  const [title, setTitle] = useState("");
  const [scripture, setScripture] = useState("");
  const [date, setDate] = useState(todayISO());
  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState("");
  const submit = () => {
    const id = onAdd(title, scripture, date);
    if (id) {
      setTitle("");
      setScripture("");
      setDate(todayISO());
      setOpenId(id);
    }
  };
  const filtered = sermons
    .filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div>
      <div className="wp-section-head">
        <h2>Preaching Library (Unlimited)</h2>
        {sermons.length > 0 && (
          <input
            className="wp-input wp-search"
            placeholder="Search sermons…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
      </div>

      <div className="wp-card wp-addperson">
        <input
          className="wp-input"
          placeholder="Sermon title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="wp-input"
          placeholder="Scripture (e.g. John 3:16-21)"
          value={scripture}
          onChange={(e) => setScripture(e.target.value)}
        />
        <input
          type="date"
          className="wp-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ maxWidth: "160px" }}
        />
        <button
          className="wp-btn wp-btn-primary"
          disabled={!title.trim()}
          onClick={submit}
        >
          Add sermon
        </button>
      </div>

      {filtered.length === 0 && sermons.length > 0 && (
        <p className="wp-muted" style={{ marginTop: "6px" }}>
          No sermons match "{query}".
        </p>
      )}
      {sermons.length === 0 && (
        <p className="wp-muted wp-lineup-empty">
          No sermons saved yet. Add the title and scripture above, then open it
          to write out your notes or outline so it's never lost.
        </p>
      )}

      <ul className="wp-songlibrary">
        {filtered.map((s) => (
          <SermonEntry
            key={s.id}
            sermon={s}
            open={openId === s.id}
            onToggle={() => setOpenId(openId === s.id ? null : s.id)}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </div>
  );
}

function SermonEntry({ sermon, open, onToggle, onUpdate, onDelete }) {
  const [title, setTitle] = useState(sermon.title);
  const [scripture, setScripture] = useState(sermon.scripture);
  const [date, setDate] = useState(sermon.date);
  const [notes, setNotes] = useState(sermon.notes);
  useEffect(() => {
    setTitle(sermon.title);
    setScripture(sermon.scripture);
    setDate(sermon.date);
    setNotes(sermon.notes);
  }, [sermon.id]);
  const saveField = (patch) => onUpdate(sermon.id, patch);
  return (
    <li className="wp-card wp-libraryentry">
      <button className="wp-libraryentry-head" onClick={onToggle}>
        <div>
          <span className="wp-libraryentry-title">{sermon.title}</span>
          {sermon.scripture && (
            <span className="wp-songitem-key">{sermon.scripture}</span>
          )}
        </div>
        <span className="wp-caret">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="wp-libraryentry-body">
          <div className="wp-fieldrow">
            <label className="wp-fieldlabel">
              Title
              <input
                className="wp-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => saveField({ title })}
              />
            </label>
            <label className="wp-fieldlabel">
              Scripture
              <input
                className="wp-input"
                value={scripture}
                onChange={(e) => setScripture(e.target.value)}
                onBlur={() => saveField({ scripture })}
              />
            </label>
            <label className="wp-fieldlabel">
              Date
              <input
                type="date"
                className="wp-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onBlur={() => saveField({ date })}
              />
            </label>
          </div>
          <label className="wp-fieldlabel wp-fieldlabel-grow">
            Notes &amp; Outline
            <span className="wp-fieldhint">
              Write out your points, illustrations, or full manuscript — it
              stays saved and synced across every device.
            </span>
          </label>
          <textarea
            className="wp-textarea wp-chordinput"
            rows={10}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => saveField({ notes })}
            placeholder={
              "I. Introduction\n   - hook / context\n\nII. Main Point\n   - scripture\n   - illustration\n\nIII. Application\n\nIV. Closing / altar call"
            }
          />
          <div className="wp-row-actions">
            <button
              className="wp-iconbtn wp-iconbtn-remove"
              onClick={() => onDelete(sermon.id)}
            >
              Delete sermon
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/* ---------- Team Chat View ---------- */
function ChatView({ messages, onSendMessage, currentUserName }) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);
  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText("");
  };
  return (
    <div>
      <div className="wp-section-head">
        <h2>Team Group Chat</h2>
      </div>

      <div className="wp-chatbox">
        {messages.length === 0 && (
          <p className="wp-muted wp-chatbox-empty">
            No messages yet. Start the conversation!
          </p>
        )}
        {messages.map((m) => {
          const isMine =
            currentUserName &&
            m.sender.toUpperCase() === currentUserName.toUpperCase();
          const isSystem = m.sender === "System" || m.sender === "Admin";
          return (
            <div
              key={m.id}
              className={`wp-chatrow ${
                isSystem
                  ? "wp-chatrow-system"
                  : isMine
                  ? "wp-chatrow-mine"
                  : "wp-chatrow-theirs"
              }`}
            >
              <div className="wp-chatmsg">
                <div className="wp-chatmsg-head">
                  <b>{m.sender}</b>
                  <span className="wp-chatmsg-time">{m.time}</span>
                </div>
                <div className="wp-chatmsg-text">{m.text}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="wp-addsong">
        <input
          className="wp-input"
          placeholder="Type your message here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="wp-btn wp-btn-primary"
          type="submit"
          disabled={!text.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}

/* ---------- Settings View ---------- */
function SettingsView({ church, onUpdate }) {
  const [cName, setCName] = useState(church.churchName);
  const [copied, setCopied] = useState(false);
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(church.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      /* clipboard may be unavailable — ignore silently */
    }
  };
  return (
    <div>
      <div className="wp-section-head">
        <h2>Church Settings</h2>
      </div>

      <div
        className="wp-card"
        style={{ display: "flex", flexDirection: "column", gap: "14px" }}
      >
        <label className="wp-fieldlabel">
          Church Name:
          <input
            className="wp-input"
            value={cName}
            onChange={(e) => setCName(e.target.value)}
            onBlur={() => onUpdate({ churchName: cName.trim() || "My Church" })}
          />
        </label>
        <div>
          <span className="wp-fieldlabel">Server Access Code:</span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginTop: "4px",
            }}
          >
            <b
              style={{
                fontSize: "16px",
                color: "var(--brass)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {church.code}
            </b>
            <button
              className="wp-btn wp-btn-ghost"
              onClick={copyCode}
              style={{ fontSize: "11px", padding: "4px 9px" }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="wp-muted" style={{ marginTop: "8px" }}>
            Use this <b>same code</b> on every device — laptop, phone, or PC —
            to open the same church server. Everyone who connects with this code
            and the app open sees the same live schedule, team, and song
            library, and changes made on one device appear on the others within
            a second or two.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Bible & Daily Devotional ---------- */
const DEVOTIONALS = [
  {
    ref: "Psalm 118:24",
    verse:
      "This is the day that the LORD hath made; we will rejoice and be glad in it.",
    title: "A Day Made For You",
    reflection:
      "Before the to-do list and the rehearsal schedule, this day was already shaped by God's hand. Rejoicing isn't something we wait to feel — it's a choice we make first, and the feeling follows.",
    prayer:
      "Lord, thank You for this day. Help me carry gladness into every part of it, even the ordinary parts.",
  },
  {
    ref: "Proverbs 3:5-6",
    verse:
      "Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.",
    title: "Trust Over Understanding",
    reflection:
      "Planning a service, a schedule, a season — it's tempting to lean only on our own reasoning. This verse asks for something harder and better: full trust, in every decision.",
    prayer:
      "Father, where I'm tempted to rely only on my own plans, remind me to acknowledge You first.",
  },
  {
    ref: "Philippians 4:6-7",
    verse:
      "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.",
    title: "Peace That Guards",
    reflection:
      "Anxiety often shows up disguised as responsibility. Paul's answer isn't to stop caring — it's to bring every care to God, wrapped in thanksgiving.",
    prayer:
      "Lord, take what's weighing on me right now and exchange it for Your peace.",
  },
  {
    ref: "Joshua 1:9",
    verse:
      "Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.",
    title: "Courage With Company",
    reflection:
      "Courage in Scripture is rarely the absence of fear — it's moving forward because God is present, not because the way ahead looks easy.",
    prayer:
      "God, give me courage today, not because the road is clear, but because You are near.",
  },
  {
    ref: "Psalm 23:1-3",
    verse:
      "The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters. He restoreth my soul.",
    title: "A Shepherd Who Restores",
    reflection:
      "Rest isn't a reward for finishing everything — it's something the Shepherd leads us into on purpose, even in the middle of a busy season.",
    prayer:
      "Restore my soul today, Lord. Lead me to the rest I keep putting off.",
  },
  {
    ref: "Romans 8:28",
    verse:
      "And we know that all things work together for good to them that love God, to them that are the called according to his purpose.",
    title: "Working Together For Good",
    reflection:
      "This promise doesn't say every individual thing is good — it says God is weaving all of it, the wins and the setbacks, toward something good for those who love Him.",
    prayer:
      "Lord, help me trust Your weaving even when I can't see the whole pattern yet.",
  },
  {
    ref: "1 Corinthians 13:4-7",
    verse:
      "Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up... beareth all things, believeth all things, hopeth all things, endureth all things.",
    title: "Love In The Small Moments",
    reflection:
      "Love shows up less in grand gestures and more in patience during a long rehearsal, kindness in a hard conversation, and choosing not to keep score.",
    prayer:
      "Teach me to love the people around me today the way this passage describes.",
  },
  {
    ref: "Isaiah 40:31",
    verse:
      "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.",
    title: "Renewed Strength",
    reflection:
      "Waiting isn't wasted time in God's economy — it's where strength gets renewed for whatever is coming next, whether that's a sprint or a long walk.",
    prayer:
      "Father, teach me to wait on You instead of running only on my own strength.",
  },
  {
    ref: "Matthew 6:33-34",
    verse:
      "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you. Take therefore no thought for the morrow.",
    title: "First Things First",
    reflection:
      "Tomorrow's worries have a way of crowding out today's obedience. Jesus points us back to what to seek first, and trusts God with the rest.",
    prayer:
      "Lord, help me seek You first today and leave tomorrow's worries with You.",
  },
  {
    ref: "Psalm 46:10",
    verse:
      "Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth.",
    title: "Be Still",
    reflection:
      "Stillness is countercultural in a season full of notifications and deadlines, but it's where we remember, again, who God actually is.",
    prayer:
      "God, quiet my heart for a moment. Help me know You are God, and I am not.",
  },
  {
    ref: "Galatians 6:9",
    verse:
      "And let us not be weary in well doing: for in due season we shall reap, if we faint not.",
    title: "Don't Grow Weary",
    reflection:
      "Serving faithfully week after week can feel invisible. This verse promises a harvest is coming, even when today feels like just another ordinary effort.",
    prayer:
      "Lord, renew my energy for the good work You've placed in front of me.",
  },
  {
    ref: "James 1:5",
    verse:
      "If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.",
    title: "Wisdom For The Asking",
    reflection:
      "God doesn't ration wisdom or make us prove we deserve it first. He gives generously to anyone who simply asks.",
    prayer:
      "Father, I need wisdom today. Thank You for giving it freely when I ask.",
  },
  {
    ref: "Psalm 27:1",
    verse:
      "The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?",
    title: "No Room For Fear",
    reflection:
      "When God is described as both light and strength, fear starts to lose its footing — not because circumstances changed, but because we remember who's holding them.",
    prayer:
      "Lord, be my light in what feels uncertain today, and my strength where I feel weak.",
  },
  {
    ref: "Colossians 3:23",
    verse:
      "And whatsoever ye do, do it heartily, as to the Lord, and not unto men.",
    title: "Working As Unto The Lord",
    reflection:
      "Whether it's leading a team, learning a new song, or handling a small administrative task, the audience that matters most is God, not the applause of people.",
    prayer: "Lord, let my work today — however small — be an offering to You.",
  },
  {
    ref: "Psalm 34:18",
    verse:
      "The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit.",
    title: "Near To The Brokenhearted",
    reflection:
      "God doesn't stay distant when we're hurting — Scripture says the opposite: He draws close precisely when a heart is broken.",
    prayer:
      "Father, thank You for being near, especially on the days that feel heavy.",
  },
  {
    ref: "Nehemiah 8:10",
    verse: "...for the joy of the LORD is your strength.",
    title: "Joy As Strength",
    reflection:
      "Joy isn't a soft, optional feeling here — it's described as strength itself, fuel for whatever the day requires.",
    prayer: "Lord, let Your joy be my strength today, not my circumstances.",
  },
  {
    ref: "Psalm 139:14",
    verse:
      "I will praise thee; for I am fearfully and wonderfully made: marvellous are thy works; and that my soul knoweth right well.",
    title: "Fearfully And Wonderfully Made",
    reflection:
      "Comparison and self-criticism have a way of creeping in. This verse is a reset — you were made with intention, not by accident.",
    prayer:
      "Thank You, God, for making me the way You did. Help me see myself the way You do.",
  },
  {
    ref: "2 Corinthians 5:17",
    verse:
      "Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new.",
    title: "Made New",
    reflection:
      "Whatever yesterday looked like — a mistake, a hard conversation, a bad habit — today gets to start from a genuinely new place in Christ.",
    prayer:
      "Lord, thank You for newness. Help me walk in it today instead of my old patterns.",
  },
  {
    ref: "Micah 6:8",
    verse:
      "...what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?",
    title: "What Is Required",
    reflection:
      "It's a short list, but not an easy one: justice, mercy, and humility — three things that shape how we treat everyone we meet today.",
    prayer:
      "God, help me act justly, love mercy, and walk humbly today, in ways big and small.",
  },
  {
    ref: "Psalm 143:8",
    verse:
      "Cause me to hear thy lovingkindness in the morning; for in thee do I trust: cause me to know the way wherein I should walk...",
    title: "A Morning Prayer",
    reflection:
      "Starting the day by asking to hear God's kindness — before the demands pile on — sets a very different tone than starting with the to-do list.",
    prayer:
      "Lord, let me hear Your lovingkindness this morning, and show me the way to walk today.",
  },
  {
    ref: "Hebrews 12:1-2",
    verse:
      "...let us lay aside every weight, and the sin which doth so easily beset us, and let us run with patience the race that is set before us, Looking unto Jesus...",
    title: "Running With Patience",
    reflection:
      "The Christian life is described as a race, but one run with patience, not panic — and always with eyes fixed on Jesus, not the pace of others.",
    prayer:
      "Jesus, help me lay aside what's weighing me down and keep my eyes on You today.",
  },
  {
    ref: "Deuteronomy 31:6",
    verse:
      "Be strong and of a good courage, fear not, nor be afraid of them: for the LORD thy God, he it is that doth go with thee; he will not fail thee, nor forsake thee.",
    title: "He Will Not Forsake You",
    reflection:
      "Whatever today holds that feels intimidating, this promise doesn't change: God goes with you, and He doesn't leave partway through.",
    prayer:
      "Father, thank You for going ahead of me and staying with me. Help me walk in that courage.",
  },
  {
    ref: "Psalm 90:12",
    verse:
      "So teach us to number our days, that we may apply our hearts unto wisdom.",
    title: "Numbering Our Days",
    reflection:
      "Time feels endless until it isn't. Praying to number our days is really a prayer for perspective — to spend today wisely instead of carelessly.",
    prayer:
      "Lord, teach me to value today. Help me not waste what You've given me.",
  },
  {
    ref: "1 Peter 5:7",
    verse: "Casting all your care upon him; for he careth for you.",
    title: "He Cares For You",
    reflection:
      "The invitation isn't to manage anxiety better on our own — it's to hand it off entirely, because God genuinely cares about the details.",
    prayer:
      "Lord, I'm casting today's cares on You. Thank You for caring about what concerns me.",
  },
  {
    ref: "Psalm 121:1-2",
    verse:
      "I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the LORD, which made heaven and earth.",
    title: "Where Help Comes From",
    reflection:
      "It's easy to look sideways for help — at our own resources, other people, or just hustle. This Psalm points our eyes up instead.",
    prayer:
      "Lord, today I'm looking to You for help, not just my own strength.",
  },
  {
    ref: "John 14:27",
    verse:
      "Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.",
    title: "A Different Kind Of Peace",
    reflection:
      "The peace Jesus offers doesn't depend on circumstances lining up — it's a gift that can stay steady even when the day doesn't go as planned.",
    prayer:
      "Jesus, give me Your peace today, the kind that doesn't depend on everything going right.",
  },
  {
    ref: "Psalm 37:4",
    verse:
      "Delight thyself also in the LORD: and he shall give thee the desires of thine heart.",
    title: "Delight First",
    reflection:
      "This isn't a formula for getting what we want — it's a promise that as we delight in God, our desires themselves start to be shaped by Him.",
    prayer: "Lord, help my delight in You reshape what I want today.",
  },
  {
    ref: "Ephesians 2:10",
    verse:
      "For we are his workmanship, created in Christ Jesus unto good works, which God hath before ordained that we should walk in.",
    title: "Made For Good Work",
    reflection:
      "Whatever today's tasks are — leading, serving, teaching, showing up quietly — they were prepared in advance as part of a bigger purpose.",
    prayer:
      "Father, thank You for the good work You've prepared for me. Help me walk it out today.",
  },
  {
    ref: "Lamentations 3:22-23",
    verse:
      "It is of the LORD's mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.",
    title: "New Every Morning",
    reflection:
      "No matter how yesterday ended, God's mercy doesn't run out overnight — it's freshly available again this morning.",
    prayer:
      "Thank You, Lord, for mercies that are new today. I receive them, and I want to reflect them.",
  },
  {
    ref: "Proverbs 16:3",
    verse:
      "Commit thy works unto the LORD, and thy thoughts shall be established.",
    title: "Commit Your Work",
    reflection:
      "Before the meetings, the rehearsals, the planning — committing the day's work to God first tends to settle a mind that's scattered.",
    prayer:
      "Lord, I commit today's work to You. Establish my thoughts and steady my plans.",
  },
  {
    ref: "Psalm 16:11",
    verse:
      "Thou wilt shew me the path of life: in thy presence is fulness of joy; at thy right hand there are pleasures for evermore.",
    title: "Fulness Of Joy",
    reflection:
      "Joy in Scripture is consistently tied to nearness to God, not to circumstances working out. Presence, not perfection, is where fulness is found.",
    prayer:
      "Lord, draw me into Your presence today — that's where I want to find my joy.",
  },
];

function getDayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff =
    d - start + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60 * 1000;
  return Math.floor(diff / 86400000);
}

const BIBLE_BOOKS = [
  ["Genesis", 50],
  ["Exodus", 40],
  ["Leviticus", 27],
  ["Numbers", 36],
  ["Deuteronomy", 34],
  ["Joshua", 24],
  ["Judges", 21],
  ["Ruth", 4],
  ["1 Samuel", 31],
  ["2 Samuel", 24],
  ["1 Kings", 22],
  ["2 Kings", 25],
  ["1 Chronicles", 29],
  ["2 Chronicles", 36],
  ["Ezra", 10],
  ["Nehemiah", 13],
  ["Esther", 10],
  ["Job", 42],
  ["Psalms", 150],
  ["Proverbs", 31],
  ["Ecclesiastes", 12],
  ["Song of Solomon", 8],
  ["Isaiah", 66],
  ["Jeremiah", 52],
  ["Lamentations", 5],
  ["Ezekiel", 48],
  ["Daniel", 12],
  ["Hosea", 14],
  ["Joel", 3],
  ["Amos", 9],
  ["Obadiah", 1],
  ["Jonah", 4],
  ["Micah", 7],
  ["Nahum", 3],
  ["Habakkuk", 3],
  ["Zephaniah", 3],
  ["Haggai", 2],
  ["Zechariah", 14],
  ["Malachi", 4],
  ["Matthew", 28],
  ["Mark", 16],
  ["Luke", 24],
  ["John", 21],
  ["Acts", 28],
  ["Romans", 16],
  ["1 Corinthians", 16],
  ["2 Corinthians", 13],
  ["Galatians", 6],
  ["Ephesians", 6],
  ["Philippians", 4],
  ["Colossians", 4],
  ["1 Thessalonians", 5],
  ["2 Thessalonians", 3],
  ["1 Timothy", 6],
  ["2 Timothy", 4],
  ["Titus", 3],
  ["Philemon", 1],
  ["Hebrews", 13],
  ["James", 5],
  ["1 Peter", 5],
  ["2 Peter", 3],
  ["1 John", 5],
  ["2 John", 1],
  ["3 John", 1],
  ["Jude", 1],
  ["Revelation", 22],
];

const OLD_TESTAMENT_BOOKS = BIBLE_BOOKS.slice(0, 39); // Genesis .. Malachi
const NEW_TESTAMENT_BOOKS = BIBLE_BOOKS.slice(39); // Matthew .. Revelation

function DevotionView() {
  const [section, setSection] = useState("today");
  const [selectedBook, setSelectedBook] = useState("Genesis");
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [verses, setVerses] = useState([]);
  const [reference, setReference] = useState("");
  const [bibleLoading, setBibleLoading] = useState(false);
  const [bibleError, setBibleError] = useState("");

  const today = new Date();
  const dayIndex = getDayOfYear(today) % DEVOTIONALS.length;
  const devotion = DEVOTIONALS[dayIndex];
  const dateLabel = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const chapterCount =
    BIBLE_BOOKS.find(([name]) => name === selectedBook)?.[1] || 1;

  const fetchChapter = useCallback(async (book, chapter) => {
    setBibleLoading(true);
    setBibleError("");
    try {
      const query = encodeURIComponent(book.replace(/ /g, "+")) + "+" + chapter;
      const res = await fetch(`https://bible-api.com/${query}`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (!data.verses || !data.verses.length) {
        throw new Error("Walang verses na natagpuan.");
      }
      setVerses(data.verses);
      setReference(data.reference || `${book} ${chapter}`);
    } catch (err) {
      setBibleError(
        "Hindi makuha ang chapter ngayon. Suriin ang koneksyon at subukan ulit."
      );
      setVerses([]);
    } finally {
      setBibleLoading(false);
    }
  }, []);

  useEffect(() => {
    if (
      section === "bible" &&
      verses.length === 0 &&
      !bibleLoading &&
      !bibleError
    ) {
      fetchChapter(selectedBook, selectedChapter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const goToChapter = (book, chapter) => {
    setSelectedBook(book);
    setSelectedChapter(chapter);
    fetchChapter(book, chapter);
  };

  const handlePrev = () => {
    const bIdx = BIBLE_BOOKS.findIndex(([name]) => name === selectedBook);
    if (selectedChapter > 1) {
      goToChapter(selectedBook, selectedChapter - 1);
    } else if (bIdx > 0) {
      const prevBook = BIBLE_BOOKS[bIdx - 1];
      goToChapter(prevBook[0], prevBook[1]);
    }
  };

  const handleNext = () => {
    const bIdx = BIBLE_BOOKS.findIndex(([name]) => name === selectedBook);
    if (selectedChapter < chapterCount) {
      goToChapter(selectedBook, selectedChapter + 1);
    } else if (bIdx < BIBLE_BOOKS.length - 1) {
      goToChapter(BIBLE_BOOKS[bIdx + 1][0], 1);
    }
  };

  return (
    <div className="wp-devotion">
      <div className="wp-devotion-tabs">
        <button
          className={`wp-devotion-tab ${
            section === "today" ? "is-active" : ""
          }`}
          onClick={() => setSection("today")}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
        >
          <HandHelping size={30} /> Today's Devotion
        </button>
        <button
          className={`wp-devotion-tab ${
            section === "bible" ? "is-active" : ""
          }`}
          onClick={() => setSection("bible")}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
        >
          <Book size={30} /> Read Bible
        </button>
      </div>

      {section === "today" && (
        <div className="wp-devotion-card">
          <div className="wp-devotion-date">{dateLabel}</div>
          <h2 className="wp-devotion-title">{devotion.title}</h2>
          <blockquote className="wp-devotion-verse">
            "{devotion.verse}"<cite>— {devotion.ref}</cite>
          </blockquote>
          <p className="wp-devotion-reflection">{devotion.reflection}</p>
          <div className="wp-devotion-prayer">
            <span className="wp-devotion-prayer-label">Prayer</span>
            <p>{devotion.prayer}</p>
          </div>
        </div>
      )}

      {section === "bible" && (
        <div className="wp-bible">
          <div className="wp-bible-sidebar">
            <select
              className="wp-select"
              value={selectedBook}
              onChange={(e) => goToChapter(e.target.value, 1)}
            >
              <optgroup label="Old Testament">
                {OLD_TESTAMENT_BOOKS.map(([name]) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="New Testament">
                {NEW_TESTAMENT_BOOKS.map(([name]) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            </select>
            <select
              className="wp-select"
              value={selectedChapter}
              onChange={(e) =>
                goToChapter(selectedBook, parseInt(e.target.value, 10))
              }
            >
              {Array.from({ length: chapterCount }, (_, i) => i + 1).map(
                (n) => (
                  <option key={n} value={n}>
                    Chapter {n}
                  </option>
                )
              )}
            </select>
            <div
              className="wp-row-actions"
              style={{ justifyContent: "space-between" }}
            >
              <button className="wp-btn wp-btn-ghost" onClick={handlePrev}>
                ← Prev
              </button>
              <button className="wp-btn wp-btn-ghost" onClick={handleNext}>
                Next →
              </button>
            </div>
          </div>

          <div className="wp-bible-reader">
            {bibleLoading && (
              <p className="wp-muted">
                Kinukuha ang {selectedBook} {selectedChapter}...
              </p>
            )}
            {!bibleLoading && bibleError && (
              <p className="wp-muted" style={{ color: "var(--remove)" }}>
                {bibleError}
              </p>
            )}
            {!bibleLoading && !bibleError && verses.length > 0 && (
              <>
                <h2 className="wp-bible-reader-title">{reference}</h2>
                <div className="wp-bible-reader-body">
                  {verses.map((v) => (
                    <p key={v.verse} className="wp-bible-verseline">
                      <b style={{ color: "var(--brass)", marginRight: "6px" }}>
                        {v.verse}
                      </b>
                      {v.text.trim()}
                    </p>
                  ))}
                </div>
                <p className="wp-muted wp-bible-note">
                  King James Version — live mula sa bible-api.com.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- styles ---------- */
function Style() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

      html, body, #root {
        margin: 0;
        padding: 0;
        min-height: 100%;
        background: #0F0F10;
      }

      body {
        min-height: 100vh;
      }

      .wp-app {
        --paper: #121212;
        --card: #1E1E1E;
        --ink: #FFFFFF;
        --ink-soft: #A0A0A0;
        --brass: #D4A359;
        --brass-soft: #382A18;
        --teal: #5B9CB6;
        --teal-soft: #1C333D;
        --rule: #2C2C2C;
        --remove: #E57373;
        --font-display: 'Fraunces', Georgia, serif;
        --font-body: 'Inter', -apple-system, sans-serif;
        --font-mono: 'IBM Plex Mono', 'Courier New', monospace;

        background: var(--paper);
        color: var(--ink);
        font-family: var(--font-body);
        max-width: 780px;
        margin: 0 auto;
        padding: 24px 20px 60px;
        min-height: 100vh;
        box-sizing: border-box;
      }
      .wp-app *, .wp-app *::before, .wp-app *::after { box-sizing: border-box; }

      /* Home Base + Server Portal now share the SAME masthead + panel
         chrome as the Dashboard, instead of a separate centered card. */
      .wp-portalscreen { display: flex; flex-direction: column; min-height: 60vh; }
      .wp-portalpanel { max-width: 460px; margin: 0 auto; width: 100%; }

      .wp-loginscreen { display: flex; align-items: center; justify-content: center; min-height: 80vh; }
      .wp-loginbox { background: var(--card); border: 1px solid var(--rule); border-radius: 12px; padding: 30px; width: 100%; max-width: 400px; text-align: center; }

      .wp-loading { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
      .wp-loading-text { font-family: var(--font-display); font-style: italic; color: var(--ink-soft); font-size: 18px; }

      .wp-masthead { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 3px double var(--rule); padding-bottom: 10px; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; }
      .wp-masthead-right { display: flex; gap: 12px; align-items: flex-end; }
      .wp-kicker { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--brass); position: absolute; }
      .wp-title { font-family: var(--font-display); font-weight: 600; font-size: 40px; letter-spacing: -0.01em; margin: 14px 0 0; color: var(--ink); }
      .wp-savepill { font-family: var(--font-mono); font-size: 11px; color: var(--ink-soft); letter-spacing: 0.04em; align-self: flex-end; margin-bottom: 4px; }
      .wp-savepill[data-state="error"] { color: var(--remove); }

      .wp-error-text { color: var(--remove); font-size: 13px; text-align: left; margin: 0; line-height: 1.4; }

      .wp-tabs { display: flex; gap: 4px; margin: 18px 0 0; overflow-x: auto; }
      .wp-tab {
        font-family: var(--font-body); font-weight: 600; font-size: 13px; letter-spacing: 0.02em;
        background: #2D2D2D; color: var(--ink-soft); border: 1px solid var(--rule); border-bottom: none;
        border-radius: 8px 8px 0 0; padding: 9px 16px; cursor: pointer; position: relative; top: 1px; white-space: nowrap;
      }
      .wp-tab.is-active { background: var(--card); color: var(--ink); border-color: var(--rule); }
      .wp-tab:hover:not(.is-active) { background: #383838; }

      .wp-panel { background: var(--card); border: 1px solid var(--rule); border-radius: 10px; padding: 26px 24px; }
      .wp-app > .wp-tabs + .wp-panel { border-radius: 0 10px 10px 10px; }

      .wp-muted { color: var(--ink-soft); font-size: 14px; line-height: 1.5; }
      .wp-dot { margin: 0 6px; color: var(--rule); }

      .wp-btn { font-family: var(--font-body); font-weight: 600; font-size: 13.5px; padding: 9px 16px; border-radius: 6px; border: 1px solid transparent; cursor: pointer; white-space: nowrap; }
      .wp-btn-primary { background: var(--brass); color: #121212; }
      .wp-btn-primary:hover { background: #E5B46A; }
      .wp-btn-primary:disabled { background: #333333; color: #777777; cursor: not-allowed; }
      .wp-btn-ghost { background: transparent; color: var(--teal); border-color: var(--teal-soft); }
      .wp-btn-ghost:hover { background: var(--teal-soft); }

      .wp-input, .wp-select, .wp-textarea {
        font-family: var(--font-body); font-size: 14px; color: var(--ink);
        background: #2A2A2A; border: 1px solid var(--rule); border-radius: 6px; padding: 9px 11px; width: 100%;
      }
      .wp-select option { background: #1E1E1E; color: var(--ink); padding: 8px; }
      .wp-select optgroup {
        font-family: var(--font-mono);
        font-weight: 700;
        font-style: normal;
        color: var(--brass);
        background: #1E1E1E;
      }
      .wp-input:focus, .wp-select:focus, .wp-textarea:focus { outline: 2px solid var(--brass); outline-offset: 1px; }
      .wp-textarea { resize: vertical; font-family: var(--font-body); }
      .wp-notes { min-height: 44px; margin-top: 16px; background: #1A1A1A; }

      .wp-inline-form { display: flex; gap: 10px; justify-content: center; margin-top: 14px; }
      .wp-addsong { display: flex; gap: 8px; }
      .wp-addsong .wp-select { min-width: 200px; }

      .wp-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
      .wp-section-head h2 { font-family: var(--font-display); font-size: 22px; margin: 0; color: var(--ink); }
      .wp-search { max-width: 220px; }

      .wp-empty { text-align: center; padding: 40px 20px; }
      .wp-empty-mark { color: var(--brass); font-size: 20px; margin-bottom: 6px; }
      .wp-empty h2 { font-family: var(--font-display); font-size: 22px; margin: 0 0 6px; color: var(--ink); }
      .wp-empty p { max-width: 380px; margin: 0 auto; }

      .wp-badge { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.05em; text-transform: uppercase; padding: 3px 8px; border-radius: 20px; }
      .wp-badge-preacher { background: #382A18; color: var(--brass); }
      .wp-badge-songleader { background: #1C333D; color: var(--teal); }
      .wp-badge-musician { background: #333333; color: #CCCCCC; }
      .wp-instrument { font-size: 12px; color: var(--ink-soft); font-style: italic; }

      .wp-weekpicker { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 18px; padding-bottom: 4px; }
      .wp-weekchip { font-family: var(--font-mono); font-size: 12px; background: #2A2A2A; border: 1px solid var(--rule); border-radius: 20px; padding: 6px 13px; cursor: pointer; color: var(--ink-soft); white-space: nowrap; }
      .wp-weekchip.is-active { background: var(--brass); color: #121212; border-color: var(--brass); font-weight: 600; }

      .wp-hero { border: 1px solid var(--rule); border-radius: 8px; padding: 22px 24px; background: linear-gradient(180deg, #242424, #1A1A1A); }
      .wp-hero-date { font-family: var(--font-display); font-size: 28px; font-weight: 600; margin-bottom: 16px; color: var(--ink); }
      .wp-hero-line { display: flex; gap: 22px; flex-wrap: wrap; }
      .wp-hero-stat { display: flex; flex-direction: column; gap: 6px; min-width: 150px; }
      .wp-hero-stat-wide { flex: 1; min-width: 220px; }
      .wp-hero-label { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-soft); }
      .wp-hero-select { border: none; border-bottom: 1px solid var(--rule); border-radius: 0; padding: 4px 2px; background: transparent; font-weight: 600; color: var(--ink); }
      .wp-hero-div { width: 1px; background: var(--rule); align-self: stretch; }
      .wp-musiciangrid { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
      .wp-muschip { font-size: 12.5px; background: #2A2A2A; border: 1px solid var(--rule); border-radius: 20px; padding: 5px 11px; cursor: pointer; color: var(--ink-soft); }
      .wp-muschip.is-on { background: var(--teal); border-color: var(--teal); color: #fff; }
      .wp-muschip-inst { opacity: 0.75; }

      .wp-lineup { margin-top: 28px; }
      .wp-lineup-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; border-top: 1px solid var(--rule); padding-top: 20px; }
      .wp-lineup-head h2 { font-family: var(--font-display); font-size: 20px; margin: 0; color: var(--ink); }
      .wp-lineup-empty { margin-top: 14px; }

      .wp-songlist { list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
      .wp-songitem { border: 1px solid var(--rule); border-radius: 7px; background: #242424; }
      .wp-songitem-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; }
      .wp-songnum { font-family: var(--font-mono); color: var(--brass); font-weight: 600; font-size: 13px; padding-top: 3px; width: 16px; }
      .wp-songitem-main { flex: 1; min-width: 0; }
      .wp-songitem-title { font-weight: 600; font-size: 15px; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; color: var(--ink); }
      .wp-songitem-key { font-family: var(--font-mono); font-size: 11px; background: var(--brass-soft); color: var(--brass); padding: 2px 7px; border-radius: 4px; }
      .wp-songnote { font-size: 13px; padding: 6px 9px; }
      .wp-songitem-actions { display: flex; gap: 4px; flex-shrink: 0; }
      .wp-iconbtn { font-family: var(--font-body); font-size: 12px; background: transparent; border: 1px solid var(--rule); border-radius: 5px; padding: 6px 9px; cursor: pointer; color: var(--ink-soft); }
      .wp-iconbtn:hover:not(:disabled) { background: var(--teal-soft); color: var(--teal); }
      .wp-iconbtn:disabled { opacity: 0.35; cursor: not-allowed; }
      .wp-iconbtn-remove:hover { background: #3E1E1E; color: var(--remove); }
      .wp-songitem-chords { border-top: 1px dashed var(--rule); padding: 14px; background: #1A1A1A; }

      .wp-chartblock { font-family: var(--font-mono); font-size: 13.5px; line-height: 1.3; overflow-x: auto; }
      .wp-chart-line { white-space: pre; margin-bottom: 6px; }
      .wp-chart-chords { color: var(--teal); font-weight: 600; }
      .wp-chart-lyric { color: var(--ink); }
      .wp-chart-gap { height: 8px; }
      .wp-chart-section { font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; color: var(--brass); margin: 10px 0 4px; }
      .wp-mono-empty { font-family: var(--font-mono); }

      .wp-schedulelist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
      .wp-schedulerow { display: flex; align-items: stretch; border: 1px solid var(--rule); border-radius: 7px; background: #242424; overflow: hidden; }
      .wp-schedulerow.is-past { opacity: 0.55; }
      .wp-schedulerow-main { flex: 1; display: flex; align-items: center; gap: 14px; padding: 12px 14px; background: none; border: none; text-align: left; cursor: pointer; min-width: 0; }
      .wp-schedulerow-main:hover { background: #2D2D2D; }
      .wp-schedulerow-date { font-family: var(--font-mono); text-align: center; width: 44px; flex-shrink: 0; border-right: 1px solid var(--rule); padding-right: 12px; }
      .wp-schedulerow-day { font-size: 19px; font-weight: 700; color: var(--ink); }
      .wp-schedulerow-mon { font-size: 10px; text-transform: uppercase; color: var(--ink-soft); }
      .wp-schedulerow-body { min-width: 0; }
      .wp-schedulerow-title { font-weight: 600; font-size: 14.5px; color: var(--ink); }
      .wp-schedulerow-meta { font-size: 12.5px; color: var(--ink-soft); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .wp-schedulerow .wp-iconbtn-remove { margin: 12px 12px 12px 0; align-self: center; }

      .wp-card { border: 1px solid var(--rule); border-radius: 8px; background: var(--card); padding: 16px; margin-bottom: 10px; }
      .wp-addperson { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 18px; }
      .wp-addperson .wp-input { flex: 1; min-width: 140px; }
      .wp-rolepicker { display: flex; gap: 6px; flex-wrap: wrap; }
      .wp-rolechip { font-size: 12.5px; background: #2A2A2A; border: 1px solid var(--rule); border-radius: 20px; padding: 6px 12px; cursor: pointer; color: var(--ink-soft); }
      .wp-rolechip.is-on { background: var(--brass); border-color: var(--brass); color: #121212; font-weight: 600; }

      .wp-personlist, .wp-songlibrary { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
      .wp-personrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .wp-personrow-editing { flex-direction: column; align-items: stretch; gap: 10px; }
      .wp-personrow-info { display: flex; flex-direction: column; gap: 5px; }
      .wp-personrow-name { font-weight: 600; font-size: 15px; color: var(--ink); }
      .wp-personrow-badges { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
      .wp-row-actions { display: flex; gap: 6px; justify-content: flex-end; }

      .wp-libraryentry { padding: 0; overflow: hidden; }
      .wp-libraryentry-head { width: 100%; display: flex; align-items: center; justify-content: space-between; background: none; border: none; padding: 14px 16px; cursor: pointer; font-family: var(--font-body); text-align: left; }
      .wp-libraryentry-title { font-weight: 600; font-size: 15px; margin-right: 10px; color: var(--ink); }
      .wp-caret { color: var(--ink-soft); }
      .wp-libraryentry-body { padding: 0 16px 16px; border-top: 1px solid var(--rule); padding-top: 14px; display: flex; flex-direction: column; gap: 12px; }
      .wp-fieldrow { display: flex; gap: 12px; flex-wrap: wrap; }
      .wp-fieldlabel { display: flex; flex-direction: column; gap: 5px; font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft); flex: 1; min-width: 130px; }
      .wp-fieldlabel-grow { flex: 1; }
      .wp-fieldhint { font-family: var(--font-body); text-transform: none; letter-spacing: normal; font-size: 12px; color: var(--ink-soft); font-weight: 400; }
      .wp-chordeditor-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; }
      .wp-chordinput { font-family: var(--font-mono); font-size: 13.5px; background: #1A1A1A; }
      .wp-chordpreviewbox { background: #1A1A1A; border: 1px solid var(--rule); border-radius: 6px; padding: 12px 14px; }

      .wp-chatbox { display: flex; flex-direction: column; height: 350px; overflow-y: auto; margin-bottom: 12px; background: #1A1A1A; border: 1px solid var(--rule); border-radius: 8px; padding: 16px; }
      .wp-chatbox-empty { text-align: center; margin: auto; }
      .wp-chatrow { display: flex; margin-bottom: 10px; }
      .wp-chatrow-theirs { justify-content: flex-start; }
      .wp-chatrow-mine { justify-content: flex-end; }
      .wp-chatrow-system { justify-content: center; }
      .wp-chatrow .wp-chatmsg { max-width: 78%; margin-bottom: 0; }
      .wp-chatrow-system .wp-chatmsg { max-width: 90%; }
      .wp-chatmsg { padding: 10px 14px; background: #242424; border-radius: 6px; border: 1px solid var(--rule); }
      .wp-chatrow-mine .wp-chatmsg { background: var(--brass-soft); border-color: var(--brass); }
      .wp-chatrow-mine .wp-chatmsg-head { flex-direction: row-reverse; }
      .wp-chatrow-mine .wp-chatmsg-head b { color: var(--brass); }
      .wp-chatrow-system .wp-chatmsg { background: transparent; border-style: dashed; }
      .wp-chatmsg-head { display: flex; justify-content: space-between; gap: 10px; font-size: 11px; color: var(--brass); margin-bottom: 4px; }
      .wp-chatmsg-time { color: var(--ink-soft); }
      .wp-chatmsg-text { font-size: 14px; color: var(--ink); word-break: break-word; }

      /* ---------- Bible & Daily Devotional ---------- */
      .wp-devotion-tabs { display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap; }
      .wp-devotion-tab { font-family: var(--font-body); font-weight: 600; font-size: 13px; background: #2A2A2A; color: var(--ink-soft); border: 1px solid var(--rule); border-radius: 20px; padding: 8px 15px; cursor: pointer; }
      .wp-devotion-tab.is-active { background: var(--brass); border-color: var(--brass); color: #121212; }

      .wp-devotion-card { border: 1px solid var(--rule); border-radius: 10px; padding: 24px; background: linear-gradient(180deg, #242424, #1A1A1A); }
      .wp-devotion-date { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--brass); margin-bottom: 8px; }
      .wp-devotion-title { font-family: var(--font-display); font-size: 24px; margin: 0 0 16px; color: var(--ink); }
      .wp-devotion-verse { margin: 0 0 16px; padding: 14px 18px; border-left: 3px solid var(--brass); background: #1A1A1A; font-family: var(--font-display); font-style: italic; font-size: 16px; line-height: 1.55; color: var(--ink); }
      .wp-devotion-verse cite { display: block; margin-top: 8px; font-family: var(--font-mono); font-style: normal; font-size: 11.5px; color: var(--ink-soft); }
      .wp-devotion-reflection { font-size: 14.5px; line-height: 1.65; color: var(--ink); margin: 0 0 18px; }
      .wp-devotion-prayer { border-top: 1px dashed var(--rule); padding-top: 14px; }
      .wp-devotion-prayer-label { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--teal); }
      .wp-devotion-prayer p { margin: 6px 0 0; font-size: 14px; font-style: italic; color: var(--ink-soft); line-height: 1.55; }

      .wp-bible { display: grid; grid-template-columns: 220px 1fr; gap: 20px; align-items: start; }
      .wp-bible-sidebar { display: flex; flex-direction: column; gap: 10px; }
      .wp-bible-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; max-height: 420px; overflow-y: auto; }
      .wp-bible-listitem { width: 100%; text-align: left; background: transparent; border: 1px solid transparent; border-radius: 6px; padding: 8px 10px; font-size: 13px; color: var(--ink-soft); cursor: pointer; font-family: var(--font-body); }
      .wp-bible-listitem:hover { background: #232323; }
      .wp-bible-listitem.is-active { background: var(--teal-soft); color: var(--teal); border-color: var(--teal-soft); font-weight: 600; }
      .wp-bible-reader { border: 1px solid var(--rule); border-radius: 8px; padding: 20px 22px; background: #1A1A1A; min-width: 0; }
      .wp-bible-reader-title { font-family: var(--font-display); font-size: 22px; margin: 0 0 14px; color: var(--brass); }
      .wp-bible-reader-body { display: flex; flex-direction: column; gap: 10px; }
      .wp-bible-verseline { margin: 0; font-size: 15px; line-height: 1.7; color: var(--ink); }
      .wp-bible-note { margin-top: 18px; padding-top: 12px; border-top: 1px dashed var(--rule); }

      @media (max-width: 640px) {
        .wp-bible { grid-template-columns: 1fr; }
        .wp-bible-list { max-height: 220px; }
      }

      /* ---------- Supabase-style Churches / Admin dashboard ---------- */
      .wp-sb {
        --sb-green: #3ECF8E;
        --sb-green-dim: #1E3A2E;
        --sb-bg: #0F0F10;
        --sb-panel: #171717;
        --sb-line: #262626;
        /* Recolor every shared component (cards, hero, badges, chips,
           buttons) to the same near-black / green-accent theme used on
           the Churches admin screen, so the church Dashboard reads as
           the same product instead of a separate vintage skin. */
        --paper: var(--sb-bg);
        --card: var(--sb-panel);
        --rule: var(--sb-line);
        --brass: var(--sb-green);
        --brass-soft: var(--sb-green-dim);
        --teal: var(--sb-green);
        --teal-soft: var(--sb-green-dim);
        max-width: none;
        padding: 0;
        margin: 0;
        background: var(--sb-bg);
        min-height: 100vh;
      }
      .wp-sb .wp-btn-primary { color: #06170F; }
      .wp-sb .wp-panel { background: var(--sb-panel); border-color: var(--sb-line); }
      .wp-sb .wp-sb-main .wp-panel { margin-top: 4px; }

      /* Home Base + Server Portal: centered card under the same topbar
         used everywhere else, instead of the old vintage masthead. */
      .wp-sb-authwrap { display: flex; align-items: center; justify-content: center; min-height: calc(100vh - 52px); padding: 24px; }
      .wp-sb-authbox { width: 100%; max-width: 440px; background: var(--sb-panel); border: 1px solid var(--sb-line); border-radius: 12px; padding: 28px 26px 26px; }
      .wp-sb-authbox .wp-kicker { position: static; display: block; margin-bottom: 8px; }
      .wp-sb-authbox .wp-title { font-size: 28px; margin-top: 0; }

      .wp-sb-topbar { height: 52px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid var(--sb-line); background: var(--sb-bg); }
      .wp-sb-topbar-left { display: flex; align-items: center; gap: 8px; }
      .wp-sb-logo { color: var(--sb-green); font-size: 16px; display: inline-flex; align-items: center; }
      .wp-sb-slash { color: #444; font-size: 14px; }
      .wp-sb-org { font-size: 13.5px; font-weight: 600; color: var(--ink); }
      .wp-sb-plan { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.05em; color: var(--ink-soft); background: #262626; border: 1px solid var(--sb-line); padding: 2px 7px; border-radius: 4px; }
      .wp-sb-chevron { color: var(--ink-soft); font-size: 11px; }
      .wp-sb-topbar-right { display: flex; align-items: center; gap: 14px; }
      .wp-sb-feedback { font-size: 12.5px; color: var(--ink-soft); cursor: default; }
      .wp-sb-search { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--ink-soft); background: #1B1B1B; border: 1px solid var(--sb-line); border-radius: 6px; padding: 6px 10px; }
      .wp-sb-search-ic { font-size: 13px; }
      .wp-sb-search kbd { font-family: var(--font-mono); font-size: 10px; background: #262626; border: 1px solid #333; border-radius: 4px; padding: 1px 5px; color: var(--ink-soft); }
      .wp-sb-iconbtn { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: var(--ink-soft); font-size: 12.5px; border: 1px solid transparent; }
      .wp-sb-iconbtn:hover { border-color: var(--sb-line); }
      .wp-sb-avatar { width: 26px; height: 26px; border-radius: 50%; background: linear-gradient(135deg, var(--sb-green), #1F8F5C); color: #06170F; font-family: var(--font-mono); font-size: 10.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; }

      .wp-sb-body { display: flex; align-items: stretch; min-height: calc(100vh - 52px); }
      .wp-sb-rail { width: 56px; flex-shrink: 0; border-right: 1px solid var(--sb-line); display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px 0; }
      .wp-sb-rail-logo { color: var(--sb-green); font-size: 18px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; }
      .wp-sb-rail-spacer { flex: 1; }
      .wp-sb-railicon { width: 36px; height: 36px; border-radius: 8px; border: none; background: transparent; font-size: 16px; display: flex; align-items: center; justify-content: center; color: var(--ink-soft); cursor: pointer; }
      .wp-sb-railicon:hover { background: #1D1D1D; }
      .wp-sb-railicon.is-active { background: #232323; color: var(--ink); box-shadow: inset 2px 0 0 var(--sb-green); }

      .wp-sb-main { flex: 1; padding: 28px 32px 60px; max-width: 1280px; }
      .wp-sb-title { font-family: var(--font-display); font-size: 32px; font-weight: 600; margin: 0 0 22px; color: var(--ink); }

      .wp-sb-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 22px; }
      .wp-sb-searchbox { display: flex; align-items: center; gap: 7px; background: var(--sb-panel); border: 1px solid var(--sb-line); border-radius: 7px; padding: 8px 12px; min-width: 220px; }
      .wp-sb-searchbox input { background: none; border: none; outline: none; color: var(--ink); font-size: 13.5px; width: 100%; font-family: var(--font-body); }
      .wp-sb-searchbox input::placeholder { color: #6B6B6B; }
      .wp-sb-pillbtn { display: flex; align-items: center; gap: 6px; font-size: 13px; font-family: var(--font-body); font-weight: 500; color: var(--ink); background: var(--sb-panel); border: 1px solid var(--sb-line); border-radius: 7px; padding: 8px 13px; cursor: pointer; white-space: nowrap; }
      .wp-sb-pillbtn:hover { border-color: #3A3A3A; }
      .wp-sb-caret, .wp-sb-sortic { color: var(--ink-soft); font-size: 11px; }
      .wp-sb-spacergrow { flex: 1; }
      .wp-sb-viewtoggle { display: flex; border: 1px solid var(--sb-line); border-radius: 7px; overflow: hidden; }
      .wp-sb-viewtoggle button { width: 34px; height: 34px; background: var(--sb-panel); border: none; color: var(--ink-soft); cursor: pointer; font-size: 14px; }
      .wp-sb-viewtoggle button + button { border-left: 1px solid var(--sb-line); }
      .wp-sb-viewtoggle button.is-active { background: #232323; color: var(--ink); }
      .wp-sb-newbtn { font-family: var(--font-body); font-weight: 600; font-size: 13.5px; background: var(--sb-green); color: #06170F; border: none; border-radius: 7px; padding: 9px 16px; cursor: pointer; white-space: nowrap; }
      .wp-sb-newbtn:hover { background: #57DDA3; }

      .wp-sb-content { display: grid; grid-template-columns: 1fr 250px; gap: 22px; align-items: start; }
      .wp-sb-content-main { min-width: 0; }

      .wp-sb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
      .wp-sb-card { text-align: left; background: var(--sb-panel); border: 1px solid var(--sb-line); border-radius: 9px; padding: 18px; cursor: pointer; font-family: var(--font-body); display: flex; flex-direction: column; gap: 9px; min-height: 108px; }
      .wp-sb-card:hover { border-color: var(--sb-green); background: #1B1F1D; }
      .wp-sb-card-top { display: flex; align-items: center; gap: 8px; }
      .wp-sb-card-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--sb-green); flex-shrink: 0; }
      .wp-sb-card-name { font-weight: 600; font-size: 15px; color: var(--ink); }
      .wp-sb-card-meta { font-size: 12px; color: var(--ink-soft); }
      .wp-sb-card-tag { align-self: flex-start; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.06em; background: var(--sb-green-dim); color: var(--sb-green); padding: 3px 9px; border-radius: 5px; margin-top: auto; }

      .wp-sb-listview { display: flex; flex-direction: column; gap: 8px; }
      .wp-sb-listrow { display: flex; align-items: center; gap: 12px; text-align: left; background: var(--sb-panel); border: 1px solid var(--sb-line); border-radius: 8px; padding: 12px 16px; cursor: pointer; font-family: var(--font-body); }
      .wp-sb-listrow:hover { border-color: var(--sb-green); background: #1B1F1D; }
      .wp-sb-listrow-name { font-weight: 600; font-size: 14px; color: var(--ink); flex: 1; }
      .wp-sb-listrow-meta { font-size: 12px; color: var(--ink-soft); }

      .wp-sb-usage { border: 1px solid var(--sb-line); border-radius: 10px; background: var(--sb-panel); padding: 18px; position: sticky; top: 20px; }
      .wp-sb-usage-head { margin-bottom: 6px; }
      .wp-sb-usage-title { font-family: var(--font-body); font-weight: 600; font-size: 13.5px; color: var(--ink); }
      .wp-sb-usage-sub { font-size: 11.5px; color: var(--ink-soft); margin-top: 2px; }
      .wp-sb-usage-row { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-top: 1px solid var(--sb-line); font-size: 12.5px; }
      .wp-sb-usage-bullet { width: 9px; height: 9px; border-radius: 50%; border: 2px solid var(--sb-line); flex-shrink: 0; }
      .wp-sb-usage-label { color: var(--ink); flex: 1; font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.05em; text-transform: uppercase; }
      .wp-sb-usage-value { font-family: var(--font-mono); font-weight: 600; color: var(--sb-green); }

      .wp-admin-headrow { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }

      .wp-admin-statgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-bottom: 30px; }
      .wp-admin-statcard { border: 1px solid var(--sb-line); border-radius: 9px; background: var(--sb-panel); padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; }
      .wp-admin-statlabel { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft); }
      .wp-admin-statvalue { font-family: var(--font-display); font-size: 26px; font-weight: 600; color: var(--sb-green); }

      .wp-admin-tablehead { font-family: var(--font-display); font-size: 20px; font-weight: 600; color: var(--ink); margin: 0 0 12px; }
      .wp-admin-tablewrap { border: 1px solid var(--sb-line); border-radius: 9px; overflow: hidden; overflow-x: auto; }
      .wp-admin-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .wp-admin-table th { text-align: left; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--ink-soft); background: var(--sb-panel); padding: 10px 14px; border-bottom: 1px solid var(--sb-line); white-space: nowrap; }
      .wp-admin-table td { padding: 12px 14px; border-bottom: 1px solid var(--sb-line); color: var(--ink); white-space: nowrap; }
      .wp-admin-table tbody tr { cursor: pointer; }
      .wp-admin-table tbody tr:hover { background: #1B1F1D; }
      .wp-admin-table tbody tr:last-child td { border-bottom: none; }
      .wp-admin-td-name { font-weight: 600; }

      .wp-modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 50; }
      .wp-modal-box { width: 100%; max-width: 400px; background: var(--sb-panel, #171717); border: 1px solid var(--sb-line, #262626); border-radius: 12px; padding: 26px 26px 22px; }
      .wp-modal-title { font-family: var(--font-display); font-size: 20px; font-weight: 600; color: var(--ink); margin: 0 0 6px; }

      @media (max-width: 860px) {
        .wp-sb-content { grid-template-columns: 1fr; }
        .wp-sb-usage { position: static; }
      }
      @media (max-width: 640px) {
        .wp-sb-main { padding: 20px 14px 40px; }
        .wp-sb-topbar-left .wp-sb-org, .wp-sb-topbar-left .wp-sb-plan { display: none; }
        .wp-sb-search { display: none; }
        .wp-sb-rail { width: 46px; }
        .wp-sb-railicon { width: 30px; height: 30px; font-size: 14px; }
      }

      @media (max-width: 560px) {
        .wp-app { padding: 16px 12px 40px; }
        .wp-title { font-size: 32px; }
        .wp-panel { padding: 18px 14px; }
        .wp-hero { padding: 16px; }
        .wp-hero-div { display: none; }
        .wp-fieldrow { flex-direction: column; }
        .wp-tab { padding: 8px 11px; font-size: 12px; }
        .wp-kicker { position: static; display: block; margin-bottom: 4px; }
      }
    `}</style>
  );
}
