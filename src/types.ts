export type Sport = {
  id: number
  name: string
  monthly_fee_minor: number
}

export type Athlete = {
  id: number
  surname: string
  given_name: string
  birth_date: string | null
  sex: string | null
  address: string | null
  phone: string | null
  school_level: string | null
  guardian_name: string | null
  guardian_phone: string | null
  created_at: string
  active: number
  active_registrations: number
  sports: string | null
}

export type Registration = {
  id: number
  athlete_id: number
  sport_id: number
  judo_category: '100 DHS' | '120 DHS' | null
  starts_on: string
  ends_on: string | null
  monthly_fee_minor: number
  status: 'active' | 'ended'
  surname: string
  given_name: string
  athlete_active: number
  sport_name: string
}

export type PaymentMonth = {
  year: number
  month: number
  amount_minor: number
  is_void: number
}

export type Payment = {
  id: number
  receipt_no: string
  athlete_id: number
  registration_id: number
  paid_at: string
  amount_minor: number
  payment_method: string
  status: 'validated' | 'cancelled'
  cancellation_reason: string | null
  cancelled_at: string | null
  surname: string
  given_name: string
  phone?: string | null
  sport_name: string
  registration_fee?: number
  months: PaymentMonth[] | string | null
}

export type MonthStatus = {
  month: number
  year: number
  status: 'paid' | 'unpaid' | 'not-applicable'
  amountMinor: number
}

export type GymSettings = {
  gymName: string
  address: string
  phone: string
  email: string
  currency: string
}

export type DashboardSummary = {
  athletes_total: number
  athletes_active: number
  disciplineCounts: Array<{ id: number; name: string; athletes: number }>
  revenue: number
  paymentCount: number
  overdue: number
  bySport: Array<{ name: string; amount: number }>
  recentPayments: Payment[]
}

declare global {
  interface Window {
    gym: {
      athletes: {
        list: (filters?: { search?: string; sportId?: number; active?: boolean }) => Promise<Athlete[]>
        get: (id: number) => Promise<Athlete & { registrations: Registration[]; payments: Payment[] }>
        create: (input: AthleteInput & {
          sportId?: number
          startsOn?: string
          judoCategory?: '100 DHS' | '120 DHS'
        }) => Promise<{ id: number }>
        update: (input: AthleteInput & { id: number; active: boolean }) => Promise<{ id: number }>
      }
      sports: {
        list: () => Promise<Sport[]>
        updateFee: (input: { id: number; monthlyFeeMinor: number }) => Promise<{ id: number }>
        updateFees: (inputs: Array<{ id: number; monthlyFeeMinor: number }>) => Promise<Sport[]>
      }
      registrations: {
        list: (filters?: { sportId?: number; athleteId?: number; status?: string }) => Promise<Registration[]>
        create: (input: {
          athleteId: number
          sportId: number
          startsOn: string
          judoCategory?: '100 DHS' | '120 DHS'
        }) => Promise<{ id: number }>
        end: (input: { id: number; endsOn: string }) => Promise<{ id: number }>
      }
      payments: {
        monthStatus: (input: { registrationId: number; year: number }) => Promise<MonthStatus[]>
        create: (input: { registrationId: number; year: number; months: number[]; paymentMethod: string }) => Promise<Payment>
        list: (filters?: { search?: string; sportId?: number; from?: string; to?: string }) => Promise<Payment[]>
        get: (id: number) => Promise<Payment>
        cancel: (input: { id: number; reason: string }) => Promise<Payment>
      }
      dashboard: {
        summary: (input: { year: number; month: number }) => Promise<DashboardSummary>
      }
      reports: {
        revenue: (filters: { from: string; to: string; sportId?: number }) => Promise<Array<{
          date: string; sport: string; payments: number; amount: number
        }>>
        byPaidMonth: (filters: { year: number; sportId?: number }) => Promise<Array<{
          year: number; month: number; sport: string; payments: number; amount: number
        }>>
        overdue: () => Promise<Array<{
          athlete_id: number; surname: string; given_name: string; registration_id: number
          sport_name: string; monthly_fee_minor: number; months_due: Array<{ year: number; month: number }>
          outstanding_minor: number
        }>>
      }
      settings: {
        get: () => Promise<GymSettings>
        update: (input: Partial<GymSettings>) => Promise<GymSettings>
      }
      receipts: { print: () => Promise<{ success: boolean }> }
      backups: {
        create: () => Promise<{ canceled: boolean; path?: string }>
        restore: () => Promise<{ canceled: boolean }>
      }
    }
  }
}

export type AthleteInput = {
  surname: string
  givenName: string
  birthDate: string
  sex: string
  address: string
  phone: string
  schoolLevel: string
  guardianName: string
  guardianPhone: string
}
