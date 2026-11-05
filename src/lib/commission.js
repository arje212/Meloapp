import { supabase } from '@/lib/supabase';
import { notifyUser } from '@/lib/notify';

// SINGLE SOURCE OF TRUTH for "agency commission has been paid and confirmed by admin":
//   booking.commission_confirmed === true  (status 'commission_confirmed')
// `commission_collected` (written by the old Collectibles screen) is only READ as a legacy value
// so rows marked there before this change still count as confirmed.
export const isCommissionConfirmed = (b) =>
  b?.commission_confirmed === true || b?.status === 'commission_confirmed' || b?.commission_collected === true;

/** The one patch every admin screen uses to confirm a commission. */
export const commissionConfirmPatch = () => ({
  status:                    'commission_confirmed',
  commission_confirmed:      true,
  commission_confirmed_date: new Date().toISOString(),
});

export async function notifyAgencyCommissionConfirmed({
  booking,
  agency,
  fromEmail,
  bookingCount = 1,
  totalFee,
}) {
  if (!booking?.agency_id && !agency?.id) {
    console.warn('Commission confirmation notification skipped: missing agency ID.');
    return;
  }

  let recipientAgency = agency;
  if (!recipientAgency?.owner_email) {
    const { data, error } = await supabase
      .from('agencies')
      .select('id, name, owner_email')
      .eq('id', booking?.agency_id || agency.id)
      .maybeSingle();
    if (error) {
      console.warn('Unable to find agency owner for commission notification:', error.message);
      return;
    }
    recipientAgency = data;
  }

  if (!recipientAgency?.owner_email) {
    console.warn('Commission confirmation notification skipped: agency owner email is missing.');
    return;
  }

  const fee = totalFee ?? booking?.platform_fee ?? booking?._fee ??
    Math.round(
      (Number(booking?.actual_total_price ?? booking?.total_price) || 0) *
      (Number(booking?.commission_rate ?? 10) / 100)
    );
  const isBulk = bookingCount > 1;
  const bookingLabel = isBulk
    ? `${bookingCount} completed bookings`
    : `"${booking?.package_title || 'your booking'}"`;

  await notifyUser({
    toEmail: recipientAgency.owner_email,
    fromEmail,
    title: 'Commission payment confirmed',
    message: `Admin confirmed receipt of ₱${Number(fee).toLocaleString()} commission for ${bookingLabel}.`,
    type: 'agency',
    link: '/agency-dashboard',
    icon: '💸',
  });
}
