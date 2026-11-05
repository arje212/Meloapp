import { base44 } from '@/api/base44Client';
import { unlockAchievement } from '@/lib/achievements';

const DOWNPAYMENT_RATE = 0.3;

/**
 * Create a booking with all required fields consistently.
 * Use this in AgencyDetail AND TripBookingSection instead of
 * calling base44.entities.Booking.create() directly.
 *
 * @param {Object} params
 * @param {Object} params.pkg           - TourPackage object
 * @param {Object} params.agency        - Agency object  (id, name, owner_email)
 * @param {Object} params.user          - AuthContext user
 * @param {Object} params.form          - booking form values:
 *   { travel_date, num_pax, pickup_location, dropoff_location,
 *     meetup_location, notes, payment_method, contact_phone,
 *     date_mode, use_downpayment }
 * @param {number} params.commissionRate  - e.g. 10
 * @returns {Promise<Object>} created booking record
 */
export async function createBooking({ pkg, agency, user, form = {}, commissionRate = 10, extra = {} }) {
  const numPax = Number(form.num_pax);
  const unitPrice = Number(pkg?.price);
  const rate = Number(commissionRate);

  if (!pkg?.id || !agency?.id || !user?.email) {
    throw new Error('Booking requires a package, agency, and signed-in user.');
  }
  if (!Number.isSafeInteger(numPax) || numPax < 1) {
    throw new Error('Number of participants must be a positive whole number.');
  }
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error('Package price must be a valid non-negative amount.');
  }
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new Error('Commission rate must be between 0 and 100.');
  }

  const totalPrice  = unitPrice * numPax;
  const useDownpayment = form.use_downpayment !== false;
  const downpayment = useDownpayment ? Math.round(totalPrice * DOWNPAYMENT_RATE) : totalPrice;
  const balance     = totalPrice - downpayment;
  const platformFee = Math.round(totalPrice * rate / 100);
  const agencyEarnings = totalPrice - platformFee;

  const booking = await base44.entities.Booking.create({
    // Optional caller-specific fields are allowed, but never override trusted booking values.
    ...extra,

    // package / agency identifiers
    package_id:    pkg.id,
    agency_id:     agency.id,
    agency_name:   agency.name,
    package_title: pkg.title,

    // user
    user_email:    user.email,
    user_name:     user.full_name,

    // dates & pax
    travel_date:   form.travel_date || undefined,
    date_mode:     form.date_mode   || 'scheduled',
    num_pax:       numPax,

    // locations
    pickup_location:   form.pickup_location   || undefined,
    dropoff_location:  form.dropoff_location  || undefined,
    meetup_location:   form.meetup_location   || form.pickup_location || undefined,

    // pricing
    total_price:        totalPrice,
    downpayment_amount: downpayment,
    balance_amount:     balance,
    use_downpayment:    useDownpayment,

    // commission
    platform_fee:      platformFee,
    agency_earnings:   agencyEarnings,
    commission_rate:   rate,

    // payment / misc
    payment_method:  form.payment_method || 'gcash',
    contact_phone:   form.contact_phone  || undefined,
    notes:           form.notes          || undefined,

    // status
    status:             'pending',
    commission_paid:    false,
    commission_confirmed: false,

  });

  // fire-and-forget achievement
  unlockAchievement(user.email, user.full_name, 'first_booking').catch(() => {});

  return booking;
}
