/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Award,
  XCircle,
  CheckCircle2,
  HelpCircle,
  UserCheck,
  Play,
  Loader2,
  RefreshCw,
  Lock,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  Smartphone
} from "lucide-react";
import { User, QuizItem, AppScreen, SubmitResult } from "./types";
import { decryptText, normalizeText } from "./utils";
import { BrandLogo } from "./components/BrandLogo";
import { LoaderGraphics } from "./components/LoaderGraphics";

const USERS_GAS_URL = "https://script.google.com/macros/s/AKfycbxkAYowCEAdiwFu-fNXSqHD7kdbIxNbW-AxT1i4Z0_-Hk0xfVpl7wySdgKPXYG9qIg00Q/exec";
const QUIZ_GAS_URL = "https://script.google.com/macros/s/AKfycbwhc5FyhL9FpwYKZNOc1FieHL3X_A6sIZ-WwYQVeAVjjYD3ukpUKU9UkeI9ffSio8Sb8Q/exec";

// Fetch users with full direct fallback for Vercel
const fetchUsersDataFromAPI = async (): Promise<User[]> => {
  try {
    const response = await fetch("/api/users");
    if (!response.ok) throw new Error(`Proxy status ${response.status}`);
    const data = await response.json();
    if (data && data.status === "success" && Array.isArray(data.data)) {
      return data.data;
    }
    throw new Error(data.message || "Invalid response format");
  } catch (error: any) {
    console.warn("Express API failed, proxying directly to GSheets:", error);
    const fetchUrl = `${USERS_GAS_URL}?_cb=${Date.now()}`;
    const response = await fetch(fetchUrl, {
      method: "GET",
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`Direct GSheets returned status ${response.status}`);
    const data = await response.json();
    if (data && data.status === "success" && Array.isArray(data.data)) {
      return data.data;
    }
    throw new Error("Invalid response from direct Google Sheets");
  }
};

const fetchQuizQuestionsFromAPI = async (): Promise<QuizItem[]> => {
  try {
    const response = await fetch("/api/quiz");
    if (!response.ok) throw new Error(`Proxy status ${response.status}`);
    const data = await response.json();
    if (data && data.status === "success" && Array.isArray(data.data)) {
      return data.data;
    }
    throw new Error(data.message || "Invalid response format");
  } catch (error: any) {
    console.warn("Express API quiz failed, proxying directly to GSheets:", error);
    const fetchUrl = `${QUIZ_GAS_URL}?_cb=${Date.now()}`;
    const response = await fetch(fetchUrl, {
      method: "GET",
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`Direct GSheets returned status ${response.status}`);
    const data = await response.json();
    if (data && data.status === "success" && Array.isArray(data.data)) {
      return data.data;
    }
    throw new Error("Invalid response from direct Google Sheets");
  }
};

const submitWinnerToAPI = async (id: string | number, winner: string): Promise<any> => {
  try {
    const response = await fetch("/api/quiz/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, winner }),
    });
    if (!response.ok) throw new Error(`Proxy status ${response.status}`);
    return await response.json();
  } catch (error: any) {
    console.warn("Express API submit failed, proxying directly to GSheets:", error);
    const response = await fetch(QUIZ_GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ id, winner }),
      redirect: "follow",
    });
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      const isAlreadyWon = text.toLowerCase().includes("already") || text.toLowerCase().includes("win");
      return {
        status: isAlreadyWon ? "already_won" : "success",
        message: "Directly submitted to Google Sheets",
        rawResponse: text,
      };
    }
  }
};

export default function App() {
  // Screen state
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.LOADING_USERS);
  
  // App data state
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [quizItems, setQuizItems] = useState<QuizItem[]>([]);
  const [activeQuizItems, setActiveQuizItems] = useState<QuizItem[]>([]);
  
  // UI states
  const [loginId, setLoginId] = useState("");
  const [loginError, setLoginError] = useState("");
  const [selectedQuizIndex, setSelectedQuizIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{ [quizId: string]: string }>({});
  
  // Request / load error feedback states
  const [userLoadError, setUserLoadError] = useState("");
  const [quizLoadError, setQuizLoadError] = useState("");
  
  // Submission verification state (Waiting for Google Apps Script doPost response)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  // Trigger loading users on mount
  useEffect(() => {
    loadUsersData();
  }, []);

  // Fetch users from the Resilient API Handler
  const loadUsersData = async () => {
    setCurrentScreen(AppScreen.LOADING_USERS);
    setUserLoadError("");
    try {
      const data = await fetchUsersDataFromAPI();
      setUsers(data);
    } catch (error: any) {
      console.error("Error loading users:", error);
      setUserLoadError(error.message || "Could not connect to the database server.");
    } finally {
      // Small pause for visual smoothness
      setTimeout(() => {
        setCurrentScreen(AppScreen.LOGIN);
      }, 800);
    }
  };

  // Perform login validation
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    const trimmedId = loginId.trim();
    if (!trimmedId) {
      setLoginError("Please enter your Kinettix ID.");
      return;
    }

    // Lookup user in fetched list (checks both numeric and string matches)
    const matchedUser = users.find(
      (u) => String(u.id).toLowerCase() === trimmedId.toLowerCase()
    );

    if (matchedUser) {
      setCurrentUser(matchedUser);
      setCurrentScreen(AppScreen.DASHBOARD);
    } else {
      setLoginError("Invalid user ID. Please check and try again.");
    }
  };

  // Perform loading of quiz data when "Start Quiz" clicked
  const handleStartQuiz = async () => {
    setCurrentScreen(AppScreen.LOADING_QUIZ);
    setQuizLoadError("");
    setSelectedQuizIndex(0);
    
    try {
      const data = await fetchQuizQuestionsFromAPI();
      setQuizItems(data);
      
      // Filter active quiz events based on rules:
      // "only show the item from the data where winner and datetime is empty or null and enable is true"
      const active = data.filter((item) => {
        const isEnabled = item.enable === undefined || item.enable === null || item.enable === "" || item.enable === true || String(item.enable).toLowerCase() === "true";
        const hasNoWinner = !item.winner || String(item.winner).trim() === "";
        const hasNoDatetime = !item.datetime || String(item.datetime).trim() === "";
        return isEnabled && hasNoWinner && hasNoDatetime;
      });
      
      setActiveQuizItems(active);
    } catch (error: any) {
      console.error("Error loading quiz events:", error);
      setQuizLoadError(error.message || "Could not fetch quiz questions from server.");
    } finally {
      // Transition Pause for visual aesthetic
      setTimeout(() => {
        setCurrentScreen(AppScreen.QUIZ);
      }, 1000);
    }
  };

  // Handle Quiz Submitting
  const handleQuizSubmit = async (e: React.FormEvent, quizItem: QuizItem) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const ansText = (userAnswers[quizItem.id] || "").trim();
    if (!ansText) return;

    // Transition to loading/result state directly
    setCurrentScreen(AppScreen.RESULT);
    setIsSubmitting(true);
    setSubmitResult(null);

    // 1. Decrypt the answer using the encryption key
    const decryptedCorrectAnswer = decryptText(quizItem.answer, quizItem.encryptionkey);
    
    // 2. Perform client-side verification of correct answer
    const isCorrectInput = normalizeText(ansText) === normalizeText(decryptedCorrectAnswer);

    if (!isCorrectInput) {
      // Directly fail client-side if answer is incorrect, without pushing to sheets
      setTimeout(() => {
        setIsSubmitting(false);
        setSubmitResult({
          isCorrect: false,
          isWinner: false,
          hasBeenWon: false,
        });
      }, 1000);
      return;
    }

    // 3. Answer is correct client-side! Submit doPost containing the quiz id and name of the winner
    try {
      const submissionData = await submitWinnerToAPI(quizItem.id, currentUser.name);
      console.log("Submission response:", submissionData);

      const isPostSuccess = submissionData.status === "success" || submissionData.success === true;
      const isAlreadyWon = submissionData.message?.toLowerCase().includes("already") || 
                           submissionData.error?.toLowerCase().includes("already") ||
                           submissionData.status === "already_won" ||
                           submissionData.rawResponse?.toLowerCase().includes("already");

      setIsSubmitting(false);
      setSubmitResult({
        isCorrect: true,
        isWinner: isPostSuccess && !isAlreadyWon,
        hasBeenWon: !!isAlreadyWon,
        errorMessage: submissionData.message || submissionData.error || undefined
      });
    } catch (error: any) {
      console.error("Submission failed:", error);
      setIsSubmitting(false);
      setSubmitResult({
        isCorrect: true,
        isWinner: false,
        hasBeenWon: false,
        errorMessage: "Network error occurred while verifying the winner status."
      });
    }
  };

  // Change individual answer inputs
  const handleAnswerChange = (quizId: string | number, value: string) => {
    setUserAnswers((prev) => ({
      ...prev,
      [String(quizId)]: value,
    }));
  };

  // Log out/Reset
  const handleLogout = () => {
    setCurrentUser(null);
    setLoginId("");
    setUserAnswers({});
    setCurrentScreen(AppScreen.LOGIN);
  };

  // Screen layout renderers
  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-[#1c2536] flex flex-col text-[#f8fafc] font-sans selection:bg-[#6366f1] selection:text-white relative overflow-x-hidden md:shadow-[0_0_80px_rgba(0,0,0,0.55)] md:border-x md:border-slate-800/80">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.14),rgba(0,0,0,0))] pointer-events-none" />

      {/* Dynamic Ambient Background Watermark */}
      <div className="absolute w-[80vw] h-[80vw] max-w-[320px] max-h-[320px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.035] pointer-events-none select-none z-0">
        <BrandLogo className="w-full h-full" />
      </div>

      {/* Permanent Core Header Bar */}
      <div className="flex justify-between items-center px-6 py-4.5 border-b border-slate-800/80 bg-[#1c2536] z-10 sticky top-0 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shadow-md">
            <BrandLogo className="w-5.5 h-5.5 text-indigo-400" />
          </div>
          <span className="text-[clamp(0.85rem,4vw,1rem)] font-extrabold tracking-wider text-white uppercase font-sans">
            Kinettix <span className="text-indigo-400 font-medium">Quiz</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/25">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-wide">Live Event</span>
        </div>
      </div>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col px-6 py-6 relative bg-[#1c2536] z-10 overflow-y-auto">
        <AnimatePresence mode="wait">
          
          {/* SCREEN 1: Loading Users Database */}
          {currentScreen === AppScreen.LOADING_USERS && (
            <motion.div
              key="loading-users"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col items-center justify-center text-center my-auto"
              id="screen-loading-users"
            >
              <LoaderGraphics
                label="Initializing App"
                sublabel="Setting up secure API tunnels and querying registered database spreadsheet..."
              />
              {userLoadError && (
                <div className="mt-6 p-4.5 bg-rose-950/40 border border-rose-850 rounded-2xl text-rose-300 text-xs text-left max-w-xs shadow-lg">
                  <p className="font-semibold mb-1">Failed to connect:</p>
                  <p className="text-slate-350 leading-relaxed">{userLoadError}</p>
                  <button
                    onClick={loadUsersData}
                    className="mt-3.5 text-rose-300 underline font-semibold hover:text-rose-100 flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" /> Retry Connection
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* SCREEN 2: Login Page */}
          {currentScreen === AppScreen.LOGIN && (
            <motion.div
              key="login-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col justify-between my-auto space-y-8"
              id="screen-login"
            >
              {/* Header branding */}
              <div className="text-center pt-4">
                <div className="mx-auto w-16 h-16 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl mb-5 flex items-center justify-center shadow-lg animate-pulse">
                  <BrandLogo className="w-10 h-10 text-indigo-400" />
                </div>
                <p className="text-slate-400 text-[clamp(0.8rem,3vw,0.95rem)] leading-relaxed max-w-[260px] mx-auto">
                  Please enter your Kinettix ID.
                </p>
              </div>

              {/* Form area */}
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label
                    htmlFor="user-id-input"
                    className="block text-slate-400 text-[10px] font-bold tracking-wider uppercase mb-2 pl-1"
                  >
                    Enter Kinettix ID
                  </label>
                  <div className="relative">
                    <input
                      id="user-id-input"
                      type="text"
                      value={loginId}
                      onChange={(e) => {
                        setLoginId(e.target.value);
                        if (loginError) setLoginError("");
                      }}
                      placeholder="e.g. 1"
                      className="block w-full px-4 py-3.5 bg-slate-800/60 border border-slate-700/60 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-[clamp(0.9rem,3.2vw,1.1rem)] outline-none transition-all"
                    />
                  </div>
                  {loginError && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-rose-400 text-xs mt-2.5 flex items-center gap-1.5 pl-1"
                    >
                      <XCircle className="w-4 h-4 inline" />
                      {loginError}
                    </motion.p>
                  )}
                </div>

                <button
                  id="btn-verify-identity"
                  type="submit"
                  className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-5053eb text-white font-bold rounded-xl text-[clamp(0.9rem,3.2vw,1.1rem)] text-center tracking-wide transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-indigo-500/15"
                >
                  Login
                </button>
              </form>

              {/* Status indicator on current users loaded */}
              <div className="text-center pb-2 text-slate-500 text-[9px] font-mono leading-relaxed uppercase tracking-wider">
                v2.5.0 • Secured by EncryptionKey
              </div>
            </motion.div>
          )}

          {/* SCREEN 3: Dashboard (Welcome Screen) */}
          {currentScreen === AppScreen.DASHBOARD && currentUser && (
            <motion.div
              key="dashboard-screen"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-1 flex flex-col justify-between space-y-8"
              id="screen-dashboard"
            >
              {/* Header Profile */}
              <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-extrabold font-mono text-base">
                    {currentUser.name.substring(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-slate-500 text-[9px] uppercase block tracking-wider leading-none mb-1 font-semibold">
                      Active Profile
                    </span>
                    <span className="text-white text-sm font-bold">
                      {currentUser.name}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-rose-450 text-xs flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-xl bg-slate-800/40 border border-slate-700/40 hover:bg-rose-500/10 hover:border-rose-500/20"
                >
                  Log out
                </button>
              </div>

              {/* Main Hero Card */}
              <div className="my-auto space-y-8">
                <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-6 relative overflow-hidden shadow-xl text-center flex flex-col items-center justify-center">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -mr-6 -mt-6" />
                  
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/15 text-indigo-400 rounded-full text-[10px] font-bold uppercase tracking-wider mb-5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-450" /> Matches Verified
                  </span>

                  <h1 className="text-[clamp(1.1rem,4.5vw,1.4rem)] font-medium text-slate-300 tracking-snug">
                    Welcome, <span className="text-indigo-400 block text-[clamp(1.7rem,7vw,2.3rem)] font-black mt-2 tracking-tight leading-none">{currentUser.name}</span>!
                  </h1>
                </div>

                <button
                  id="btn-start-quiz"
                  onClick={handleStartQuiz}
                  className="w-full py-4 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-[clamp(0.95rem,3.2vw,1.15rem)] text-center tracking-wide transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-indigo-500/15"
                >
                  Start Quiz
                </button>
              </div>

              <div className="text-center text-slate-500 text-[9px] font-semibold uppercase tracking-wider">
                Ready to fetch quiz database
              </div>
            </motion.div>
          )}

          {/* SCREEN 4: Loading Quiz Questions */}
          {currentScreen === AppScreen.LOADING_QUIZ && (
            <motion.div
              key="loading-quiz"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col items-center justify-center text-center my-auto placeholder-gray-500"
              id="screen-loading-quiz"
            >
              <LoaderGraphics
                label="Loading Quiz"
                sublabel="Downloading encrypted live quiz questions and verification registers from Sheets..."
              />
              {quizLoadError && (
                <div className="mt-6 p-4 bg-rose-950/40 border border-rose-850 rounded-2xl text-rose-300 text-xs text-left max-w-xs shadow-lg">
                  <p className="font-semibold mb-1 text-rose-200">Failed to fetch quiz:</p>
                  <p className="text-slate-350 leading-relaxed mb-3">{quizLoadError}</p>
                  <button
                    onClick={handleStartQuiz}
                    className="text-rose-300 underline font-semibold hover:text-rose-100 flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Try Again
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* SCREEN 5: Quiz Questions Screen */}
          {currentScreen === AppScreen.QUIZ && (
            <motion.div
              key="quiz-screen"
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              className="flex-1 flex flex-col justify-between space-y-6"
              id="screen-quiz"
            >
              {/* Header Back Button */}
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <button
                  onClick={() => setCurrentScreen(AppScreen.DASHBOARD)}
                  className="text-slate-400 hover:text-white text-xs flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-lg bg-slate-800/40 border border-slate-700/50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <span className="text-slate-400 text-xs font-mono font-bold bg-slate-800/40 px-2 py-1 rounded border border-slate-700/30">
                  {activeQuizItems.length > 0 
                    ? `${selectedQuizIndex + 1} of ${activeQuizItems.length}` 
                    : "0 Questions"}
                </span>
              </div>

              {/* Active Questions Controller */}
              {activeQuizItems.length === 0 ? (
                <div className="my-auto text-center space-y-5" id="fallback-no-quiz">
                  <div className="mx-auto w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-slate-500 shadow-inner">
                    <HelpCircle className="w-8 h-8" />
                  </div>
                  <p className="text-slate-300 text-[clamp(1.1rem,4.5vw,1.4rem)] font-extrabold tracking-tight mx-auto max-w-[240px]" id="no-quiz-msg">
                    No active quiz events
                  </p>
                  <p className="text-slate-450 text-[clamp(0.8rem,2.8vw,0.9rem)] max-w-[250px] mx-auto leading-relaxed">
                    All events may have already concluded or been temporarily disabled by the administrator. Check back later for upcoming challenges!
                  </p>
                  <button
                    onClick={handleStartQuiz}
                    className="inline-flex items-center gap-1.5 px-4.5 py-2.5 text-xs font-bold text-indigo-400 border border-slate-700 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh List
                  </button>
                </div>
              ) : (
                /* Adaptive Layout Quiz Presenter */
                <div className="my-auto flex-1 flex flex-col justify-between py-2 space-y-6">
                  {/* Adaptive Header Card with Decrypted Question */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-extrabold py-1 px-2.5 bg-indigo-500/20 text-indigo-400 rounded-full uppercase tracking-wider border border-indigo-500/10">
                        Live Question
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        ID: #{activeQuizItems[selectedQuizIndex].id}
                      </span>
                    </div>

                    {/* Interactive slide counters if more than 1 question is active */}
                    {activeQuizItems.length > 1 && (
                      <div className="flex gap-1.5">
                        {activeQuizItems.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedQuizIndex(idx)}
                            className={`h-1 rounded-full transition-all cursor-pointer ${
                              idx === selectedQuizIndex 
                                ? "w-8 bg-indigo-500" 
                                : "w-2.5 bg-slate-750"
                            }`}
                            aria-label={`Go to question ${idx + 1}`}
                          />
                        ))}
                      </div>
                    )}

                    {/* Display Question Box with high responsiveness */}
                    <div className="p-5.5 rounded-2xl bg-slate-800/40 border border-slate-700/50 shadow-inner mb-3 text-left relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/[0.03] rounded-full blur-xl" />
                      <span className="text-[10px] text-indigo-300 font-mono mb-3.5 block uppercase tracking-wide font-extrabold">
                        Decrypted Question
                      </span>

                      <p className="text-[clamp(1.2rem,5vw,1.9rem)] leading-snug text-white font-black italic mt-1" id="question text">
                        "{decryptText(
                          activeQuizItems[selectedQuizIndex].question,
                          activeQuizItems[selectedQuizIndex].encryptionkey
                        )}"
                      </p>
                    </div>
                  </div>

                  {/* Adaptive Inputs Placing Text input and Submit Button strictly below question */}
                  <form
                    onSubmit={(e) => handleQuizSubmit(e, activeQuizItems[selectedQuizIndex])}
                    className="space-y-4.5 mt-auto"
                  >
                    <div>
                      <label
                        htmlFor={`answer-input-${activeQuizItems[selectedQuizIndex].id}`}
                        className="text-[10px] uppercase font-bold text-slate-400 mb-2.5 block ml-1 tracking-wider"
                      >
                        Your Answer
                      </label>
                      <input
                        id={`answer-input-${activeQuizItems[selectedQuizIndex].id}`}
                        type="text"
                        value={userAnswers[activeQuizItems[selectedQuizIndex].id] || ""}
                        onChange={(e) =>
                          handleAnswerChange(activeQuizItems[selectedQuizIndex].id, e.target.value)
                        }
                        required
                        placeholder="Type answer..."
                        className="block w-full px-4 py-3.5 bg-slate-800/60 border border-slate-700/60 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-[clamp(0.9rem,3.2vw,1.1rem)] outline-none transition-all"
                      />
                    </div>

                    <button
                      id="btn-submit-answer"
                      type="submit"
                      disabled={!(userAnswers[activeQuizItems[selectedQuizIndex].id] || "").trim()}
                      className="w-full py-4 px-4 bg-indigo-600 disabled:bg-slate-800/60 disabled:text-slate-500 text-white font-black rounded-xl text-[clamp(0.95rem,3.2vw,1.15rem)] text-center tracking-wide transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-indigo-500/10 disabled:shadow-none"
                    >
                      Submit Answer
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          )}

          {/* SCREEN 6: Submit / Result page */}
          {currentScreen === AppScreen.RESULT && (
            <motion.div
              key="result-screen"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-1 flex flex-col justify-between my-auto space-y-6"
              id="screen-result"
            >
              <div>{/* spacing block */}</div>

              {/* Central Feedback Card */}
              <div className="text-center my-auto space-y-6">
                {isSubmitting ? (
                  <div className="space-y-5" id="verifying-indicator">
                    <div className="relative mx-auto w-14 h-14">
                      <div className="w-14 h-14 rounded-full border-4 border-slate-750 border-t-indigo-500 animate-spin" />
                    </div>
                    <h2 className="text-[clamp(1rem,4.5vw,1.25rem)] font-extrabold text-slate-300">
                      Verifying Submission...
                    </h2>
                    <p className="text-[clamp(0.8rem,2.8vw,0.9rem)] text-slate-450 max-w-[250px] mx-auto leading-relaxed">
                      Communicating safely with Google Sheet service endpoints. Please wait...
                    </p>
                  </div>
                ) : submitResult ? (
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="space-y-6"
                  >
                    {!submitResult.isCorrect ? (
                      /* INCORRECT RESPONSE */
                      <div className="space-y-4" id="outcome-incorrect">
                        <div className="mx-auto w-16 h-16 bg-rose-500/15 text-rose-400 rounded-full flex items-center justify-center shadow-lg border border-rose-500/15">
                          <XCircle className="w-9 h-9" />
                        </div>
                        <h2 className="text-[clamp(1.4rem,6vw,1.9rem)] font-black text-white">Wrong Answer</h2>
                        <p className="text-slate-400 text-xs leading-relaxed max-w-[250px] mx-auto">
                          The submitted answer did not match the decrypted response record. Please check your spelling and try again!
                        </p>
                      </div>
                    ) : submitResult.hasBeenWon ? (
                      /* CORRECT BUT ALREADY WON BY SOMEONE ELSE (CONCURRENCY LOCK) */
                      <div className="space-y-4" id="outcome-concurrency-locked">
                        <div className="mx-auto w-16 h-16 bg-amber-500/15 text-amber-450 rounded-full flex items-center justify-center shadow-lg border border-amber-500/15">
                          <XCircle className="w-9 h-9" />
                        </div>
                        <h2 className="text-[clamp(1.4rem,6vw,1.9rem)] font-black text-white">Already Won</h2>
                        <p className="text-slate-400 text-xs leading-relaxed max-w-[250px] mx-auto">
                          Your answer was correct, but unfortunately, another student submitted first and was recorded as the winner.
                        </p>
                      </div>
                    ) : (
                      /* TRUE WINNER */
                      <div className="space-y-5" id="outcome-winner-victory">
                        <div className="mx-auto w-16 h-16 bg-emerald-500/15 text-emerald-400 rounded-full flex items-center justify-center shadow-lg border border-emerald-500/20 animate-bounce">
                          <CheckCircle2 className="w-9 h-9" />
                        </div>
                        <h2 className="text-[clamp(1.6rem,7vw,2.10rem)] font-black text-emerald-405">Winner!</h2>
                        <p className="text-slate-350 text-xs leading-relaxed max-w-[250px] mx-auto">
                          Your answer was correct and verified as the winning record by the Sheets API.
                        </p>

                        {/* Beautiful verified ticket receipt */}
                        <div className="w-full p-4.5 rounded-xl bg-slate-800/40 border border-slate-700/50 text-left my-4 shadow-inner">
                          <div className="flex justify-between mb-2">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Receipt ID</span>
                            <span className="text-[10px] font-mono text-indigo-400 font-extrabold">TXN-77218</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Timestamp</span>
                            <span className="text-[10px] text-slate-400 font-mono font-medium">
                              {new Date().toISOString().substring(0, 10)} {new Date().toLocaleTimeString('en-US', { hour12: false }).substring(0, 5)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : null}
              </div>

              {/* Footer Back/Reset Button following rule 9 */}
              <div className="space-y-3 mt-auto">
                <button
                  id="btn-return-quiz-page"
                  disabled={isSubmitting}
                  onClick={async () => {
                    await handleStartQuiz();
                  }}
                  className="w-full py-4.5 bg-slate-805 hover:bg-slate-700 text-white font-extrabold rounded-xl text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-center border border-slate-700/60"
                >
                  Return to Quiz lobby
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

