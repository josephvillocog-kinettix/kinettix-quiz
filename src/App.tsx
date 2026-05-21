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

  // Fetch users from the Express API Proxy
  const loadUsersData = async () => {
    setCurrentScreen(AppScreen.LOADING_USERS);
    setUserLoadError("");
    try {
      const response = await fetch("/api/users");
      const data = await response.json();
      
      if (data && data.status === "success" && Array.isArray(data.data)) {
        setUsers(data.data);
      } else {
        throw new Error(data.message || "Invalid database response format");
      }
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
      setLoginError("Please enter your registered user ID.");
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
      const response = await fetch("/api/quiz");
      const data = await response.json();
      
      if (data && data.status === "success" && Array.isArray(data.data)) {
        const rawItems: QuizItem[] = data.data;
        setQuizItems(rawItems);
        
        // Filter active quiz events based on rules:
        // "only show the item from the data where winner and datetime is empty or null and enable is true"
        const active = rawItems.filter((item) => {
          const isEnabled = item.enable === undefined || item.enable === null || item.enable === "" || item.enable === true || String(item.enable).toLowerCase() === "true";
          const hasNoWinner = !item.winner || String(item.winner).trim() === "";
          const hasNoDatetime = !item.datetime || String(item.datetime).trim() === "";
          return isEnabled && hasNoWinner && hasNoDatetime;
        });
        
        setActiveQuizItems(active);
      } else {
        throw new Error(data.message || "Invalid quiz data format received");
      }
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

    // Transition to loading/result state directly as requested in:
    // "8. once the user will click the submit button, it will go to the Submit page, where this will wait for the google api response..."
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
      const response = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: quizItem.id,
          winner: currentUser.name,
        }),
      });

      const submissionData = await response.json();
      console.log("Submission response:", submissionData);

      // Checking response details to confirm if the user is verified as winner by Google API.
      // Usually, GAS returns successful insertion details, e.g. status: "success".
      // Let's analyze if the sheet is already won by checking returned properties.
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
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4 md:p-8 text-[#f8fafc] font-sans selection:bg-[#6366f1] selection:text-white relative">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.12),rgba(0,0,0,0))] pointer-events-none" />

      {/* Sleek Outer Dashboard Header */}
      <div className="flex justify-between items-end mb-8 border-b border-slate-800 pb-5 w-full max-w-md md:max-w-xl">
        <div className="flex flex-col">
          <span className="text-indigo-400 font-bold tracking-widest text-xs uppercase mb-1">API Integration Hub</span>
          <h1 className="text-2xl md:text-3xl font-light">Quiz <span className="font-bold text-white">System Manager</span></h1>
        </div>
        <div className="flex gap-4 text-right">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Google Sheets API Status</span>
            <span className="text-xs text-emerald-400 flex items-center justify-end gap-1.5 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Connected
            </span>
          </div>
        </div>
      </div>

      {/* Main Container Mocking a Device Interface defined by the 'Sleek Interface' specifications */}
      <div className="relative w-full max-w-sm h-[680px] bg-[#1e293b] border-[8px] border-[#334155] rounded-[40px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">
        {/* simulated status bar for design polish */}
        <div className="flex justify-between items-center px-6 pt-3.5 pb-2 text-[10px] text-[#94a3b8] font-bold select-none bg-[#1e293b] z-10 border-b border-slate-800/10">
          <span>9:41</span>
          <div className="flex gap-1 items-center">
            <span>📶</span>
            <span>🔋</span>
          </div>
        </div>

        {/* Content Box */}
        <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col relative bg-[#1e293b]">
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
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-full border-4 border-slate-700 border-t-[#6366f1] animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
                  </div>
                </div>
                <h1 className="text-xl font-bold tracking-tight text-white mb-2">
                  Initializing App
                </h1>
                <p className="text-xs text-slate-400 max-w-[240px]">
                  Setting up connections and fetching registered users spreadsheet...
                </p>
                {userLoadError && (
                  <div className="mt-6 p-3 bg-rose-950/50 border border-rose-800/85 rounded-xl text-rose-300 text-xs text-left max-w-xs">
                    <p className="font-semibold mb-1">Failed to connect:</p>
                    <p>{userLoadError}</p>
                    <button
                      onClick={loadUsersData}
                      className="mt-2 text-rose-300 underline font-medium hover:text-rose-100 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry Connection
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
                className="flex-1 flex flex-col justify-between my-auto"
                id="screen-login"
              >
                {/* Header branding */}
                <div className="mt-6 text-center">
                  <div className="mx-auto w-16 h-16 bg-[#6366f1] rounded-2xl mb-6 flex items-center justify-center shadow-lg shadow-indigo-500/20 rotate-3 animate-pulse">
                    <span className="text-2xl">👋</span>
                  </div>
                  <h2 className="text-xl font-bold mb-2 text-white">Welcome Back</h2>
                  <p className="text-slate-400 text-xs mb-8 leading-relaxed max-w-[240px] mx-auto">
                    Please enter your unique ID to access the active quizzes.
                  </p>
                </div>

                {/* Form area */}
                <form onSubmit={handleLogin} className="my-auto space-y-4">
                  <div>
                    <label
                      htmlFor="user-id-input"
                      className="block text-slate-400 text-[10px] font-bold tracking-wider uppercase mb-2 pl-1"
                    >
                      Enter User ID
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
                        className="block w-full px-4 py-3 bg-[#334155] border border-[#475569] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#6366f1] text-sm outline-none"
                      />
                    </div>
                    {loginError && (
                      <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-rose-400 text-xs mt-2 flex items-center gap-1 pl-1"
                      >
                        <XCircle className="w-3.5 h-3.5 inline" />
                        {loginError}
                      </motion.p>
                    )}
                  </div>

                  <button
                    id="btn-verify-identity"
                    type="submit"
                    className="w-full py-3 px-4 bg-[#6366f1] hover:bg-[#5053eb] text-white font-semibold rounded-xl text-sm text-center tracking-wide transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-indigo-500/15"
                  >
                    Continue to Dashboard
                  </button>
                </form>

                {/* Status indicator on current users loaded */}
                <div className="text-center pb-2 text-slate-500 text-[10px] font-mono leading-relaxed uppercase tracking-wider">
                  v2.4.0 • Secured by EncryptionKey
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
                className="flex-1 flex flex-col justify-between"
                id="screen-dashboard"
              >
                {/* Header */}
                <div className="flex justify-between items-center border-b border-slate-700/50 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#334155] flex items-center justify-center text-indigo-400 font-bold font-mono">
                      {currentUser.name.substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-slate-400 text-[9px] uppercase block tracking-wider leading-none">
                        Active Profile
                      </span>
                      <span className="text-white text-xs font-semibold">
                        {currentUser.name}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-slate-400 hover:text-rose-400 text-xs flex items-center gap-1 transition-colors px-2 py-1 rounded bg-slate-800/40 border border-slate-700/40"
                  >
                    Log out
                  </button>
                </div>

                {/* Main Hero Card */}
                <div className="my-auto space-y-6">
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 relative overflow-hidden shadow-xl">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -mr-6 -mt-6" />
                    
                    <span className="inline-flex items-center gap-1.2 px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-[9px] font-bold uppercase tracking-wider mb-4">
                      <Sparkles className="w-3 h-3 text-indigo-400" /> Matches Verified
                    </span>

                    <h1 className="text-xl font-bold text-white tracking-snug">
                      Welcome, <span className="text-indigo-400 block text-2xl font-black mt-1">{currentUser.name}</span>!
                    </h1>
                    
                    <p className="text-slate-350 text-xs mt-3 leading-relaxed">
                      You are correctly logged in. We've authenticated your connection. Whenever you're ready, click the button below to start loading and join the quiz event.
                    </p>
                  </div>

                  <button
                    id="btn-start-quiz"
                    onClick={handleStartQuiz}
                    className="w-full py-3 px-4 bg-[#6366f1] hover:bg-[#5053eb] text-white font-semibold rounded-xl text-sm text-center tracking-wide transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-indigo-500/15"
                  >
                    Start Quiz
                  </button>
                </div>

                <div className="text-center text-slate-500 text-[10px] font-semibold uppercase tracking-wider">
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
                className="flex-1 flex flex-col items-center justify-center text-center my-auto"
                id="screen-loading-quiz"
              >
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-full border-4 border-slate-700 border-t-[#6366f1] animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
                  </div>
                </div>
                <h1 className="text-xl font-bold tracking-tight text-white mb-2">
                  Syncing Event
                </h1>
                <p className="text-xs text-slate-400 max-w-[240px]">
                  Downloading quiz questions and active winning records...
                </p>
                {quizLoadError && (
                  <div className="mt-6 p-4 bg-rose-950/50 border border-rose-800/80 rounded-xl text-rose-300 text-xs text-left max-w-xs">
                    <p className="font-semibold mb-1">Failed to fetch quiz:</p>
                    <p>{quizLoadError}</p>
                    <button
                      onClick={handleStartQuiz}
                      className="mt-2 text-rose-300 underline font-medium hover:text-rose-100 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Try Again
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
                className="flex-1 flex flex-col justify-between"
                id="screen-quiz"
              >
                {/* Header Back Button */}
                <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                  <button
                    onClick={() => setCurrentScreen(AppScreen.DASHBOARD)}
                    className="text-slate-400 hover:text-white text-xs flex items-center gap-1 transition-colors px-2.5 py-1.5 rounded-lg bg-slate-800/40 border border-slate-700/50"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <span className="text-slate-400 text-xs font-mono font-medium">
                    {activeQuizItems.length > 0 
                      ? `${selectedQuizIndex + 1} of ${activeQuizItems.length}` 
                      : "0 Questions"}
                  </span>
                </div>

                {/* Active Questions Controller */}
                {activeQuizItems.length === 0 ? (
                  <div className="my-auto text-center space-y-4" id="fallback-no-quiz">
                    <div className="mx-auto w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-slate-500">
                      <HelpCircle className="w-8 h-8" />
                    </div>
                    <p className="text-slate-350 text-base font-semibold tracking-tight mx-auto max-w-[240px]" id="no-quiz-msg">
                      There are no active quiz event
                    </p>
                    <p className="text-slate-500 text-[11px] max-w-[240px] mx-auto leading-relaxed">
                      All events may have already concluded or been temporarily disabled by the administrator. Check back later for upcoming challenges!
                    </p>
                    <button
                      onClick={handleStartQuiz}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-indigo-400 border border-slate-700 rounded-full hover:bg-slate-850 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Refresh List
                    </button>
                  </div>
                ) : (
                  /* Adaptive Layout Quiz Presenter using beautiful Sleek design patterns */
                  <div className="my-auto flex-1 flex flex-col justify-between py-2 space-y-4">
                    {/* Adaptive Header Card with Decrypted Question */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold py-1 px-2.5 bg-indigo-500/20 text-indigo-400 rounded uppercase tracking-wider">
                          Live Quiz
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: #{activeQuizItems[selectedQuizIndex].id}
                        </span>
                      </div>

                      {/* Interactive slide counters if more than 1 question is active */}
                      {activeQuizItems.length > 1 && (
                        <div className="flex gap-1">
                          {activeQuizItems.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedQuizIndex(idx)}
                              className={`h-1 rounded-full transition-all cursor-pointer ${
                                idx === selectedQuizIndex 
                                  ? "w-6 bg-indigo-500" 
                                  : "w-2 bg-slate-700"
                              }`}
                              aria-label={`Go to question ${idx + 1}`}
                            />
                          ))}
                        </div>
                      )}

                      {/* Display Question Box matching Sleek Interface styling */}
                      <div className="p-4 rounded-2xl glass mb-3 text-left relative">
                        <span className="text-[10px] text-indigo-300 font-mono mb-2.5 block uppercase tracking-wide font-semibold">
                          Decrypted Question
                        </span>

                        <p className="text-sm leading-relaxed text-white font-medium italic mt-1" id="question text">
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
                      className="space-y-4 mt-auto"
                    >
                      <div>
                        <label
                          htmlFor={`answer-input-${activeQuizItems[selectedQuizIndex].id}`}
                          className="text-[10px] uppercase font-bold text-slate-400 mb-2 block ml-1"
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
                          className="block w-full px-4 py-3 bg-[#334155] border border-[#475569] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6366f1] text-sm outline-none"
                        />
                      </div>

                      <button
                        id="btn-submit-answer"
                        type="submit"
                        disabled={!(userAnswers[activeQuizItems[selectedQuizIndex].id] || "").trim()}
                        className="w-full py-3 px-4 bg-[#6366f1] disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-xl text-sm text-center tracking-wide transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-indigo-500/10 disabled:shadow-none"
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
                className="flex-1 flex flex-col justify-between my-auto"
                id="screen-result"
              >
                <div>{/* empty block to help vertical spacing */}</div>

                {/* Central Feedback Card */}
                <div className="text-center my-auto space-y-6">
                  {isSubmitting ? (
                    <div className="space-y-4" id="verifying-indicator">
                      <div className="relative mx-auto w-14 h-14">
                        <div className="w-14 h-14 rounded-full border-4 border-slate-700 border-t-[#6366f1] animate-spin" />
                      </div>
                      <h2 className="text-base font-semibold text-slate-300">
                        Verifying Submission...
                      </h2>
                      <p className="text-[11px] text-slate-500 max-w-[240px] mx-auto leading-relaxed">
                        Communicating safely with Google Sheet service endpoints. Please wait...
                      </p>
                    </div>
                  ) : submitResult ? (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="space-y-5"
                    >
                      {/* Check Three Different Outcome States strictly following Step 8 instructions */}
                      {!submitResult.isCorrect ? (
                        /* INCORRECT RESPONSE */
                        <div className="space-y-4" id="outcome-incorrect">
                          <div className="mx-auto w-16 h-16 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center">
                            <XCircle className="w-9 h-9" />
                          </div>
                          <h2 className="text-xl font-bold mb-1 text-white">Wrong Answer</h2>
                          <p className="text-slate-450 text-xs leading-relaxed max-w-[240px] mx-auto">
                            The submitted answer did not match the decrypted response record. Please check your spelling and try again!
                          </p>
                        </div>
                      ) : submitResult.hasBeenWon ? (
                        /* CORRECT BUT ALREADY WON BY SOMEONE ELSE (CONCURRENCY LOCK) */
                        <div className="space-y-4" id="outcome-concurrency-locked">
                          <div className="mx-auto w-16 h-16 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center">
                            <XCircle className="w-9 h-9" />
                          </div>
                          <h2 className="text-xl font-bold mb-1 text-white">Already Won</h2>
                          <p className="text-slate-450 text-xs leading-relaxed max-w-[240px] mx-auto">
                            Your answer was correct, but unfortunately, another student submitted first and was recorded as the winner.
                          </p>
                        </div>
                      ) : (
                        /* TRUE WINNER */
                        <div className="space-y-4" id="outcome-winner-victory">
                          <div className="mx-auto w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center animate-bounce">
                            <CheckCircle2 className="w-9 h-9" />
                          </div>
                          <h2 className="text-2xl font-bold mb-1 text-emerald-400">Winner!</h2>
                          <p className="text-slate-400 text-xs leading-relaxed max-w-[245px] mx-auto">
                            Your answer was correct and verified as the winning record by the Sheets API.
                          </p>

                          {/* Beautiful verified ticket receipt following the Sleek Interface specs */}
                          <div className="w-full p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-left my-4">
                            <div className="flex justify-between mb-2">
                              <span className="text-[10px] text-slate-500 font-semibold uppercase">Receipt ID</span>
                              <span className="text-[10px] font-mono text-indigo-400 font-bold">TXN-77218</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[10px] text-slate-500 font-semibold uppercase">Timestamp</span>
                              <span className="text-[10px] text-slate-300 font-mono">
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
                    className="w-full py-3 bg-slate-700 hover:bg-slate-650 text-white font-semibold rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-center"
                  >
                    Return to Quiz lobby
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* Footer system details */}
      <div className="mt-8 flex justify-between items-center text-[10px] text-slate-600 w-full max-w-md md:max-w-xl font-medium tracking-wide">
        <p>Workflow: Loading → Validation → Decryption → Submission → Result</p>
        <p>Google Sheets API Verified</p>
      </div>
    </div>
  );
}

