import { supabase } from '@/integrations/supabase/client';
import { OrderStatus, Tap } from '@/types/database';

type TapReservation = {
  id: string;
  tap_id: string | null;
  delivery_date: string;
  expected_return_date: string | null;
  status: OrderStatus;
};

const RESERVED_ORDER_STATUSES: OrderStatus[] = ['agendado', 'em_andamento'];

function normalizeEndDate(startDate: string, endDate?: string | null) {
  return endDate && endDate >= startDate ? endDate : startDate;
}

export function dateRangesOverlap(
  requestedStart: string,
  requestedEnd: string,
  reservedStart: string,
  reservedEnd: string,
) {
  // Return date is treated as available again. Example: reserved 01-07 allows a new booking on 07.
  return reservedStart < requestedEnd && reservedEnd > requestedStart;
}

export function isTapReservedForPeriod(
  tapId: string,
  startDate: string,
  endDate: string,
  reservations: TapReservation[] = [],
  excludeOrderId?: string,
) {
  return reservations.some((reservation) => {
    if (reservation.id === excludeOrderId) return false;
    if (reservation.tap_id !== tapId) return false;

    const reservedStart = reservation.delivery_date;
    const reservedEnd = normalizeEndDate(reservedStart, reservation.expected_return_date);

    return dateRangesOverlap(startDate, endDate, reservedStart, reservedEnd);
  });
}

export function filterTapsAvailableForPeriod(
  taps: Tap[] = [],
  reservations: TapReservation[] = [],
  startDate?: string,
  endDate?: string | null,
  excludeOrderId?: string,
) {
  if (!startDate) {
    return taps.filter((tap) => tap.status !== 'manutencao');
  }

  const requestedEnd = normalizeEndDate(startDate, endDate);

  return taps.filter((tap) => {
    if (tap.status === 'manutencao') return false;

    return !isTapReservedForPeriod(
      tap.id,
      startDate,
      requestedEnd,
      reservations,
      excludeOrderId,
    );
  });
}

export async function assertTapAvailableForPeriod({
  tapId,
  startDate,
  endDate,
  excludeOrderId,
}: {
  tapId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  excludeOrderId?: string;
}) {
  if (!tapId || !startDate) return;

  const requestedEnd = normalizeEndDate(startDate, endDate);

  const { data, error } = await supabase
    .from('orders')
    .select('id, tap_id, delivery_date, expected_return_date, status')
    .eq('tap_id', tapId)
    .in('status', RESERVED_ORDER_STATUSES);

  if (error) throw error;

  const hasConflict = isTapReservedForPeriod(
    tapId,
    startDate,
    requestedEnd,
    (data || []) as TapReservation[],
    excludeOrderId,
  );

  if (hasConflict) {
    throw new Error('Esta chopeira ja esta reservada para o periodo selecionado.');
  }
}

