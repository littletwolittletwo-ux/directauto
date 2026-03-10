import { prisma } from '@/lib/prisma'
import Image from 'next/image'
import MultiStepForm from '@/components/public-form/MultiStepForm'

export const dynamic = 'force-dynamic'

export default async function SubmitPage() {
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

        {/* Multi-Step Form */}
        <MultiStepForm />
      </div>
    </div>
  )
}
