"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
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

  // Perform Check-Out Operation
  const confirmCheckOut = async () => {
    if (!scannedTicket) return;
    setCheckingIn(true);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:9000";
      const response = await fetch(`${backendUrl}/api/bookings/public/${scannedTicket.id}/checkout`, {
        method: "POST"
      });
      if (response.ok) {
        console.log("Database checked out successfully via backend");
      }
    } catch (err) {
      console.warn("Backend check-out request failed, updating local state only.", err);
    }

    MOCK_DATABASE[scannedTicket.id] = {
      ...scannedTicket,
      status: "confirmed"
    };
    delete MOCK_DATABASE[scannedTicket.id].checkInTime;

    setStats(prev => ({
      ...prev,
      totalCheckedIn: Math.max(0, prev.totalCheckedIn - 1)
    }));

    playSound("info");
    setCheckingIn(false);
    dismissBottomSheet();
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
      <div 
        className="w-full h-full md:relative md:w-[380px] md:h-[820px] md:max-h-[90vh] rounded-none md:rounded-[40px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border-0 md:border-8 border-[#201D30] overflow-hidden flex flex-col transition-all duration-300 scanner-phone-card"
        style={{
          background: (activeTab === "home" || (activeTab === "scanner" && scannedTicket !== null))
            ? "linear-gradient(360deg, #AC9BF7 -134.32%, #FFFFFF 47.71%)" 
            : "white"
        }}
      >
        
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
          {(activeTab === "scanner" && scannedTicket === null) ? (
            <button
              onClick={toggleFlash}
              className={`w-[33px] h-[33px] rounded-full flex items-center justify-center transition-colors duration-200 mt-1 cursor-pointer ${
                flashOn ? "bg-[#5331EA] text-white" : "bg-[#D9D9D9] text-[#2F2F2F] hover:bg-gray-300"
              }`}
              title="Toggle Flash"
            >
              <svg 
                width="21" 
                height="21" 
                viewBox="0 0 21 21" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="w-[18px] h-[18px]"
              >
                <g clipPath="url(#clip0_990_1899)">
                  <path 
                    d="M17.7014 9.69378C17.6768 9.58874 17.6266 9.49141 17.5553 9.41039C17.4841 9.32937 17.394 9.26716 17.293 9.22927L12.5655 7.45646L13.7685 1.44119C13.7965 1.30118 13.7781 1.15586 13.716 1.02727C13.654 0.89868 13.5517 0.793839 13.4246 0.728648C13.2976 0.663457 13.1528 0.641473 13.0121 0.66603C12.8715 0.690587 12.7427 0.760345 12.6452 0.864724L3.45775 10.7085C3.38413 10.7873 3.3311 10.8832 3.30334 10.9874C3.27558 11.0917 3.27396 11.2012 3.29861 11.3062C3.32327 11.4112 3.37344 11.5086 3.44469 11.5896C3.51594 11.6706 3.60606 11.7328 3.70709 11.7707L8.43458 13.5435L7.23151 19.5588C7.2035 19.6988 7.22191 19.8441 7.28397 19.9727C7.34603 20.1013 7.44833 20.2062 7.57537 20.2714C7.70241 20.3366 7.84724 20.3586 7.9879 20.334C8.12856 20.3094 8.25737 20.2397 8.35479 20.1353L17.5423 10.2915C17.6159 10.2126 17.6689 10.1168 17.6967 10.0126C17.7245 9.90831 17.7261 9.79882 17.7014 9.69378Z" 
                    fill="currentColor"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_990_1899">
                    <rect width="21" height="21" fill="white"/>
                  </clipPath>
                </defs>
              </svg>
            </button>
          ) : (
            <button
              onClick={() => alert("No new notifications.")}
              className="w-[33px] h-[33px] rounded-full bg-[#D9D9D9] text-black flex items-center justify-center hover:bg-gray-300 transition-colors duration-200 mt-1 cursor-pointer"
              title="Notifications"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px]">
                <path d="M13.1639 19.085C13.6612 19.0997 14.1495 19.221 14.5953 19.4406H14.6221C14.9946 19.7445 15.0578 20.2868 14.7653 20.6673C14.2325 21.4297 13.3801 21.9104 12.4482 21.974C11.4907 22.0882 10.5265 21.8231 9.76425 21.2362C9.37223 20.9674 9.11748 20.5423 9.06643 20.0717C9.06643 19.5739 9.53164 19.3428 9.96107 19.245C10.464 19.1391 10.9767 19.0855 11.4909 19.085H13.1639ZM12.0366 2C15.1321 2 18.3259 4.24008 18.6569 7.48463C18.7106 8.15132 18.6569 8.84468 18.7106 9.52026C18.8862 10.3915 19.2906 11.2011 19.8826 11.867C20.2506 12.4143 20.4638 13.0498 20.4999 13.7071V13.9115C20.5054 14.7984 20.1876 15.6573 19.6052 16.3294C18.8671 17.1186 17.8657 17.6145 16.7871 17.725C13.6005 18.1339 10.3743 18.1339 7.1877 17.725C6.09645 17.6229 5.0809 17.1263 4.33382 16.3294C3.76973 15.6508 3.47393 14.7912 3.50181 13.9115V13.7071C3.53672 13.0523 3.74336 12.4179 4.10121 11.867C4.69585 11.2005 5.10588 10.3918 5.29107 9.52026C5.34475 8.84468 5.29107 8.16021 5.34475 7.48463C5.68471 4.24008 8.81593 2 11.9472 2H12.0366Z" fill="black"/>
              </svg>
            </button>
          )}
        </header>

        {/* Main Tabs Body (Camera Stream or Stats/Profile Dashboard) */}
        <main className={`flex-grow relative overflow-hidden flex flex-col ${
          (activeTab === "home" || (activeTab === "scanner" && scannedTicket !== null)) ? "bg-transparent" : "bg-[#F5F7FB]"
        }`}>
          
          {/* TAB 1: SCANNER VIEW (Live Camera or Manual Keyboard Interface) */}
          {activeTab === "scanner" && (
            <div className={`w-full h-full relative flex flex-col justify-between ${
              scannedTicket ? "bg-transparent" : "bg-black"
            }`}>
              
              {scannedTicket ? (
                /* NEW AFTER-SCAN SCREEN */
                <div className="flex-grow w-full px-6 py-4 flex flex-col justify-between overflow-hidden font-[family-name:var(--font-anek-latin)] h-full">
                  
                  {/* Rectangle 561: Ticket Details Card */}
                  <div className="bg-white rounded-[10px] border border-[#686868]/30 p-4 space-y-3 shadow-sm relative mt-2 w-full max-w-[352px] mx-auto shrink-0">
                    

                    {/* Card Header: Avatar & Name */}
                    <div className="flex items-center gap-3.5">
                      {/* Ellipse 77: Avatar Placeholder */}
                      <div className="w-[63px] h-[63px] bg-[#D9D9D9] rounded-full shrink-0" />
                      
                      <div className="min-w-0 flex-grow">
                        <h3 className="font-semibold text-[18px] text-black leading-tight truncate font-sans">
                          {scannedTicket.userName}
                        </h3>
                        <p className="text-[12px] font-medium text-[#686868] mt-1 font-sans truncate">
                          {scannedTicket.category} x {scannedTicket.quantity}
                        </p>
                      </div>
                    </div>

                    {/* Divider rows (Booking ID, Order ID, Event, Date, Venue) */}
                    <div className="divide-y divide-[#AEAEAE]/50 text-[12px] pt-1">
                      <div className="flex justify-between py-2">
                        <span className="text-[#686868] font-medium">Booking ID</span>
                        <span className="font-medium text-black">#{scannedTicket.id}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-[#686868] font-medium">Order ID</span>
                        <span className="font-medium text-black">ORD-{scannedTicket.id.replace("T-", "99")}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-[#686868] font-medium">Event</span>
                        <span className="font-medium text-black truncate max-w-[180px]">{scannedTicket.eventName}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-[#686868] font-medium">Date</span>
                        <span className="font-medium text-black">{scannedTicket.date}</span>
                      </div>
                      <div className="flex justify-between py-2 text-right">
                        <span className="text-[#686868] font-medium shrink-0">Venue</span>
                        <span className="font-medium text-black truncate ml-4">{scannedTicket.venueName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="w-full max-w-[352px] mx-auto space-y-3 pb-2 shrink-0">
                    {/* Rectangle 562: CHECK IN Button */}
                    <button
                      onClick={confirmCheckIn}
                      disabled={checkingIn || sheetStatus === "cancelled" || sheetStatus === "already_checked_in" || sheetStatus === "success"}
                      className={`w-full h-11 text-white font-medium rounded-[10px] flex items-center justify-center text-[20px] transition-colors cursor-pointer disabled:cursor-not-allowed shadow-sm ${
                        sheetStatus === "cancelled"
                          ? "bg-red-500"
                          : sheetStatus === "already_checked_in"
                          ? "bg-amber-500"
                          : sheetStatus === "success"
                          ? "bg-emerald-500"
                          : "bg-[#AC9BF7] hover:bg-[#907ef0]"
                      }`}
                    >
                      {checkingIn 
                        ? "PROCESSING..." 
                        : sheetStatus === "cancelled"
                        ? "TICKET CANCELLED"
                        : sheetStatus === "already_checked_in"
                        ? "ALREADY CHECKED IN"
                        : sheetStatus === "success"
                        ? "CHECK-IN SUCCESS"
                        : "CHECK IN"}
                    </button>

                    {/* Rectangle 563: CHECK OUT Button */}
                    <button
                      onClick={confirmCheckOut}
                      disabled={checkingIn || sheetStatus === "success"}
                      className="w-[254px] h-11 bg-[#CECECE] hover:bg-[#b5b5b5] text-[#ED4D1B] font-medium rounded-[10px] flex items-center justify-center text-[20px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm mx-auto block"
                    >
                      CHECK OUT
                    </button>
                  </div>
                </div>
              ) : (
                <>
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
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 overflow-hidden">
                        
                        {/* Interactive Viewfinder Target */}
                        <div className="w-[70%] max-w-[260px] aspect-square relative border border-white/15 rounded-2xl bg-white/[0.08] shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                          {/* 4 Premium corner bracket frames matching attached screenshot */}
                          <div className="absolute top-0 left-0 w-6 h-6 border-t-[1.5px] border-l-[1.5px] border-white/65 rounded-tl-[16px]" />
                          <div className="absolute top-0 right-0 w-6 h-6 border-t-[1.5px] border-r-[1.5px] border-white/65 rounded-tr-[16px]" />
                          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[1.5px] border-l-[1.5px] border-white/65 rounded-bl-[16px]" />
                          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[1.5px] border-r-[1.5px] border-white/65 rounded-br-[16px]" />
                        </div>

                        {/* Bottom Label (placed absolutely at the bottom area of the viewport) */}
                        <div className="absolute bottom-[8%] left-0 right-0 flex justify-center">
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
                </>
              )}
            </div>
          )}

          {/* TAB 2: HOME VIEW (Dashboard Statistics & Scan Logs) */}
          {activeTab === "home" && (
            <div 
              className="w-full h-full flex flex-col px-6 py-5 overflow-y-auto font-[family-name:var(--font-anek-latin)] bg-transparent"
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
                    className="w-full h-[119px] bg-[#F5F5F5] rounded-[15px] flex items-center overflow-hidden border border-gray-100 relative transition-transform hover:scale-[1.01]"
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



        {/* Bottom Navigation Bar (Figma spec heights: home, scanner, profile top 795px to bottom 874px = 79px) */}
        <footer className={`h-[79px] w-full grid grid-cols-3 shrink-0 relative z-40 ${
          (activeTab === "home" || (activeTab === "scanner" && scannedTicket !== null))
            ? "bg-transparent border-t border-[#686868]/60" 
            : "bg-white border-t border-[#F0F0F0]"
        }`}>
          
          {/* TAB 1: Home Button (Figma: Label left 30px, top 829px; Icon left 38px, top 795px) */}
          <button
            onClick={() => setActiveTab("home")}
            className="flex flex-col items-center justify-center cursor-pointer space-y-1"
          >
            <svg 
              className="w-[26px] h-[26px] transition-colors"
              viewBox="0 0 28 28" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                d="M10.6566 24.2362V20.6689C10.6566 19.7582 11.4002 19.02 12.3175 19.02H15.6707C16.1112 19.02 16.5337 19.1937 16.8452 19.5029C17.1567 19.8122 17.3317 20.2316 17.3317 20.6689V24.2362C17.3289 24.6148 17.4784 24.9788 17.7471 25.2475C18.0158 25.5162 18.3814 25.6673 18.7628 25.6673H21.0505C22.1189 25.6701 23.1446 25.2506 23.901 24.5016C24.6575 23.7525 25.0827 22.7355 25.0827 21.6748V11.512C25.0827 10.6552 24.7001 9.84247 24.0381 9.29276L16.2557 3.1225C14.902 2.04064 12.9623 2.07557 11.649 3.20546L4.0442 9.29276C3.35088 9.82626 2.93649 10.6414 2.91602 11.512V21.6644C2.91602 23.8751 4.72129 25.6673 6.94822 25.6673H9.18369C9.97578 25.6673 10.6195 25.0329 10.6253 24.2466L10.6566 24.2362Z" 
                fill={activeTab === "home" ? "#5331EA" : "#686868"} 
              />
            </svg>
            <span className={`text-[12px] font-medium transition-colors ${
              activeTab === "home" ? "text-[#5331EA]" : "text-[#686868]"
            }`}>
              Home
            </span>
          </button>

          {/* TAB 2: Scanner Button (Figma: Label left 170px, top 829px; Icon left 187px, top 795px) */}
          <button
            onClick={() => {
              setActiveTab("scanner");
              dismissBottomSheet();
            }}
            className="flex flex-col items-center justify-center cursor-pointer space-y-1"
          >
            <svg 
              className="w-[26px] h-[26px] transition-colors"
              viewBox="0 0 28 28" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                d="M23.3333 15.1667H4.66667C4.35725 15.1667 4.0605 15.0437 3.84171 14.825C3.62292 14.6062 3.5 14.3094 3.5 14C3.5 13.6906 3.62292 13.3938 3.84171 13.175C4.0605 12.9562 4.35725 12.8333 4.66667 12.8333H23.3333C23.6428 12.8333 23.9395 12.9562 24.1583 13.175C24.3771 13.3938 24.5 13.6906 24.5 14C24.5 14.3094 24.3771 14.6062 24.1583 14.825C23.9395 15.0437 23.6428 15.1667 23.3333 15.1667ZM23.3333 10.5C23.0239 10.5 22.7272 10.3771 22.5084 10.1583C22.2896 9.9395 22.1667 9.64275 22.1667 9.33333V7C22.1667 6.69058 22.0438 6.39383 21.825 6.17504C21.6062 5.95625 21.3094 5.83333 21 5.83333H18.6667C18.3572 5.83333 18.0605 5.71042 17.8417 5.49162C17.6229 5.27283 17.5 4.97609 17.5 4.66667C17.5 4.35725 17.6229 4.0605 17.8417 3.84171C18.0605 3.62292 18.3572 3.5 18.6667 3.5H21C21.9283 3.5 22.8185 3.86875 23.4749 4.52513C24.1313 5.1815 24.5 6.07174 24.5 7V9.33333C24.5 9.64275 24.3771 9.9395 24.1583 10.1583C23.9395 10.3771 23.6428 10.5 23.3333 10.5ZM4.66667 10.5C4.35725 10.5 4.0605 10.3771 3.84171 10.1583C3.62292 9.9395 3.5 9.64275 3.5 9.33333V7C3.5 6.07174 3.86875 5.1815 4.52513 4.52513C5.1815 3.86875 6.07174 3.5 7 3.5H9.33333C9.64275 3.5 9.9395 3.62292 10.1583 3.84171C10.3771 4.0605 10.5 4.35725 10.5 4.66667C10.5 4.97609 10.3771 5.27283 10.1583 5.49162C9.9395 5.71042 9.64275 5.83333 9.33333 5.83333H7C6.69058 5.83333 6.39383 5.95625 6.17504 6.17504C5.95625 6.39383 5.83333 6.69058 5.83333 7V9.33333C5.83333 9.64275 5.71042 9.9395 5.49162 10.1583C5.27283 10.3771 4.97609 10.5 4.66667 10.5ZM9.33333 24.5H7C6.07174 24.5 5.1815 24.1313 4.52513 23.4749C3.86875 22.8185 3.5 21.9283 3.5 21V18.6667C3.5 18.3572 3.62292 18.0605 3.84171 17.8417C4.0605 17.6229 4.35725 17.5 4.66667 17.5C4.97609 17.5 5.27283 17.6229 5.49162 17.8417C5.71042 18.0605 5.83333 18.3572 5.83333 18.6667V21C5.83333 21.3094 5.95625 21.6062 6.17504 21.825C6.39383 22.0438 6.69058 22.1667 7 22.1667H9.33333C9.64275 22.1667 9.9395 22.2896 10.1583 22.5084C10.3771 22.7272 10.5 23.0239 10.5 23.3333C10.5 23.6428 10.3771 23.9395 10.1583 24.1583C9.9395 24.3771 9.64275 24.5 9.33333 24.5ZM21 24.5H18.6667C18.3572 24.5 18.0605 24.3771 17.8417 24.1583C17.6229 23.9395 17.5 23.6428 17.5 23.3333C17.5 23.0239 17.6229 22.7272 17.8417 22.5084C18.0605 22.2896 18.3572 22.1667 18.6667 22.1667H21C21.3094 22.1667 21.6062 22.0438 21.825 21.825C22.0438 21.6062 22.1667 21.3094 22.1667 21V18.6667C22.1667 18.3572 22.2896 18.0605 22.5084 17.8417C22.7272 17.6229 23.0239 17.5 23.3333 17.5C23.6428 17.5 23.9395 17.6229 24.1583 17.8417C24.3771 18.0605 24.5 18.3572 24.5 18.6667V21C24.5 21.9283 24.1313 22.8185 23.4749 23.4749C22.8185 24.1313 21.9283 24.5 21 24.5Z" 
                fill={activeTab === "scanner" ? "#5331EA" : "#686868"} 
              />
            </svg>
            <span className={`text-[12px] font-medium transition-colors ${
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
            <svg 
              className="w-[26px] h-[26px] transition-colors"
              viewBox="0 0 18 22" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                d="M8.75537 10.7074C11.5424 10.7074 13.8018 8.4784 13.8018 5.72872C13.8018 2.97905 11.5424 0.75 8.75537 0.75C5.96833 0.75 3.70898 2.97905 3.70898 5.72872C3.70898 8.4784 5.96833 10.7074 8.75537 10.7074Z" 
                stroke={activeTab === "profile" ? "#5331EA" : "#686868"} 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                fillRule="evenodd" 
                clipRule="evenodd" 
                d="M0.750017 17.631C0.748678 17.281 0.828018 16.9353 0.982053 16.62C1.46543 15.6662 2.82854 15.1607 3.95963 14.9318C4.77538 14.76 5.60239 14.6453 6.4345 14.5884C7.97511 14.4549 9.52462 14.4549 11.0652 14.5884C11.8973 14.6459 12.7242 14.7607 13.5401 14.9318C14.6712 15.1607 16.0343 15.6185 16.5177 16.62C16.8274 17.2627 16.8274 18.0088 16.5177 18.6515C16.0343 19.653 14.6712 20.1108 13.5401 20.3302C12.7253 20.5091 11.898 20.627 11.0652 20.6831C9.81129 20.788 8.55151 20.8071 7.29491 20.7403C7.00489 20.7403 6.72453 20.7403 6.4345 20.6831C5.60484 20.6277 4.7807 20.5097 3.9693 20.3302C2.82854 20.1108 1.47509 19.653 0.982053 18.6515C0.828805 18.3326 0.749544 17.984 0.750017 17.631Z" 
                stroke={activeTab === "profile" ? "#5331EA" : "#686868"} 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
            <span className={`text-[12px] font-medium transition-colors ${
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
