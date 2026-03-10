import { prisma } from '@/lib/prisma'
import Image from 'next/image'
import MultiStepForm from '@/components/public-form/MultiStepForm'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface TokenPageProps {
  params: Promise<{ token: string }>
}

export default async function TokenSubmitPage({ params }: TokenPageProps) {
  const { token } = await params

  const submissionToken = await prisma.submissionToken.findUnique({
    where: { token },
  })

  const isInvalid =
    !submissionToken ||
    submissionToken.used ||
    submissionToken.expiresAt < new Date()

  if (isInvalid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center text-center p-8 space-y-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-foreground">
              This link has expired
            </h1>
            <p className="text-sm text-muted-foreground">
              The submission link you followed is no longer valid. It may have
              already been used or has passed its expiration date.
            </p>
            <p className="text-sm text-muted-foreground">
              Contact the dealership for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const settings = await prisma.settings.findUnique({
    where: { id: 'singleton' },
  })

  const dealershipName = settings?.dealershipName || 'Direct Auto Wholesale'
  const logoPath = settings?.logoPath || null
  const primaryColor = settings?.primaryColor || '#1e40af'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 pt-8 sm:pt-12">
        {/* Dealership Branding */}
        <div className="mb-8 flex flex-col items-center gap-3">
          {logoPath && (
            <Image
              src={logoPath}
              alt={dealershipName}
              width={160}
              height={60}
              className="h-14 w-auto object-contain"
              priority
            />
          )}
          <h1
            className="text-2xl font-bold"
            style={{ color: primaryColor }}
          >
            {dealershipName}
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            Vehicle Seller Submission Form
          </p>
        </div>

        {/* Multi-Step Form with prefill */}
        <MultiStepForm
          prefillVin={submissionToken.vehicleVin || undefined}
          tokenId={submissionToken.id}
        />
      </div>
    </div>
  )
}
