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
