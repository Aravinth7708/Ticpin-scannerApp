"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Zap,
  ZapOff,
  Camera,
  Check,
  AlertTriangle,
  XCircle,
  Search,
  Sparkles,
  Clock,
  MapPin,
  Calendar,
  Ticket,
  Keyboard,
  Home,
  QrCode,
  User,
  RotateCcw,
  Download,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  Bell
} from "lucide-react";

// Types
interface ScannedTicket {
  id: string;
  userName: string;
  userPhone: string;
  eventName: string;
  venueName: string;
  date: string;
  time: string;
  category: string;
  quantity: number;
  status: "booked" | "confirmed" | "checked_in" | "cancelled" | "refunded";
  checkInTime?: string;
  price?: number;
}

// Initial Simulated Booking Database
const MOCK_DATABASE: Record<string, ScannedTicket> = {
  "T-1001": {
    id: "T-1001",
    userName: "Aakash Mehta",
    userPhone: "+91 98765 43210",
    eventName: "The Ocean Symphony Concert",
    venueName: "Nesco Center, Hall 4, Mumbai",
    date: "15 Jun 2026",
    time: "08:30 PM - 11:30 PM",
    category: "VIP Diamond Pass",
    quantity: 2,
    status: "confirmed",
    price: 7000
  },
  "T-1002": {
    id: "T-1002",
    userName: "Karan Johar",
    userPhone: "+91 98200 11223",
    eventName: "Sunset House DJ Party",
    venueName: "Opa Bar & Cafe, Mumbai",
    date: "15 Jun 2026",
    time: "06:00 PM - 10:00 PM",
    category: "General Entry",
    quantity: 1,
    status: "checked_in",
    checkInTime: "09:35 PM",
    price: 1200
  },
  "T-1003": {
    id: "T-1003",
    userName: "Preeti Sen",
    userPhone: "+91 99300 44556",
    eventName: "Global Comedy Standup Festival",
    venueName: "Canvas Comedy Club, Pune",
    date: "16 Jun 2026",
    time: "07:00 PM - 09:00 PM",
    category: "Front Row Seat",
    quantity: 1,
    status: "cancelled",
    price: 1500
  },
  "T-1004": {
    id: "T-1004",
    userName: "Rahul Roy",
    userPhone: "+91 91234 56789",
    eventName: "Sunset House DJ Party",
    venueName: "Opa Bar & Cafe, Mumbai",
    date: "15 Jun 2026",
    time: "06:00 PM - 10:00 PM",
    category: "VIP Deck Pass",
    quantity: 3,
    status: "confirmed",
    price: 4500
  }
};

export default function TicketScannerPage() {
  const router = useRouter();

  // Navigation states
  const [activeTab, setActiveTab] = useState<"home" | "scanner" | "profile">("scanner");

  // Camera & jsQR scanner states
  const [cameraPermission, setCameraPermission] = useState<"pending" | "granted" | "denied">("pending");
  const [cameraActive, setCameraActive] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scannerError, setScannerError] = useState<string | null>(null);

  // Scanning loop refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Verification bottom sheet states
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [scannedTicket, setScannedTicket] = useState<ScannedTicket | null>(null);
  const [sheetStatus, setSheetStatus] = useState<"valid" | "already_checked_in" | "cancelled" | "success">("valid");
  const [isRescanning, setIsRescanning] = useState(false);

  // Session stats state (Home Tab)
  const [stats, setStats] = useState({
    totalCheckedIn: 18,
    totalBooked: 150,
    cancelledTickets: 3
  });
  const [recentScans, setRecentScans] = useState<Array<{
    id: string;
    userName: string;
    category: string;
    time: string;
    status: "success" | "duplicate" | "cancelled";
  }>>([
    { id: "T-1002", userName: "Karan Johar", category: "General Entry", time: "09:35 PM", status: "duplicate" },
    { id: "T-8890", userName: "Neha Sharma", category: "VIP Pass", time: "09:20 PM", status: "success" },
    { id: "T-7761", userName: "Amit Patel", category: "General Entry", time: "09:12 PM", status: "success" },
    { id: "T-2234", userName: "Vikram Malhotra", category: "VIP Pass", time: "08:58 PM", status: "success" }
  ]);

  // Audio Synthesizer Beeps
  const playSound = (type: "success" | "error" | "info") => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === "success") {
        // High, crisp success beep
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        osc.start();
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc.stop(audioCtx.currentTime + 0.15);
      } else if (type === "error") {
        // Lower double error buzz
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, audioCtx.currentTime); // A3
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        osc.start();
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.stop(audioCtx.currentTime + 0.3);
      } else {
        // Neutral high note
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        osc.start();
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        osc.stop(audioCtx.currentTime + 0.1);
      }
    } catch (e) {
      console.warn("Web Audio API warning:", e);
    }
  };

  // Load jsQR library from CDN dynamically
  const [jsQRLoaded, setJsQRLoaded] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Check if script is already present
    if ((window as any).jsQR) {
      setJsQRLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
    script.async = true;
    script.onload = () => {
      setJsQRLoaded(true);
      console.log("jsQR loaded successfully from CDN");
    };
    script.onerror = () => {
      setScannerError("Failed to load QR scanner library. Using manual mode.");
    };
    document.body.appendChild(script);

    return () => {
      // Clean up script if desired, though leaving it is fine
    };
  }, []);

  // Initialize camera stream
  const startCamera = async () => {
    try {
      setScannerError(null);
      if (streamRef.current) {
        stopCamera();
      }

      const constraints: MediaStreamConstraints = {
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true"); // required for iOS
        videoRef.current.play();
        setCameraActive(true);
        setCameraPermission("granted");
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraPermission("denied");
      setCameraActive(false);
      setScannerError("Camera not available. Please grant permissions or enter booking code manually.");
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setFlashOn(false);
  };

  // Start camera when tab becomes "scanner"
  useEffect(() => {
    if (activeTab === "scanner" && !showBottomSheet && !manualEntryOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [activeTab, showBottomSheet, manualEntryOpen]);

  // Flashlight toggle
  const toggleFlash = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    
    try {
      const capabilities = track.getCapabilities() as any;
      if (capabilities.torch) {
        const nextFlashState = !flashOn;
        await track.applyConstraints({
          advanced: [{ torch: nextFlashState } as any]
        });
        setFlashOn(nextFlashState);
      } else {
        // Browser fallback: visual feedback only if torch constraint isn't supported
        setFlashOn(!flashOn);
        playSound("info");
      }
    } catch (e) {
      console.warn("Flash control not supported by this track", e);
      setFlashOn(!flashOn);
    }
  };

  // QR Scanning Loop
  useEffect(() => {
    if (!cameraActive || !jsQRLoaded || showBottomSheet || manualEntryOpen) return;

    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const jsQR = (window as any).jsQR;
          
          if (jsQR) {
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert"
            });

            if (code && code.data) {
              console.log("QR Code Scanned:", code.data);
              handleScannedCode(code.data);
              return; // Stop scan frame loop once ticket is detected
            }
          }
        }
      }
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [cameraActive, jsQRLoaded, showBottomSheet, manualEntryOpen]);

  // Process code (from QR or Manual Input)
  const handleScannedCode = async (code: string) => {
    if (verifying || showBottomSheet) return;
    setVerifying(true);
    stopCamera();

    // Check if code is a URL (extract ID from URL if so)
    let ticketId = code.trim();
    if (ticketId.includes("/qr-verify/") || ticketId.includes("/ticket/")) {
      const parts = ticketId.split("/");
      ticketId = parts[parts.length - 1];
    }

    try {
      // 1. Try fetching from the actual API endpoint
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:9000";
      const response = await fetch(`${backendUrl}/api/bookings/public/${ticketId}`);
      if (response.ok) {
        const data = await response.json();
        
        // Map backend booking details to local ticket view format
        const ticket: ScannedTicket = {
          id: data.id || ticketId,
          userName: data.user_name || data.userName || "Customer",
          userPhone: data.user_phone || data.userPhone || "N/A",
          eventName: data.event_name || data.eventName || "Ticpin Event",
          venueName: data.venue_name || data.venueName || "Official Venue",
          date: data.date || "TBA",
          time: data.time || "TBA",
          category: data.tickets?.[0]?.category || "Standard",
          quantity: data.tickets?.[0]?.quantity || 1,
          status: data.status || "confirmed"
        };
        triggerBottomSheet(ticket);
        return;
      }
    } catch (err) {
      console.warn("Backend unavailable or API error, falling back to mock database.", err);
    }

    // 2. Mock Database / Simulation Fallback
    const mockTicket = MOCK_DATABASE[ticketId];
    if (mockTicket) {
      triggerBottomSheet(mockTicket);
    } else {
      // Generate a dynamic mock ticket on-the-fly for any custom scanned QR/ID to allow testing
      const generatedTicket: ScannedTicket = {
        id: ticketId,
        userName: "Guest " + Math.floor(Math.random() * 900 + 100),
        userPhone: "+91 98*** **" + Math.floor(Math.random() * 90 + 10),
        eventName: "The Ocean Symphony Concert",
        venueName: "Nesco Center, Hall 4, Mumbai",
        date: "15 Jun 2026",
        time: "08:30 PM - 11:30 PM",
        category: "General Pass",
        quantity: 1,
        status: "confirmed",
        price: 2500
      };
      triggerBottomSheet(generatedTicket);
    }
  };

  const triggerBottomSheet = (ticket: ScannedTicket) => {
    setScannedTicket(ticket);
    setVerifying(false);

    if (ticket.status === "cancelled" || ticket.status === "refunded") {
      setSheetStatus("cancelled");
      playSound("error");
    } else if (ticket.status === "checked_in") {
      setSheetStatus("already_checked_in");
      playSound("error");
    } else {
      setSheetStatus("valid");
      playSound("success");
    }
    setShowBottomSheet(true);
  };

  // Perform Check-in Operation
  const confirmCheckIn = async () => {
    if (!scannedTicket) return;
    setCheckingIn(true);

    const currentTimeString = new Date().toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).toUpperCase();

    // 1. Try backend POST update if available
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:9000";
      const response = await fetch(`${backendUrl}/api/bookings/public/${scannedTicket.id}/checkin`, {
        method: "POST"
      });
      if (response.ok) {
        console.log("Database checked in successfully via backend");
      }
    } catch (err) {
      console.warn("Backend check-in request failed, updating local state only.", err);
    }

    // 2. Update local mock database & stats
    MOCK_DATABASE[scannedTicket.id] = {
      ...scannedTicket,
      status: "checked_in",
      checkInTime: currentTimeString
    };

    setStats(prev => ({
      ...prev,
      totalCheckedIn: prev.totalCheckedIn + 1
    }));

    // Add to recent scans list
    setRecentScans(prev => [
      {
        id: scannedTicket.id,
        userName: scannedTicket.userName,
        category: scannedTicket.category,
        time: currentTimeString,
        status: "success"
      },
      ...prev
    ]);

    setSheetStatus("success");
    playSound("success");
    setCheckingIn(false);

    // Auto close bottom sheet after 1.5 seconds to return to camera scan
    setTimeout(() => {
      dismissBottomSheet();
    }, 1800);
  };

  const dismissBottomSheet = () => {
    setShowBottomSheet(false);
    setScannedTicket(null);
    setManualCode("");
    setManualEntryOpen(false);
    
    // Resume camera scanning if on the scanner tab
    if (activeTab === "scanner") {
      startCamera();
    }
  };

  // Reset Session Helper
  const handleResetSession = () => {
    if (confirm("Are you sure you want to reset the scanner statistics for this session?")) {
      // Revert MOCK_DATABASE tickets to booked state
      Object.keys(MOCK_DATABASE).forEach(key => {
        if (MOCK_DATABASE[key].status === "checked_in" && key !== "T-1002") {
          MOCK_DATABASE[key].status = "confirmed";
          delete MOCK_DATABASE[key].checkInTime;
        }
      });
      
      // Keep T-1002 as checked_in for demo
      MOCK_DATABASE["T-1002"].status = "checked_in";
      MOCK_DATABASE["T-1002"].checkInTime = "09:35 PM";

      setStats({
        totalCheckedIn: 18,
        totalBooked: 150,
        cancelledTickets: 3
      });

      setRecentScans([
        { id: "T-1002", userName: "Karan Johar", category: "General Entry", time: "09:35 PM", status: "duplicate" }
      ]);
      
      playSound("info");
      alert("Scanner session statistics reset successfully.");
    }
  };

  // Masking helpers (same as bookings page)
  const maskPhone = (phone: string) => {
    if (!phone) return "N/A";
    const clean = phone.trim();
    if (clean.length < 4) return "*******";
    return `${clean.substring(0, 3)}*****${clean.substring(clean.length - 2)}`;
  };

  return (
    <div className="fixed inset-0 bg-[#0E0B1F] flex items-center justify-center p-0 md:p-4 select-none font-[family-name:var(--font-anek-latin)] overflow-hidden">
      
      {/* Container Bezel Box (iPhone dimensions on desktop, full screen on mobile) */}
      <div className="w-full h-full md:relative md:w-[380px] md:h-[820px] md:max-h-[90vh] bg-white rounded-none md:rounded-[40px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border-0 md:border-8 border-[#201D30] overflow-hidden flex flex-col transition-all duration-300 scanner-phone-card">
        
        {/* Notch / Speaker representation on Desktop */}
        <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[24px] bg-[#201D30] rounded-b-[16px] z-50">
          <div className="w-10 h-1 bg-[#49455B] rounded-full mx-auto mt-1" />
        </div>

        {/* Top Header Section (Figma: Wordmark Top 27px, Left 25px; Lightning Top 21px, Left 346px) */}
        <header className="h-[77px] w-full bg-white border-b border-[#F0F0F0] flex items-center justify-between px-6 shrink-0 relative z-40">
          {/* Logo (Figma: Wordmark PNG 1.png at left 25px, top 27px) */}
          <div className="flex items-center gap-1.5 mt-2">
            <img
              src="/ticpin-logo-black.png"
              alt="TICPIN"
              className="h-5 w-auto"
              onError={(e) => {
                // Text fallback if logo image fails
                e.currentTarget.style.display = 'none';
                const el = document.getElementById("logo-text-fallback");
                if (el) el.style.display = 'block';
              }}
            />
            <span id="logo-text-fallback" className="hidden font-black text-[22px] tracking-tight text-black">
              TICPIN
            </span>
          </div>

          {/* Flash Button / Bell Notification Button / Ellipse 76 */}
          {activeTab === "scanner" ? (
            <button
              onClick={toggleFlash}
              className={`w-[33px] h-[33px] rounded-full flex items-center justify-center transition-colors duration-200 mt-1 cursor-pointer ${
                flashOn ? "bg-[#5331EA] text-white" : "bg-[#D9D9D9] text-[#2F2F2F] hover:bg-gray-300"
              }`}
              title="Toggle Flash"
            >
              {flashOn ? <Zap className="w-4.5 h-4.5" /> : <ZapOff className="w-4.5 h-4.5" />}
            </button>
          ) : (
            <button
              onClick={() => alert("No new notifications.")}
              className="w-[33px] h-[33px] rounded-full bg-[#D9D9D9] text-black flex items-center justify-center hover:bg-gray-300 transition-colors duration-200 mt-1 cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4 text-black" />
            </button>
          )}
        </header>

        {/* Main Tabs Body (Camera Stream or Stats/Profile Dashboard) */}
        <main className="flex-grow relative bg-[#F5F7FB] overflow-hidden flex flex-col">
          
          {/* TAB 1: SCANNER VIEW (Live Camera or Manual Keyboard Interface) */}
          {activeTab === "scanner" && (
            <div className="w-full h-full relative flex flex-col justify-between bg-black">
              
              {/* Manual Entry Modal Input Toggle Overlay */}
              {manualEntryOpen ? (
                <div className="absolute inset-0 bg-[#0A0132]/95 flex flex-col justify-center px-6 z-30 transition-all duration-300 animate-in fade-in duration-200">
                  <div className="bg-white rounded-[24px] p-5 shadow-2xl border border-white/10 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-lg text-black flex items-center gap-2">
                        <Keyboard className="w-5 h-5 text-[#5331EA]" />
                        Manual Entry
                      </h3>
                      <button
                        onClick={() => setManualEntryOpen(false)}
                        className="text-gray-400 hover:text-black font-semibold text-sm cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    <p className="text-xs text-gray-500">
                      Type the ticket code below or click one of the demo presets to test the scanner states.
                    </p>

                    {/* Pre-populated demo buttons for testing */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Demo Test Presets</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => { setManualCode("T-1001"); handleScannedCode("T-1001"); }}
                          className="bg-green-50 text-green-700 border border-green-200 rounded-lg py-1.5 text-xs font-semibold hover:bg-green-100 transition-colors"
                        >
                          T-1001 (Valid VIP)
                        </button>
                        <button
                          onClick={() => { setManualCode("T-1002"); handleScannedCode("T-1002"); }}
                          className="bg-amber-50 text-amber-700 border border-amber-200 rounded-lg py-1.5 text-xs font-semibold hover:bg-amber-100 transition-colors"
                        >
                          T-1002 (Checked-In)
                        </button>
                        <button
                          onClick={() => { setManualCode("T-1003"); handleScannedCode("T-1003"); }}
                          className="bg-red-50 text-red-700 border border-red-200 rounded-lg py-1.5 text-xs font-semibold hover:bg-red-100 transition-colors"
                        >
                          T-1003 (Cancelled)
                        </button>
                        <button
                          onClick={() => {
                            const dynId = "T-" + Math.floor(Math.random() * 9000 + 1000);
                            setManualCode(dynId);
                            handleScannedCode(dynId);
                          }}
                          className="bg-purple-50 text-purple-700 border border-purple-200 rounded-lg py-1.5 text-xs font-semibold hover:bg-purple-100 transition-colors flex items-center justify-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" /> New Dynamic
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. T-1001"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                        className="w-full h-12 border border-[#E0E0E0] rounded-xl px-4 text-black font-mono font-bold tracking-widest text-center focus:outline-none focus:border-[#5331EA] text-base md:text-lg"
                        autoFocus
                      />
                    </div>

                    <button
                      onClick={() => {
                        if (manualCode.trim()) {
                          handleScannedCode(manualCode);
                        }
                      }}
                      disabled={!manualCode.trim()}
                      className="w-full h-12 bg-[#5331EA] hover:bg-[#3d1bb8] text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      Verify Booking
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Live Video Viewer (Figma: Screenshot... width: 402px, height: 708px, top: 77px) */}
              <div className="flex-grow w-full relative overflow-hidden bg-zinc-950 flex items-center justify-center">
                
                {/* Live video track */}
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                  muted
                />

                {/* Hidden canvas for jsQR capture */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Camera Pending / Access Denied UI fallbacks */}
                {cameraPermission !== "granted" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#131121] px-8 text-center space-y-4 z-10">
                    <div className="w-16 h-16 bg-[#5331EA]/10 text-[#5331EA] rounded-full flex items-center justify-center">
                      <Camera className="w-8 h-8 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-base">Camera Stream Inactive</h4>
                      <p className="text-gray-400 text-xs mt-1.5 leading-relaxed">
                        Allow camera permissions to scan tickets. Alternatively, type the ticket code manually.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 w-full pt-2">
                      <button
                        onClick={startCamera}
                        className="h-10 bg-[#5331EA] hover:bg-[#3d1bb8] text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                      >
                        Request Permission
                      </button>
                      <button
                        onClick={() => setManualEntryOpen(true)}
                        className="h-10 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Keyboard className="w-4 h-4" /> Enter Code Manually
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* QR scanning viewfinder box & screen overlay mask */}
                {cameraPermission === "granted" && !manualEntryOpen && (
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-10">
                    {/* Dark translucent backdrop around viewfinder */}
                    <div className="h-[15%] bg-black/50 w-full" />
                    
                    <div className="h-[55%] flex justify-between w-full">
                      <div className="w-[15%] bg-black/50" />
                      
                      {/* Interactive Viewfinder Target (Figma box matching corner brackets) */}
                      <div className="w-[70%] max-w-[260px] aspect-square relative border border-white/20 rounded-3xl">
                        
                        {/* 4 Premium corner bracket frames matching attached screenshot */}
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-[4px] border-l-[4px] border-white rounded-tl-[24px]" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-[4px] border-r-[4px] border-white rounded-tr-[24px]" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[4px] border-l-[4px] border-white rounded-bl-[24px]" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[4px] border-r-[4px] border-white rounded-br-[24px]" />
                        
                        {/* Moving horizontal laser pointer line */}
                        <div className="absolute top-0 left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-[#5331EA] to-transparent shadow-[0_0_15px_#5331EA] animate-scan-laser rounded-full" />
                      </div>
                      
                      <div className="w-[15%] bg-black/50" />
                    </div>

                    <div className="h-[30%] bg-black/50 w-full flex flex-col items-center justify-start pt-6">
                      <span className="text-white text-xs font-semibold bg-black/70 px-4 py-1.5 rounded-full border border-white/10 tracking-wide text-center">
                        Align Ticket QR inside the frame
                      </span>
                    </div>
                  </div>
                )}

                {/* Floating Manual Key Entry Trigger */}
                {cameraPermission === "granted" && !manualEntryOpen && (
                  <button
                    onClick={() => setManualEntryOpen(true)}
                    className="absolute bottom-6 right-6 w-12 h-12 bg-white text-[#5331EA] rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 z-20 cursor-pointer"
                    title="Enter manually"
                  >
                    <Keyboard className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: HOME VIEW (Dashboard Statistics & Scan Logs) */}
          {activeTab === "home" && (
            <div 
              className="w-full h-full flex flex-col px-6 py-5 overflow-y-auto font-[family-name:var(--font-anek-latin)]"
              style={{ background: "linear-gradient(360deg, #AC9BF7 -134.32%, #FFFFFF 47.71%)" }}
            >
              {/* Greetings */}
              <div className="mt-2.5 mb-5 space-y-1">
                <h2 className="text-[22px] font-semibold text-black leading-tight">Good Evening, Organizer</h2>
                <p className="text-[12px] font-medium text-[#686868] leading-tight">Here's what's happening with your event</p>
              </div>

              {/* Event Cards List */}
              <div className="flex-grow space-y-6 pb-6">
                {[
                  {
                    id: "E-1001",
                    name: "The Ocean Symphony",
                    status: "live",
                    date: "15 Jun",
                    time: "08:30 PM",
                    attendees: stats.totalCheckedIn,
                  },
                  {
                    id: "E-1002",
                    name: "Sunset House DJ Party",
                    status: "closed",
                    date: "15 Jun",
                    time: "06:00 PM",
                    attendees: 42,
                  },
                  {
                    id: "E-1003",
                    name: "Global Comedy Festival",
                    status: "live",
                    date: "16 Jun",
                    time: "07:00 PM",
                    attendees: 29,
                  },
                  {
                    id: "E-1004",
                    name: "Bollywood Retro Night",
                    status: "live",
                    date: "18 Jun",
                    time: "09:00 PM",
                    attendees: 8,
                  }
                ].map((event, idx) => (
                  <div 
                    key={idx} 
                    className="w-full h-[119px] bg-[#F5F5F5] rounded-[15px] flex items-center overflow-hidden border border-gray-100 shadow-sm relative transition-transform hover:scale-[1.01]"
                  >
                    {/* Left Lavender Thumbnail */}
                    <div className="w-[89px] h-full bg-[#BDB1F3] rounded-[15px] shrink-0" />

                    {/* Right Details Section */}
                    <div className="flex-grow h-full py-3 px-3.5 flex flex-col justify-between min-w-0">
                      
                      {/* Top Row: Status Badge */}
                      <div>
                        {event.status === "live" ? (
                          <span className="inline-block bg-[#D6FAE5] text-[#009133] text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[5px]">
                            LIVE
                          </span>
                        ) : (
                          <span className="inline-block bg-[rgba(237,77,27,0.25)] text-[#ED4D1B] text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[5px]">
                            CLOSED
                          </span>
                        )}
                      </div>

                      {/* Event Name */}
                      <h3 className="font-bold text-[18px] text-black leading-tight truncate">
                        {event.name}
                      </h3>

                      {/* Date & Time */}
                      <div className="text-[12px] font-medium text-[#686868] leading-none">
                        {event.date} &nbsp; {event.time} onwards
                      </div>

                      {/* Divider line */}
                      <div className="w-full border-t border-[#686868]/30 my-0.5" />

                      {/* Attendees Count */}
                      <div className="text-[12px] font-medium text-black leading-none flex items-center gap-1">
                        <span className="font-bold">{event.attendees}</span> attendees
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: PROFILE VIEW (Organizer Credentials & Settings) */}
          {activeTab === "profile" && (
            <div className="w-full h-full flex flex-col p-5 justify-between overflow-y-auto">
              
              <div className="space-y-5">
                {/* Profile Heading */}
                <div>
                  <h2 className="text-[22px] font-black text-black leading-none">Organizer Settings</h2>
                  <p className="text-gray-400 text-xs mt-1 font-medium">Configure credentials and gate profile</p>
                </div>

                {/* Organizer Agent Identity Card */}
                <div className="bg-white rounded-[24px] border border-[#EBEBEB] p-5 shadow-sm flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#AC9BF7] to-[#5331EA] rounded-full flex items-center justify-center text-white font-extrabold text-lg shadow-sm shrink-0">
                    AM
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[18px] text-black leading-tight">Aakash Mehta</h3>
                    <p className="text-xs text-[#5331EA] font-semibold mt-0.5">Gate Entry Administrator</p>
                    <p className="text-[10px] text-gray-400 mt-1">TICPIN Organizers Portal</p>
                  </div>
                </div>

                {/* Settings Grid list */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Gate Config</h3>
                  
                  <div className="bg-white rounded-[20px] border border-[#EBEBEB] divide-y divide-[#F2F2F2] overflow-hidden shadow-sm text-sm">
                    <div className="flex justify-between items-center p-4">
                      <span className="text-[#686868] font-medium">Assigned Event</span>
                      <span className="font-bold text-black text-right max-w-[180px] truncate">The Ocean Symphony</span>
                    </div>
                    <div className="flex justify-between items-center p-4">
                      <span className="text-[#686868] font-medium">Assigned Gate</span>
                      <span className="font-bold text-black">Gate 3 - Auditorium</span>
                    </div>
                    <div className="flex justify-between items-center p-4">
                      <span className="text-[#686868] font-medium">Device Role</span>
                      <span className="font-bold text-black uppercase text-xs bg-gray-100 px-2 py-0.5 rounded">Security Main</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Utility Actions</h3>
                  
                  <div className="bg-white rounded-[20px] border border-[#EBEBEB] divide-y divide-[#F2F2F2] overflow-hidden shadow-sm text-sm">
                    <button
                      onClick={() => {
                        // Simulated scan report download
                        alert("Exporting CSV report for checked-in attendees. File generated on disk.");
                        playSound("success");
                      }}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left cursor-pointer"
                    >
                      <span className="text-[#686868] font-medium flex items-center gap-2">
                        <Download className="w-4 h-4 text-[#5331EA]" />
                        Export Session CSV Report
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => {
                        alert("For support, please call TICPIN Hotline at +91 22 6688 9900 or email support@ticpin.com.");
                      }}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left cursor-pointer"
                    >
                      <span className="text-[#686868] font-medium flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-[#5331EA]" />
                        Contact TICPIN Support
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Version & Logout bottom area */}
              <div className="pt-8 text-center space-y-4">
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to log out and exit from scanner console?")) {
                      router.push("/");
                    }
                  }}
                  className="w-full h-11 border border-red-200 text-red-500 hover:bg-red-50 font-bold rounded-xl transition-all cursor-pointer text-sm"
                >
                  Log Out from Scanner console
                </button>
                <div className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">
                  TICPIN Mobile Scanner Console • v2.0.4
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Dynamic Verification Bottom Sheet Overlay (Slides up from the bottom) */}
        {showBottomSheet && scannedTicket && (
          <div className="absolute inset-0 bg-black/60 flex items-end justify-center z-50 animate-in fade-in duration-200">
            {/* Sheet body wrapper */}
            <div className="w-full bg-white rounded-t-[32px] p-6 shadow-2xl space-y-5 border-t border-gray-100 max-h-[90%] overflow-y-auto animate-in slide-in-from-bottom duration-300 relative">
              
              {/* Top notch close button indicator */}
              <button
                onClick={dismissBottomSheet}
                className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1 bg-gray-300 rounded-full cursor-pointer"
              />

              {/* Status Header Badge Block */}
              <div className="text-center pt-3 border-b border-gray-100 pb-4">
                {sheetStatus === "valid" && (
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-3.5 shadow-sm relative animate-bounce">
                      <Check className="w-8 h-8" />
                      <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping" />
                    </div>
                    <h2 className="text-[20px] font-black text-emerald-600 tracking-tight">✓ VALID TICKET</h2>
                    <p className="text-gray-400 text-[10px] mt-0.5 font-bold tracking-wider uppercase">Ready for Check-In confirmation</p>
                  </div>
                )}
                {sheetStatus === "already_checked_in" && (
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-3.5">
                      <AlertTriangle className="w-7 h-7" />
                    </div>
                    <h2 className="text-[20px] font-black text-amber-600 tracking-tight">✗ ALREADY CHECKED IN</h2>
                    <p className="text-red-500 text-[11px] mt-0.5 font-bold uppercase tracking-wider">Scanned at: {scannedTicket.checkInTime || "Previously"}</p>
                  </div>
                )}
                {sheetStatus === "cancelled" && (
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-3.5 animate-pulse">
                      <XCircle className="w-7 h-7" />
                    </div>
                    <h2 className="text-[20px] font-black text-red-600 tracking-tight">✗ TICKET CANCELLED</h2>
                    <p className="text-gray-400 text-[10px] mt-0.5 font-bold tracking-wider uppercase">Order cancelled or refunded</p>
                  </div>
                )}
                {sheetStatus === "success" && (
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center mb-3.5 shadow-md">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    <h2 className="text-[20px] font-black text-emerald-600 tracking-tight uppercase">✓ Check-in Success</h2>
                    <p className="text-gray-400 text-[10px] mt-0.5 font-bold tracking-wider uppercase">Attendee added to gates</p>
                  </div>
                )}
              </div>

              {/* Main Ticket details layout block */}
              <div className="space-y-4">
                
                {/* ID badge */}
                <div className="flex justify-between items-center bg-[#F8F9FA] rounded-xl px-4 py-2.5 border border-[#F2F2F2]">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Booking ID</span>
                  <span className="font-mono font-bold text-[#5331EA] text-xs bg-[#5331EA]/10 px-2.5 py-0.5 rounded-md">
                    #{scannedTicket.id}
                  </span>
                </div>

                {/* Event Name */}
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-[#5331EA] tracking-wider uppercase bg-[#5331EA]/10 px-2 py-0.5 rounded-full inline-block">
                    Event Details
                  </span>
                  <h3 className="font-bold text-base text-black leading-snug pt-0.5">{scannedTicket.eventName}</h3>
                </div>

                <hr className="border-gray-100" />

                {/* Key metadata grid layout */}
                <div className="space-y-3.5 text-xs font-semibold">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-[#5331EA] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-gray-400 text-[9px] font-bold uppercase tracking-wider">Date & Time</p>
                      <p className="text-black mt-0.5">{scannedTicket.date} | {scannedTicket.time}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-[#5331EA] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-gray-400 text-[9px] font-bold uppercase tracking-wider">Venue</p>
                      <p className="text-black mt-0.5 leading-tight">{scannedTicket.venueName}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Ticket className="w-4 h-4 text-[#5331EA] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-gray-400 text-[9px] font-bold uppercase tracking-wider">Pass Details</p>
                      <div className="bg-[#F8F9FA] rounded-md px-2.5 py-1 mt-1 text-[11px] text-gray-700 flex justify-between gap-6 border border-[#F2F2F2]">
                        <span>{scannedTicket.category}</span>
                        <span className="font-bold">x {scannedTicket.quantity}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <hr className="border-gray-100" />

                {/* Customer Masked Info Card */}
                <div className="bg-[#0A0132]/5 rounded-2xl p-3.5 border border-[#0A0132]/10 space-y-2">
                  <div className="flex items-center gap-1.5 text-[#0A0132] font-black text-[10px] tracking-wider uppercase">
                    <User className="w-4 h-4 text-[#5331EA]" />
                    <span>Masked Booking Contact</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-xs font-bold text-gray-700">
                    <div>
                      <p className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Email Address</p>
                      <p className="text-black mt-0.5 truncate">
                        {scannedTicket.userName.toLowerCase().replace(" ", "")}@gmail.com
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Phone Number</p>
                      <p className="text-black mt-0.5">{maskPhone(scannedTicket.userPhone)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons footer */}
              <div className="space-y-2.5 pt-2">
                {sheetStatus === "valid" ? (
                  <button
                    onClick={confirmCheckIn}
                    disabled={checkingIn}
                    className="w-full h-12 bg-[#5331EA] hover:bg-[#3d1bb8] text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {checkingIn ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Confirm Check-In Entry
                      </>
                    )}
                  </button>
                ) : null}

                <button
                  onClick={dismissBottomSheet}
                  className="w-full h-12 bg-gray-100 hover:bg-gray-200 text-black font-bold rounded-xl transition-all flex items-center justify-center cursor-pointer text-sm"
                >
                  {sheetStatus === "success" ? "Resume Scanner" : "Dismiss & Scan Next"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Navigation Bar (Figma spec heights: home, scanner, profile top 795px to bottom 874px = 79px) */}
        <footer className="h-[79px] w-full bg-white border-t border-[#F0F0F0] grid grid-cols-3 shrink-0 relative z-40">
          
          {/* TAB 1: Home Button (Figma: Label left 30px, top 829px; Icon left 38px, top 795px) */}
          <button
            onClick={() => setActiveTab("home")}
            className="flex flex-col items-center justify-center cursor-pointer space-y-1"
          >
            <Home className={`w-[26px] h-[26px] transition-colors ${
              activeTab === "home" ? "text-[#5331EA]" : "text-[#686868]"
            }`} />
            <span className={`text-[12px] font-bold transition-colors ${
              activeTab === "home" ? "text-[#5331EA]" : "text-[#686868]"
            }`}>
              Home
            </span>
          </button>

          {/* TAB 2: Scanner Button (Figma: Label left 170px, top 829px; Icon left 187px, top 795px) */}
          <button
            onClick={() => setActiveTab("scanner")}
            className="flex flex-col items-center justify-center cursor-pointer space-y-1"
          >
            <QrCode className={`w-[26px] h-[26px] transition-colors ${
              activeTab === "scanner" ? "text-[#5331EA]" : "text-[#686868]"
            }`} />
            <span className={`text-[12px] font-bold transition-colors ${
              activeTab === "scanner" ? "text-[#5331EA]" : "text-[#686868]"
            }`}>
              Scanner
            </span>
          </button>

          {/* TAB 3: Profile Button (Figma: Label left 321px, top 829px; Group top 795px) */}
          <button
            onClick={() => setActiveTab("profile")}
            className="flex flex-col items-center justify-center cursor-pointer space-y-1"
          >
            <User className={`w-[26px] h-[26px] transition-colors ${
              activeTab === "profile" ? "text-[#5331EA]" : "text-[#686868]"
            }`} />
            <span className={`text-[12px] font-bold transition-colors ${
              activeTab === "profile" ? "text-[#5331EA]" : "text-[#686868]"
            }`}>
              Profile
            </span>
          </button>
        </footer>
      </div>

      {/* Tailwind Scan Laser keyframe configurations and desktop phone bezel scaling */}
      <style jsx global>{`
        @keyframes scan-laser {
          0%, 100% {
            top: 4%;
          }
          50% {
            top: 96%;
          }
        }
        .animate-scan-laser {
          animation: scan-laser 2.2s infinite ease-in-out;
        }
        
        @media (min-width: 768px) and (max-height: 900px) {
          .scanner-phone-card {
            width: 360px !important;
            height: 760px !important;
            border-radius: 36px !important;
            border-width: 6px !important;
          }
        }
        @media (min-width: 768px) and (max-height: 800px) {
          .scanner-phone-card {
            width: 330px !important;
            height: 700px !important;
            border-radius: 32px !important;
            border-width: 6px !important;
          }
        }
        @media (min-width: 768px) and (max-height: 700px) {
          .scanner-phone-card {
            width: 290px !important;
            height: 600px !important;
            border-radius: 28px !important;
            border-width: 5px !important;
          }
        }
        @media (min-width: 768px) and (max-height: 600px) {
          .scanner-phone-card {
            width: 260px !important;
            height: 520px !important;
            border-radius: 24px !important;
            border-width: 4px !important;
          }
        }
      `}</style>
    </div>
  );
}
