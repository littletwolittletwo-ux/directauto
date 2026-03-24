import { InAppBrowserGate } from "@/components/InAppBrowserGate"

export const metadata = {
  other: {
    "format-detection": "telephone=no",
  },
}

export default function SignLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <InAppBrowserGate>{children}</InAppBrowserGate>
}
