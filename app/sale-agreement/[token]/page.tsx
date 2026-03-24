import { Card, CardContent } from "@/components/ui/card"

// Sale agreement feature disabled — DB columns not yet created
export default function SaleAgreementPage() {
  return (
    <div className="flex min-h-screen-safe items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-3">
          <h2 className="text-xl font-semibold">Not Available</h2>
          <p className="text-muted-foreground text-sm">
            The sale agreement feature is not yet available. Please contact Direct Auto Wholesale directly.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
