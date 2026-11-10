import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  addDoc, 
  updateDoc 
} from 'firebase/firestore';
import {
  Trophy,
  Activity,
  Calendar,
  Shield,
  Users,
  Target,
  Send,
  Plus,
  Flame,
  Dumbbell,
  Brain,
  CheckCircle,
  BarChart3,
  X,
  Sliders,
  Zap,
  Lock,
  Mail,
  User,
  LogOut,
  Sparkles,
  MessageSquare
} from 'lucide-react';

// --- FIREBASE INITIALIZATION ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : { apiKey: "demo-key", authDomain: "demo.firebaseapp.com", projectId: "demo-project" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'loc-in-fc-app';

// Default Standings & Fixtures
const DEFAULT_FIXTURES = [
  { id: 'fx1', opponent: 'Rival City FC', date: 'Saturday, Nov 14', time: '10:00 AM', venue: 'LOC IN Stadium (Home)', type: 'League' },
  { id: 'fx2', opponent: 'Valley Strikers', date: 'Saturday, Nov 21', time: '2:30 PM', venue: 'Valley Complex (Away)', type: 'League' },
  { id: 'fx3', opponent: 'State Cup Quarterfinal', date: 'Wednesday, Nov 25', time: '6:00 PM', venue: 'Neutral Turf (State Arena)', type: 'Cup' }
];

const DEFAULT_STANDINGS = [
  { rank: 1, team: 'LOC IN FC', mp: 14, w: 11, d: 2, l: 1, gf: 38, ga: 12, gd: '+26', pts: 35, isUser: true },
  { rank: 2, team: 'Apex Soccer Academy', mp: 14, w: 10, d: 3, l: 1, gf: 34, ga: 14, gd: '+20', pts: 33, isUser: false },
  { rank: 3, team: 'Metro Stars FC', mp: 14, w: 8, d: 2, l: 4, gf: 27, ga: 19, gd: '+8', pts: 26, isUser: false },
  { rank: 4, team: 'Coastal United', mp: 14, w: 7, d: 4, l: 3, gf: 24, ga: 18, gd: '+6', pts: 25, isUser: false },
  { rank: 5, team: 'Rival City FC', mp: 14, w: 6, d: 2, l: 6, gf: 21, ga: 22, gd: '-1', pts: 20, isUser: false }
];

export default function App() {
  // --- AUTH & USER STATE ---
  const [authUser, setAuthUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [loading, setLoading] = useState(true);

  // Sign Up Form Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('player'); // 'player' | 'coach'
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [position, setPosition] = useState('Attacking Midfielder');
  const [coachPasscode, setCoachPasscode] = useState('');
  const [authError, setAuthError] = useState('');

  // --- COACH SQUAD DATA ---
  const [squadRoster, setSquadRoster] = useState([]);
  const [selectedPlayerForCoach, setSelectedPlayerForCoach] = useState(null);

  // --- UI NAVIGATION TABS ---
  const [playerTab, setPlayerTab] = useState('wellness');
  const [coachTab, setCoachTab] = useState('overview');

  // --- MODALS & FORMS ---
  const [showJuggleModal, setShowJuggleModal] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [newJuggle, setNewJuggle] = useState({ count: '', ballType: 'Tennis Ball' });
  const [newMatch, setNewMatch] = useState({ opponent: '', result: 'W 2-1', goals: 0, assists: 0, minutes: 90, yellow: 0, red: 0 });
  const [feedbackInput, setFeedbackInput] = useState({ category: 'Technical & Match Performance', content: '', drill: '' });
  const [replyInput, setReplyInput] = useState('');

  // 1. INITIAL AUTHENTICATION EFFECT
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          // If no token exists, wait for explicit user login/signup
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setAuthUser(usr);
    });
    return () => unsubscribe();
  }, []);

  // 2. FETCH CURRENT USER PROFILE & SQUAD ROSTER EFFECT
  useEffect(() => {
    if (!authUser) {
      setUserProfile(null);
      setSquadRoster([]);
      return;
    }

    // Subscribe to logged-in user profile
    const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', authUser.uid);
    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
      }
    }, (err) => console.error("Error loading user profile:", err));

    // Subscribe to all squad players for Coach View
    const playersColRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const unsubRoster = onSnapshot(playersColRef, (snapshot) => {
      const players = [];
      snapshot.forEach(d => {
        const data = d.data();
        if (data.role === 'player') {
          players.push({ id: d.id, ...data });
        }
      });
      setSquadRoster(players);
      if (players.length > 0 && !selectedPlayerForCoach) {
        setSelectedPlayerForCoach(players[0]);
      }
    }, (err) => console.error("Error loading roster:", err));

    return () => {
      unsubUser();
      unsubRoster();
    };
  }, [authUser]);

  // AUTH HANDLERS
  const handleSignUp = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (role === 'coach' && coachPasscode !== 'LOCIN2026') {
      setAuthError('Invalid Coach Passcode. Contact admin for authorization.');
      return;
    }

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;

      const newUserData = {
        uid,
        email,
        name: fullName || 'New Athlete',
        role,
        number: jerseyNumber || '99',
        position: position || 'Midfielder',
        avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
        wellness: {
          date: new Date().toISOString().split('T')[0],
          energy: 8,
          soreness: 3,
          focus: 8,
          stress: 3,
          note: 'Ready for training session!'
        },
        juggles: {
          tennisBallPR: 0,
          standardPR: 0,
          miniballPR: 0,
          history: []
        },
        stats: {
          goals: 0,
          assists: 0,
          matchesPlayed: 0,
          minutes: 0,
          yellowCards: 0,
          redCards: 0
        },
        recentMatches: [],
        feedback: []
      };

      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid), newUserData);
    } catch (err) {
      setAuthError(err.message.replace('Firebase: ', ''));
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError('Failed to sign in. Check email and password.');
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  // WELLNESS & STAT UPDATE HANDLERS
  const handleUpdateWellness = async (field, val) => {
    if (!authUser || !userProfile) return;
    const updatedWellness = { ...userProfile.wellness, [field]: val };
    const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', authUser.uid);
    await updateDoc(userDocRef, { wellness: updatedWellness });
  };

  const handleLogJuggle = async (e) => {
    e.preventDefault();
    const countNum = parseInt(newJuggle.count, 10);
    if (isNaN(countNum) || countNum <= 0 || !authUser || !userProfile) return;

    const currentJuggles = userProfile.juggles || { tennisBallPR: 0, standardPR: 0, miniballPR: 0, history: [] };
    const isPR = newJuggle.ballType === 'Tennis Ball' && countNum > (currentJuggles.tennisBallPR || 0);
    const newTennisPR = isPR ? countNum : (currentJuggles.tennisBallPR || 0);

    const updatedJuggles = {
      ...currentJuggles,
      tennisBallPR: newTennisPR,
      history: [
        { id: `j_${Date.now()}`, date: new Date().toLocaleDateString(), count: countNum, ballType: newJuggle.ballType },
        ...(currentJuggles.history || [])
      ]
    };

    const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', authUser.uid);
    await updateDoc(userDocRef, { juggles: updatedJuggles });

    setNewJuggle({ count: '', ballType: 'Tennis Ball' });
    setShowJuggleModal(false);
  };

  const handleAddMatch = async (e) => {
    e.preventDefault();
    if (!newMatch.opponent || !authUser || !userProfile) return;

    const currentStats = userProfile.stats || { goals: 0, assists: 0, minutes: 0, matchesPlayed: 0, yellowCards: 0, redCards: 0 };
    const updatedStats = {
      ...currentStats,
      goals: currentStats.goals + parseInt(newMatch.goals || 0, 10),
      assists: currentStats.assists + parseInt(newMatch.assists || 0, 10),
      minutes: currentStats.minutes + parseInt(newMatch.minutes || 0, 10),
      matchesPlayed: currentStats.matchesPlayed + 1,
      yellowCards: currentStats.yellowCards + parseInt(newMatch.yellow || 0, 10),
      redCards: currentStats.redCards + parseInt(newMatch.red || 0, 10)
    };

    const updatedMatches = [
      { id: `m_${Date.now()}`, ...newMatch, date: new Date().toLocaleDateString() },
      ...(userProfile.recentMatches || [])
    ];

    const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', authUser.uid);
    await updateDoc(userDocRef, { stats: updatedStats, recentMatches: updatedMatches });

    setNewMatch({ opponent: '', result: 'W 2-1', goals: 0, assists: 0, minutes: 90, yellow: 0, red: 0 });
    setShowMatchModal(false);
  };

  const handleSendCoachFeedback = async (e) => {
    e.preventDefault();
    if (!feedbackInput.content || !selectedPlayerForCoach) return;

    const targetPlayerId = selectedPlayerForCoach.id;
    const newFb = {
      id: `fb_${Date.now()}`,
      coachName: userProfile?.name || 'Coach Marcus',
      date: new Date().toLocaleDateString(),
      category: feedbackInput.category,
      content: feedbackInput.content,
      drill: feedbackInput.drill || 'Individual skills focus',
      acknowledged: false,
      reply: ''
    };

    const existingFeedback = selectedPlayerForCoach.feedback || [];
    const playerDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', targetPlayerId);

    await updateDoc(playerDocRef, {
      feedback: [newFb, ...existingFeedback]
    });

    setFeedbackInput({ category: 'Technical & Match Performance', content: '', drill: '' });
  };

  const handleAcknowledgeFeedback = async (fbId) => {
    if (!authUser || !userProfile) return;
    const updatedFeedback = (userProfile.feedback || []).map(fb => {
      if (fb.id === fbId) {
        return { ...fb, acknowledged: true, reply: replyInput || 'Acknowledged by player.' };
      }
      return fb;
    });

    const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', authUser.uid);
    await updateDoc(userDocRef, { feedback: updatedFeedback });
    setReplyInput('');
  };

  // Readiness Status Helper
  const getWellnessStatus = (soreness = 1, energy = 10) => {
    if (soreness >= 7 || energy <= 4) return { label: 'High Fatigue / Caution', color: 'bg-rose-500/20 text-rose-400 border-rose-500/40', badge: 'RED' };
    if (soreness >= 5 || energy <= 6) return { label: 'Moderate Recovery Needed', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40', badge: 'YELLOW' };
    return { label: 'Optimum Match Readiness', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', badge: 'GREEN' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
          <span className="font-bold text-sm tracking-wider uppercase">Loading LOC IN FC...</span>
        </div>
      </div>
    );
  }

  // --- SCREEN 1: LOGIN / SIGN UP AUTHENTICATION FLOW ---
  if (!authUser || !userProfile) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {/* Brand Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black text-2xl shadow-xl shadow-emerald-500/20 ring-4 ring-emerald-400/20">
              <Shield className="w-8 h-8 fill-slate-950 stroke-none" />
            </div>
            <h1 className="text-2xl font-black tracking-wider uppercase text-white">
              LOC IN <span className="text-emerald-400">FC</span>
            </h1>
            <p className="text-xs text-slate-400">Player Performance & Squad Command Hub</p>
          </div>

          {/* Auth Mode Toggle */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex">
            <button
              onClick={() => { setAuthMode('login'); setAuthError(''); }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                authMode === 'login' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthMode('signup'); setAuthError(''); }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                authMode === 'signup' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {authError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-medium text-center">
              {authError}
            </div>
          )}

          {/* LOGIN FORM */}
          {authMode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                  <input
                    type="email"
                    required
                    placeholder="player@locinfc.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 uppercase tracking-wider"
              >
                Log In To Dashboard
              </button>
            </form>
          )}

          {/* SIGN UP FORM */}
          {authMode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Account Role</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('player')}
                    className={`py-2 px-3 rounded-xl border font-bold text-center ${
                      role === 'player' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Player
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('coach')}
                    className={`py-2 px-3 rounded-xl border font-bold text-center ${
                      role === 'coach' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Coach / Staff
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mateo Silva"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {role === 'player' ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Jersey #</label>
                    <input
                      type="text"
                      required
                      placeholder="10"
                      value={jerseyNumber}
                      onChange={(e) => setJerseyNumber(e.target.value)}
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Position</label>
                    <select
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Striker">Striker</option>
                      <option value="Winger">Winger</option>
                      <option value="Attacking Midfielder">Attacking Midfielder</option>
                      <option value="Defensive Midfielder">Defensive Midfielder</option>
                      <option value="Center Back">Center Back</option>
                      <option value="Full Back">Full Back</option>
                      <option value="Goalkeeper">Goalkeeper</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Coach Authorization Passcode</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter coach passcode (Demo: LOCIN2026)"
                    value={coachPasscode}
                    onChange={(e) => setCoachPasscode(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Default Demo Passcode: <strong className="text-emerald-400">LOCIN2026</strong></p>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-bold mb-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 uppercase tracking-wider mt-2"
              >
                Register Account & Join Squad
              </button>
            </form>
          )}

        </div>
      </div>
    );
  }

  // --- SCREEN 2: MAIN LOC IN FC DASHBOARD ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col antialiased selection:bg-emerald-500 selection:text-slate-950">

      {/* TOP HEADER */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-emerald-500/20 tracking-tighter ring-2 ring-emerald-400/30">
            <Shield className="w-6 h-6 fill-slate-950 stroke-none" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-white text-lg tracking-wider uppercase flex items-center gap-1.5">
                LOC IN <span className="text-emerald-400">FC</span>
              </h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {userProfile.role}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Performance & Cloud Sync Hub</p>
          </div>
        </div>

        {/* Logged In User Profile Pill */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <div className="text-left text-xs">
              <p className="font-bold text-white">{userProfile.name}</p>
              <p className="text-[10px] text-slate-400">{userProfile.role === 'player' ? `#${userProfile.number} • ${userProfile.position}` : 'Staff Coach'}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-2.5 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 rounded-xl border border-slate-700 text-slate-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* SUB NAVIGATION TAB BAR */}
      <nav className="bg-slate-900/60 border-b border-slate-800/80 px-4 sm:px-6 py-2 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          {userProfile.role === 'player' ? (
            <>
              <button
                onClick={() => setPlayerTab('wellness')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  playerTab === 'wellness' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="w-4 h-4 text-emerald-400" /> Daily Wellness Check-In
              </button>
              <button
                onClick={() => setPlayerTab('juggles')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  playerTab === 'juggles' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Flame className="w-4 h-4 text-amber-400" /> Tennis Ball PRs
              </button>
              <button
                onClick={() => setPlayerTab('stats')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  playerTab === 'stats' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-4 h-4 text-teal-400" /> Game Stats Hub
              </button>
              <button
                onClick={() => setPlayerTab('schedule')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  playerTab === 'schedule' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar className="w-4 h-4 text-indigo-400" /> Schedule & League Standings
              </button>
              <button
                onClick={() => setPlayerTab('feedback')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  playerTab === 'feedback' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-purple-400" /> Coach Feedback
                {(userProfile.feedback || []).some(f => !f.acknowledged) && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setCoachTab('overview')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  coachTab === 'overview' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4 text-emerald-400" /> Squad Readiness Matrix ({squadRoster.length})
              </button>
              <button
                onClick={() => setCoachTab('leaderboard')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  coachTab === 'leaderboard' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Trophy className="w-4 h-4 text-amber-400" /> Juggle Leaderboard
              </button>
              <button
                onClick={() => setCoachTab('deepdive')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  coachTab === 'deepdive' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Target className="w-4 h-4 text-indigo-400" /> Player Feedback Writer
              </button>
            </>
          )}
        </div>
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* PLAYER ROLE VIEW */}
        {userProfile.role === 'player' && (
          <div className="space-y-6">

            {/* TAB 1: DAILY WELLNESS CHECK-IN */}
            {playerTab === 'wellness' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="font-bold text-white text-base flex items-center gap-2">
                        <Activity className="w-5 h-5 text-emerald-400" /> Daily Mental & Physical Check-In
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">Log your status to notify staff of your recovery.</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Energy */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-300 flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-amber-400" /> Energy Level
                        </span>
                        <span className="text-emerald-400 font-extrabold text-sm">{userProfile.wellness?.energy || 8} / 10</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={userProfile.wellness?.energy || 8}
                        onChange={(e) => handleUpdateWellness('energy', parseInt(e.target.value, 10))}
                        className="w-full accent-emerald-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Muscle Soreness */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-300 flex items-center gap-1.5">
                          <Dumbbell className="w-4 h-4 text-rose-400" /> Soreness & Tightness
                        </span>
                        <span className="text-rose-400 font-extrabold text-sm">{userProfile.wellness?.soreness || 3} / 10</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={userProfile.wellness?.soreness || 3}
                        onChange={(e) => handleUpdateWellness('soreness', parseInt(e.target.value, 10))}
                        className="w-full accent-rose-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Mental Focus */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-300 flex items-center gap-1.5">
                          <Brain className="w-4 h-4 text-indigo-400" /> Mental Focus & Clarity
                        </span>
                        <span className="text-indigo-400 font-extrabold text-sm">{userProfile.wellness?.focus || 8} / 10</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={userProfile.wellness?.focus || 8}
                        onChange={(e) => handleUpdateWellness('focus', parseInt(e.target.value, 10))}
                        className="w-full accent-indigo-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Note */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-300">
                        Check-In Note (Syncs with Coach View)
                      </label>
                      <textarea
                        rows={3}
                        value={userProfile.wellness?.note || ''}
                        onChange={(e) => handleUpdateWellness('note', e.target.value)}
                        placeholder="Log any muscle tightness or mindset notes..."
                        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4 shadow-lg h-fit">
                  <h4 className="font-bold text-white text-sm">Live Readiness Summary</h4>
                  <div className={`p-4 rounded-xl border ${getWellnessStatus(userProfile.wellness?.soreness, userProfile.wellness?.energy).color}`}>
                    <p className="text-xs font-black uppercase tracking-wider">
                      {getWellnessStatus(userProfile.wellness?.soreness, userProfile.wellness?.energy).badge} FLAG
                    </p>
                    <p className="text-sm font-bold mt-1">
                      {getWellnessStatus(userProfile.wellness?.soreness, userProfile.wellness?.energy).label}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TENNIS BALL & JUGGLES */}
            {playerTab === 'juggles' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-900 p-5 rounded-2xl border border-amber-500/30 shadow-lg flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-amber-400 uppercase">Tennis Ball PR</p>
                      <p className="text-3xl font-black text-white mt-1">{userProfile.juggles?.tennisBallPR || 0}</p>
                    </div>
                    <div className="text-2xl">🎾</div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-lg space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="font-bold text-white text-base flex items-center gap-2">
                        <Flame className="w-5 h-5 text-amber-400" /> Log Juggle Attempt
                      </h3>
                      <p className="text-xs text-slate-400">Attempts automatically sync to cloud.</p>
                    </div>
                    <button
                      onClick={() => setShowJuggleModal(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-emerald-400"
                    >
                      <Plus className="w-4 h-4" /> Add Record
                    </button>
                  </div>

                  <div className="divide-y divide-slate-800">
                    {(userProfile.juggles?.history || []).map(j => (
                      <div key={j.id} className="py-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-white">{j.count} Juggles ({j.ballType})</p>
                          <p className="text-slate-400">{j.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: MATCH STATS */}
            {playerTab === 'stats' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Goals</p>
                    <p className="text-2xl font-black text-emerald-400 mt-1">{userProfile.stats?.goals || 0}</p>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Assists</p>
                    <p className="text-2xl font-black text-teal-400 mt-1">{userProfile.stats?.assists || 0}</p>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Matches</p>
                    <p className="text-2xl font-black text-white mt-1">{userProfile.stats?.matchesPlayed || 0}</p>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Minutes</p>
                    <p className="text-2xl font-black text-indigo-400 mt-1">{userProfile.stats?.minutes || 0}'</p>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-lg space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <h3 className="font-bold text-white text-base">Match History</h3>
                    <button
                      onClick={() => setShowMatchModal(true)}
                      className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-emerald-400"
                    >
                      <Plus className="w-4 h-4 inline mr-1" /> Log Game
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(userProfile.recentMatches || []).map(m => (
                      <div key={m.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-white">vs {m.opponent} ({m.result})</p>
                          <p className="text-slate-400">{m.date} • {m.minutes} mins</p>
                        </div>
                        <div className="text-right font-bold text-emerald-400">
                          {m.goals} Goals / {m.assists} Assists
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: SCHEDULE & LEAGUE */}
            {playerTab === 'schedule' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
                  <h3 className="font-bold text-white text-base">Upcoming Fixtures</h3>
                  <div className="space-y-3 text-xs">
                    {DEFAULT_FIXTURES.map(f => (
                      <div key={f.id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex justify-between">
                        <div>
                          <p className="font-bold text-white">{f.opponent}</p>
                          <p className="text-slate-400">{f.venue}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-indigo-400 font-bold">{f.date}</p>
                          <p className="text-slate-500">{f.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
                  <h3 className="font-bold text-white text-base">League Standings</h3>
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500">
                        <th className="py-2">#</th>
                        <th className="py-2">Team</th>
                        <th className="py-2 text-right">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {DEFAULT_STANDINGS.map(s => (
                        <tr key={s.rank} className={s.isUser ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                          <td className="py-2">{s.rank}</td>
                          <td className="py-2">{s.team}</td>
                          <td className="py-2 text-right font-black">{s.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 5: COACH FEEDBACK */}
            {playerTab === 'feedback' && (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
                <h3 className="font-bold text-white text-base">Personalized Coach Feedback</h3>
                <div className="space-y-4">
                  {(userProfile.feedback || []).length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No notes from coach yet.</p>
                  ) : (
                    (userProfile.feedback || []).map(fb => (
                      <div key={fb.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-2">
                        <div className="flex justify-between text-purple-400 font-bold">
                          <span>{fb.category}</span>
                          <span className="text-slate-500">{fb.date}</span>
                        </div>
                        <p className="text-slate-200">"{fb.content}"</p>
                        {fb.acknowledged ? (
                          <div className="text-emerald-400 font-bold text-[11px] pt-1">
                            ✓ Acknowledged: {fb.reply}
                          </div>
                        ) : (
                          <div className="pt-2 flex gap-2">
                            <input
                              type="text"
                              placeholder="Write reply..."
                              value={replyInput}
                              onChange={(e) => setReplyInput(e.target.value)}
                              className="flex-1 p-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                            />
                            <button
                              onClick={() => handleAcknowledgeFeedback(fb.id)}
                              className="px-3 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-lg"
                            >
                              Confirm
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          </div>
        )}

        {/* COACH ROLE VIEW */}
        {userProfile.role === 'coach' && (
          <div className="space-y-6">

            {/* COACH TAB 1: SQUAD READINESS MATRIX */}
            {coachTab === 'overview' && (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4 shadow-lg">
                <h3 className="font-bold text-white text-base">Registered Squad Roster ({squadRoster.length} Players)</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {squadRoster.map(p => {
                    const status = getWellnessStatus(p.wellness?.soreness, p.wellness?.energy);
                    return (
                      <div key={p.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-2">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-white">#{p.number} {p.name}</h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${status.color}`}>
                            {status.badge}
                          </span>
                        </div>
                        <p className="text-slate-400">{p.position}</p>
                        <div className="flex justify-between pt-2 border-t border-slate-900 text-[11px]">
                          <span>Soreness: <strong>{p.wellness?.soreness || 0}/10</strong></span>
                          <span>Tennis PR: <strong className="text-amber-400">{p.juggles?.tennisBallPR || 0}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* COACH TAB 2: JUGGLE LEADERBOARD */}
            {coachTab === 'leaderboard' && (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
                <h3 className="font-bold text-white text-base">Squad Tennis Ball Juggle Leaderboard</h3>
                <div className="space-y-2">
                  {[...squadRoster]
                    .sort((a, b) => (b.juggles?.tennisBallPR || 0) - (a.juggles?.tennisBallPR || 0))
                    .map((p, idx) => (
                      <div key={p.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                        <div className="flex items-center gap-3">
                          <span className="font-black text-amber-400">#{idx + 1}</span>
                          <span className="font-bold text-white">#{p.number} {p.name}</span>
                        </div>
                        <span className="font-black text-lg text-amber-400">{p.juggles?.tennisBallPR || 0} PR</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* COACH TAB 3: FEEDBACK WRITER */}
            {coachTab === 'deepdive' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3">
                  <h4 className="font-bold text-white text-xs uppercase">Select Player</h4>
                  <div className="space-y-2">
                    {squadRoster.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPlayerForCoach(p)}
                        className={`w-full p-3 rounded-xl border text-left text-xs font-bold ${
                          selectedPlayerForCoach?.id === p.id ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500' : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        #{p.number} {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-2 bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4 text-xs">
                  <h3 className="font-bold text-white text-base">Send Direct Feedback to {selectedPlayerForCoach?.name}</h3>
                  <form onSubmit={handleSendCoachFeedback} className="space-y-3">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Category</label>
                      <select
                        value={feedbackInput.category}
                        onChange={(e) => setFeedbackInput({ ...feedbackInput, category: e.target.value })}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      >
                        <option value="Technical & Match Performance">Technical & Match Performance</option>
                        <option value="Physical & Recovery">Physical & Recovery</option>
                        <option value="Tactical Leadership">Tactical Leadership</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Coach Note</label>
                      <textarea
                        rows={3}
                        required
                        value={feedbackInput.content}
                        onChange={(e) => setFeedbackInput({ ...feedbackInput, content: e.target.value })}
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                        placeholder="Write feedback..."
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-emerald-500 text-slate-950 font-bold rounded-xl"
                    >
                      Send Note To Player Account
                    </button>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}

      </main>

      {/* JUGGLE MODAL */}
      {showJuggleModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-4 text-xs">
            <h3 className="font-bold text-white text-base">Log Juggle Record</h3>
            <form onSubmit={handleLogJuggle} className="space-y-3">
              <input
                type="number"
                required
                placeholder="Count (e.g. 85)"
                value={newJuggle.count}
                onChange={(e) => setNewJuggle({ ...newJuggle, count: e.target.value })}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-black text-lg"
              />
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowJuggleModal(false)} className="px-3 py-2 text-slate-400">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MATCH STATS MODAL */}
      {showMatchModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-4 text-xs">
            <h3 className="font-bold text-white text-base">Log Game Stats</h3>
            <form onSubmit={handleAddMatch} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Opponent Name"
                value={newMatch.opponent}
                onChange={(e) => setNewMatch({ ...newMatch, opponent: e.target.value })}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Goals"
                  value={newMatch.goals}
                  onChange={(e) => setNewMatch({ ...newMatch, goals: e.target.value })}
                  className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
                <input
                  type="number"
                  placeholder="Assists"
                  value={newMatch.assists}
                  onChange={(e) => setNewMatch({ ...newMatch, assists: e.target.value })}
                  className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowMatchModal(false)} className="px-3 py-2 text-slate-400">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}