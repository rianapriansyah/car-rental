import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { supabase } from '../lib/supabase'
import { SERVICE_TYPE_LABELS } from '../constants/serviceTypes'
import type { TablesInsert } from '../types/database'
import type { CarServiceRow, ServiceIntervalDefaultRow, ServiceType } from '../types/service'

type ReminderLevel = 'overdue' | 'due_soon'

export type ServiceReminder = CarServiceRow & {
  warning_days: number
  reminder_level: ReminderLevel
}

function ymdToDate(ymd: string): Date {
  const [y = '0', m = '1', d = '1'] = ymd.split('-')
  return new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** First line of manual_note (LIKE-safe) — used to delete linked expense when service log is removed. */
export function serviceLogExpenseNotePrefix(serviceId: string): string {
  return `svc-expense:${serviceId}`
}

function buildServiceExpenseManualNote(row: CarServiceRow): string {
  const typeLabel = SERVICE_TYPE_LABELS[row.service_type as ServiceType] ?? row.service_type
  const lines = [
    serviceLogExpenseNotePrefix(row.id),
    `Operation Maintenance · ${typeLabel}`,
    row.vendor?.trim() ? `Vendor: ${row.vendor.trim()}` : null,
    row.description?.trim() ? `Detail: ${row.description.trim()}` : null,
    row.notes?.trim() ? `Notes: ${row.notes.trim()}` : null,
  ].filter(Boolean) as string[]
  return lines.join('\n')
}

export function useCarServices(carId: string | null) {
  const [services, setServices] = useState<CarServiceRow[]>([])
  const [reminders, setReminders] = useState<ServiceReminder[]>([])
  const [intervalDefaults, setIntervalDefaults] = useState<ServiceIntervalDefaultRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalDefaultsRef = useRef<ServiceIntervalDefaultRow[]>([])

  const intervalDefaultsByType = useMemo(() => {
    return new Map(intervalDefaults.map((row) => [row.service_type, row]))
  }, [intervalDefaults])

  const fetchIntervalDefaults = useCallback(async () => {
    const { data, error: qError } = await supabase
      .from('v2_service_interval_defaults')
      .select('service_type, default_interval_months, warning_days')
      .order('service_type')
    if (qError) throw qError
    const rows = (data ?? []) as ServiceIntervalDefaultRow[]
    setIntervalDefaults(rows)
    intervalDefaultsRef.current = rows
    return rows
  }, [])

  const fetchServices = useCallback(
    async (targetCarId?: string) => {
      const effectiveCarId = targetCarId ?? carId
      if (!effectiveCarId) return []
      const { data, error: qError } = await supabase
        .from('v2_car_services')
        .select('*')
        .eq('car_id', effectiveCarId)
        .order('service_date', { ascending: false })
      if (qError) throw qError
      const rows = (data ?? []) as CarServiceRow[]
      setServices(rows)
      return rows
    },
    [carId],
  )

  const fetchUpcomingReminders = useCallback(
    async (targetCarId?: string, defaultsOverride?: ServiceIntervalDefaultRow[]) => {
      const effectiveCarId = targetCarId ?? carId
      if (!effectiveCarId) return []
      const { data, error: qError } = await supabase
        .from('v2_car_services')
        .select('*')
        .eq('car_id', effectiveCarId)
        .not('next_due_date', 'is', null)
        .order('next_due_date', { ascending: true })
      if (qError) throw qError

      const defaultsRows =
        defaultsOverride ??
        (intervalDefaultsRef.current.length > 0
          ? intervalDefaultsRef.current
          : await fetchIntervalDefaults())
      const defaultsMap = new Map(defaultsRows.map((row) => [row.service_type, row.warning_days]))
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const rows = ((data ?? []) as CarServiceRow[])
        .flatMap((row) => {
          if (!row.next_due_date) return []
          const dueDate = ymdToDate(row.next_due_date)
          const warningDays = defaultsMap.get(row.service_type) ?? 14
          const warningLimit = addDays(today, warningDays)
          if (dueDate > warningLimit) return []
          const reminderLevel: ReminderLevel = dueDate < today ? 'overdue' : 'due_soon'
          return [{ ...row, warning_days: warningDays, reminder_level: reminderLevel }]
        })
        .sort((a, b) => (a.next_due_date ?? '').localeCompare(b.next_due_date ?? ''))

      setReminders(rows)
      return rows
    },
    [carId, fetchIntervalDefaults],
  )

  const addService = useCallback(
    async (payload: TablesInsert<'v2_car_services'>) => {
      const { data, error: qError } = await supabase
        .from('v2_car_services')
        .insert(payload)
        .select('*')
        .single()
      if (qError) throw qError
      const row = data as CarServiceRow

      const amount =
        row.cost != null && Number.isFinite(Number(row.cost)) ? Math.max(0, Number(row.cost)) : 0
      const recordedAt = dayjs(row.service_date).hour(12).minute(0).second(0).millisecond(0).toISOString()

      const { error: txError } = await supabase.from('v2_transactions').insert({
        car_id: row.car_id,
        rental_id: null,
        type: 'expense',
        category: 'maintenance',
        amount,
        auto_fee: false,
        manual_note: buildServiceExpenseManualNote(row),
        recorded_at: recordedAt,
      })

      if (txError) {
        await supabase.from('v2_car_services').delete().eq('id', row.id)
        throw txError
      }

      return row
    },
    [],
  )

  const deleteService = useCallback(async (id: string) => {
    const { data: svc, error: sError } = await supabase
      .from('v2_car_services')
      .select('car_id')
      .eq('id', id)
      .maybeSingle()
    if (sError) throw sError
    if (svc?.car_id) {
      const pattern = `${serviceLogExpenseNotePrefix(id)}%`
      const { error: txDelError } = await supabase
        .from('v2_transactions')
        .delete()
        .eq('car_id', svc.car_id)
        .like('manual_note', pattern)
      if (txDelError) throw txDelError
    }
    const { error: qError } = await supabase.from('v2_car_services').delete().eq('id', id)
    if (qError) throw qError
  }, [])

  const refresh = useCallback(async () => {
    if (!carId) return
    setLoading(true)
    setError(null)
    try {
      const defaultsRows = await fetchIntervalDefaults()
      await Promise.all([fetchServices(carId), fetchUpcomingReminders(carId, defaultsRows)])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data service.')
    } finally {
      setLoading(false)
    }
  }, [carId, fetchIntervalDefaults, fetchServices, fetchUpcomingReminders])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    services,
    reminders,
    intervalDefaults,
    intervalDefaultsByType,
    loading,
    error,
    fetchServices,
    addService,
    deleteService,
    fetchUpcomingReminders,
    fetchIntervalDefaults,
    refresh,
  }
}
