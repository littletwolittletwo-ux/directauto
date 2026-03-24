"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

type InAppBrowser = "instagram" | "facebook" | "tiktok" | "snapchat" | null

function detectInAppBrowser(ua: string): InAppBrowser {
  if (ua.includes("Instagram")) return "instagram"
  if (ua.includes("FBAN") || ua.includes("FBAV")) return "facebook"
  if (ua.includes("musical_ly") || ua.includes("BytedanceWebview") || ua.includes("TikTok")) return "tiktok"
  if (ua.includes("Snapchat")) return "snapchat"
  return null
}

function isIOS(ua: string): boolean {
  return /iPhone|iPad|iPod/.test(ua)
}

const APP_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  snapchat: "Snapchat",
}

export function InAppBrowserGate({ children }: { children: React.ReactNode }) {
  const [browser, setBrowser] = useState<InAppBrowser>(null)
  const [ios, setIos] = useState(false)
  const [checked, setChecked] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent || ""
    setBrowser(detectInAppBrowser(ua))
    setIos(isIOS(ua))
    setChecked(true)
  }, [])

  // Don't render anything until we've checked (avoid flash)
  if (!checked) return null

  // Not an in-app browser — render children normally
  if (!browser) return <>{children}</>

  const appName = APP_LABELS[browser] || "this app"
  const currentUrl = typeof window !== "undefined" ? window.location.href : ""

  function handleOpenExternal() {
    const url = window.location.href

    if (isIOS(navigator.userAgent || "")) {
      // iOS: Try x-safari-https scheme (works on some iOS versions)
      // then fall back to setting location which can trigger external browser
      const safariUrl = url.replace(/^https?:\/\//, "x-safari-https://")
      const opened = window.open(safariUrl, "_blank")
      if (!opened) {
        window.location.href = url
      }
    } else {
      // Android: Use intent scheme to open in Chrome
      const intentUrl = `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`
      window.location.href = intentUrl
    }
  }

  function handleCopyLink() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    } else {
      // Fallback for older browsers
      const textarea = document.createElement("textarea")
      textarea.value = currentUrl
      textarea.style.position = "fixed"
      textarea.style.opacity = "0"
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center bg-white overflow-y-auto">
      {/* Header */}
      <div className="w-full bg-[#1e40af] text-white text-center py-5 shrink-0">
        <Image
          src="/logo.png"
          alt="Direct Auto Wholesale"
          width={180}
          height={64}
          className="mx-auto object-contain max-h-[50px] w-auto"
          priority
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-md w-full text-center">
        {/* Warning icon */}
        <div className="mb-6 flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-amber-50">
          <svg
            className="h-10 w-10 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Open in {ios ? "Safari" : "Chrome"}
        </h1>

        <p className="text-sm text-gray-500 mb-6">
          The {appName} browser doesn&apos;t support file uploads and forms properly.
          Please open this link in your regular browser.
        </p>

        {/* Instructions */}
        <div className="w-full rounded-xl bg-gray-50 p-5 mb-6 text-left space-y-4">
          {ios ? (
            <>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                  1
                </span>
                <p className="text-sm text-gray-700">
                  Tap the{" "}
                  <strong className="inline-flex items-center">
                    <svg className="inline h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <circle cx="12" cy="5" r="1.5" fill="currentColor" />
                      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                      <circle cx="12" cy="19" r="1.5" fill="currentColor" />
                    </svg>
                  </strong>{" "}
                  or{" "}
                  <strong className="inline-flex items-center">
                    <svg className="inline h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
                      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
                    </svg>
                  </strong>{" "}
                  menu {browser === "instagram" ? "at the bottom" : "at the top right"}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                  2
                </span>
                <p className="text-sm text-gray-700">
                  Select <strong>&quot;Open in Safari&quot;</strong> or{" "}
                  <strong>&quot;Open in Browser&quot;</strong>
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                  1
                </span>
                <p className="text-sm text-gray-700">
                  Tap the{" "}
                  <strong className="inline-flex items-center">
                    <svg className="inline h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
                      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
                    </svg>
                  </strong>{" "}
                  menu at the top right
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                  2
                </span>
                <p className="text-sm text-gray-700">
                  Select <strong>&quot;Open in Chrome&quot;</strong> or{" "}
                  <strong>&quot;Open in browser&quot;</strong>
                </p>
              </div>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="w-full space-y-3">
          <button
            onClick={handleOpenExternal}
            className="w-full rounded-lg bg-blue-600 py-3.5 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 transition-colors min-h-[48px]"
          >
            Open in {ios ? "Safari" : "Chrome"}
          </button>

          <button
            onClick={handleCopyLink}
            className="w-full rounded-lg border border-gray-300 bg-white py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[48px]"
          >
            {copied ? "Link Copied!" : "Copy Link"}
          </button>

          <p className="text-xs text-gray-400 pt-1">
            Copy the link and paste it in {ios ? "Safari" : "Chrome"} if the button above
            doesn&apos;t work
          </p>
        </div>
      </div>
    </div>
  )
}
