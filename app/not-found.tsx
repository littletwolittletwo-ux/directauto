import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
      <h2 className="text-2xl font-bold text-gray-900">Page Not Found</h2>
      <p className="mt-2 text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Link
        href="/"
        className="mt-4 text-sm text-blue-600 hover:underline"
      >
        Go back home
      </Link>
    </div>
  )
}
